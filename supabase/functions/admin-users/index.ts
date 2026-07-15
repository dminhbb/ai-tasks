import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.110.3';
import {
  authenticatedUserClient,
  handleOptions,
  jsonResponse,
  readJsonBody,
  validateRequestEnvelope,
} from '../_shared/http.ts';

const MAX_REQUEST_BYTES = 16_384;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ROLES = new Set(['superadmin', 'admin', 'user']);

interface AdminUserBody {
  action?: unknown;
  id?: unknown;
  email?: unknown;
  password?: unknown;
  nickname?: unknown;
  role?: unknown;
  isActive?: unknown;
}

interface ProfileRow {
  id: string;
  email: string;
  nickname: string;
  role: 'superadmin' | 'admin' | 'user';
  is_active: boolean;
  created_at: string;
}

function adminClient(): SupabaseClient {
  const url = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!url || !serviceRoleKey) throw new Error('SERVER_CONFIGURATION');
  return createClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
}

function normalizedEmail(value: unknown): string {
  if (typeof value !== 'string') throw new Error('INVALID_USER');
  const email = value.trim().toLocaleLowerCase();
  if (email.length > 254 || !EMAIL_PATTERN.test(email)) throw new Error('INVALID_USER');
  return email;
}

function normalizedNickname(value: unknown): string {
  if (typeof value !== 'string') throw new Error('INVALID_USER');
  return value.trim().replace(/\s+/g, ' ').slice(0, 100);
}

function validRole(value: unknown): value is ProfileRow['role'] {
  return typeof value === 'string' && ROLES.has(value);
}

async function requireSuperadmin(request: Request) {
  const { supabase, user } = await authenticatedUserClient(request);
  const { data, error } = await supabase
    .from('profiles')
    .select('role, is_active')
    .eq('id', user.id)
    .single();
  if (error || data.role !== 'superadmin' || !data.is_active) throw new Error('FORBIDDEN');
  return { actor: user, admin: adminClient() };
}

async function readProfile(admin: SupabaseClient, id: string): Promise<ProfileRow> {
  const { data, error } = await admin
    .from('profiles')
    .select('id, email, nickname, role, is_active, created_at')
    .eq('id', id)
    .single();
  if (error || !data) throw new Error('USER_NOT_FOUND');
  return data as ProfileRow;
}

async function ensureNotLastSuperadmin(admin: SupabaseClient, profile: ProfileRow, nextRole?: string) {
  if (profile.role !== 'superadmin' || nextRole === 'superadmin') return;
  const { count, error } = await admin
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('role', 'superadmin')
    .eq('is_active', true);
  if (error || (count ?? 0) <= 1) throw new Error('LAST_SUPERADMIN');
}

async function audit(
  admin: SupabaseClient,
  actorId: string,
  targetId: string | null,
  action: string,
  details: Record<string, unknown>
) {
  const { error } = await admin.from('user_admin_audit_events').insert({
    actor_user_id: actorId,
    target_user_id: targetId,
    action,
    details,
  });
  if (error) throw new Error('AUDIT_FAILED');
}

function errorResponse(request: Request, error: unknown): Response {
  const code = error instanceof Error ? error.message : '';
  if (code === 'UNAUTHENTICATED') return jsonResponse(request, { error: 'Authentication required.' }, 401);
  if (code === 'FORBIDDEN') return jsonResponse(request, { error: 'Superadmin permission required.' }, 403);
  if (code === 'INVALID_USER') return jsonResponse(request, { error: 'Invalid user information.' }, 400);
  if (code === 'USER_NOT_FOUND') return jsonResponse(request, { error: 'User was not found.' }, 404);
  if (code === 'LAST_SUPERADMIN')
    return jsonResponse(request, { error: 'The last active superadmin cannot be changed.' }, 409);
  if (code === 'USER_HAS_NOTEBOOKS')
    return jsonResponse(request, { error: 'Transfer or delete notebooks owned by this user first.' }, 409);
  if (code === 'PAYLOAD_TOO_LARGE') return jsonResponse(request, { error: 'Request is too large.' }, 413);
  if (code === 'INVALID_JSON') return jsonResponse(request, { error: 'Invalid JSON request.' }, 400);
  console.error('Admin user request failed:', code || 'unknown');
  return jsonResponse(request, { error: 'Unable to manage users right now.' }, 500);
}

Deno.serve(async (request: Request) => {
  const optionsResponse = handleOptions(request);
  if (optionsResponse) return optionsResponse;
  const envelopeError = validateRequestEnvelope(request, MAX_REQUEST_BYTES);
  if (envelopeError) return envelopeError;

  try {
    const { actor, admin } = await requireSuperadmin(request);
    const body = await readJsonBody<AdminUserBody>(request, MAX_REQUEST_BYTES);

    if (body.action === 'list') {
      const { data, error } = await admin
        .from('profiles')
        .select('id, email, nickname, role, is_active, created_at')
        .order('created_at');
      if (error) throw new Error('PROFILE_LIST_FAILED');
      return jsonResponse(request, { users: data ?? [] });
    }

    if (body.action === 'create') {
      const email = normalizedEmail(body.email);
      const nickname = normalizedNickname(body.nickname);
      if (typeof body.password !== 'string' || body.password.length < 8 || body.password.length > 128) {
        throw new Error('INVALID_USER');
      }
      if (!validRole(body.role) || typeof body.isActive !== 'boolean') throw new Error('INVALID_USER');

      const { data, error } = await admin.auth.admin.createUser({
        email,
        password: body.password,
        email_confirm: true,
        user_metadata: { nickname },
        app_metadata: { app_role: body.role, is_active: body.isActive },
      });
      if (error || !data.user) throw new Error('AUTH_CREATE_FAILED');

      const { error: profileError } = await admin.from('profiles').upsert({
        id: data.user.id,
        email,
        nickname,
        role: body.role,
        is_active: body.isActive,
      });
      if (profileError) {
        await admin.auth.admin.deleteUser(data.user.id);
        throw new Error('PROFILE_CREATE_FAILED');
      }
      if (!body.isActive) {
        await admin.auth.admin.updateUserById(data.user.id, { ban_duration: '876000h' });
      }
      await audit(admin, actor.id, data.user.id, 'create', { email, role: body.role });
      return jsonResponse(request, { ok: true });
    }

    if (typeof body.id !== 'string' || !UUID_PATTERN.test(body.id)) throw new Error('INVALID_USER');
    const existing = await readProfile(admin, body.id);

    if (body.action === 'update') {
      const email = normalizedEmail(body.email);
      const nickname = normalizedNickname(body.nickname);
      if (!validRole(body.role) || typeof body.isActive !== 'boolean') throw new Error('INVALID_USER');
      if (actor.id === body.id && (body.role !== 'superadmin' || !body.isActive)) throw new Error('FORBIDDEN');
      await ensureNotLastSuperadmin(admin, existing, body.isActive ? body.role : 'inactive');

      const password = typeof body.password === 'string' ? body.password : '';
      if (password && (password.length < 8 || password.length > 128)) throw new Error('INVALID_USER');
      const baseAttributes = {
        email,
        email_confirm: true,
        user_metadata: { nickname },
        app_metadata: { app_role: body.role, is_active: body.isActive },
        ban_duration: body.isActive ? 'none' : '876000h',
      };
      const attributes = password ? { ...baseAttributes, password } : baseAttributes;
      const { error } = await admin.auth.admin.updateUserById(body.id, attributes);
      if (error) throw new Error('AUTH_UPDATE_FAILED');
      const { error: profileError } = await admin.from('profiles').update({
        email,
        nickname,
        role: body.role,
        is_active: body.isActive,
      }).eq('id', body.id);
      if (profileError) throw new Error('PROFILE_UPDATE_FAILED');
      await audit(admin, actor.id, body.id, 'update', { email, role: body.role, isActive: body.isActive });
      return jsonResponse(request, { ok: true });
    }

    if (body.action === 'deactivate') {
      if (actor.id === body.id) throw new Error('FORBIDDEN');
      await ensureNotLastSuperadmin(admin, existing, 'inactive');
      const { error } = await admin.auth.admin.updateUserById(body.id, {
        ban_duration: '876000h',
        app_metadata: { app_role: existing.role, is_active: false },
      });
      if (error) throw new Error('AUTH_UPDATE_FAILED');
      const { error: profileError } = await admin.from('profiles').update({ is_active: false }).eq('id', body.id);
      if (profileError) throw new Error('PROFILE_UPDATE_FAILED');
      await audit(admin, actor.id, body.id, 'deactivate', { email: existing.email });
      return jsonResponse(request, { ok: true });
    }

    if (body.action === 'permanentDelete') {
      if (actor.id === body.id) throw new Error('FORBIDDEN');
      await ensureNotLastSuperadmin(admin, existing, 'deleted');
      const { count, error: notebookError } = await admin
        .from('notebooks')
        .select('id', { count: 'exact', head: true })
        .eq('owner_id', body.id);
      if (notebookError || (count ?? 0) > 0) throw new Error('USER_HAS_NOTEBOOKS');
      await audit(admin, actor.id, body.id, 'permanent_delete', { email: existing.email });
      const { error } = await admin.auth.admin.deleteUser(body.id);
      if (error) throw new Error('AUTH_DELETE_FAILED');
      return jsonResponse(request, { ok: true });
    }

    return jsonResponse(request, { error: 'Unsupported action.' }, 400);
  } catch (error: unknown) {
    return errorResponse(request, error);
  }
});
