import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get('wm_token')?.value;
  const isValid = !!token && token !== 'undefined' && token !== 'null';

  return NextResponse.json({ authenticated: isValid });
}
