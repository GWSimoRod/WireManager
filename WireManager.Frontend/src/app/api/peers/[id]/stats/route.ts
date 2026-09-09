import { NextRequest } from 'next/server';
import { proxyRequest } from '@/lib/proxy';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const from = searchParams.get('from');
  const query = from ? `?from=${encodeURIComponent(from)}` : '';
  return proxyRequest(`/api/Peer/${id}/stats${query}`);
}
