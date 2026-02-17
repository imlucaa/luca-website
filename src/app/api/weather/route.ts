import { NextResponse } from 'next/server';
import { WEATHER_LOCATION } from '@/lib/constants';
import { WEATHER_CODES } from '@/lib/constants';

export async function GET() {
  try {
    // Get coordinates for the location
    const geoResponse = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(WEATHER_LOCATION)}&count=1&language=en&format=json`
    );
    const geoData = await geoResponse.json();

    if (!geoData.results || geoData.results.length === 0) {
      throw new Error('City not found');
    }

    const { latitude, longitude, name } = geoData.results[0];

    // Get weather data
    const weatherResponse = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weather_code&timezone=auto`
    );
    const weatherData = await weatherResponse.json();

    const temp = Math.round(weatherData.current.temperature_2m);
    const code = weatherData.current.weather_code;
    const description = WEATHER_CODES[code] || 'Cloudy';

    return NextResponse.json({
      temp,
      description,
      location: name,
    });
  } catch (error) {
    console.error('Weather API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch weather data' },
      { status: 500 }
    );
  }
}
