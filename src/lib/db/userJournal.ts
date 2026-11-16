// 2026-11-16: 유저 운동일지(프로필 화면) · 운동일지 비공개 · 공유 링크 — DB 접근
// - 헤더 정보(닉네임·사진·비공개·차단)는 get_user_journal RPC (profiles는 본인만 읽을 수 있어서)
// - 오운완 목록은 workout_feed_posts를 그대로 조회 → 공개 범위·차단·운동일지 비공개를 DB 권한 규칙이 처리
import { supabase } from '../supabase';
import type { WorkoutFeedPost } from '../../data/types';
import { rowToPost } from './feedPosts';

export const JOURNAL_SHARE_BASE_URL = 'https://gympick.app/u/';
const MAX_POSTS = 300;

export interface UserJournalHeader {
  userId:     string;
  nickname:   string;
  avatarUrl?: string;
  isMe:       boolean;
  /** 다른 사람이 볼 때 비공개 상태 (본인에게는 항상 false) */
  isPrivate:  boolean;
  /** 내가 이 사람을 차단했는지 */
  isBlocked:  boolean;
  /** 본인일 때만 — 이미 만든 공유 코드 */
  shareCode?: string;
}

export async function fetchUserJournalHeader(userId: string): Promise<UserJournalHeader | null> {
  const { data, error } = await supabase.rpc('get_user_journal', { p_user_id: userId });
  if (error || !data) return null;
  const r = data as any;
  return {
    userId:    String(r.user_id),
    nickname:  r.nickname ?? '짐픽 회원',
    avatarUrl: r.avatar_url ?? undefined,
    isMe:      !!r.is_me,
    isPrivate: !!r.is_private,
    isBlocked: !!r.is_blocked,
    shareCode: r.share_code ?? undefined,
  };
}

/** 이 사람의 오운완 중 내가 볼 수 있는 것 (최신순) */
export async function fetchUserOunwanPosts(userId: string, isMe: boolean): Promise<WorkoutFeedPost[]> {
  const { data, error } = await supabase
    .from('workout_feed_posts')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(MAX_POSTS);
  if (error || !data) return [];
  return data.map((r: any) => ({ ...rowToPost(r), isMyPost: isMe }));
}

export async function fetchMyJournalPrivate(userId: string): Promise<boolean> {
  const { data } = await supabase
    .from('profiles')
    .select('journal_private')
    .eq('id', userId)
    .maybeSingle();
  return !!data?.journal_private;
}

export async function setMyJournalPrivate(userId: string, value: boolean): Promise<boolean> {
  const { error } = await supabase
    .from('profiles')
    .update({ journal_private: value })
    .eq('id', userId);
  return !error;
}

/** 내 공유 코드 (없으면 서버가 만들어 줌) → 공유 링크 */
export async function getMyJournalShareUrl(): Promise<string | null> {
  const { data, error } = await supabase.rpc('ensure_my_share_code');
  if (error || !data) return null;
  return `${JOURNAL_SHARE_BASE_URL}${data}`;
}
