import { getApiBaseUrl } from '@/lib/env';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const API_BASE = getApiBaseUrl();
    const res = await fetch(`${API_BASE}/api/Setup/status`);

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
