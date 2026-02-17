'use client';

import { useState, useEffect, useCallback } from 'react';
import { OsuManiaData } from '@/lib/types';

export function useOsu(searchUsername?: string) {
  const [data, setData] = useState<OsuManiaData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOsuData = useCallback(async () => {
    setLoading(true);
    try {
      let url = '/api/osu';
      if (searchUsername) {
        url += `?username=${encodeURIComponent(searchUsername)}`;
      }
      const response = await fetch(url);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to fetch osu! data');
      }
      const result = await response.json();
      setData(result);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [searchUsername]);

  const retry = useCallback(() => {
    fetchOsuData();
  }, [fetchOsuData]);

  useEffect(() => {
    fetchOsuData();
    // Only auto-refresh for default user (not searches)
    if (!searchUsername) {
      const interval = setInterval(fetchOsuData, 5 * 60 * 1000);
      return () => clearInterval(interval);
    }
  }, [fetchOsuData, searchUsername]);

  return { data, loading, error, refetch: fetchOsuData, retry };
}
