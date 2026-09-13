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

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return new Response(JSON.stringify({ message: 'Dati di richiesta non validi' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const API_BASE = getApiBaseUrl();
  const backendRes = await fetch(`${API_BASE}/api/backup/restore`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });

  const responseText = await backendRes.text();

  if (!backendRes.ok) {
    return new Response(responseText || 'Errore durante il ripristino del backup', {
      status: backendRes.status,
      headers: { 'Content-Type': 'text/plain' },
    });
  }

  return new Response(responseText || JSON.stringify({ message: 'Backup ripristinato con successo' }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
