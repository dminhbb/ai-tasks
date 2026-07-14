'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import type { UserProfile } from '@/types';
import { getSupabaseBrowserClient, getSupabaseConfigurationError } from '@/lib/supabase/client';

interface AuthContextValue {
  session: Session | null;
  profile: UserProfile | null;
  loading: boolean;
  error: string;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function loadProfile(userId: string): Promise<UserProfile> {
  const { data, error } = await getSupabaseBrowserClient()
    .from('profiles')
    .select('id, email, role, is_active')
    .eq('id', userId)
    .single();

  if (error) throw new Error('Không thể tải quyền người dùng.');
  if (!data.is_active) throw new Error('Tài khoản đã bị vô hiệu hóa.');

  return {
    id: data.id as string,
    email: data.email as string,
    role: data.role as UserProfile['role'],
    isActive: data.is_active as boolean,
  };
}

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const [configurationError] = useState(() => getSupabaseConfigurationError());
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(() => !configurationError);
  const [error, setError] = useState(() => configurationError ?? '');

  useEffect(() => {
    if (configurationError) return;

    const supabase = getSupabaseBrowserClient();
    let active = true;

    void supabase.auth.getSession().then(async ({ data, error: sessionError }) => {
      if (!active) return;
      if (sessionError) {
        setError('Không thể khôi phục phiên đăng nhập.');
        setLoading(false);
        return;
      }

      setSession(data.session);
      if (data.session) {
        try {
          setProfile(await loadProfile(data.session.user.id));
        } catch (profileError: unknown) {
          setError(profileError instanceof Error ? profileError.message : 'Không thể tải hồ sơ người dùng.');
          await supabase.auth.signOut();
        }
      }
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) return;
      setSession(nextSession);
      if (!nextSession) setProfile(null);
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, [configurationError]);

  const signIn = useCallback(async (email: string, password: string) => {
    setLoading(true);
    setError('');
    try {
      const supabase = getSupabaseBrowserClient();
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim().toLocaleLowerCase(),
        password,
      });
      if (signInError || !data.session) throw new Error('Email hoặc mật khẩu không đúng.');

      const nextProfile = await loadProfile(data.session.user.id);
      setSession(data.session);
      setProfile(nextProfile);
    } catch (signInFailure: unknown) {
      const message = signInFailure instanceof Error ? signInFailure.message : 'Đăng nhập thất bại.';
      setError(message);
      setSession(null);
      setProfile(null);
      throw new Error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  const signOut = useCallback(async () => {
    setLoading(true);
    try {
      await getSupabaseBrowserClient().auth.signOut();
      setSession(null);
      setProfile(null);
      setError('');
    } finally {
      setLoading(false);
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ session, profile, loading, error, signIn, signOut }),
    [session, profile, loading, error, signIn, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider.');
  return value;
}
