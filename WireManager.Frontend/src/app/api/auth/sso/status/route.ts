import { NextResponse } from 'next/server';
import { getApiBaseUrl } from '@/lib/env';

export const dynamic = 'force-dynamic';

export async function GET() {
  const apiBase = getApiBaseUrl();
  const backendUrl = (process.env.BACKEND_URL || apiBase).replace(/\/+$/, '');
  const ssoUrl = `${backendUrl}/api/Auth/sso/login`;

  try {
    const res = await fetch(`${apiBase}/api/Auth/sso/status`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });

    if (res.ok) {
      const data = await res.json().catch(() => ({ enabled: false }));
      return NextResponse.json({
        enabled: Boolean(data?.enabled),
        ssoUrl,
      });
    }

    // Fallback: check /api/Auth/sso/login response behavior
    const loginProbe = await fetch(`${apiBase}/api/Auth/sso/login`, {
      method: 'GET',
      redirect: 'manual',
      cache: 'no-store',
    });

    const isRedirect = loginProbe.status >= 300 && loginProbe.status < 400;
    const hasLocation = Boolean(loginProbe.headers.get('location'));
    const isEnabled = isRedirect || hasLocation;

    return NextResponse.json({
      enabled: isEnabled,
      ssoUrl,
    });
  } catch {
    return NextResponse.json({ enabled: false, ssoUrl });
  }
}
