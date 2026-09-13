import { NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { getApiBaseUrl } from '@/lib/env';

export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  const token = cookieStore.get('wm_token')?.value;

  if (!token) {
    return new Response(JSON.stringify({ message: 'Non autenticato' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let body: string;
  try {
    body = await request.text();
  } catch {
    return new Response(JSON.stringify({ message: 'Payload non valido' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const API_BASE = getApiBaseUrl();
  const backendRes = await fetch(`${API_BASE}/api/backup`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body,
  });

  if (!backendRes.ok) {
    const errorText = await backendRes.text();
    return new Response(errorText || 'Errore durante la creazione del backup', {
      status: backendRes.status,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const contentType = backendRes.headers.get('content-type') || 'application/octet-stream';
  const contentDisposition =
    backendRes.headers.get('content-disposition') ||
    'attachment; filename="wiremanager-backup.json"';

  return new Response(backendRes.body, {
    status: 200,
    headers: {
      'Content-Type': contentType,
      'Content-Disposition': contentDisposition,
    },
  });
}
