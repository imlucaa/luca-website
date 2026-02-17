'use client';

import { useState } from 'react';
import { useOsu } from '@/hooks/useOsu';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { OsuProfileCard } from '@/components/osu/OsuProfileCard';
import { OsuRecentPlays } from '@/components/osu/OsuRecentPlays';
import { OsuTopPlays } from '@/components/osu/OsuTopPlays';
import { SearchModal } from '@/components/ui/SearchModal';

export default function OsuPage() {
  const [searchUsername, setSearchUsername] = useState<string | undefined>();
  const [isSearching, setIsSearching] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const { data, loading, error, retry } = useOsu(searchUsername);

  const isRateLimited = error?.includes("Rate limited") || error?.includes("rate limit");

  const handleSearch = (query: string) => {
    setSearchUsername(query);
    setIsSearching(true);
  };

  const handleClearSearch = () => {
    setSearchUsername(undefined);
    setIsSearching(false);
  };

  const searchButton = (
    <div className="col-span-4 flex justify-end">
      <button
        className="search-profile-btn"
        onClick={() => setIsModalOpen(true)}
        style={{ background: 'rgba(232, 67, 147, 0.15)', borderColor: 'rgba(232, 67, 147, 0.3)', color: '#e84393' }}
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
          title="Search osu! Profile"
          description="Enter a username to view their profile"
          placeholder="Enter osu! username (e.g., mrekk)"
          accentColor="#e84393"
          helpInfo={{
            title: "How to find your osu! username:",
            steps: [
              "Open osu! or visit osu.ppy.sh",
              "Your username is shown on your profile"
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
            <h1 className="text-4xl font-bold mb-4">osu!</h1>
            <p className={isRateLimited ? "text-yellow-400" : "text-red-400"}>
              {isRateLimited ? "⏳ " : ""}{error || 'Failed to load data'}
            </p>
            <button
              onClick={retry}
              className="mt-4 px-4 py-2 text-sm rounded-lg transition-colors"
              style={{
                background: 'rgba(232, 67, 147, 0.15)',
                border: '1px solid rgba(232, 67, 147, 0.3)',
                color: '#e84393',
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
          title="Search osu! Profile"
          description="Enter a username to view their profile"
          placeholder="Enter osu! username (e.g., mrekk)"
          accentColor="#e84393"
          helpInfo={{
            title: "How to find your osu! username:",
            steps: [
              "Open osu! or visit osu.ppy.sh",
              "Your username is shown on your profile"
            ]
          }}
        />
      </main>
    );
  }

  const { user, recentScores, bestScores, coverColor } = data;

  return (
    <main className="bento-container">
      {searchButton}

      {/* Back to profile link when searching */}
      {isSearching && (
        <div className="col-span-4">
          <button onClick={handleClearSearch} className="text-xs text-gray-500 hover:text-white transition-colors">
            ← Back to my profile
          </button>
        </div>
      )}

      {/* Profile Card */}
      <OsuProfileCard user={user} coverColor={coverColor} />

      {/* Recent Plays - always show section */}
      <OsuRecentPlays scores={recentScores || []} coverColor={coverColor} />

      {/* Top Plays */}
      {bestScores && bestScores.length > 0 && (
        <OsuTopPlays scores={bestScores} coverColor={coverColor} />
      )}

      {/* Search Modal */}
      <SearchModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSearch={handleSearch}
        title="Search osu! Profile"
        description="Enter a username to view their profile"
        placeholder="Enter osu! username (e.g., mrekk)"
        accentColor="#e84393"
        helpInfo={{
          title: "How to find your osu! username:",
          steps: [
            "Open osu! or visit osu.ppy.sh",
            "Your username is shown on your profile"
          ]
        }}
      />
    </main>
  );
}
