import { proxyRequest } from '@/lib/proxy';

export async function POST() {
  return proxyRequest('/api/Auth/mfa/enable', { method: 'POST' });
}
