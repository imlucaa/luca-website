import { NextRequest, NextResponse } from 'next/server';

const API_BASE = 'https://camilo404.azurewebsites.net';

export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get('id');
  
  if (!userId) {
    return NextResponse.json({ error: 'Missing user ID' }, { status: 400 });
  }

  try {
    const response = await fetch(`${API_BASE}/v1/banner/${userId}`, {
      next: { revalidate: 300 }, // Cache for 5 minutes
    });

    if (!response.ok) {
      return NextResponse.json({ error: 'Banner not found' }, { status: 404 });
    }

    const contentType = response.headers.get('content-type') || 'image/png';
    const buffer = await response.arrayBuffer();
    const base64 = Buffer.from(buffer).toString('base64');
    const dataUrl = `data:${contentType};base64,${base64}`;

    return NextResponse.json({ dataUrl });
  } catch {
    return NextResponse.json({ error: 'Failed to fetch banner' }, { status: 500 });
  }
}
