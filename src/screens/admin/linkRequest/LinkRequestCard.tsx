import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { C, R } from '../../../theme';
import type { GymManagerLinkRequest } from '../../../lib/db/gymManagerLinkRequests';
import type { AdminGym } from '../../../lib/db/adminGyms';
import type { InquirerProfile } from '../../../lib/db/userInquiries';

/**
 * 매니저 연결 요청 카드.
 * 신청서에 적힌 헬스장 이름(자유 입력)이 아니라 gym_id로 찾은 "실제 헬스장"과
 * 현재 매니저를 보여줘서, 이름만 바꿔 다른 헬스장을 노리는 신청을 어드민이 알아볼 수 있게 한다.
 */
interface Props {
  request:   GymManagerLinkRequest;
  gym:       AdminGym | undefined;
  requester: InquirerProfile | undefined;
  dimmed?:   boolean;
  children?: React.ReactNode; // 승인/거절 버튼 자리
}

function personLabel(nickname: string | null | undefined, email: string | null | undefined, fallbackId: string): string {
  const parts = [nickname, email].filter(Boolean) as string[];
  return parts.length > 0 ? parts.join(' · ') : fallbackId;
}

export function LinkRequestCard({ request, gym, requester, dimmed, children }: Props) {
  const nameMismatch   = !!gym && gym.name.trim() !== request.gymName.trim();
  const hasManager     = !!gym?.managerId;
  const managerIsSelf  = hasManager && String(gym!.managerId) === String(request.requesterId);
  const otherManager   = hasManager && !managerIsSelf;

  return (
    <View style={[s.card, dimmed && s.dimmed]}>
      <Text style={s.gymName}>{gym ? gym.name : '찾을 수 없는 헬스장'}</Text>
      <Text style={s.meta}>헬스장 ID: {request.gymId}</Text>

      {!gym && (
        <View style={s.warnRow}>
          <Ionicons name="warning" size={14} color={C.danger} />
          <Text style={s.warnText}>삭제됐거나 존재하지 않는 헬스장이에요.</Text>
        </View>
      )}

      {nameMismatch && (
        <View style={s.warnRow}>
          <Ionicons name="warning" size={14} color={C.danger} />
          <Text style={s.warnText}>신청서에 적힌 이름과 달라요: "{request.gymName}"</Text>
        </View>
      )}

      <Text style={s.line}>
        현재 매니저: {hasManager
          ? personLabel(gym!.managerNickname, gym!.managerEmail, String(gym!.managerId))
          : '없음'}
      </Text>
      {otherManager && (
        <View style={s.warnRow}>
          <Ionicons name="alert-circle" size={14} color={C.danger} />
          <Text style={s.warnText}>이미 다른 매니저가 있어요. 승인하면 매니저가 바뀌어요.</Text>
        </View>
      )}
      {managerIsSelf && (
        <Text style={s.meta}>이미 이 신청자가 매니저로 연결돼 있어요.</Text>
      )}

      <Text style={s.line}>
        신청자: {personLabel(requester?.nickname, requester?.email, request.requesterId)}
        {requester?.role ? `  (${requester.role})` : ''}
      </Text>
      <Text style={s.meta}>{new Date(request.createdAt).toLocaleDateString('ko-KR')}</Text>

      {children}
    </View>
  );
}

const s = StyleSheet.create({
  card:     { backgroundColor: C.surface, borderRadius: R.card, padding: 16, gap: 6 },
  dimmed:   { opacity: 0.6 },
  gymName:  { fontSize: 15, fontWeight: '800', color: C.text },
  line:     { fontSize: 13, color: C.textSub },
  meta:     { fontSize: 11, color: C.textDim },
  warnRow:  { flexDirection: 'row', alignItems: 'center', gap: 6 },
  warnText: { flex: 1, fontSize: 12, fontWeight: '700', color: C.danger },
});
