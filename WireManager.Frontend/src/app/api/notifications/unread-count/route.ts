import { notificationProxy } from '@/lib/notification-proxy'

export function GET(request: Request) {
  return notificationProxy(request, '/unread-count')
}
