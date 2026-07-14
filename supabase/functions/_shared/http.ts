import {
  createClient,
  type SupabaseClient,
  type User,
} from 'npm:@supabase/supabase-js@2.110.3';

const JSON_HEADERS = { 'Content-Type': 'application/json; charset=utf-8' };

function allowedOrigins(): Set<string> {
  const configured = Deno.env.get('ALLOWED_ORIGINS') ?? 'http://localhost:3000';
  return new Set(configured.split(',').map((origin) => origin.trim()).filter(Boolean));
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
    headers: { ...JSON_HEADERS, ...corsHeaders(request) },
  });
}

export function handleOptions(request: Request): Response | null {
  if (request.method !== 'OPTIONS') return null;
  const headers = corsHeaders(request);
  if (!headers['Access-Control-Allow-Origin']) return jsonResponse(request, { error: 'Origin not allowed.' }, 403);
  return new Response(null, { status: 204, headers });
}

export function validateRequestEnvelope(request: Request): Response | null {
  if (request.method !== 'POST') return jsonResponse(request, { error: 'Method not allowed.' }, 405);
  if (!corsHeaders(request)['Access-Control-Allow-Origin']) {
    return jsonResponse(request, { error: 'Origin not allowed.' }, 403);
  }
  const contentType = request.headers.get('content-type') ?? '';
  if (!contentType.toLocaleLowerCase().startsWith('application/json')) {
    return jsonResponse(request, { error: 'Content-Type must be application/json.' }, 415);
  }
  const contentLength = Number(request.headers.get('content-length') ?? 0);
  if (Number.isFinite(contentLength) && contentLength > 32_768) {
    return jsonResponse(request, { error: 'Request payload is too large.' }, 413);
  }
  return null;
}

export async function authenticatedClient(request: Request): Promise<{
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

  const { data: quotaAllowed, error: quotaError } = await supabase.rpc('consume_ai_quota');
  if (quotaError) throw new Error('QUOTA_CHECK_FAILED');
  if (!quotaAllowed) throw new Error('RATE_LIMITED');

  return { supabase, user: data.user };
}

export function safeFunctionError(request: Request, error: unknown): Response {
  const code = error instanceof Error ? error.message : '';
  if (code === 'UNAUTHENTICATED') return jsonResponse(request, { error: 'Authentication required.' }, 401);
  if (code === 'RATE_LIMITED') return jsonResponse(request, { error: 'Too many AI requests. Try again later.' }, 429);
  if (code === 'NOT_FOUND') return jsonResponse(request, { error: 'Requested notebook was not found.' }, 404);
  if (code === 'INVALID_RESPONSE') return jsonResponse(request, { error: 'AI returned an invalid response.' }, 502);
  if (code === 'SERVER_CONFIGURATION') {
    return jsonResponse(request, { error: 'The AI service is not configured.', code }, 500);
  }
  if (code === 'QUOTA_CHECK_FAILED') {
    return jsonResponse(request, { error: 'Unable to verify the AI request quota.', code }, 500);
  }
  if (/^GEMINI_\d{3}$/.test(code)) {
    return jsonResponse(request, { error: 'Gemini rejected the request.', code }, 502);
  }
  console.error('Edge function request failed:', code || 'unknown error');
  return jsonResponse(request, { error: 'The AI service is temporarily unavailable.' }, 500);
}
