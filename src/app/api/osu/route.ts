import { NextResponse } from 'next/server';
import { OSU_CLIENT_ID, OSU_CLIENT_SECRET, OSU_USERNAME } from '@/lib/constants';
import { kvGetWithStale, kvSetWithTimestamp } from '@/lib/server/kv-cache';
import { rateLimit } from '@/lib/server/rate-limit';
import type { OsuManiaData, OsuScore, OsuUser } from '@/lib/types';

const OSU_API_BASE = 'https://osu.ppy.sh/api/v2';
const OSU_TOKEN_URL = 'https://osu.ppy.sh/oauth/token';
const OSU_CACHE_TTL_MS = 2 * 60 * 1000;
const OSU_STALE_TTL_MS = 10 * 60 * 1000;
const OSU_CACHE_KEY = 'api:osu:mania:v1';
const OSU_RATE_LIMIT_WINDOW_MS = 60 * 1000;
const OSU_RATE_LIMIT_MAX_REQUESTS = 45;

// In-memory token cache
let cachedToken: { access_token: string; expires_at: number } | null = null;
let osuCache: { payload: OsuManiaData; cachedAt: number } | null = null;
let osuInFlight: Promise<OsuManiaData> | null = null;

class OsuApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
    public retryAfter?: number
  ) {
    super(message);
    this.name = 'OsuApiError';
  }
}

function parseRetryAfter(value: string | null): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function getCacheHeaders(cacheStatus: 'HIT' | 'MISS' | 'SHARED' | 'STALE' | 'HIT_KV'): HeadersInit {
  return {
    'Cache-Control': 's-maxage=120, stale-while-revalidate=600',
    'X-Osu-Cache': cacheStatus,
  };
}

function mergeHeaders(...headerSets: Array<HeadersInit | undefined>): HeadersInit {
  const merged = new Headers();
  for (const headers of headerSets) {
    if (!headers) continue;
    const normalized = new Headers(headers);
    for (const [key, value] of normalized.entries()) {
      merged.set(key, value);
    }
  }
  return merged;
}

async function getOsuToken(): Promise<string> {
  if (!OSU_CLIENT_ID || !OSU_CLIENT_SECRET) {
    throw new OsuApiError('osu! API credentials not configured', 500, 'OSU_CONFIG_MISSING');
  }

  // Return cached token if still valid (with 60s buffer)
  if (cachedToken && cachedToken.expires_at > Date.now() + 60000) {
    return cachedToken.access_token;
  }

  const response = await fetch(OSU_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify({
      client_id: parseInt(OSU_CLIENT_ID),
      client_secret: OSU_CLIENT_SECRET,
      grant_type: 'client_credentials',
      scope: 'public',
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new OsuApiError(
      `Failed to get osu! token: ${response.status} - ${errorText}`,
      response.status >= 500 ? 502 : response.status,
      'OSU_TOKEN_ERROR'
    );
  }

  const data = await response.json();
  cachedToken = {
    access_token: data.access_token,
    expires_at: Date.now() + (data.expires_in * 1000),
  };

  return cachedToken.access_token;
}

async function osuFetch<T>(endpoint: string, token: string): Promise<T> {
  const response = await fetch(`${OSU_API_BASE}${endpoint}`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    next: { revalidate: 120 },
  });

  if (!response.ok) {
    const errorText = await response.text();
    if (response.status === 429) {
      const retryAfter = parseRetryAfter(response.headers.get('Retry-After'));
      throw new OsuApiError(
        'Rate limited by the osu! API. Please try again in a minute.',
        429,
        'RATE_LIMITED',
        retryAfter
      );
    }
    throw new OsuApiError(
      `osu! API error: ${response.status} - ${errorText}`,
      response.status >= 500 ? 502 : response.status,
      response.status === 404 ? 'NOT_FOUND' : 'OSU_UPSTREAM_ERROR'
    );
  }

  return response.json() as Promise<T>;
}

async function fetchFreshOsuData(): Promise<OsuManiaData> {
  const playerUsername = OSU_USERNAME;
  const gameMode = 'mania';
  const token = await getOsuToken();

  let user: OsuUser;
  try {
    user = await osuFetch<OsuUser>(
      `/users/${encodeURIComponent(playerUsername)}/${gameMode}?key=username`,
      token
    );
  } catch (error) {
    if (error instanceof OsuApiError && error.status === 404) {
      throw new OsuApiError(`Player "${playerUsername}" not found`, 404, 'NOT_FOUND');
    }
    throw error;
  }

  const userId = user.id;

  const [recentScores, bestScores] = await Promise.all([
    osuFetch<OsuScore[]>(`/users/${userId}/scores/recent?mode=${gameMode}&include_fails=1&limit=20`, token),
    osuFetch<OsuScore[]>(`/users/${userId}/scores/best?mode=${gameMode}&limit=10`, token),
  ]);

  return {
    user,
    recentScores,
    bestScores,
  };
}

export async function GET(request: Request) {
  const rateLimitResult = rateLimit(request, {
    namespace: 'api:osu',
    limit: OSU_RATE_LIMIT_MAX_REQUESTS,
    windowMs: OSU_RATE_LIMIT_WINDOW_MS,
  });

  if (!rateLimitResult.ok) {
    return NextResponse.json(
      {
        error: 'Too many requests. Please retry shortly.',
        code: 'RATE_LIMITED_LOCAL',
        retryAfter: rateLimitResult.retryAfter,
      },
      {
        status: 429,
        headers: mergeHeaders(rateLimitResult.headers, { 'Cache-Control': 'no-store' }),
      }
    );
  }

  const now = Date.now();
  let staleKvPayload: OsuManiaData | null = null;

  if (osuCache && now - osuCache.cachedAt < OSU_CACHE_TTL_MS) {
    return NextResponse.json(osuCache.payload, {
      headers: mergeHeaders(getCacheHeaders('HIT'), rateLimitResult.headers),
    });
  }

  const kvData = await kvGetWithStale<OsuManiaData>(OSU_CACHE_KEY, {
    freshMs: OSU_CACHE_TTL_MS,
    staleMs: OSU_STALE_TTL_MS,
  });

  if (kvData) {
    if (kvData.isStale) {
      staleKvPayload = kvData.value;
    } else {
      osuCache = {
        payload: kvData.value,
        cachedAt: now - kvData.ageMs,
      };
      return NextResponse.json(kvData.value, {
        headers: mergeHeaders(getCacheHeaders('HIT_KV'), rateLimitResult.headers),
      });
    }
  }

  if (osuInFlight) {
    try {
      const sharedPayload = await osuInFlight;
      return NextResponse.json(sharedPayload, {
        headers: mergeHeaders(getCacheHeaders('SHARED'), rateLimitResult.headers),
      });
    } catch {
      // Continue with fresh fetch.
    }
  }

  const fetchTask = fetchFreshOsuData();
  osuInFlight = fetchTask;

  try {
    const payload = await fetchTask;
    osuCache = { payload, cachedAt: Date.now() };
    void kvSetWithTimestamp(OSU_CACHE_KEY, payload, OSU_CACHE_TTL_MS + OSU_STALE_TTL_MS);

    return NextResponse.json(payload, {
      headers: mergeHeaders(getCacheHeaders('MISS'), rateLimitResult.headers),
    });
  } catch (error) {
    if (osuCache && now - osuCache.cachedAt < OSU_CACHE_TTL_MS + OSU_STALE_TTL_MS) {
      return NextResponse.json(
        { ...osuCache.payload, stale: true },
        { headers: mergeHeaders(getCacheHeaders('STALE'), rateLimitResult.headers) }
      );
    }

    if (staleKvPayload) {
      return NextResponse.json(
        { ...staleKvPayload, stale: true },
        { headers: mergeHeaders(getCacheHeaders('STALE'), rateLimitResult.headers) }
      );
    }

    if (error instanceof OsuApiError) {
      return NextResponse.json(
        {
          error: error.message,
          code: error.code,
          retryAfter: error.retryAfter,
        },
        { status: error.status, headers: mergeHeaders(rateLimitResult.headers) }
      );
    }

    console.error('osu! API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch osu! data', code: 'OSU_UNKNOWN_ERROR' },
      { status: 500, headers: mergeHeaders(rateLimitResult.headers) }
    );
  } finally {
    if (osuInFlight === fetchTask) {
      osuInFlight = null;
    }
  }
}
