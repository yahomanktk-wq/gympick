import { supabase } from '../supabase';

// 2026-11-04: 오운완 댓글
// - 대댓글 없음, 200자, 수정 없이 삭제만
// - 비공개 오운완의 댓글, 내가 차단한 사람의 댓글은 DB 권한 규칙에서 자동으로 숨겨진다
// - 닉네임·작성자는 서버(트리거)가 채운다
// - 삭제: 댓글 작성자 / 오운완 주인 / 어드민

export const COMMENT_MAX_LENGTH = 200;

export interface OunwanComment {
  id:        string;
  postId:    string;
  userId:    string;
  nickname:  string;
  content:   string;
  createdAt: string;
}

function rowToComment(r: any): OunwanComment {
  return {
    id:        r.id,
    postId:    r.post_id,
    userId:    r.user_id,
    nickname:  r.nickname,
    content:   r.content,
    createdAt: r.created_at,
  };
}

export async function fetchOunwanComments(postId: string): Promise<OunwanComment[]> {
  const { data, error } = await supabase
    .from('ounwan_comments')
    .select('id, post_id, user_id, nickname, content, created_at')
    .eq('post_id', postId)
    .order('created_at', { ascending: true })
    .limit(300);
  if (error) return [];
  return (data ?? []).map(rowToComment);
}

export async function addOunwanComment(postId: string, content: string): Promise<OunwanComment> {
  const text = content.trim().slice(0, COMMENT_MAX_LENGTH);
  const { data, error } = await supabase
    .from('ounwan_comments')
    .insert({ post_id: postId, content: text })
    .select('id, post_id, user_id, nickname, content, created_at')
    .single();
  if (error) throw error;
  return rowToComment(data);
}

export async function deleteOunwanComment(id: string): Promise<void> {
  const { error } = await supabase.from('ounwan_comments').delete().eq('id', id);
  if (error) throw error;
}
