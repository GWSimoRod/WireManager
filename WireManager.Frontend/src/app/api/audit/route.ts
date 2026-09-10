import { NextRequest } from 'next/server';
import { proxyRequest } from '@/lib/proxy';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const pageNumber = searchParams.get('pageNumber');
  const pageSize = searchParams.get('pageSize');

  const query = new URLSearchParams();
  if (pageNumber) query.append('pageNumber', pageNumber);
  if (pageSize) query.append('pageSize', pageSize);

  const queryString = query.toString();
  const path = queryString ? `/api/Audit?${queryString}` : '/api/Audit';

  const backendRes = await proxyRequest(path, { method: 'GET' });

  const totalCountHeader = backendRes.headers.get('X-Total-Count');
  const totalCount = totalCountHeader ? parseInt(totalCountHeader, 10) : null;

  const text = await backendRes.text();
  let data = [];
  try {
    data = text ? JSON.parse(text) : [];
  } catch {
    data = [];
  }

  // If backend returned an array directly, wrap in { data, totalCount }
  if (Array.isArray(data)) {
    return new Response(JSON.stringify({ data, totalCount }), {
      status: backendRes.status,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // If backend returned an object (e.g. already wrapped or error payload)
  return new Response(text, {
    status: backendRes.status,
    headers: { 'Content-Type': 'application/json' },
  });
}
