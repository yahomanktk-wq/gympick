import { supabase } from '../supabase';

// 2026-11-04: 신고 · 차단 (오운완 / 오운완 댓글 / 헬스장 후기 공용)
// - 차단: user_blocks. 차단한 사람의 오운완·댓글·후기는 DB 권한 규칙(RLS)에서 자동으로 빠진다.
// - 신고: content_reports. 어드민이 직접 확인하고 처리한다 (자동 숨김 없음).

export type ReportTargetType = 'ounwan' | 'comment' | 'gym_review';
export type ReportReason = 'abuse' | 'sexual' | 'spam' | 'privacy' | 'other';

export const REPORT_REASONS: { key: ReportReason; label: string }[] = [
  { key: 'abuse',   label: '욕설·비방' },
  { key: 'sexual',  label: '음란·선정' },
  { key: 'spam',    label: '광고·스팸' },
  { key: 'privacy', label: '개인정보 노출' },
  { key: 'other',   label: '기타 (직접 입력)' },
];

export const REPORT_TARGET_LABEL: Record<ReportTargetType, string> = {
  ounwan:     '오운완',
  comment:    '오운완 댓글',
  gym_review: '헬스장 후기',
};

export function reportReasonLabel(reason: string): string {
  return REPORT_REASONS.find(r => r.key === reason)?.label.replace(' (직접 입력)', '') ?? reason;
}

async function currentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

// ── 차단 ──────────────────────────────────────────────────

export interface BlockedUser {
  blockedId: string;
  nickname:  string;
  createdAt: string;
}

export async function blockUser(blockedId: string): Promise<void> {
  const me = await currentUserId();
  if (!me) throw new Error('not_signed_in');
  if (me === blockedId) return;
  const { error } = await supabase
    .from('user_blocks')
    .insert({ blocker_id: me, blocked_id: blockedId });
  // 이미 차단한 경우(중복 키)는 성공으로 본다
  if (error && error.code !== '23505') throw error;
}

export async function unblockUser(blockedId: string): Promise<void> {
  const me = await currentUserId();
  if (!me) throw new Error('not_signed_in');
  const { error } = await supabase
    .from('user_blocks')
    .delete()
    .eq('blocker_id', me)
    .eq('blocked_id', blockedId);
  if (error) throw error;
}

export async function fetchBlockedUsers(): Promise<BlockedUser[]> {
  const me = await currentUserId();
  if (!me) return [];
  const { data, error } = await supabase
    .from('user_blocks')
    .select('blocked_id, blocked_nickname, created_at')
    .eq('blocker_id', me)
    .order('created_at', { ascending: false });
  if (error) return [];
  return (data ?? []).map((r: any) => ({
    blockedId: r.blocked_id,
    nickname:  r.blocked_nickname ?? '회원',
    createdAt: r.created_at,
  }));
}

// ── 신고 ──────────────────────────────────────────────────

export interface ReportInput {
  targetType:    ReportTargetType;
  targetId:      string;
  targetUserId?: string;
  reason:        ReportReason;
  detail?:       string;
}

/** 'ok' = 접수됨, 'duplicate' = 이미 신고한 대상 */
export async function reportContent(input: ReportInput): Promise<'ok' | 'duplicate'> {
  const me = await currentUserId();
  if (!me) throw new Error('not_signed_in');
  const detail = input.detail?.trim();
  const { error } = await supabase.from('content_reports').insert({
    reporter_id:    me,
    target_type:    input.targetType,
    target_id:      input.targetId,
    target_user_id: input.targetUserId ?? null,
    reason:         input.reason,
    detail:         detail ? detail.slice(0, 300) : null,
  });
  if (error) {
    if (error.code === '23505') return 'duplicate';
    throw error;
  }
  return 'ok';
}

// ── 어드민 ────────────────────────────────────────────────

export interface ContentReport {
  id:           string;
  reporterId:   string;
  targetType:   ReportTargetType;
  targetId:     string;
  targetUserId: string | null;
  reason:       ReportReason;
  detail:       string | null;
  status:       'pending' | 'resolved';
  resolution:   string | null;
  createdAt:    string;
  resolvedAt:   string | null;
}

function rowToReport(r: any): ContentReport {
  return {
    id:           r.id,
    reporterId:   r.reporter_id,
    targetType:   r.target_type,
    targetId:     r.target_id,
    targetUserId: r.target_user_id ?? null,
    reason:       r.reason,
    detail:       r.detail ?? null,
    status:       r.status,
    resolution:   r.resolution ?? null,
    createdAt:    r.created_at,
    resolvedAt:   r.resolved_at ?? null,
  };
}

export async function fetchContentReports(): Promise<ContentReport[]> {
  const { data, error } = await supabase
    .from('content_reports')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) return [];
  return (data ?? []).map(rowToReport);
}

export async function resolveContentReport(id: string, resolution: string): Promise<void> {
  const { error } = await supabase
    .from('content_reports')
    .update({ status: 'resolved', resolution, resolved_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

export interface ReportTargetPreview {
  nickname: string;
  text:     string;
  imageUri?: string;
  /** 이미 삭제됐거나 비공개 처리됨 */
  gone:     boolean;
}

/** 신고 대상 미리보기 (어드민 권한으로 조회) */
export async function fetchReportTargetPreview(
  type: ReportTargetType,
  id: string,
): Promise<ReportTargetPreview> {
  if (type === 'comment') {
    const { data } = await supabase
      .from('ounwan_comments').select('nickname, content').eq('id', id).maybeSingle();
    return data
      ? { nickname: data.nickname, text: data.content, gone: false }
      : { nickname: '', text: '삭제된 댓글이에요', gone: true };
  }
  if (type === 'gym_review') {
    const { data } = await supabase
      .from('gym_reviews').select('nickname, content').eq('id', id).maybeSingle();
    return data
      ? { nickname: data.nickname, text: data.content, gone: false }
      : { nickname: '', text: '삭제된 후기예요', gone: true };
  }
  const { data } = await supabase
    .from('workout_feed_posts')
    .select('nickname, gym_name, composite_uri, photo_uri, is_public')
    .eq('id', id).maybeSingle();
  if (!data) return { nickname: '', text: '삭제된 오운완이에요', gone: true };
  return {
    nickname: data.nickname,
    text:     data.is_public ? (data.gym_name ?? '') : `${data.gym_name ?? ''} · 비공개 처리됨`,
    imageUri: data.composite_uri ?? data.photo_uri ?? undefined,
    gone:     !data.is_public,
  };
}

/** 신고 대상 조치: 댓글·후기는 삭제, 오운완은 비공개 처리 */
export async function adminRemoveReportTarget(type: ReportTargetType, id: string): Promise<void> {
  if (type === 'comment') {
    const { error } = await supabase.from('ounwan_comments').delete().eq('id', id);
    if (error) throw error;
    return;
  }
  if (type === 'gym_review') {
    const { error } = await supabase.from('gym_reviews').delete().eq('id', id);
    if (error) throw error;
    return;
  }
  const { error } = await supabase
    .from('workout_feed_posts').update({ is_public: false }).eq('id', id);
  if (error) throw error;
}
