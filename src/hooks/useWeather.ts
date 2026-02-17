'use client';

import { useState, useEffect } from 'react';

interface WeatherData {
  temp: number;
  description: string;
  location: string;
}

export function useWeather() {
  const [data, setData] = useState<WeatherData | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchWeather = async () => {
      try {
        const response = await fetch('/api/weather');
        if (!response.ok) throw new Error('Failed to fetch weather');
        const weatherData = await response.json();
        setData(weatherData);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to fetch weather'));
      } finally {
        setIsLoading(false);
      }
    };

    fetchWeather();
  }, []);

  return { data, error, isLoading };
}
