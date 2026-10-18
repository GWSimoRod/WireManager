import { cookies } from 'next/headers'
import { getApiBaseUrl } from '@/lib/env'

// Fixed paths are supplied by the route handlers, never by the client.
export async function notificationProxy(
  request: Request,
  path: string,
  method = 'GET',
) {
  const token = (await cookies()).get('wm_token')?.value
  if (!token) return new Response(null, { status: 401 })

  if (method !== 'GET') {
    const origin = request.headers.get('origin')
    if (origin && origin !== new URL(request.url).origin) {
      return new Response(null, { status: 403 })
    }
  }

  try {
    const response = await fetch(
      `${getApiBaseUrl()}/api/notifications${path}`,
      {
        method,
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
        signal: request.signal,
      },
    )
    return new Response(
      response.status === 204 ? null : await response.text(),
      {
        status: response.status,
        headers: {
          'Content-Type':
            response.headers.get('content-type') || 'application/json',
          'Cache-Control': 'private, no-store',
        },
      },
    )
  } catch {
    return Response.json(
      { error: 'Notifications unavailable' },
      { status: 502 },
    )
  }
}
