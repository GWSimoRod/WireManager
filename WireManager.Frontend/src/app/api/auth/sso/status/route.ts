import { NextResponse } from 'next/server';
import { getApiBaseUrl } from '@/lib/env';

const API_BASE = getApiBaseUrl();

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const res = await fetch(`${API_BASE}/api/Auth/sso/status`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });

    if (res.ok) {
      const data = await res.json().catch(() => ({ enabled: false }));
      return NextResponse.json({ enabled: Boolean(data?.enabled) });
    }

    // Fallback: check /api/Auth/sso/login response behavior
    const loginProbe = await fetch(`${API_BASE}/api/Auth/sso/login`, {
      method: 'GET',
      redirect: 'manual',
      cache: 'no-store',
    });

    const isRedirect = loginProbe.status >= 300 && loginProbe.status < 400;
    const hasLocation = Boolean(loginProbe.headers.get('location'));
    const isEnabled = isRedirect || hasLocation;

    return NextResponse.json({ enabled: isEnabled });
  } catch {
    return NextResponse.json({ enabled: false });
  }
}
