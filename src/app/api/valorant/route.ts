import { NextResponse } from "next/server";
import {
  ValorantMatch,
  ValorantMatchPlayer,
  AgentStats,
  PerformanceMetrics,
} from "@/lib/types";

const HENRIK_API_BASE = "https://api.henrikdev.xyz";
const VALORANT_NAME = "angels in camo";
const VALORANT_TAG = "006";
const VALORANT_REGION = "ap";

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
        rr_change: 0, // Will be populated from MMR history if available
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

export async function GET(request: Request) {
  try {
    // Check for search query parameters
    const { searchParams } = new URL(request.url);
    const searchName = searchParams.get('name');
    const searchTag = searchParams.get('tag');

    // Use searched user or default
    const playerName = searchName || VALORANT_NAME;
    const playerTag = searchTag || VALORANT_TAG;

    // Prepare headers - only add Authorization if API key exists
    const headers: HeadersInit = {};
    if (process.env.HENRIK_API_KEY) {
      headers["Authorization"] = process.env.HENRIK_API_KEY;
    }

    // Fetch account data (region-agnostic - searches globally by Riot ID)
    const accountResponse = await fetch(
      `${HENRIK_API_BASE}/valorant/v1/account/${encodeURIComponent(playerName)}/${encodeURIComponent(playerTag)}`,
      {
        headers,
        next: { revalidate: searchName ? 60 : 300 }, // Shorter cache for searches
      }
    );

    if (!accountResponse.ok) {
      const errorText = await accountResponse.text();
      console.error("Account API error:", accountResponse.status, errorText);
      if (accountResponse.status === 429) {
        return NextResponse.json(
          { error: "Rate limited by the Valorant API. Please try again in a minute.", code: "RATE_LIMITED" },
          { status: 429 }
        );
      }
      if (accountResponse.status === 404) {
        return NextResponse.json(
          { error: `Player "${playerName}#${playerTag}" not found` },
          { status: 404 }
        );
      }
      throw new Error(`Account API error: ${accountResponse.status}`);
    }

    const accountData = await accountResponse.json();

    // Auto-detect region from account data, fallback to default
    const playerRegion = accountData.data?.region || VALORANT_REGION;

    // Fetch MMR data (rank info) - uses detected region
    const mmrResponse = await fetch(
      `${HENRIK_API_BASE}/valorant/v2/mmr/${playerRegion}/${encodeURIComponent(playerName)}/${encodeURIComponent(playerTag)}`,
      {
        headers,
        next: { revalidate: searchName ? 60 : 300 },
      }
    );

    if (!mmrResponse.ok) {
      const errorText = await mmrResponse.text();
      console.error("MMR API error:", mmrResponse.status, errorText);
      if (mmrResponse.status === 429) {
        return NextResponse.json(
          { error: "Rate limited by the Valorant API. Please try again in a minute.", code: "RATE_LIMITED" },
          { status: 429 }
        );
      }
      throw new Error(`MMR API error: ${mmrResponse.status}`);
    }

    const mmrData = await mmrResponse.json();

    // Fetch match history (all modes: competitive, unrated, swiftplay, deathmatch, etc.)
    let matches: ValorantMatch[] = [];
    let matchError = null;
    try {
      const matchesResponse = await fetch(
        `${HENRIK_API_BASE}/valorant/v3/matches/${playerRegion}/${encodeURIComponent(playerName)}/${encodeURIComponent(playerTag)}?size=15`,
        {
          headers,
          next: { revalidate: searchName ? 60 : 300 },
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

    // Calculate aggregated stats if we have matches
    const aggregatedStats =
      matches.length > 0
        ? calculateAggregatedStats(matches, accountData.data.puuid)
        : null;

    return NextResponse.json({
      account: accountData.data,
      mmr: mmrData.data,
      matches: matches.length > 0 ? matches : undefined,
      aggregatedStats: aggregatedStats || undefined,
      errors: {
        matches: matchError,
      },
    });
  } catch (error) {
    console.error("Valorant API error:", error);
    const message = error instanceof Error ? error.message : "Failed to fetch Valorant data";
    const isRateLimit = message.includes('429');
    return NextResponse.json(
      { error: isRateLimit ? "Rate limited by the Valorant API. Please try again in a minute." : "Failed to fetch Valorant data", code: isRateLimit ? "RATE_LIMITED" : undefined },
      { status: isRateLimit ? 429 : 500 }
    );
  }
}
