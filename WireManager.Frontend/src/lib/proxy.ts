import { cookies } from 'next/headers';
import { getApiBaseUrl } from './env';

const API_BASE = getApiBaseUrl();

export async function proxyRequest(
  backendPath: string,
  options: {
    method?: string;
    body?: string | null;
    contentType?: string;
  } = {}
): Promise<Response> {
  const cookieStore = await cookies();
  const token = cookieStore.get('wm_token')?.value;

  const headers: Record<string, string> = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  if (options.contentType !== null) {
    headers['Content-Type'] = options.contentType || 'application/json';
  }

  const res = await fetch(`${API_BASE}${backendPath}`, {
    method: options.method || 'GET',
    headers,
    body: options.body || undefined,
  });

  console.log(`Proxy ${options.method || 'GET'} ${backendPath} - Status: ${res.status}`);
  if (!res.ok) {
    console.log(`Proxy Error Headers:`, Object.fromEntries(res.headers.entries()));
  }

  const contentType = res.headers.get('content-type') || '';
  const totalCount = res.headers.get('X-Total-Count');
  
  const forwardHeaders: Record<string, string> = { 'Content-Type': contentType };
  if (totalCount !== null) forwardHeaders['X-Total-Count'] = totalCount;

  if (contentType.startsWith('image/')) {
    return new Response(res.body, {
      status: res.status,
      headers: forwardHeaders,
    });
  }

  if (contentType.startsWith('text/')) {
    const text = await res.text();
    forwardHeaders['Content-Type'] = 'text/plain';
    return new Response(text, {
      status: res.status,
      headers: forwardHeaders,
    });
  }

  const text = await res.text();
  forwardHeaders['Content-Type'] = text ? 'application/json' : 'text/plain';
  return new Response(text, {
    status: res.status,
    headers: forwardHeaders,
  });
}
