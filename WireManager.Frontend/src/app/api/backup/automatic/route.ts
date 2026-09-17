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
  const backendRes = await fetch(`${API_BASE}/api/backup/automatic`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body,
  });

  const responseText = await backendRes.text();

  if (!backendRes.ok) {
    return new Response(responseText || 'Errore durante la configurazione del backup automatico', {
      status: backendRes.status,
      headers: { 'Content-Type': 'text/plain' },
    });
  }

  return new Response(responseText || JSON.stringify({ message: 'Backup automatico configurato con successo' }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get('wm_token')?.value;

  if (!token) {
    return new Response(JSON.stringify({ message: 'Non autenticato' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const API_BASE = getApiBaseUrl();
  const backendRes = await fetch(`${API_BASE}/api/backup/automatic`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!backendRes.ok) {
    const errorText = await backendRes.text();
    return new Response(errorText || 'Errore durante il recupero della configurazione del backup automatico', {
      status: backendRes.status,
      headers: { 'Content-Type': 'text/plain' },
    });
  }

  const data = await backendRes.json().catch(() => null);
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

