import { proxyRequest } from '@/lib/proxy';

export async function POST() {
  return proxyRequest('/api/Auth/mfa/disable', { method: 'POST' });
}
