import { NextResponse } from 'next/server';
import { LASTFM_USERNAME, LASTFM_API_KEY } from '@/lib/constants';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = searchParams.get('limit') || '10';

    const url = `https://ws.audioscrobbler.com/2.0/?method=user.getrecenttracks&user=${LASTFM_USERNAME}&api_key=${LASTFM_API_KEY}&format=json&limit=${limit}&extended=1`;
    
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    
    if (!data.recenttracks || !data.recenttracks.track) {
      throw new Error('No tracks found');
    }

    const tracks = Array.isArray(data.recenttracks.track) 
      ? data.recenttracks.track 
      : [data.recenttracks.track];

    return NextResponse.json({ tracks });
  } catch (error) {
    console.error('Last.fm API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch Last.fm data' },
      { status: 500 }
    );
  }
}
