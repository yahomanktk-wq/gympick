import { supabase } from '../supabase';

// 2026-11-04: 헬스장 후기
// - 자유 텍스트 500자, 그 헬스장에서 운동 기록 1회 이상인 사람만 작성 (DB 권한 규칙에서도 검사)
// - 운동 횟수는 표시하지 않음
// - 삭제: 작성자 / 어드민. 관장님은 삭제 불가, 답글만 (reply_gym_review RPC)
// - 내가 차단한 사람의 후기는 DB 권한 규칙에서 자동으로 숨겨진다

export const REVIEW_MAX_LENGTH = 500;

export interface GymReview {
  id:           string;
  gymId:        string;
  userId:       string;
  nickname:     string;
  content:      string;
  replyContent: string | null;
  replyAt:      string | null;
  createdAt:    string;
}

const COLUMNS = 'id, gym_id, user_id, nickname, content, reply_content, reply_at, created_at';

function rowToReview(r: any): GymReview {
  return {
    id:           r.id,
    gymId:        r.gym_id,
    userId:       r.user_id,
    nickname:     r.nickname,
    content:      r.content,
    replyContent: r.reply_content ?? null,
    replyAt:      r.reply_at ?? null,
    createdAt:    r.created_at,
  };
}

export async function fetchGymReviews(gymId: string, limit = 100): Promise<GymReview[]> {
  const { data, error } = await supabase
    .from('gym_reviews')
    .select(COLUMNS)
    .eq('gym_id', gymId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) return [];
  return (data ?? []).map(rowToReview);
}

/** 이 헬스장에서 운동 기록이 1회 이상 있는지 (본인 기록만 조회 가능) */
export async function canWriteGymReview(gymId: string, userId: string | undefined | null): Promise<boolean> {
  if (!userId) return false;
  const { count, error } = await supabase
    .from('workout_sessions')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('gym_id', gymId);
  if (error) return false;
  return (count ?? 0) > 0;
}

export async function addGymReview(gymId: string, content: string): Promise<GymReview> {
  const text = content.trim().slice(0, REVIEW_MAX_LENGTH);
  const { data, error } = await supabase
    .from('gym_reviews')
    .insert({ gym_id: gymId, content: text })
    .select(COLUMNS)
    .single();
  if (error) throw error;
  return rowToReview(data);
}

export async function deleteGymReview(id: string): Promise<void> {
  const { error } = await supabase.from('gym_reviews').delete().eq('id', id);
  if (error) throw error;
}

/** 관장님 답글 작성·수정. 빈 문자열이면 답글 삭제 */
export async function replyGymReview(reviewId: string, content: string): Promise<void> {
  const { error } = await supabase.rpc('reply_gym_review', {
    p_review_id: reviewId,
    p_content:   content.trim().slice(0, REVIEW_MAX_LENGTH),
  });
  if (error) throw error;
}
