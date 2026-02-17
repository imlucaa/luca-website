'use client';

import { useState, useEffect, useCallback } from 'react';
import { OsuManiaData } from '@/lib/types';
import { ApiError, fetchJson } from '@/lib/api-client';
import { readLocalCache, writeLocalCache } from '@/lib/local-cache';

export function useOsu() {
  const [data, setData] = useState<OsuManiaData | null>(null);
  const [isFetching, setIsFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [retryAfter, setRetryAfter] = useState<number | null>(null);
  const [isStale, setIsStale] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null);

  const cacheKey = 'osu:default';

  useEffect(() => {
    const cached = readLocalCache<OsuManiaData>(cacheKey);
    if (!cached) {
      setData(null);
      setLastUpdatedAt(null);
      setIsStale(false);
      return;
    }

    setData(cached.data);
    setLastUpdatedAt(cached.savedAt);
    setIsStale(true);
    setIsFetching(false);
  }, [cacheKey]);

  const fetchOsuData = useCallback(async () => {
    setIsFetching(true);

    try {
      const result = await fetchJson<OsuManiaData>('/api/osu');
      setData(result);
      writeLocalCache(cacheKey, result);
      setError(null);
      setErrorCode(null);
      setRetryAfter(null);
      setIsStale(false);
      setLastUpdatedAt(Date.now());
    } catch (err) {
      const cached = readLocalCache<OsuManiaData>(cacheKey);

      if (cached) {
        setData(cached.data);
        setLastUpdatedAt(cached.savedAt);
        setIsStale(true);
      }

      if (err instanceof ApiError) {
        setError(err.message);
        setErrorCode(err.code ?? null);
        setRetryAfter(err.retryAfter ?? null);
      } else {
        setError(err instanceof Error ? err.message : 'An error occurred');
        setErrorCode(null);
        setRetryAfter(null);
      }
    } finally {
      setIsFetching(false);
    }
  }, [cacheKey]);

  const retry = useCallback(() => {
    fetchOsuData();
  }, [fetchOsuData]);

  useEffect(() => {
    fetchOsuData();
    const interval = setInterval(fetchOsuData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchOsuData]);

  return {
    data,
    loading: isFetching && !data,
    isFetching,
    error,
    errorCode,
    retryAfter,
    isStale,
    lastUpdatedAt,
    refetch: fetchOsuData,
    retry,
  };
}
