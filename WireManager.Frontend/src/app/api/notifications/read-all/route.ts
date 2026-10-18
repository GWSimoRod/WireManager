import { notificationProxy } from '@/lib/notification-proxy'

export function PATCH(request: Request) {
  return notificationProxy(request, '/read-all', 'PATCH')
}
