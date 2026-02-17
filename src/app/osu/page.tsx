'use client';

import { useOsu } from '@/hooks/useOsu';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { OsuProfileCard } from '@/components/osu/OsuProfileCard';
import { OsuRecentPlays } from '@/components/osu/OsuRecentPlays';
import { OsuTopPlays } from '@/components/osu/OsuTopPlays';

export default function OsuPage() {
  const { data, loading, error, errorCode, retryAfter, isStale, retry } = useOsu();

  const isRateLimited =
    errorCode === 'RATE_LIMITED' || error?.includes('Rate limited') || error?.includes('rate limit');

  if (loading) {
    return (
      <main className="bento-container">
        <div className="bento-card col-span-4 flex items-center justify-center min-h-[400px]">
          <LoadingSpinner />
        </div>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="bento-container">
        <div className="bento-card col-span-4 flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <h1 className="text-4xl font-bold mb-4">osu!</h1>
            <p className={isRateLimited ? 'text-yellow-400' : 'text-red-400'}>
              {isRateLimited ? '⏳ ' : ''}
              {error || 'Failed to load data'}
            </p>
            {isRateLimited && retryAfter && (
              <p className="text-xs text-gray-500 mt-1">Try again in about {retryAfter} seconds.</p>
            )}
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
          </div>
        </div>
      </main>
    );
  }

  const { user, recentScores, bestScores } = data;

  return (
    <main className="bento-container">
      {error && isStale && (
        <div className="bento-card col-span-4 !p-3 border border-amber-400/30 bg-amber-500/10">
          <p className="text-xs text-amber-200">
            Live data could not be refreshed. Showing cached stats.
            {retryAfter ? ` Retry in ~${retryAfter}s.` : ''}
          </p>
        </div>
      )}

      <OsuProfileCard user={user} />
      <OsuRecentPlays scores={recentScores || []} />

      {bestScores && bestScores.length > 0 && <OsuTopPlays scores={bestScores} />}
    </main>
  );
}
