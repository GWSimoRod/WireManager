import { NextRequest } from 'next/server';
import { proxyRequest } from '@/lib/proxy';

export async function GET() {
  return proxyRequest('/api/Server');
}

export async function POST(request: NextRequest) {
  const body = await request.text();
  return proxyRequest('/api/Server', { method: 'POST', body });
}
