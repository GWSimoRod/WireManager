import { NextRequest } from 'next/server';
import { proxyRequest } from '@/lib/proxy';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ uuid: string; role: string }> }
) {
  const { uuid, role } = await params;
  return proxyRequest(`/api/Auth/users/${uuid}/role/${role}`, {
    method: 'PATCH',
  });
}
