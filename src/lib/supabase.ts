import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL  ?? '';
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

if (__DEV__ && (!supabaseUrl || !supabaseKey)) {
  console.warn('[Supabase] Missing env vars. Check .env for EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.');
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken:   true,
    persistSession:     true,
    detectSessionInUrl: false,
    storage:            AsyncStorage,
  },
});

export async function deleteAccount(): Promise<{ error: string | null }> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return { error: '로그인이 필요합니다.' };

    const response = await fetch(
      `${supabaseUrl}/functions/v1/delete-account`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      const err = await response.json();
      if (__DEV__) console.log('[deleteAccount] response status:', response.status);
      if (__DEV__) console.log('[deleteAccount] error:', JSON.stringify(err));
      return { error: err.error ?? '계정 삭제에 실패했습니다.' };
    }

    await supabase.auth.signOut();
    return { error: null };
  } catch (e) {
    if (__DEV__) console.warn('[deleteAccount] error:', e);
    return { error: '계정 삭제 중 오류가 발생했습니다.' };
  }
}
