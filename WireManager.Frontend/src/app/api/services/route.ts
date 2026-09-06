import { NextRequest } from 'next/server';
import { proxyRequest } from '@/lib/proxy';

export async function GET() {
  return proxyRequest('/api/Policy/services');
}

export async function POST(request: NextRequest) {
  const body = await request.text();
  return proxyRequest('/api/Policy/services', { method: 'POST', body });
}
