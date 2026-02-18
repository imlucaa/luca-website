import { NextResponse } from "next/server";
import { kvGetWithStale, kvSetWithTimestamp } from "@/lib/server/kv-cache";
import { rateLimit } from "@/lib/server/rate-limit";
import {
  ValorantMatch,
  AgentStats,
  PerformanceMetrics,
} from "@/lib/types";

const HENRIK_API_BASE = "https://api.henrikdev.xyz";
const VALORANT_NAME = "angels in camo";
const VALORANT_TAG = "006";
const VALORANT_REGION = "ap";
const VALORANT_CACHE_TTL_MS = 2 * 60 * 1000;
const VALORANT_STALE_TTL_MS = 10 * 60 * 1000;
const VALORANT_RATE_LIMIT_WINDOW_MS = 60 * 1000;
const VALORANT_RATE_LIMIT_MAX_REQUESTS = 45;

// Search-specific rate limits (stricter to prevent API abuse)
const VALORANT_SEARCH_RATE_LIMIT_WINDOW_MS = 60 * 1000;
const VALORANT_SEARCH_RATE_LIMIT_MAX_REQUESTS = 15;

interface ValorantApiPayload {
  account: unknown;
  mmr: unknown;
  matches?: ValorantMatch[];
  aggregatedStats?: {
    agentStats: AgentStats[];
    performanceMetrics: PerformanceMetrics;
  };
  errors: {
    matches: string | null;
  };
  stale?: boolean;
}

class ValorantApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
    public retryAfter?: number
  ) {
    super(message);
    this.name = "ValorantApiError";
  }
}

// Per-user in-memory caches
const userCaches = new Map<string, { payload: ValorantApiPayload; cachedAt: number }>();
const userInFlight = new Map<string, Promise<ValorantApiPayload>>();

function getRetryAfterSeconds(value: string | null): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function getCacheHeaders(cacheStatus: "HIT" | "MISS" | "SHARED" | "STALE" | "HIT_KV"): HeadersInit {
  return {
    "Cache-Control": "s-maxage=120, stale-while-revalidate=600",
    "X-Valorant-Cache": cacheStatus,
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

function getCacheKey(name: string, tag: string): string {
  return `api:valorant:${name.toLowerCase()}:${tag.toLowerCase()}`;
}

// Helper function to calculate aggregated stats from matches
function calculateAggregatedStats(
  matches: ValorantMatch[],
  playerPuuid: string
) {
  if (!matches || matches.length === 0) {
    return null;
  }

  // Find player data in each match
  const playerMatches = matches
    .map((match) => {
      const player = match.players.all_players.find(
        (p) => p.puuid === playerPuuid
      );
      if (!player) return null;

      const playerTeam = player.team.toLowerCase();
      const won = match.teams[playerTeam as "red" | "blue"]?.has_won || false;

      return {
        player,
        won,
        map: match.metadata.map,
        mode: match.metadata.mode,
        rr_change: 0,
      };
    })
    .filter((m) => m !== null);

  // Calculate agent statistics
  const agentStatsMap = new Map<string, AgentStats>();

  playerMatches.forEach((match) => {
    const agent = match.player.character;
    const existing = agentStatsMap.get(agent) || {
      agent,
      games_played: 0,
      wins: 0,
      losses: 0,
      win_rate: 0,
      total_kills: 0,
      total_deaths: 0,
      total_assists: 0,
      kd_ratio: 0,
      avg_combat_score: 0,
      avg_kills: 0,
      avg_deaths: 0,
      avg_assists: 0,
    };

    existing.games_played++;
    if (match.won) existing.wins++;
    else existing.losses++;
    existing.total_kills += match.player.stats.kills;
    existing.total_deaths += match.player.stats.deaths;
    existing.total_assists += match.player.stats.assists;

    agentStatsMap.set(agent, existing);
  });

  // Calculate final agent stats
  const agentStats: AgentStats[] = Array.from(agentStatsMap.values())
    .map((stats) => ({
      ...stats,
      win_rate: (stats.wins / stats.games_played) * 100,
      kd_ratio:
        stats.total_deaths > 0
          ? stats.total_kills / stats.total_deaths
          : stats.total_kills,
      avg_combat_score:
        playerMatches
          .filter((m) => m.player.character === stats.agent)
          .reduce((sum, m) => sum + m.player.stats.score, 0) /
        stats.games_played,
      avg_kills: stats.total_kills / stats.games_played,
      avg_deaths: stats.total_deaths / stats.games_played,
      avg_assists: stats.total_assists / stats.games_played,
    }))
    .sort((a, b) => b.games_played - a.games_played);

  // Calculate overall performance metrics
  const totalKills = playerMatches.reduce(
    (sum, m) => sum + m.player.stats.kills,
    0
  );
  const totalDeaths = playerMatches.reduce(
    (sum, m) => sum + m.player.stats.deaths,
    0
  );
  const totalAssists = playerMatches.reduce(
    (sum, m) => sum + m.player.stats.assists,
    0
  );
  const totalDamage = playerMatches.reduce(
    (sum, m) => sum + m.player.stats.damage_made,
    0
  );
  const totalHeadshots = playerMatches.reduce(
    (sum, m) => sum + m.player.stats.headshots,
    0
  );
  const totalBodyshots = playerMatches.reduce(
    (sum, m) => sum + m.player.stats.bodyshots,
    0
  );
  const totalLegshots = playerMatches.reduce(
    (sum, m) => sum + m.player.stats.legshots,
    0
  );
  const totalShots = totalHeadshots + totalBodyshots + totalLegshots;
  const wins = playerMatches.filter((m) => m.won).length;

  // Most played agents
  const mostPlayedAgents = agentStats.slice(0, 5).map((a) => ({
    agent: a.agent,
    games: a.games_played,
  }));

  // Favorite maps
  const mapCounts = new Map<string, number>();
  playerMatches.forEach((m) => {
    mapCounts.set(m.map, (mapCounts.get(m.map) || 0) + 1);
  });
  const favoriteMaps = Array.from(mapCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([map, games]) => ({ map, games }));

  const performanceMetrics: PerformanceMetrics = {
    overall_kd: totalDeaths > 0 ? totalKills / totalDeaths : totalKills,
    avg_combat_score:
      playerMatches.reduce((sum, m) => sum + m.player.stats.score, 0) /
      playerMatches.length,
    win_rate: (wins / playerMatches.length) * 100,
    headshot_percentage: totalShots > 0 ? (totalHeadshots / totalShots) * 100 : 0,
    total_games: playerMatches.length,
    wins,
    losses: playerMatches.length - wins,
    avg_kills: totalKills / playerMatches.length,
    avg_deaths: totalDeaths / playerMatches.length,
    avg_assists: totalAssists / playerMatches.length,
    avg_damage: totalDamage / playerMatches.length,
    most_played_agents: mostPlayedAgents,
    favorite_maps: favoriteMaps,
  };

  return {
    agentStats,
    performanceMetrics,
  };
}

async function fetchFreshValorantData(playerName: string, playerTag: string): Promise<ValorantApiPayload> {
  const headers: HeadersInit = {};
  if (process.env.HENRIK_API_KEY) {
    headers["Authorization"] = process.env.HENRIK_API_KEY;
  }

  const accountResponse = await fetch(
    `${HENRIK_API_BASE}/valorant/v1/account/${encodeURIComponent(playerName)}/${encodeURIComponent(playerTag)}`,
    {
      headers,
      next: { revalidate: 300 },
    }
  );

  if (!accountResponse.ok) {
    const errorText = await accountResponse.text();
    console.error("Account API error:", accountResponse.status, errorText);
    if (accountResponse.status === 429) {
      throw new ValorantApiError(
        "Rate limited by the Valorant API. Please try again in a minute.",
        429,
        "RATE_LIMITED",
        getRetryAfterSeconds(accountResponse.headers.get("Retry-After"))
      );
    }
    if (accountResponse.status === 404) {
      throw new ValorantApiError(`Player "${playerName}#${playerTag}" not found`, 404, "NOT_FOUND");
    }
    throw new ValorantApiError("Failed to fetch Valorant data", 502);
  }

  const accountData = await accountResponse.json();
  const playerRegion = accountData.data?.region || VALORANT_REGION;

  const mmrResponse = await fetch(
    `${HENRIK_API_BASE}/valorant/v2/mmr/${playerRegion}/${encodeURIComponent(playerName)}/${encodeURIComponent(playerTag)}`,
    {
      headers,
      next: { revalidate: 300 },
    }
  );

  if (!mmrResponse.ok) {
    const errorText = await mmrResponse.text();
    console.error("MMR API error:", mmrResponse.status, errorText);
    if (mmrResponse.status === 429) {
      throw new ValorantApiError(
        "Rate limited by the Valorant API. Please try again in a minute.",
        429,
        "RATE_LIMITED",
        getRetryAfterSeconds(mmrResponse.headers.get("Retry-After"))
      );
    }
    throw new ValorantApiError("Failed to fetch Valorant data", 502);
  }

  const mmrData = await mmrResponse.json();

  let matches: ValorantMatch[] = [];
  let matchError: string | null = null;
  try {
    const matchesResponse = await fetch(
      `${HENRIK_API_BASE}/valorant/v3/matches/${playerRegion}/${encodeURIComponent(playerName)}/${encodeURIComponent(playerTag)}?size=15`,
      {
        headers,
        cache: 'no-store',
      }
    );

    if (matchesResponse.ok) {
      const matchesData = await matchesResponse.json();
      matches = matchesData.data || [];
    } else {
      const errorText = await matchesResponse.text();
      console.error("Matches API error:", matchesResponse.status, errorText);
      matchError = `Matches API error: ${matchesResponse.status}`;
    }
  } catch (error) {
    console.error("Error fetching matches:", error);
    matchError = "Failed to fetch match history";
  }

  const aggregatedStats =
    matches.length > 0
      ? calculateAggregatedStats(matches, accountData.data.puuid)
      : null;

  return {
    account: accountData.data,
    mmr: mmrData.data,
    matches: matches.length > 0 ? matches : undefined,
    aggregatedStats: aggregatedStats || undefined,
    errors: {
      matches: matchError,
    },
  };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const searchName = searchParams.get('name');
  const searchTag = searchParams.get('tag');
  const isSearch = Boolean(searchName && searchTag);
  const playerName = searchName || VALORANT_NAME;
  const playerTag = searchTag || VALORANT_TAG;
  const cacheKey = getCacheKey(playerName, playerTag);

  // Apply stricter rate limits for search requests
  const rateLimitResult = rateLimit(request, {
    namespace: isSearch ? "api:valorant:search" : "api:valorant",
    limit: isSearch ? VALORANT_SEARCH_RATE_LIMIT_MAX_REQUESTS : VALORANT_RATE_LIMIT_MAX_REQUESTS,
    windowMs: isSearch ? VALORANT_SEARCH_RATE_LIMIT_WINDOW_MS : VALORANT_RATE_LIMIT_WINDOW_MS,
  });

  if (!rateLimitResult.ok) {
    return NextResponse.json(
      {
        error: "Too many requests. Please retry shortly.",
        code: "RATE_LIMITED_LOCAL",
        retryAfter: rateLimitResult.retryAfter,
      },
      {
        status: 429,
        headers: mergeHeaders(rateLimitResult.headers, {
          "Cache-Control": "no-store",
        }),
      }
    );
  }

  const now = Date.now();
  let staleKvPayload: ValorantApiPayload | null = null;

  // Check in-memory cache for this user
  const memCache = userCaches.get(cacheKey);
  if (memCache && now - memCache.cachedAt < VALORANT_CACHE_TTL_MS) {
    return NextResponse.json(memCache.payload, {
      headers: mergeHeaders(getCacheHeaders("HIT"), rateLimitResult.headers),
    });
  }

  // Check Redis/KV cache
  const kvData = await kvGetWithStale<ValorantApiPayload>(cacheKey, {
    freshMs: VALORANT_CACHE_TTL_MS,
    staleMs: VALORANT_STALE_TTL_MS,
  });

  if (kvData) {
    if (kvData.isStale) {
      staleKvPayload = kvData.value;
    } else {
      userCaches.set(cacheKey, {
        payload: kvData.value,
        cachedAt: now - kvData.ageMs,
      });
      return NextResponse.json(kvData.value, {
        headers: mergeHeaders(getCacheHeaders("HIT_KV"), rateLimitResult.headers),
      });
    }
  }

  // Check if there's already an in-flight request for this user
  const existingFlight = userInFlight.get(cacheKey);
  if (existingFlight) {
    try {
      const sharedPayload = await existingFlight;
      return NextResponse.json(sharedPayload, {
        headers: mergeHeaders(getCacheHeaders("SHARED"), rateLimitResult.headers),
      });
    } catch {
      // Continue and try a new fetch below.
    }
  }

  const fetchTask = fetchFreshValorantData(playerName, playerTag);
  userInFlight.set(cacheKey, fetchTask);

  try {
    const payload = await fetchTask;
    userCaches.set(cacheKey, { payload, cachedAt: Date.now() });
    void kvSetWithTimestamp(
      cacheKey,
      payload,
      VALORANT_CACHE_TTL_MS + VALORANT_STALE_TTL_MS
    );
    return NextResponse.json(payload, {
      headers: mergeHeaders(getCacheHeaders("MISS"), rateLimitResult.headers),
    });
  } catch (error) {
    if (
      memCache &&
      now - memCache.cachedAt < VALORANT_CACHE_TTL_MS + VALORANT_STALE_TTL_MS
    ) {
      return NextResponse.json(
        { ...memCache.payload, stale: true },
        { headers: mergeHeaders(getCacheHeaders("STALE"), rateLimitResult.headers) }
      );
    }

    if (staleKvPayload) {
      return NextResponse.json(
        { ...staleKvPayload, stale: true },
        { headers: mergeHeaders(getCacheHeaders("STALE"), rateLimitResult.headers) }
      );
    }

    if (error instanceof ValorantApiError) {
      return NextResponse.json(
        {
          error: error.message,
          code: error.code,
          retryAfter: error.retryAfter,
        },
        { status: error.status, headers: mergeHeaders(rateLimitResult.headers) }
      );
    }

    console.error("Valorant API error:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch Valorant data",
      },
      { status: 500, headers: mergeHeaders(rateLimitResult.headers) }
    );
  } finally {
    if (userInFlight.get(cacheKey) === fetchTask) {
      userInFlight.delete(cacheKey);
    }
  }
}
