import { supabase } from '../supabase';

// 2026-11-09: 헬스장 Q&A
// - 목록(제목·답변 상태·답변 수)은 짐픽 유저 누구나 (list_gym_questions)
// - 본문·답변은 그 헬스장 회원(트레이너·관장님 포함)만 (DB 권한 규칙)
// - 질문·답변 작성은 회원만. 트레이너/관장님 답변은 서버가 배지를 붙인다
// - 삭제: 작성자 / 어드민 (관장님은 삭제 불가 — 신고로 처리)

export const QNA_TITLE_MAX   = 40;
export const QNA_CONTENT_MAX = 1000;
export const QNA_ANSWER_MAX  = 500;

export interface GymQuestionSummary {
  id:            string;
  title:         string;
  answerCount:   number;
  staffAnswered: boolean;
  createdAt:     string;
  isMine:        boolean;
}

export interface GymQuestion {
  id:             string;
  gymId:          string;
  userId:         string;
  nickname:       string;
  title:          string;
  content:        string;
  attachedPostId: string | null;
  answerCount:    number;
  staffAnswered:  boolean;
  createdAt:      string;
}

export interface GymAnswer {
  id:          string;
  questionId:  string;
  userId:      string;
  nickname:    string;
  content:     string;
  authorBadge: 'trainer' | 'owner' | null;
  createdAt:   string;
}

const Q_COLUMNS = 'id, gym_id, user_id, nickname, title, content, attached_post_id, answer_count, staff_answered, created_at';
const A_COLUMNS = 'id, question_id, user_id, nickname, content, author_badge, created_at';

function rowToQuestion(r: any): GymQuestion {
  return {
    id: r.id, gymId: r.gym_id, userId: r.user_id, nickname: r.nickname, title: r.title, content: r.content,
    attachedPostId: r.attached_post_id ?? null, answerCount: r.answer_count ?? 0,
    staffAnswered: !!r.staff_answered, createdAt: r.created_at,
  };
}

function rowToAnswer(r: any): GymAnswer {
  return {
    id: r.id, questionId: r.question_id, userId: r.user_id, nickname: r.nickname, content: r.content,
    authorBadge: r.author_badge ?? null, createdAt: r.created_at,
  };
}

/** 누구나: 질문 목록 (before = 더 불러오기 커서) */
export async function fetchGymQuestionList(gymId: string, before?: string, limit = 20): Promise<GymQuestionSummary[]> {
  const { data, error } = await supabase.rpc('list_gym_questions', {
    p_gym_id: gymId, p_before: before ?? null, p_limit: limit,
  });
  if (error) return [];
  return (data ?? []).map((r: any) => ({
    id: r.id, title: r.title, answerCount: r.answer_count ?? 0, staffAnswered: !!r.staff_answered,
    createdAt: r.created_at, isMine: !!r.is_mine,
  }));
}

/** 회원만: 질문 본문. 볼 수 없으면 null */
export async function fetchGymQuestion(id: string): Promise<GymQuestion | null> {
  const { data, error } = await supabase.from('gym_questions').select(Q_COLUMNS).eq('id', id).maybeSingle();
  if (error || !data) return null;
  return rowToQuestion(data);
}

/** 알림에서 열 때: 질문이 어느 헬스장 것인지 (회원이 아니면 null) */
export async function fetchQuestionGymId(id: string): Promise<string | null> {
  const q = await fetchGymQuestion(id);
  return q?.gymId ?? null;
}

/** 답변 목록 — 트레이너·관장님 답변을 맨 위로 */
export async function fetchGymAnswers(questionId: string): Promise<GymAnswer[]> {
  const { data, error } = await supabase
    .from('gym_answers').select(A_COLUMNS)
    .eq('question_id', questionId)
    .order('created_at', { ascending: true })
    .limit(300);
  if (error) return [];
  const list = (data ?? []).map(rowToAnswer);
  return [...list.filter(a => a.authorBadge), ...list.filter(a => !a.authorBadge)];
}

export async function addGymQuestion(gymId: string, title: string, content: string, attachedPostId: string | null): Promise<GymQuestion> {
  const { data, error } = await supabase
    .from('gym_questions')
    .insert({
      gym_id: gymId,
      title: title.trim().slice(0, QNA_TITLE_MAX),
      content: content.trim().slice(0, QNA_CONTENT_MAX),
      attached_post_id: attachedPostId,
    })
    .select(Q_COLUMNS)
    .single();
  if (error) throw error;
  return rowToQuestion(data);
}

export async function deleteGymQuestion(id: string): Promise<void> {
  const { error } = await supabase.from('gym_questions').delete().eq('id', id);
  if (error) throw error;
}

export async function addGymAnswer(questionId: string, content: string): Promise<GymAnswer> {
  const { data, error } = await supabase
    .from('gym_answers')
    .insert({ question_id: questionId, content: content.trim().slice(0, QNA_ANSWER_MAX) })
    .select(A_COLUMNS)
    .single();
  if (error) throw error;
  return rowToAnswer(data);
}

export async function deleteGymAnswer(id: string): Promise<void> {
  const { error } = await supabase.from('gym_answers').delete().eq('id', id);
  if (error) throw error;
}

/** 질문에 붙일 내 오운완 후보 (나만 보기 제외, 최근 30개) */
export async function fetchMyAttachableOunwan(userId: string): Promise<{ id: string; uri: string; gymName: string; createdAt: string }[]> {
  const { data, error } = await supabase
    .from('workout_feed_posts')
    .select('id, thumbnail_uri, composite_uri, photo_uri, gym_name, created_at')
    .eq('user_id', userId)
    .neq('visibility', 'private')
    .order('created_at', { ascending: false })
    .limit(30);
  if (error) return [];
  return (data ?? []).map((r: any) => ({
    id: r.id, uri: r.thumbnail_uri ?? r.composite_uri ?? r.photo_uri, gymName: r.gym_name ?? '', createdAt: r.created_at,
  }));
}

/** 내 질문 (대시보드 '헬스장 소식'용, 최근 5개) */
export async function fetchMyGymQuestions(gymId: string, userId: string): Promise<GymQuestionSummary[]> {
  const { data, error } = await supabase
    .from('gym_questions')
    .select('id, title, answer_count, staff_answered, created_at')
    .eq('gym_id', gymId).eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(5);
  if (error) return [];
  return (data ?? []).map((r: any) => ({
    id: r.id, title: r.title, answerCount: r.answer_count ?? 0, staffAnswered: !!r.staff_answered,
    createdAt: r.created_at, isMine: true,
  }));
}
