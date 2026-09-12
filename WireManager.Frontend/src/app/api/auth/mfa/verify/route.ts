import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrl } from '@/lib/env';

const API_BASE = getApiBaseUrl();

export async function POST(request: NextRequest) {
  let body: { code?: string; token?: string } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, message: 'Richiesta non valida' }, { status: 400 });
  }

  const { code } = body;
  if (!code || typeof code !== 'string' || !code.trim()) {
    return NextResponse.json({ success: false, message: 'Codice di verifica richiesto' }, { status: 400 });
  }

  const cookieStore = await cookies();

  // Extract bearer token from Authorization header, body, or wm_mfa_token cookie
  let authHeader = request.headers.get('Authorization') || request.headers.get('authorization');
  if (!authHeader && body.token) {
    authHeader = `Bearer ${body.token}`;
  }
  if (!authHeader) {
    const mfaCookie = cookieStore.get('wm_mfa_token')?.value;
    if (mfaCookie) {
      authHeader = `Bearer ${mfaCookie}`;
    }
  }

  if (!authHeader) {
    return NextResponse.json(
      { success: false, message: 'Sessione MFA mancante o scaduta. Effettua nuovamente il login.' },
      { status: 401 }
    );
  }

  try {
    const backendRes = await fetch(`${API_BASE}/api/Auth/mfa/verify`, {
      method: 'POST',
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ Code: code.trim() }),
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
      console.error('Error decoding JWT payload in mfa verify route:', err);
    }

    const isDisabled = role.toLowerCase() === 'disabled';

    if (isDisabled) {
      cookieStore.delete('wm_token');
      cookieStore.delete('wm_mfa_token');
      return NextResponse.json(
        { success: false, error: 'account_disabled', message: 'Account non abilitato', role },
        { status: 403 }
      );
    }

    // Remove transitional MFA cookie and set valid authentication cookie
    cookieStore.delete('wm_mfa_token');
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
    const message = err instanceof Error ? err.message : 'Errore del server durante la verifica MFA';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
