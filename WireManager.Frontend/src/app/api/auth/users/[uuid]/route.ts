import { NextRequest } from 'next/server';
import { proxyRequest } from '@/lib/proxy';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ uuid: string }> }
) {
  const { uuid } = await params;
  return proxyRequest(`/api/Auth/users/${uuid}`, {
    method: 'DELETE',
  });
}
