import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrl } from '@/lib/env';

const API_BASE = getApiBaseUrl();

export async function GET(request: NextRequest) {
  let authHeader = request.headers.get('Authorization') || request.headers.get('authorization');
  if (!authHeader) {
    const url = new URL(request.url);
    const tokenParam = url.searchParams.get('token');
    if (tokenParam) {
      authHeader = `Bearer ${tokenParam}`;
    }
  }

  if (!authHeader) {
    return NextResponse.json({ success: false, message: 'Token mancante' }, { status: 401 });
  }

  try {
    const backendRes = await fetch(`${API_BASE}/api/Auth/sso/exchange`, {
      method: 'GET',
      headers: {
        Authorization: authHeader,
        Accept: 'application/json',
      },
    });

    if (!backendRes.ok) {
      const text = await backendRes.text();
      return new Response(text, {
        status: backendRes.status,
        headers: { 'Content-Type': text ? 'application/json' : 'text/plain' },
      });
    }

    const data = await backendRes.json();
    const token = data.token || data.Token;
    const date = data.date || data.Date;

    if (!token) {
      return NextResponse.json(
        { success: false, message: 'Nessun token ricevuto dal server' },
        { status: 401 }
      );
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
      console.error('Error decoding JWT payload in exchange route:', err);
    }

    const isDisabled = role.toLowerCase() === 'disabled';
    const cookieStore = await cookies();

    if (isDisabled) {
      cookieStore.delete('wm_token');
      return NextResponse.json(
        { success: false, error: 'account_disabled', message: 'Account non abilitato', role },
        { status: 403 }
      );
    }

    cookieStore.set('wm_token', token, {
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      path: '/',
      maxAge: 86400,
    });

    return NextResponse.json({
      success: true,
      token,
      date,
      role,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Errore del server durante lo scambio del token';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
