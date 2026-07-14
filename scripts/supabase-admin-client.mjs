import { createClient } from '@supabase/supabase-js';

export function requiredEnvironment(name) {
  const value = process.env[name]?.trim() ?? '';
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

export function createSupabaseAdminClient() {
  const url = requiredEnvironment('NEXT_PUBLIC_SUPABASE_URL');
  const secretKey = requiredEnvironment('SUPABASE_SECRET_KEY');
  return createClient(url, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function findAuthUserByEmail(supabase, email) {
  const normalizedEmail = email.trim().toLocaleLowerCase();
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 100 });
    if (error) throw new Error(`Unable to list auth users: ${error.message}`);
    const user = data.users.find((candidate) => candidate.email?.toLocaleLowerCase() === normalizedEmail);
    if (user) return user;
    if (data.users.length < 100) return null;
  }
  throw new Error('Unable to find user after scanning 2000 auth records.');
}
