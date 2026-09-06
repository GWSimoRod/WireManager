import { NextRequest } from 'next/server';
import { proxyRequest } from '@/lib/proxy';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const start = searchParams.get('start');
  const end = searchParams.get('end');
  const searchTerm = searchParams.get('searchTerm');
  
  const query = new URLSearchParams();
  if (start) query.append('start', start);
  if (end) query.append('end', end);
  if (searchTerm) query.append('searchTerm', searchTerm);
  
  const queryString = query.toString();
  const path = queryString ? `/api/Auth/users?${queryString}` : '/api/Auth/users';
  
  const backendRes = await proxyRequest(path, { method: 'GET' });

  const totalCountHeader = backendRes.headers.get('X-Total-Count');
  const totalCount = totalCountHeader ? parseInt(totalCountHeader, 10) : null;

  const text = await backendRes.text();
  const data = text ? JSON.parse(text) : [];

  return new Response(JSON.stringify({ data, totalCount }), {
    status: backendRes.status,
    headers: { 'Content-Type': 'application/json' },
  });
}
