import { supabase } from '../supabase';

export type InquiryStatus = 'pending' | 'answered';

export interface UserInquiry {
  id:          string;
  userId:      string;
  title:       string;
  content:     string;
  status:      InquiryStatus;
  answer:      string | null;
  answeredAt:  string | null;
  createdAt:   string;
}

function rowTo(r: any): UserInquiry {
  return {
    id:         r.id,
    userId:     r.user_id,
    title:      r.title,
    content:    r.content,
    status:     (r.status ?? 'pending') as InquiryStatus,
    answer:     r.answer ?? null,
    answeredAt: r.answered_at ?? null,
    createdAt:  r.created_at,
  };
}

// 유저: 문의 제출
export async function submitUserInquiry(userId: string, title: string, content: string): Promise<void> {
  await supabase.from('user_inquiries').insert({
    id:      `inq${Date.now()}`,
    user_id: userId,
    title,
    content,
    status:  'pending',
  });
}

// 유저: 본인 문의 내역 조회 (최신순)
export async function fetchUserInquiries(userId: string): Promise<UserInquiry[]> {
  try {
    const { data, error } = await supabase
      .from('user_inquiries')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error || !data) return [];
    return data.map(rowTo);
  } catch (e: any) {
    if (__DEV__) console.warn('[userInquiries] fetchUserInquiries:', e?.message);
    return [];
  }
}

// 어드민: 전체 문의 조회 (최신순)
export async function fetchAllUserInquiries(): Promise<UserInquiry[]> {
  try {
    const { data, error } = await supabase
      .from('user_inquiries')
      .select('*')
      .order('created_at', { ascending: false });
    if (error || !data) return [];
    return data.map(rowTo);
  } catch (e: any) {
    if (__DEV__) console.warn('[userInquiries] fetchAllUserInquiries:', e?.message);
    return [];
  }
}

export interface InquirerProfile {
  id:       string;
  nickname: string | null;
  email:    string | null;
  role:     'user' | 'manager' | 'admin' | null;
}

// 어드민: 문의 작성자 프로필 일괄 조회 (profiles RLS상 어드민만 다른 유저 행을 읽을 수 있음)
export async function fetchInquirerProfiles(userIds: string[]): Promise<Record<string, InquirerProfile>> {
  const ids = [...new Set(userIds.filter(Boolean))];
  if (ids.length === 0) return {};
  const { data, error } = await supabase
    .from('profiles')
    .select('id, nickname, email, role')
    .in('id', ids);
  if (error || !data) {
    console.warn('[userInquiries] fetchInquirerProfiles:', error?.message);
    return {};
  }
  const map: Record<string, InquirerProfile> = {};
  data.forEach((p: any) => {
    map[p.id] = {
      id:       p.id,
      nickname: p.nickname ?? null,
      email:    p.email ?? null,
      role:     p.role ?? null,
    };
  });
  return map;
}

// 어드민: 답변 등록 (status를 'answered'로, answered_at을 now()로 함께 반영)
export async function answerUserInquiry(id: string, answer: string): Promise<void> {
  await supabase
    .from('user_inquiries')
    .update({
      answer,
      status:      'answered',
      answered_at: new Date().toISOString(),
    })
    .eq('id', id);
}
