import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrl } from '@/lib/env';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token') || '';
  const backendUrl = `${getApiBaseUrl()}/api/Auth/sso/login${token ? `?token=${encodeURIComponent(token)}` : ''}`;

  try {
    const backendRes = await fetch(backendUrl, {
      method: 'GET',
      redirect: 'manual',
    });

    const location = backendRes.headers.get('location');
    const setCookies = backendRes.headers.getSetCookie?.() || [];

    if (location) {
      const accept = request.headers.get('accept') || '';
      if (accept.includes('application/json')) {
        const jsonRes = NextResponse.json({ url: location, redirect: true });
        for (const cookie of setCookies) {
          jsonRes.headers.append('Set-Cookie', cookie);
        }
        return jsonRes;
      }

      const redirectRes = NextResponse.redirect(location);
      for (const cookie of setCookies) {
        redirectRes.headers.append('Set-Cookie', cookie);
      }
      return redirectRes;
    }

    const contentType = backendRes.headers.get('content-type') || 'text/plain';
    const text = await backendRes.text();
    const responseHeaders = new Headers({ 'Content-Type': contentType });
    for (const cookie of setCookies) {
      responseHeaders.append('Set-Cookie', cookie);
    }

    return new Response(text, {
      status: backendRes.status,
      headers: responseHeaders,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Proxy error';
    return NextResponse.json({ message }, { status: 500 });
  }
}
