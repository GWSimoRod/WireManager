import { NextRequest } from 'next/server';
import { proxyRequest } from '@/lib/proxy';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; policyId: string }> }
) {
  const { id, policyId } = await params;
  return proxyRequest(`/api/Peer/${id}/policies/${policyId}`, { method: 'POST' });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; policyId: string }> }
) {
  const { id, policyId } = await params;
  return proxyRequest(`/api/Peer/${id}/policies/${policyId}`, { method: 'DELETE' });
}
