import { NextResponse } from 'next/server';
import { OSU_CLIENT_ID, OSU_CLIENT_SECRET, OSU_USERNAME } from '@/lib/constants';

const OSU_API_BASE = 'https://osu.ppy.sh/api/v2';
const OSU_TOKEN_URL = 'https://osu.ppy.sh/oauth/token';

// In-memory token cache
let cachedToken: { access_token: string; expires_at: number } | null = null;

async function getOsuToken(): Promise<string> {
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
    throw new Error(`Failed to get osu! token: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  cachedToken = {
    access_token: data.access_token,
    expires_at: Date.now() + (data.expires_in * 1000),
  };

  return cachedToken.access_token;
}

async function osuFetch(endpoint: string, token: string) {
  const response = await fetch(`${OSU_API_BASE}${endpoint}`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    if (response.status === 429) {
      throw new Error('RATE_LIMITED');
    }
    throw new Error(`osu! API error: ${response.status} - ${errorText}`);
  }

  return response.json();
}

export async function GET(request: Request) {
  if (!OSU_CLIENT_ID || !OSU_CLIENT_SECRET) {
    return NextResponse.json(
      { error: 'osu! API credentials not configured' },
      { status: 500 }
    );
  }

  // Check for search query parameter
  const { searchParams } = new URL(request.url);
  const searchUsername = searchParams.get('username');
  const playerUsername = searchUsername || OSU_USERNAME;

  try {
    const token = await getOsuToken();

    // Determine the game mode to use
    let gameMode: string;

    if (searchUsername) {
      // For searched users, first look up without mode to get their default playmode
      const basicUser = await osuFetch(`/users/${encodeURIComponent(playerUsername)}?key=username`, token);
      gameMode = basicUser.playmode || 'osu';
    } else {
      // Default user uses mania
      gameMode = 'mania';
    }

    // Look up the user with the correct mode to get mode-specific stats
    const user = await osuFetch(`/users/${encodeURIComponent(playerUsername)}/${gameMode}?key=username`, token);
    const userId = user.id;

    // Fetch recent scores and best scores using numeric user ID
    const [recentScores, bestScores] = await Promise.all([
      osuFetch(`/users/${userId}/scores/recent?mode=${gameMode}&include_fails=1&limit=20`, token),
      osuFetch(`/users/${userId}/scores/best?mode=${gameMode}&limit=10`, token),
    ]);

    // Extract dominant color from cover image for card background
    let coverColor: string | null = null;
    const coverUrl = user.cover_url || user.cover?.url;
    if (coverUrl) {
      try {
        const imgResponse = await fetch(coverUrl);
        if (imgResponse.ok) {
          const buffer = await imgResponse.arrayBuffer();
          const bytes = new Uint8Array(buffer);
          // Simple color sampling from raw image data
          // Sample pixels from the image header area for a representative color
          let r = 0, g = 0, b = 0, samples = 0;
          // For JPEG/PNG, sample bytes at regular intervals (rough approximation)
          const step = Math.max(3, Math.floor(bytes.length / 300));
          for (let i = 0; i < bytes.length - 2; i += step) {
            r += bytes[i];
            g += bytes[i + 1];
            b += bytes[i + 2];
            samples++;
          }
          if (samples > 0) {
            r = Math.round((r / samples) * 0.35);
            g = Math.round((g / samples) * 0.35);
            b = Math.round((b / samples) * 0.35);
            coverColor = `rgb(${r}, ${g}, ${b})`;
          }
        }
      } catch {
        // Ignore color extraction errors
      }
    }

    return NextResponse.json({
      user,
      recentScores,
      bestScores,
      coverColor,
    });
  } catch (error) {
    console.error('osu! API error:', error);
    const message = error instanceof Error ? error.message : 'Failed to fetch osu! data';
    // Check if it's a rate limit error
    if (message === 'RATE_LIMITED') {
      return NextResponse.json(
        { error: 'Rate limited by the osu! API. Please try again in a minute.', code: 'RATE_LIMITED' },
        { status: 429 }
      );
    }
    // Check if it's a "not found" type error
    const isNotFound = message.includes('404') || message.toLowerCase().includes('not found');
    return NextResponse.json(
      { error: isNotFound ? `Player "${playerUsername}" not found` : message },
      { status: isNotFound ? 404 : 500 }
    );
  }
}
