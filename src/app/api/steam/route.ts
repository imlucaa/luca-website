import { NextResponse } from 'next/server';
import { STEAM_ID, STEAM_API_KEY } from '@/lib/constants';

export async function GET() {
  try {
    const corsProxy = 'https://corsproxy.io/?';

    // Try GetRecentlyPlayedGames first (last 2 weeks)
    let steamUrl = `https://api.steampowered.com/IPlayerService/GetRecentlyPlayedGames/v0001/?key=${STEAM_API_KEY}&steamid=${STEAM_ID}&format=json`;
    let response = await fetch(corsProxy + encodeURIComponent(steamUrl));

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    let data = await response.json();

    // Check if we got recent games
    if (data?.response?.games && data.response.games.length > 0) {
      return NextResponse.json({ games: data.response.games.slice(0, 3) });
    }

    // If no recent games, try GetOwnedGames (all games, sorted by playtime)
    steamUrl = `https://api.steampowered.com/IPlayerService/GetOwnedGames/v0001/?key=${STEAM_API_KEY}&steamid=${STEAM_ID}&format=json&include_appinfo=1&include_played_free_games=1`;
    response = await fetch(corsProxy + encodeURIComponent(steamUrl));

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    data = await response.json();

    if (data?.response?.games && data.response.games.length > 0) {
      // Sort by playtime and get top 3
      const sortedGames = data.response.games
        .filter((game: { playtime_forever: number }) => game.playtime_forever > 0)
        .sort((a: { playtime_forever: number }, b: { playtime_forever: number }) => b.playtime_forever - a.playtime_forever)
        .slice(0, 3);

      return NextResponse.json({ games: sortedGames });
    }

    return NextResponse.json({ games: [] });
  } catch (error) {
    console.error('Steam API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch Steam data' },
      { status: 500 }
    );
  }
}
