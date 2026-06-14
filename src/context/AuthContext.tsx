import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Platform } from 'react-native';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import * as WebBrowser from 'expo-web-browser';
import * as AppleAuthentication from 'expo-apple-authentication';
import { UserRole } from '../data/types';
import { supabase } from '../lib/supabase';
import { fetchGymFavorites } from '../lib/db/gymFavorites';
import { initGymFavorites } from '../data/gymFavoriteStore';
import { containsBannedWord } from '../lib/bannedWords';

// --- Types

export interface AuthUser {
  id: string;
  name: string;
  nickname?: string;
  email: string;
  role: UserRole;
  managedGymIds: string[];
  gymId?: string;
  profileImageUrl?: string;
  weightUnit?: 'kg' | 'lbs';
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  signIn:       (email: string, password: string) => Promise<{ error: string | null }>;
  signUp:       (
    email: string, password: string,
    name: string, birthDate: string,
  ) => Promise<{ error: string | null; needsVerification: boolean }>;
  signOut:      () => Promise<void>;
  signInGoogle:    () => Promise<{ error: string | null }>;
  signInApple:     () => Promise<{ error: string | null }>;
  switchRole:         (role: UserRole) => void;
  updateNickname:     (nickname: string) => Promise<{ error: string | null }>;
  updateProfileImage: (url: string) => void;
  updateWeightUnit:   (unit: 'kg' | 'lbs') => void;
  refreshUser:        () => Promise<void>;
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

interface ProfileData {
  avatarUrl?:     string;
  nickname?:      string;
  role?:          'user' | 'manager' | 'admin';
  managedGymIds?: string[];
}

function mapSupabaseUser(sbUser: SupabaseUser, profileData?: ProfileData): AuthUser {
  const mock = Object.values(MOCK_USERS).find(m => m.email === sbUser.email);
  if (mock) return { ...mock, profileImageUrl: profileData?.avatarUrl };
  return {
    id:              sbUser.id,
    name:            sbUser.user_metadata?.name ?? sbUser.email?.split('@')[0] ?? 'User',
    nickname:        profileData?.nickname ?? sbUser.user_metadata?.nickname,
    email:           sbUser.email ?? '',
    role:            (profileData?.role ?? 'user') as UserRole,
    managedGymIds:   profileData?.managedGymIds ?? [],
    profileImageUrl: profileData?.avatarUrl,
  };
}

async function fetchProfileData(userId: string): Promise<ProfileData> {
  try {
    const [profileRes, gymsRes] = await Promise.all([
      supabase
        .from('profiles')
        .select('avatar_url, nickname, role')
        .eq('id', userId)
        .single(),
      supabase
        .from('gyms')
        .select('id')
        .eq('manager_id', userId),
    ]);

    const data     = profileRes.data;
    const gymsData = gymsRes.data ?? [];

    return {
      avatarUrl:     data?.avatar_url ?? undefined,
      nickname:      data?.nickname   ?? undefined,
      role:          data?.role       ?? undefined,
      managedGymIds: gymsData.map((g: { id: string }) => g.id),
    };
  } catch {
    return {};
  }
}

async function ensureProfileExists(sbUser: SupabaseUser): Promise<void> {
  try {
    console.log('[ensureProfile] 시작 userId:', sbUser.id);
    const { data, error: selectError } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', sbUser.id)
      .single();

    console.log('[ensureProfile] select 결과:', data, selectError?.message);

    if (!data) {
      console.log('[ensureProfile] row 없음 → insert 시도');
      const { error: insertError } = await supabase.from('profiles').insert({
        id:    sbUser.id,
        email: sbUser.email ?? '',
        name:  sbUser.user_metadata?.name ?? sbUser.email?.split('@')[0] ?? 'User',
        role:  'user',
      });
      console.log('[ensureProfile] insert 결과:', insertError?.message ?? 'OK');
    } else {
      console.log('[ensureProfile] row 이미 존재');
    }
  } catch (e: any) {
    console.log('[ensureProfile] catch → upsert 시도, 에러:', e.message);
    const { error: upsertError } = await supabase.from('profiles').upsert({
      id:    sbUser.id,
      email: sbUser.email ?? '',
      name:  sbUser.user_metadata?.name ?? sbUser.email?.split('@')[0] ?? 'User',
      role:  'user',
    });
    console.log('[ensureProfile] upsert 결과:', upsertError?.message ?? 'OK');
  }
}

function generateNickname(): string {
  const adjectives = [
    '단단한', '탄탄한', '강인한', '날렵한', '묵직한', '거대한', '다부진',
    '열정적인', '꾸준한', '폭발적인', '맹렬한', '끈질긴', '집중하는', '도전하는',
    '철벽같은', '파워풀한', '불굴의', '맹수같은',
    '무적의', '최강의', '전설의', '압도적인', '위대한',
  ];
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const num = String(Math.floor(Math.random() * 9000) + 1000);
  return `${adj}_${num}`;
}

// --- Context

const AuthContext = createContext<AuthContextValue>({
  user:         null,
  loading:      true,
  signIn:       async () => ({ error: null }),
  signUp:       async () => ({ error: null, needsVerification: false }),
  signOut:      async () => {},
  signInGoogle:   async () => ({ error: null }),
  signInApple:    async () => ({ error: null }),
  switchRole:         () => {},
  updateNickname:     async () => ({ error: null }),
  updateProfileImage: () => {},
  updateWeightUnit:   () => {},
  refreshUser:        async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user,    setUser]    = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const supabaseConfigured = !!(process.env.EXPO_PUBLIC_SUPABASE_URL);

  useEffect(() => {
    if (!supabaseConfigured) {
      setLoading(false);
      return;
    }

    // getSession에 5초 timeout 적용 — hang 시 반드시 setLoading(false) 보장
    const sessionTimeout = setTimeout(() => {
      setLoading(false);
    }, 5000);

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      clearTimeout(sessionTimeout);
      try {
        if (session?.user) {
          const profileData = await fetchProfileData(session.user.id);
          setUser(mapSupabaseUser(session.user, profileData));
          fetchGymFavorites(session.user.id).then(ids => initGymFavorites(ids));
        } else {
          setUser(null);
        }
      } catch {
        setUser(null);
      } finally {
        setLoading(false);
      }
    }).catch(() => {
      clearTimeout(sessionTimeout);
      setUser(null);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        fetchProfileData(session.user!.id).then(profileData => {
          setUser(mapSupabaseUser(session.user!, profileData));
          fetchGymFavorites(session.user!.id).then(ids => initGymFavorites(ids));
        });
      } else {
        setUser(null);
      }
    });

    return () => {
      clearTimeout(sessionTimeout);
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string): Promise<{ error: string | null }> => {
    const trimmedEmail = email.trim().toLowerCase();

    if (!supabaseConfigured) {
      const entry = MOCK_CREDENTIALS[trimmedEmail];
      if (!entry || password !== entry.password) {
        return { error: '이메일 또는 비밀번호가 올바르지 않습니다.' };
      }
      setUser(entry.user);
      initGymFavorites([]);
      return { error: null };
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email: trimmedEmail,
      password,
    });
    if (error) return { error: error.message };
    if (data.user) {
      await ensureProfileExists(data.user);
      const profileData = await fetchProfileData(data.user.id);
      setUser(mapSupabaseUser(data.user, profileData));
      const gymFavIds = await fetchGymFavorites(data.user.id);
      initGymFavorites(gymFavIds);
    }
    return { error: null };
  };

  const signUp = async (
    email: string, password: string,
    name: string, birthDate: string,
  ): Promise<{ error: string | null; needsVerification: boolean }> => {
    const trimmedEmail = email.trim().toLowerCase();

    if (!supabaseConfigured) {
      const mockUser: AuthUser = {
        id:            `mock-${Date.now()}`,
        name,
        nickname:      generateNickname(),
        email:         trimmedEmail,
        role:          'user',
        managedGymIds: [],
      };
      setUser(mockUser);
      return { error: null, needsVerification: false };
    }

    const nickname = generateNickname();

    const { data, error } = await supabase.auth.signUp({
      email: trimmedEmail,
      password,
      options: { data: { name, nickname } },
    });
    if (error) {
      const msg = error.message ?? '';
      if (
        msg.includes('already registered') ||
        msg.includes('already been registered') ||
        msg.includes('email address is already') ||
        msg.includes('User already registered')
      ) {
        return { error: '이미 가입된 이메일이에요. 로그인해주세요.', needsVerification: false };
      }
      return { error: msg, needsVerification: false };
    }

    if (data.user) {
      await supabase.from('profiles').upsert({
        id:         data.user.id,
        name,
        nickname,
        birth_date: birthDate,
      });
    }

    // 이미 가입된 이메일: identities가 빈 배열로 반환됨
    if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
      return { error: '이미 가입된 이메일이에요. 로그인해주세요.', needsVerification: false };
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
    initGymFavorites([]);
    setUser(null);
  };

  const updateNickname = async (nickname: string): Promise<{ error: string | null }> => {
    try {
      if (!user) return { error: '로그인이 필요합니다.' };
      const trimmed = nickname.trim();
      if (!trimmed) return { error: '닉네임을 입력해주세요.' };

      if (supabaseConfigured) {
        const bannedInNickname = await containsBannedWord(trimmed);
        if (bannedInNickname) return { error: '사용할 수 없는 단어가 닉네임에 포함되어 있어요.' };

        // 닉네임 중복 체크 (본인 제외)
        const { data: existingNickname } = await supabase
          .from('profiles')
          .select('id')
          .eq('nickname', trimmed)
          .neq('id', user.id)
          .maybeSingle();
        if (existingNickname) return { error: '이미 사용 중인 닉네임이에요. 다른 닉네임을 입력해주세요.' };

        const { upsertUserProfile } = await import('../lib/db/userProfiles');
        await upsertUserProfile(user.id, { nickname: trimmed });
      }

      // 로컬 user 상태 즉시 업데이트
      setUser(prev => prev ? { ...prev, nickname: trimmed } : prev);
      return { error: null };
    } catch (e: any) {
      return { error: e.message ?? '닉네임 변경에 실패했습니다.' };
    }
  };

  const updateProfileImage = (url: string) => {
    setUser(prev => prev ? { ...prev, profileImageUrl: url } : prev);
  };

  const updateWeightUnit = (unit: 'kg' | 'lbs') => {
    setUser(prev => prev ? { ...prev, weightUnit: unit } : prev);
  };

  const refreshUser = async (): Promise<void> => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;
      const profileData = await fetchProfileData(session.user.id);
      setUser(mapSupabaseUser(session.user, profileData));
    } catch (e) {
      if (__DEV__) console.warn('[AuthContext] refreshUser 오류:', e);
    }
  };

  const signInGoogle = async (): Promise<{ error: string | null }> => {
    try {
      if (!supabaseConfigured) {
        setUser({
          id:            'google-mock',
          name:          'Google User',
          nickname:      'GoogleUser',
          email:         'google@mock.com',
          role:          'user',
          managedGymIds: [],
        });
        initGymFavorites([]);
        return { error: null };
      }

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo:          'gympick://auth/callback',
          skipBrowserRedirect: true,
        },
      });

      if (error) return { error: error.message };
      if (!data.url) return { error: '구글 로그인 URL을 받지 못했습니다.' };

      const result = await WebBrowser.openAuthSessionAsync(
        data.url,
        'gympick://auth/callback',
      );

      if (result.type === 'success') {
        const url    = result.url;
        const hash   = url.split('#')[1] ?? '';
        const query  = url.split('?')[1] ?? '';
        const params = new URLSearchParams(hash || query);
        const accessToken  = params.get('access_token');
        const refreshToken = params.get('refresh_token') ?? '';

        if (accessToken) {
          const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
            access_token:  accessToken,
            refresh_token: refreshToken,
          });
          if (sessionError) return { error: sessionError.message };
          if (sessionData.user) {
            await ensureProfileExists(sessionData.user);
            const profileData = await fetchProfileData(sessionData.user.id);
            setUser(mapSupabaseUser(sessionData.user, profileData));
            const gymFavIds = await fetchGymFavorites(sessionData.user.id);
            initGymFavorites(gymFavIds);
          }
          return { error: null };
        }
      }

      if (result.type === 'cancel') {
        return { error: '구글 로그인이 취소되었습니다.' };
      }

      return { error: '구글 로그인 중 오류가 발생했습니다.' };
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
        initGymFavorites([]);
        return { error: null };
      }

      const { data, error } = await supabase.auth.signInWithIdToken({
        provider: 'apple',
        token:    credential.identityToken,
      });

      if (error) return { error: error.message };
      if (data.user) {
        await ensureProfileExists(data.user);
        const profileData = await fetchProfileData(data.user.id);
        setUser(mapSupabaseUser(data.user, profileData));
        const gymFavIds = await fetchGymFavorites(data.user.id);
        initGymFavorites(gymFavIds);
      }
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
      switchRole:         role => setUser(MOCK_USERS[role]),
      updateNickname,
      updateProfileImage,
      updateWeightUnit,
      refreshUser,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
