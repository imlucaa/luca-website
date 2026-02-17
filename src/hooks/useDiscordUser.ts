'use client';

import { useState, useEffect } from 'react';
import { DISCORD_ID } from '@/lib/constants';
import type { DiscordUserProfile } from '@/lib/types';

export function useDiscordUser() {
  const [data, setData] = useState<DiscordUserProfile | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const response = await fetch(`/api/discord-user?id=${DISCORD_ID}`);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const json = await response.json();
        setData(json);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to fetch user data'));
      } finally {
        setIsLoading(false);
      }
    };

    fetchUserData();
    // Refresh every 5 minutes
    const interval = setInterval(fetchUserData, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  return { data, error, isLoading };
}
