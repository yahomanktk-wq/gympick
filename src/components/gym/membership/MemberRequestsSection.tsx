import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import * as Haptics from 'expo-haptics';
import { C, R } from '../../../theme';
import { fetchGymMemberRequests, reviewGymMemberRequest, type GymMemberRequestRow } from '../../../lib/db/gymMembers';
import { MemberRequestItem } from '../../manager/members/MemberRows';

// 2026-11-09: 회원 가입 신청 승인·거절 — 트레이너용 (프로필 '내 헬스장', 헬스장 상세 트레이너 줄)
// 관장님은 매니저 대시보드 '회원 · 트레이너 관리'에서 같은 일을 한다.

interface Props {
  gymId:      string;
  version?:   number;
  /** 0건이면 아무것도 그리지 않음 */
  hideWhenEmpty?: boolean;
  onCountChange?: (n: number) => void;
}

export default function MemberRequestsSection({ gymId, version = 0, hideWhenEmpty, onCountChange }: Props) {
  const [items,  setItems]  = useState<GymMemberRequestRow[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await fetchGymMemberRequests(gymId);
    setItems(r);
    onCountChange?.(r.length);
  }, [gymId]);
  useEffect(() => { load(); }, [load, version]);

  async function review(req: GymMemberRequestRow, approve: boolean) {
    setBusyId(req.id);
    try {
      await reviewGymMemberRequest(req.id, approve);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      Alert.alert('처리하지 못했어요', '이미 처리된 신청일 수 있어요.');
    } finally {
      setBusyId(null);
      load();
    }
  }

  if (items.length === 0 && hideWhenEmpty) return null;

  return (
    <View style={s.card}>
      <Text style={s.title}>회원 가입 신청 {items.length > 0 ? items.length : ''}</Text>
      {items.length === 0
        ? <Text style={s.empty}>대기 중인 신청이 없어요</Text>
        : items.map(r => (
            <MemberRequestItem
              key={r.id}
              item={r}
              busy={busyId === r.id}
              onApprove={() => review(r, true)}
              onReject={() => review(r, false)}
            />
          ))}
    </View>
  );
}

const s = StyleSheet.create({
  card:  { backgroundColor: C.surface, borderRadius: R.card, borderWidth: 1, borderColor: C.border, overflow: 'hidden' },
  title: { color: C.text, fontSize: 15, fontWeight: '800', paddingHorizontal: 14, paddingTop: 14, paddingBottom: 4 },
  empty: { color: C.textSub, fontSize: 13, paddingHorizontal: 14, paddingBottom: 14, paddingTop: 4 },
});
