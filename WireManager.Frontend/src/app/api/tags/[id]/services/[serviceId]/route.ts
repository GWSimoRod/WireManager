import { NextRequest } from 'next/server';
import { proxyRequest } from '@/lib/proxy';

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; serviceId: string }> }
) {
  const { id, serviceId } = await params;
  return proxyRequest(`/api/Policy/tags/${id}/services/${serviceId}`, { method: 'DELETE' });
}
