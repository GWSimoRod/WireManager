import { NextRequest } from 'next/server';
import { proxyRequest } from '@/lib/proxy';

export async function PATCH(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; bool: string }> }
) {
  const { id, bool } = await params;
  return proxyRequest(`/api/Peer/${id}/status/${bool}`, { method: 'PATCH' });
}
