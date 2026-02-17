'use client';

import { useState, useEffect } from 'react';
import type { SteamGame } from '@/lib/types';

export function useSteam() {
  const [games, setGames] = useState<SteamGame[]>([]);
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchGames = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/steam');
      if (!response.ok) throw new Error('Failed to fetch Steam data');
      const data = await response.json();
      setGames(data.games || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch Steam data'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchGames();
  }, []);

  return { games, error, isLoading, refetch: fetchGames };
}
