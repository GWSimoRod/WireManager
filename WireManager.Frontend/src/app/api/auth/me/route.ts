import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get('wm_token')?.value;

  if (!token || token === 'undefined' || token === 'null') {
    return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });
  }

  try {
    // Decode JWT payload (middle part) without verification
    const parts = token.split('.');
    if (parts.length !== 3) {
      return NextResponse.json({ error: 'Token non valido' }, { status: 401 });
    }

    const payload = JSON.parse(
      Buffer.from(parts[1], 'base64url').toString('utf-8')
    );

    return NextResponse.json({
      username: payload.unique_name || payload.sub || '',
      role: payload.role || 'Operator',
    });
  } catch {
    return NextResponse.json({ error: 'Token non valido' }, { status: 401 });
  }
}
