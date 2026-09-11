import { NextRequest, NextResponse } from 'next/server';
import { getBackendUrl } from '@/lib/env';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token') || '';
  const backendUrl = getBackendUrl();
  const targetUrl = `${backendUrl}/api/Auth/sso/login${token ? `?token=${encodeURIComponent(token)}` : ''}`;

  return NextResponse.redirect(targetUrl);
}
