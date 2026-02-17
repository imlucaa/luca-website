import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const guildId = searchParams.get('id');

  if (!guildId) {
    return NextResponse.json({ error: 'Guild ID is required' }, { status: 400 });
  }

  try {
    const response = await fetch(`https://discord.com/api/v10/guilds/${guildId}/widget.json`, {
      headers: {
        'Accept': 'application/json',
      },
      next: { revalidate: 300 }, // Cache for 5 minutes
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    // Return only the data we need
    return NextResponse.json({
      id: data.id,
      name: data.name,
      presence_count: data.presence_count,
      instant_invite: data.instant_invite,
    });
  } catch (error) {
    console.error('Discord Guild API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch guild data' },
      { status: 500 }
    );
  }
}
