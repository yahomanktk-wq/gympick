import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Platform } from 'react-native';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import * as AuthSession from 'expo-auth-session';
import * as AppleAuthentication from 'expo-apple-authentication';
import { UserRole } from '../data/types';
import { supabase } from '../lib/supabase';

WebBrowser.maybeCompleteAuthSession();

// --- Types

export interface AuthUser {
  id: string;
  name: string;
  nickname?: string;
  email: string;
  role: UserRole;
  managedGymIds: string[];
  gymId?: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  signIn:       (email: string, password: string) => Promise<{ error: string | null }>;
  signUp:       (
    email: string, password: string,
    name: string, nickname: string, birthDate: string,
  ) => Promise<{ error: string | null; needsVerification: boolean }>;
  signOut:      () => Promise<void>;
  signInGoogle: () => Promise<{ error: string | null }>;
  signInApple:  () => Promise<{ error: string | null }>;
  switchRole: (role: UserRole) => void;
}

// --- Mock users

const MOCK_USERS: Record<UserRole, AuthUser> = {
  user: {
    id: 'u1', name: 'Alex Park', nickname: 'AlexP', email: 'alex@gympick.io',
    role: 'user', managedGymIds: [],
  },
  manager: {
    id: 'u2', name: 'Jordan Kim', nickname: 'JordanK', email: 'jordan@ironhub.kr',
    role: 'manager', managedGymIds: ['g01', 'g02'],
  },
  admin: {
    id: 'u3', name: 'Sam Lee', nickname: 'SamL', email: 'sam@gympick.io',
    role: 'admin', managedGymIds: [],
  },
};

const DEMO_USER: AuthUser = {
  id: 'u1', name: '짐픽 사용자', nickname: '짐픽유저', email: 'demo@gympick.app',
  role: 'user', managedGymIds: [],
};
const DEMO_MANAGER: AuthUser = {
  id: 'u2', name: '헬스장 매니저', nickname: '매니저', email: 'manager@gympick.app',
  role: 'manager', managedGymIds: ['g01'],
};

const MOCK_CREDENTIALS: Record<string, { user: AuthUser; password: string }> = {
  'alex@gympick.io':      { user: MOCK_USERS.user,    password: 'gympick123' },
  'jordan@ironhub.kr':    { user: MOCK_USERS.manager, password: 'gympick123' },
  'sam@gympick.io':       { user: MOCK_USERS.admin,   password: 'gympick123' },
  'demo@gympick.app':     { user: DEMO_USER,           password: 'Demo1234!' },
  'manager@gympick.app':  { user: DEMO_MANAGER,        password: 'Demo1234!' },
};

function mapSupabaseUser(sbUser: SupabaseUser): AuthUser {
  const mock = Object.values(MOCK_USERS).find(m => m.email === sbUser.email);
  if (mock) return mock;
  return {
    id:            sbUser.id,
    name:          sbUser.user_metadata?.name ?? sbUser.email?.split('@')[0] ?? 'User',
    nickname:      sbUser.user_metadata?.nickname,
    email:         sbUser.email ?? '',
    role:          'user',
    managedGymIds: [],
  };
}

// --- Context

const AuthContext = createContext<AuthContextValue>({
  user:         null,
  loading:      true,
  signIn:       async () => ({ error: null }),
  signUp:       async () => ({ error: null, needsVerification: false }),
  signOut:      async () => {},
  signInGoogle: async () => ({ error: null }),
  signInApple:  async () => ({ error: null }),
  switchRole:   () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user,    setUser]    = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const supabaseConfigured = !!(process.env.EXPO_PUBLIC_SUPABASE_URL);

  // useProxy: true → Expo 프록시 서버를 통해 리디렉션
  // Expo Go 개발 환경에서 Google 로그인 가능하게 함
  const redirectUri = AuthSession.makeRedirectUri();

  const [_googleRequest, _googleResponse, promptGoogleAsync] = Google.useAuthRequest({
    iosClientId:     process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
    androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
    webClientId:     process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    redirectUri,
  });

  useEffect(() => {
    if (!supabaseConfigured) {
      setLoading(false);
      return;
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ? mapSupabaseUser(session.user) : null);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ? mapSupabaseUser(session.user) : null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string): Promise<{ error: string | null }> => {
    const trimmedEmail = email.trim().toLowerCase();

    if (!supabaseConfigured) {
      const entry = MOCK_CREDENTIALS[trimmedEmail];
      if (!entry || password !== entry.password) {
        return { error: '이메일 또는 비밀번호가 올바르지 않습니다.' };
      }
      setUser(entry.user);
      return { error: null };
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email: trimmedEmail,
      password,
    });
    if (error) return { error: error.message };
    if (data.user) setUser(mapSupabaseUser(data.user));
    return { error: null };
  };

  const signUp = async (
    email: string, password: string,
    name: string, nickname: string, birthDate: string,
  ): Promise<{ error: string | null; needsVerification: boolean }> => {
    const trimmedEmail = email.trim().toLowerCase();

    if (!supabaseConfigured) {
      const mockUser: AuthUser = {
        id:            `mock-${Date.now()}`,
        name,
        nickname,
        email:         trimmedEmail,
        role:          'user',
        managedGymIds: [],
      };
      setUser(mockUser);
      return { error: null, needsVerification: false };
    }

    const { data, error } = await supabase.auth.signUp({
      email: trimmedEmail,
      password,
      options: { data: { name, nickname } },
    });
    if (error) return { error: error.message, needsVerification: false };

    if (data.user) {
      await supabase.from('profiles').upsert({
        id:         data.user.id,
        name,
        nickname,
        birth_date: birthDate,
      });
    }

    const needsVerification = !data.session;
    if (!needsVerification && data.user) {
      setUser(mapSupabaseUser(data.user));
    }
    return { error: null, needsVerification };
  };

  const signOut = async () => {
    if (supabaseConfigured) {
      await supabase.auth.signOut();
    }
    setUser(null);
  };

  const signInGoogle = async (): Promise<{ error: string | null }> => {
    try {
      const result = await promptGoogleAsync();

      if (result.type !== 'success') {
        return { error: '구글 로그인이 취소되었습니다.' };
      }

      if (!supabaseConfigured) {
        setUser({
          id:            'google-mock',
          name:          'Google User',
          nickname:      'GoogleUser',
          email:         'google@mock.com',
          role:          'user',
          managedGymIds: [],
        });
        return { error: null };
      }

      const { authentication } = result;
      if (!authentication?.idToken) {
        return { error: '구글 인증 토큰을 받지 못했습니다.' };
      }

      const { data, error } = await supabase.auth.signInWithIdToken({
        provider: 'google',
        token:    authentication.idToken,
      });

      if (error) return { error: error.message };
      if (data.user) setUser(mapSupabaseUser(data.user));
      return { error: null };
    } catch (e: any) {
      return { error: e.message ?? '구글 로그인 중 오류가 발생했습니다.' };
    }
  };

  const signInApple = async (): Promise<{ error: string | null }> => {
    try {
      if (Platform.OS !== 'ios') {
        return { error: 'Apple 로그인은 iOS에서만 사용 가능합니다.' };
      }

      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      if (!credential.identityToken) {
        return { error: 'Apple 인증 토큰을 받지 못했습니다.' };
      }

      if (!supabaseConfigured) {
        const fullName = credential.fullName;
        const name = [fullName?.givenName, fullName?.familyName]
          .filter(Boolean).join(' ') || 'Apple User';
        setUser({
          id:            'apple-mock',
          name,
          nickname:      'AppleUser',
          email:         credential.email ?? 'apple@mock.com',
          role:          'user',
          managedGymIds: [],
        });
        return { error: null };
      }

      const { data, error } = await supabase.auth.signInWithIdToken({
        provider: 'apple',
        token:    credential.identityToken,
      });

      if (error) return { error: error.message };
      if (data.user) setUser(mapSupabaseUser(data.user));
      return { error: null };
    } catch (e: any) {
      if (e.code === 'ERR_REQUEST_CANCELED') {
        return { error: 'Apple 로그인이 취소되었습니다.' };
      }
      return { error: e.message ?? 'Apple 로그인 중 오류가 발생했습니다.' };
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      signIn,
      signUp,
      signOut,
      signInGoogle,
      signInApple,
      switchRole: role => setUser(MOCK_USERS[role]),
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
