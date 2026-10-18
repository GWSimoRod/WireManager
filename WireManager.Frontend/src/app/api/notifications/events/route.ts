import { cookies } from 'next/headers'
import { HubConnectionBuilder, LogLevel } from '@microsoft/signalr'
import { getApiBaseUrl } from '@/lib/env'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Keep the bearer token server-side. The browser receives only invalidation events.
export async function GET(request: Request) {
  const token = (await cookies()).get('wm_token')?.value
  if (!token) return new Response(null, { status: 401 })

  const connection = new HubConnectionBuilder()
    .withUrl(`${getApiBaseUrl()}/hubs/notifications`, {
      accessTokenFactory: () => token,
    })
    .configureLogging(LogLevel.None)
    .build()

  let closed = false
  let heartbeat: ReturnType<typeof setInterval> | undefined
  let controller: ReadableStreamDefaultController<Uint8Array> | undefined
  const encoder = new TextEncoder()
  const close = () => {
    if (closed) return
    closed = true
    clearInterval(heartbeat)
    request.signal.removeEventListener('abort', close)
    controller?.close()
    void connection.stop().catch(() => {})
  }
  const send = (event: string) => {
    if (!closed)
      controller?.enqueue(encoder.encode(`event: ${event}\ndata: {}\n\n`))
  }
  connection.on('NotificationReceived', () => send('notification'))
  connection.onclose(close)
  request.signal.addEventListener('abort', close, { once: true })
  if (request.signal.aborted) close()

  try {
    if (closed) return new Response(null, { status: 499 })
    await connection.start()
    if (closed) {
      await connection.stop()
      return new Response(null, { status: 499 })
    }
  } catch {
    close()
    return new Response(null, { status: 503 })
  }

  const stream = new ReadableStream<Uint8Array>({
    start(streamController) {
      controller = streamController
      send('ready')
      heartbeat = setInterval(() => send('heartbeat'), 20_000)
    },
    cancel() {
      // A cancelled stream is already closed by the runtime.
      controller = undefined
      close()
    },
  })
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'private, no-cache, no-transform',
      'X-Accel-Buffering': 'no',
    },
  })
}
