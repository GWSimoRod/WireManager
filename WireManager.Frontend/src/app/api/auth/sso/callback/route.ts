import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrl } from '@/lib/env';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const queryToken = searchParams.get('token');
  let token = queryToken;

  const locale = request.cookies.get('NEXT_LOCALE')?.value;
  const loginPath = locale ? `/${locale}/login` : '/login';
  const dashboardPath = locale ? `/${locale}/dashboard` : '/dashboard';

  // If token is not in query params, call backend /api/Auth/sso/callback with forwarded cookies
  if (!token) {
    const backendUrl = `${getApiBaseUrl()}/api/Auth/sso/callback${request.nextUrl.search}`;
    const cookieHeader = request.headers.get('cookie') || '';

    try {
      const backendRes = await fetch(backendUrl, {
        method: 'GET',
        headers: {
          Cookie: cookieHeader,
          Accept: 'application/json',
        },
        redirect: 'manual',
      });

      if (backendRes.ok) {
        const data = await backendRes.json().catch(() => null);
        token = data?.token || data?.Token || null;
      } else {
        console.error('SSO callback backend returned status:', backendRes.status);
      }
    } catch (err) {
      console.error('Error contacting backend SSO callback:', err);
    }
  }

  if (!token) {
    const errorUrl = new URL(`${loginPath}?error=sso_failed`, request.url);
    return NextResponse.redirect(errorUrl);
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
    console.error('Error decoding JWT payload in SSO callback:', err);
  }

  const isDisabled = role.toLowerCase() === 'disabled';

  if (isDisabled) {
    const disabledUrl = new URL(`${loginPath}?error=account_disabled`, request.url);
    const redirectRes = NextResponse.redirect(disabledUrl);
    redirectRes.cookies.delete('wm_token');
    return redirectRes;
  }

  // User is Operator, Admin, or other enabled role: grant session and go to dashboard
  const successUrl = new URL(dashboardPath, request.url);
  const redirectRes = NextResponse.redirect(successUrl);
  redirectRes.cookies.set('wm_token', token, {
    httpOnly: true,
    secure: false,
    sameSite: 'lax',
    path: '/',
    maxAge: 86400,
  });

  return redirectRes;
}
