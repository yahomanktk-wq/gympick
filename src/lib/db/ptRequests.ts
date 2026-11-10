import { supabase } from '../supabase';

// 2026-11-09: PT 상담 신청
// - 신청 1건 = 대화방 1개 (참여자: 신청 회원 / 지정 트레이너 / 관장님). 일반 DM은 없음
// - 연락처는 선택 + 동의. 참여자에게만 보이고, 완료·취소 90일 뒤 서버가 지운다
// - 완료(관장님·트레이너) / 취소(회원)되면 더 이상 메시지를 보낼 수 없다

export const PT_CONTENT_MAX = 500;
export const PT_MESSAGE_MAX = 500;

export type PtStatus = 'open' | 'closed' | 'cancelled';
export type PtRole   = 'member' | 'trainer' | 'owner';

export interface PtRequest {
  id:              string;
  gymId:           string;
  gymName:         string;
  memberId:        string;
  memberNickname:  string;
  trainerId:       string;
  trainerNickname: string;
  content:         string;
  phone:           string | null;
  status:          PtStatus;
  createdAt:       string;
  lastMessageAt:   string;
  myRole:          PtRole;
}

export interface PtMessage {
  id:             string;
  senderId:       string;
  senderNickname: string;
  content:        string;
  createdAt:      string;
}

export const PT_STATUS_LABEL: Record<PtStatus, string> = {
  open:      '진행 중',
  closed:    '완료',
  cancelled: '취소됨',
};

export async function createPtRequest(gymId: string, trainerId: string, content: string, phone: string | null): Promise<string> {
  const { data, error } = await supabase.rpc('create_pt_request', {
    p_gym_id: gymId,
    p_trainer_id: trainerId,
    p_content: content.trim().slice(0, PT_CONTENT_MAX),
    p_phone: phone?.trim() || null,
  });
  if (error) throw error;
  return data as string;
}

export async function fetchMyPtRequests(): Promise<PtRequest[]> {
  const { data, error } = await supabase.rpc('list_my_pt_requests');
  if (error) return [];
  return (data ?? []).map((r: any) => ({
    id: r.id, gymId: r.gym_id, gymName: r.gym_name, memberId: r.member_id, memberNickname: r.member_nickname,
    trainerId: r.trainer_id, trainerNickname: r.trainer_nickname, content: r.content, phone: r.phone ?? null,
    status: r.status, createdAt: r.created_at, lastMessageAt: r.last_message_at, myRole: r.my_role,
  }));
}

export async function fetchPtMessages(requestId: string): Promise<PtMessage[]> {
  const { data, error } = await supabase.rpc('list_pt_messages', { p_request_id: requestId });
  if (error) return [];
  return (data ?? []).map((r: any) => ({
    id: r.id, senderId: r.sender_id, senderNickname: r.sender_nickname, content: r.content, createdAt: r.created_at,
  }));
}

export async function sendPtMessage(requestId: string, content: string): Promise<void> {
  const { error } = await supabase
    .from('pt_messages')
    .insert({ request_id: requestId, content: content.trim().slice(0, PT_MESSAGE_MAX) });
  if (error) throw error;
}

export async function closePtRequest(requestId: string): Promise<void> {
  const { error } = await supabase.rpc('close_pt_request', { p_request_id: requestId });
  if (error) throw error;
}
