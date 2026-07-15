import { createClient, type SupabaseClient, type User } from 'npm:@supabase/supabase-js@2.110.3';

const JSON_HEADERS = { 'Content-Type': 'application/json; charset=utf-8' };
const DEFAULT_MAX_REQUEST_BYTES = 32_768;

function allowedOrigins(): Set<string> {
  const configured = Deno.env.get('ALLOWED_ORIGINS') ?? 'http://localhost:3000';
  return new Set(
    configured
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean)
  );
}

export function corsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get('origin') ?? '';
  const allowedOrigin = allowedOrigins().has(origin) ? origin : '';
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

export function jsonResponse(request: Request, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...JSON_HEADERS,
      ...corsHeaders(request),
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

export function handleOptions(request: Request): Response | null {
  if (request.method !== 'OPTIONS') return null;
  const headers = corsHeaders(request);
  if (!headers['Access-Control-Allow-Origin'])
    return jsonResponse(request, { error: 'Origin not allowed.' }, 403);
  return new Response(null, { status: 204, headers });
}

export function validateRequestEnvelope(
  request: Request,
  maxRequestBytes = DEFAULT_MAX_REQUEST_BYTES
): Response | null {
  if (request.method !== 'POST') return jsonResponse(request, { error: 'Method not allowed.' }, 405);
  if (!corsHeaders(request)['Access-Control-Allow-Origin']) {
    return jsonResponse(request, { error: 'Origin not allowed.' }, 403);
  }
  const contentType = request.headers.get('content-type') ?? '';
  if (!contentType.toLocaleLowerCase().startsWith('application/json')) {
    return jsonResponse(request, { error: 'Content-Type must be application/json.' }, 415);
  }
  const contentLengthHeader = request.headers.get('content-length');
  const contentLength = contentLengthHeader === null ? null : Number(contentLengthHeader);
  if (contentLength !== null && (!Number.isFinite(contentLength) || contentLength < 0)) {
    return jsonResponse(request, { error: 'Invalid Content-Length header.' }, 400);
  }
  if (contentLength !== null && contentLength > maxRequestBytes) {
    return jsonResponse(request, { error: 'Request payload is too large.' }, 413);
  }
  return null;
}

export async function readJsonBody<T>(request: Request, maxRequestBytes: number): Promise<T> {
  if (!request.body) throw new Error('INVALID_JSON');

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    totalBytes += value.byteLength;
    if (totalBytes > maxRequestBytes) {
      await reader.cancel();
      throw new Error('PAYLOAD_TOO_LARGE');
    }
    chunks.push(value);
  }

  const payload = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    payload.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    return JSON.parse(new TextDecoder().decode(payload)) as T;
  } catch {
    throw new Error('INVALID_JSON');
  }
}

export async function authenticatedUserClient(request: Request): Promise<{
  supabase: SupabaseClient;
  user: User;
}> {
  const authorization = request.headers.get('authorization') ?? '';
  if (!authorization.toLocaleLowerCase().startsWith('bearer ')) throw new Error('UNAUTHENTICATED');

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const publishableKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  if (!supabaseUrl || !publishableKey) throw new Error('SERVER_CONFIGURATION');

  const supabase = createClient(supabaseUrl, publishableKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  });
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error('UNAUTHENTICATED');

  return { supabase, user: data.user };
}

export async function authenticatedClient(request: Request): Promise<{
  supabase: SupabaseClient;
  user: User;
}> {
  const { supabase, user } = await authenticatedUserClient(request);
  const { data: quotaAllowed, error: quotaError } = await supabase.rpc('consume_ai_quota');
  if (quotaError) throw new Error('QUOTA_CHECK_FAILED');
  if (!quotaAllowed) throw new Error('RATE_LIMITED');

  return { supabase, user };
}

export function safeFunctionError(request: Request, error: unknown): Response {
  const code = error instanceof Error ? error.message : '';
  if (code === 'UNAUTHENTICATED') return jsonResponse(request, { error: 'Authentication required.' }, 401);
  if (code === 'RATE_LIMITED')
    return jsonResponse(request, { error: 'Too many AI requests. Try again later.' }, 429);
  if (code === 'NOT_FOUND') return jsonResponse(request, { error: 'Requested notebook was not found.' }, 404);
  if (code === 'PAYLOAD_TOO_LARGE')
    return jsonResponse(request, { error: 'Request payload is too large.' }, 413);
  if (code === 'INVALID_JSON')
    return jsonResponse(request, { error: 'Request body must be valid JSON.' }, 400);
  if (code === 'INVALID_RESPONSE')
    return jsonResponse(request, { error: 'The AI service returned an invalid response.' }, 502);
  if (/^GEMINI_\d{3}$/.test(code)) {
    return jsonResponse(request, { error: 'The AI service rejected the request.' }, 502);
  }
  console.error('Edge function request failed:', code || 'unknown error');
  return jsonResponse(request, { error: 'The AI service is temporarily unavailable.' }, 500);
}
