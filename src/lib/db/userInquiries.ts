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
