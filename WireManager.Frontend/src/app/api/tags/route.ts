import { NextRequest } from 'next/server';
import { proxyRequest } from '@/lib/proxy';

export async function GET() {
  return proxyRequest('/api/Policy/tags');
}

export async function POST(request: NextRequest) {
  const body = await request.text();
  return proxyRequest('/api/Policy/tags', { method: 'POST', body });
}
