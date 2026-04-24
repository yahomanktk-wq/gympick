import { supabase } from '../supabase';

export interface UserProfile {
  id: string;
  nickname?: string;
  name: string;
  birthDate?: string;
  role: 'user' | 'manager' | 'admin';
  createdAt: string;
}

function rowToProfile(r: any): UserProfile {
  return {
    id:        r.id,
    nickname:  r.nickname ?? undefined,
    name:      r.name ?? '',
    birthDate: r.birth_date ?? undefined,
    role:      r.role ?? 'user',
    createdAt: r.created_at,
  };
}

export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();
  if (error || !data) return null;
  return rowToProfile(data);
}

export async function upsertUserProfile(
  userId: string,
  updates: Partial<Pick<UserProfile, 'nickname' | 'name' | 'birthDate'>>,
): Promise<void> {
  await supabase.from('profiles').upsert({
    id:         userId,
    nickname:   updates.nickname,
    name:       updates.name,
    birth_date: updates.birthDate,
    updated_at: new Date().toISOString(),
  });
}
