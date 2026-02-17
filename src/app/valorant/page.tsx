"use client";

import { useState } from "react";
import { useValorant } from "@/hooks/useValorant";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { MatchHistoryCard } from "@/components/valorant/MatchHistoryCard";
import { PerformanceStats } from "@/components/valorant/PerformanceStats";
import { AgentStats } from "@/components/valorant/AgentStats";
import { SearchModal } from "@/components/ui/SearchModal";
import Image from "next/image";

export default function ValorantPage() {
  const [searchName, setSearchName] = useState<string | undefined>();
  const [searchTag, setSearchTag] = useState<string | undefined>();
  const [isSearching, setIsSearching] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const { data, loading, error, retry } = useValorant(searchName, searchTag);

  const isRateLimited = error?.includes("Rate limited") || error?.includes("rate limit");

  const handleSearch = (query: string) => {
    // Parse name#tag format
    const hashIndex = query.lastIndexOf('#');
    if (hashIndex > 0 && hashIndex < query.length - 1) {
      setSearchName(query.substring(0, hashIndex));
      setSearchTag(query.substring(hashIndex + 1));
      setIsSearching(true);
    }
  };

  const handleClearSearch = () => {
    setSearchName(undefined);
    setSearchTag(undefined);
    setIsSearching(false);
  };

  const searchButton = (
    <div className="col-span-4 flex justify-end">
      <button
        className="search-profile-btn"
        onClick={() => setIsModalOpen(true)}
        style={{ background: 'rgba(255, 70, 85, 0.15)', borderColor: 'rgba(255, 70, 85, 0.3)', color: '#ff4655' }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8" />
          <path d="M21 21l-4.35-4.35" />
        </svg>
        Search Profile
      </button>
    </div>
  );

  if (loading) {
    return (
      <main className="bento-container">
        {searchButton}
        <div className="bento-card col-span-4 flex items-center justify-center min-h-[400px]">
          <LoadingSpinner />
        </div>
        <SearchModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSearch={handleSearch}
          title="Search Valorant Profile"
          description="Enter a Riot ID to view their profile"
          placeholder="Enter Riot ID (e.g., TenZ#0505)"
          accentColor="#ff4655"
          helpInfo={{
            title: "How to find your Riot ID:",
            steps: [
              "Open Valorant or the Riot Client",
              "Your Riot ID is shown as Name#Tag",
              "Example: TenZ#0505"
            ]
          }}
        />
      </main>
    );
  }

  if (error || !data) {
    return (
      <main className="bento-container">
        {searchButton}
        <div className="bento-card col-span-4 flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <h1 className="text-4xl font-bold mb-4">Valorant</h1>
            <p className={isRateLimited ? "text-yellow-400" : "text-red-400"}>
              {isRateLimited ? "⏳ " : ""}{error || "Failed to load data"}
            </p>
            <button
              onClick={retry}
              className="mt-4 px-4 py-2 text-sm rounded-lg transition-colors"
              style={{
                background: 'rgba(255, 70, 85, 0.15)',
                border: '1px solid rgba(255, 70, 85, 0.3)',
                color: '#ff4655',
              }}
            >
              ↻ Retry
            </button>
            {isSearching && (
              <button onClick={handleClearSearch} className="mt-4 ml-3 text-sm text-gray-400 hover:text-white transition-colors">
                ← Back to default profile
              </button>
            )}
          </div>
        </div>
        <SearchModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSearch={handleSearch}
          title="Search Valorant Profile"
          description="Enter a Riot ID to view their profile"
          placeholder="Enter Riot ID (e.g., TenZ#0505)"
          accentColor="#ff4655"
          helpInfo={{
            title: "How to find your Riot ID:",
            steps: [
              "Open Valorant or the Riot Client",
              "Your Riot ID is shown as Name#Tag",
              "Example: TenZ#0505"
            ]
          }}
        />
      </main>
    );
  }

  const { account, mmr, matches, aggregatedStats } = data;
  const currentData = mmr.current_data;

  return (
    <main className="bento-container">
      {searchButton}

      {/* Header Card - Compact */}
      <div className="bento-card col-span-4 relative overflow-hidden !p-4">
        {/* Background Image */}
        <div className="absolute inset-0 opacity-20">
          <Image
            src={account.card.wide}
            alt="Player Card Background"
            fill
            className="object-cover"
          />
        </div>
        
        {/* Content */}
        <div className="relative z-10 flex items-center gap-4">
          <div className="relative w-16 h-16 rounded-lg overflow-hidden bg-gray-800 shadow-lg border-2 border-gray-700">
            <Image
              src={account.card.small}
              alt="Player Card"
              fill
              className="object-cover"
            />
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-bold mb-1 drop-shadow-lg">
              {account.name}
              <span className="text-gray-400">#{account.tag}</span>
            </h1>
            <div className="flex items-center gap-3 text-xs text-gray-400">
              <span>Level {account.account_level}</span>
              <span>•</span>
              <span className="uppercase">{account.region}</span>
              {isSearching && (
                <>
                  <span>•</span>
                  <button onClick={handleClearSearch} className="text-blue-400 hover:text-blue-300 transition-colors">
                    ← Back to my profile
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Match History - Moved below profile card */}
      {matches && matches.length > 0 && (
        <MatchHistoryCard
          matches={matches}
          playerPuuid={account.puuid}
          loading={loading}
        />
      )}

      {/* Rank Card - Compact */}
      <div className="bento-card col-span-2 !p-4">
        <h2 className="text-lg font-semibold mb-3">Current Rank</h2>
        <div className="flex flex-col items-center justify-center py-2">
          {currentData.images?.large && (
            <div className="relative w-24 h-24 mb-2">
              <Image
                src={currentData.images.large}
                alt={currentData.currenttierpatched}
                fill
                className="object-contain"
              />
            </div>
          )}
          <h3 className="text-xl font-bold mb-1">
            {currentData.currenttierpatched}
          </h3>
          <div className="text-center">
            <p className="text-gray-400 text-xs">
              {currentData.ranking_in_tier}/100 RR
            </p>
            {currentData.mmr_change_to_last_game !== 0 && currentData.images && (
              <div
                className={`flex items-center justify-center gap-1 mt-1 ${
                  currentData.mmr_change_to_last_game > 0
                    ? "text-green-400"
                    : "text-red-400"
                }`}
              >
                <Image
                  src={
                    currentData.mmr_change_to_last_game > 0
                      ? currentData.images.triangle_up
                      : currentData.images.triangle_down
                  }
                  alt="Change"
                  width={10}
                  height={10}
                />
                <span className="text-xs font-medium">
                  {Math.abs(currentData.mmr_change_to_last_game)} RR
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Stats Card - Compact */}
      <div className="bento-card col-span-2 !p-4">
        <h2 className="text-lg font-semibold mb-3">Statistics</h2>
        <div className="space-y-2">
          <div className="flex justify-between items-center p-2 bg-gray-800/50 rounded-lg">
            <span className="text-gray-400 text-xs">MMR Rating</span>
            <span className="font-semibold text-sm">{currentData.elo}</span>
          </div>
          <div className="flex justify-between items-center p-2 bg-gray-800/50 rounded-lg">
            <span className="text-gray-400 text-xs">Rank Progress</span>
            <span className="font-semibold text-sm">
              {currentData.ranking_in_tier}/100
            </span>
          </div>
          <div className="flex justify-between items-center p-2 bg-gray-800/50 rounded-lg">
            <span className="text-gray-400 text-xs">Games for Rating</span>
            <span className="font-semibold text-sm">
              {currentData.games_needed_for_rating > 0
                ? currentData.games_needed_for_rating
                : "Rated"}
            </span>
          </div>
          <div className="flex justify-between items-center p-2 bg-gray-800/50 rounded-lg">
            <span className="text-gray-400 text-xs">Last Game</span>
            <span
              className={`font-semibold text-sm ${
                currentData.mmr_change_to_last_game > 0
                  ? "text-green-400"
                  : currentData.mmr_change_to_last_game < 0
                  ? "text-red-400"
                  : "text-gray-400"
              }`}
            >
              {currentData.mmr_change_to_last_game > 0 ? "+" : ""}
              {currentData.mmr_change_to_last_game} RR
            </span>
          </div>
        </div>
      </div>

      {/* Performance Stats - Only show if we have aggregated stats */}
      {aggregatedStats?.performanceMetrics && (
        <PerformanceStats stats={aggregatedStats.performanceMetrics} />
      )}

      {/* Agent Stats - Only show if we have aggregated stats */}
      {aggregatedStats?.agentStats && (
        <AgentStats agents={aggregatedStats.agentStats} />
      )}

      {/* Show message if no match data available */}
      {(!matches || matches.length === 0) && !aggregatedStats && (
        <div className="bento-card col-span-4">
          <div className="text-center py-8">
            <p className="text-gray-400 mb-2">
              No match history available
            </p>
            <p className="text-sm text-gray-500">
              Play some matches to see detailed statistics
            </p>
          </div>
        </div>
      )}

      {/* Search Modal */}
      <SearchModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSearch={handleSearch}
        title="Search Valorant Profile"
        description="Enter a Riot ID to view their profile"
        placeholder="Enter Riot ID (e.g., TenZ#0505)"
        accentColor="#ff4655"
        helpInfo={{
          title: "How to find your Riot ID:",
          steps: [
            "Open Valorant or the Riot Client",
            "Your Riot ID is shown as Name#Tag",
            "Example: TenZ#0505"
          ]
        }}
      />
    </main>
  );
}
