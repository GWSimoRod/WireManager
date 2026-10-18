import { notificationProxy } from '@/lib/notification-proxy'

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params
  if (!/^[1-9]\d*$/.test(id)) return new Response(null, { status: 400 })
  return notificationProxy(request, `/${id}/read`, 'PATCH')
}
