import { NextRequest, NextResponse } from 'next/server';

const BASE_URL   = process.env.AKENEO_BASE_URL!;
const CLIENT_ID  = process.env.AKENEO_CLIENT_ID!;
const SECRET     = process.env.AKENEO_CLIENT_SECRET!;
const USERNAME   = process.env.AKENEO_USERNAME!;
const PASSWORD   = process.env.AKENEO_PASSWORD!;

let cachedToken = '';
let tokenExpiry = 0;

async function getToken(): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiry) return cachedToken;
  const res = await fetch(`${BASE_URL}/api/oauth/v1/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'password',
      client_id: CLIENT_ID, client_secret: SECRET,
      username: USERNAME, password: PASSWORD,
    }),
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`Auth failed: ${res.status}`);
  const json = await res.json() as { access_token: string; expires_in: number };
  cachedToken = json.access_token;
  tokenExpiry = Date.now() + (json.expires_in - 60) * 1000;
  return cachedToken;
}

export async function GET(req: NextRequest) {
  const mediaPath = req.nextUrl.searchParams.get('path');
  if (!mediaPath) return new NextResponse('Missing path', { status: 400 });

  // Only allow paths that start with /api/rest/v1/media-files/ to prevent SSRF
  if (!mediaPath.startsWith('/api/rest/v1/media-files/')) {
    return new NextResponse('Forbidden', { status: 403 });
  }

  try {
    const token = await getToken();
    const upstream = await fetch(`${BASE_URL}${mediaPath}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });

    if (!upstream.ok) {
      return new NextResponse('Image not found', { status: upstream.status });
    }

    const contentType = upstream.headers.get('content-type') ?? 'image/jpeg';
    const buffer = await upstream.arrayBuffer();

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400', // cache 24h in browser
      },
    });
  } catch {
    return new NextResponse('Proxy error', { status: 502 });
  }
}
