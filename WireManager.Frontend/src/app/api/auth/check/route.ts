import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get('wm_token')?.value;
  let isValid = !!token && token !== 'undefined' && token !== 'null';

  if (isValid && token) {
    try {
      const parts = token.split('.');
      if (parts.length === 3) {
        const payload = JSON.parse(
          Buffer.from(parts[1], 'base64url').toString('utf-8')
        );
        const role =
          payload.role ||
          payload['http://schemas.microsoft.com/ws/2008/06/identity/claims/role'] ||
          payload.Role ||
          '';
        if (role.toLowerCase() === 'mfa' || role.toLowerCase() === 'disabled') {
          isValid = false;
        }
      }
    } catch {
      isValid = false;
    }
  }

  return NextResponse.json({ authenticated: isValid });
}
