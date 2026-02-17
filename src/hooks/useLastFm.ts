'use client';

import { useState, useEffect } from 'react';
import type { LastFmTrack } from '@/lib/types';

export function useLastFm(limit: number = 10) {
  const [tracks, setTracks] = useState<LastFmTrack[]>([]);
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchTracks = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/lastfm?limit=${limit}`);
      if (!response.ok) throw new Error('Failed to fetch Last.fm data');
      const data = await response.json();
      setTracks(data.tracks || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch Last.fm data'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTracks();
  }, [limit]);

  return { tracks, error, isLoading, refetch: fetchTracks };
}
