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
  const token = data.token || data.Token;

  if (!token) {
    return NextResponse.json({ success: false, message: 'Nessun token ricevuto dal server' }, { status: 401 });
  }

  // Decode JWT payload to verify the user role
  let role = '';
  try {
    const parts = token.split('.');
    if (parts.length === 3) {
      const payload = JSON.parse(
        Buffer.from(parts[1], 'base64url').toString('utf-8')
      );
      role =
        payload.role ||
        payload['http://schemas.microsoft.com/ws/2008/06/identity/claims/role'] ||
        payload.Role ||
        '';
    }
  } catch (err) {
    console.error('Error decoding JWT payload in login route:', err);
  }

  const cookieStore = await cookies();

  if (role.toLowerCase() === 'mfa') {
    cookieStore.set('wm_mfa_token', token, {
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      path: '/',
      maxAge: 600,
    });

    return NextResponse.json({
      success: true,
      mfaRequired: true,
      mfaToken: token,
    });
  }

  cookieStore.delete('wm_mfa_token');
  cookieStore.set('wm_token', token, {
    httpOnly: true,
    secure: false,
    sameSite: 'lax',
    path: '/',
    maxAge: 86400,
  });

  return NextResponse.json({ success: true, mfaRequired: false });
}
