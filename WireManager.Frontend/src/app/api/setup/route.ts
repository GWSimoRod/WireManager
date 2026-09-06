import { NextRequest } from 'next/server';
import { getApiBaseUrl } from '@/lib/env';

export async function POST(request: NextRequest) {
  const body = await request.text();

  try {
    const API_BASE = getApiBaseUrl();
    const res = await fetch(`${API_BASE}/api/Setup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    });

    const text = await res.text();
    return new Response(text || null, {
      status: res.status,
      headers: {
        'Content-Type': text ? 'application/json' : 'text/plain',
      },
    });
  } catch {
    return new Response(
      JSON.stringify({ message: 'Backend non raggiungibile' }),
      { status: 502, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
