'use client';

import { useState, useEffect, useCallback } from 'react';
import { OsuManiaData } from '@/lib/types';
import { ApiError, fetchJson } from '@/lib/api-client';
import { readLocalCache, writeLocalCache } from '@/lib/local-cache';

export function useOsu(searchUsername?: string | null) {
  const [data, setData] = useState<OsuManiaData | null>(null);
  const [isFetching, setIsFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [retryAfter, setRetryAfter] = useState<number | null>(null);
  const [isStale, setIsStale] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  const isSearch = Boolean(searchUsername);
  const cacheKey = isSearch ? `osu:search:${searchUsername!.toLowerCase()}` : 'osu:default';

  // Load from local cache on mount or when search changes
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
    if (isSearch) setIsSearching(true);

    try {
      const url = isSearch
        ? `/api/osu?username=${encodeURIComponent(searchUsername!)}`
        : '/api/osu';

      const result = await fetchJson<OsuManiaData>(url);
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
      setIsSearching(false);
    }
  }, [cacheKey, isSearch, searchUsername]);

  const retry = useCallback(() => {
    fetchOsuData();
  }, [fetchOsuData]);

  useEffect(() => {
    fetchOsuData();

    // Only auto-refresh for default profile, not searches
    if (!isSearch) {
      const interval = setInterval(fetchOsuData, 5 * 60 * 1000);
      return () => clearInterval(interval);
    }
  }, [fetchOsuData, isSearch]);

  return {
    data,
    loading: isFetching && !data,
    isFetching,
    error,
    errorCode,
    retryAfter,
    isStale,
    lastUpdatedAt,
    isSearching,
    refetch: fetchOsuData,
    retry,
  };
}
