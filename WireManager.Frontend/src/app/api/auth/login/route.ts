import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrl } from '@/lib/env';

const API_BASE = getApiBaseUrl();

export async function POST(request: NextRequest) {
  const body = await request.json();

  const res = await fetch(`${API_BASE}/api/Auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    return new Response(text, {
      status: res.status,
      headers: { 'Content-Type': text ? 'application/json' : 'text/plain' },
    });
  }

  const data = await res.json();
  console.log('Login backend response:', data);
  const token = data.token || data.Token;
  console.log('Extracted token:', token);

  if (!token) {
    return NextResponse.json({ success: false, message: 'Nessun token ricevuto dal server' }, { status: 401 });
  }

  const cookieStore = await cookies();
  cookieStore.set('wm_token', token, {
    httpOnly: true,
    secure: false,
    sameSite: 'lax',
    path: '/',
    maxAge: 86400,
  });

  return NextResponse.json({ success: true });
}
