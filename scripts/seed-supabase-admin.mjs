import { createSupabaseAdminClient, findAuthUserByEmail, requiredEnvironment } from './supabase-admin-client.mjs';

const email = (process.env.SEED_SUPERADMIN_EMAIL?.trim() || 'minhd.mbb@gmail.com').toLocaleLowerCase();
const password = requiredEnvironment('SEED_SUPERADMIN_PASSWORD');

if (password.length < 8) {
  throw new Error('SEED_SUPERADMIN_PASSWORD must contain at least 8 characters.');
}

const supabase = createSupabaseAdminClient();
let user = await findAuthUserByEmail(supabase, email);

if (user) {
  const { data, error } = await supabase.auth.admin.updateUserById(user.id, {
    email,
    password,
    email_confirm: true,
  });
  if (error) throw new Error(`Unable to update the seed user: ${error.message}`);
  user = data.user;
} else {
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !data.user) throw new Error(`Unable to create the seed user: ${error?.message ?? 'unknown error'}`);
  user = data.user;
}

const { error: profileError } = await supabase.from('profiles').upsert({
  id: user.id,
  email,
  role: 'superadmin',
  is_active: true,
});
if (profileError) throw new Error(`Unable to assign the superadmin role: ${profileError.message}`);

console.log(`Seeded superadmin account: ${email}`);
