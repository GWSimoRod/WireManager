import { NextRequest } from 'next/server';
import { proxyRequest } from '@/lib/proxy';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return proxyRequest(`/api/Server/${id}/sync`, { method: 'POST' });
}
