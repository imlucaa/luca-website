import { useState, useEffect, useCallback } from "react";
import { ValorantData } from "@/lib/types";

export function useValorant(searchName?: string, searchTag?: string) {
  const [data, setData] = useState<ValorantData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchValorantData = useCallback(async () => {
    setLoading(true);
    try {
      let url = "/api/valorant";
      if (searchName && searchTag) {
        url += `?name=${encodeURIComponent(searchName)}&tag=${encodeURIComponent(searchTag)}`;
      }
      const response = await fetch(url);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to fetch Valorant data");
      }
      const result = await response.json();
      setData(result);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [searchName, searchTag]);

  const retry = useCallback(() => {
    fetchValorantData();
  }, [fetchValorantData]);

  useEffect(() => {
    fetchValorantData();
    // Only auto-refresh for default user (not searches)
    if (!searchName) {
      const interval = setInterval(fetchValorantData, 5 * 60 * 1000);
      return () => clearInterval(interval);
    }
  }, [fetchValorantData, searchName]);

  return { data, loading, error, refetch: fetchValorantData, retry };
}
