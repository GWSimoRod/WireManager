import { NextRequest } from 'next/server';
import { proxyRequest } from '@/lib/proxy';

export async function GET() {
  return proxyRequest('/api/Auth/sso', {
    method: 'GET',
  });
}

export async function PUT(request: NextRequest) {
  const body = await request.text();
  return proxyRequest('/api/Auth/sso', {
    method: 'PUT',
    body,
  });
}
