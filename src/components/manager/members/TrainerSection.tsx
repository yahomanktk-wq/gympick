import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import * as Haptics from 'expo-haptics';
import { C, R } from '../../../theme';
import { timeAgo } from '../../../lib/timeAgo';
import {
  fetchTrainerApplications, fetchGymStaffAdmin, reviewTrainerApplication, removeGymTrainer,
  type TrainerApplicationRow, type GymStaffRow,
} from '../../../lib/db/gymTrainers';

// 2026-11-09: 관장님 회원 관리 화면의 트레이너 영역 (신청 승인·거절 / 트레이너 목록·권한 해제)
// 실명·소개는 이 화면(관장님)에서만 보인다.

interface Props {
  gymId:      string;
  /** 부모가 당겨서 새로고침할 때 숫자를 올린다 */
  version:    number;
  onChanged?: () => void;
}

export default function TrainerSection({ gymId, version, onChanged }: Props) {
  const [apps,   setApps]   = useState<TrainerApplicationRow[]>([]);
  const [staff,  setStaff]  = useState<GymStaffRow[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [a, st] = await Promise.all([fetchTrainerApplications(gymId), fetchGymStaffAdmin(gymId)]);
    setApps(a);
    setStaff(st);
  }, [gymId]);
  useEffect(() => { load(); }, [load, version]);

  async function review(app: TrainerApplicationRow, approve: boolean) {
    setBusyId(app.id);
    try {
      await reviewTrainerApplication(app.id, approve);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onChanged?.();
    } catch {
      Alert.alert('처리하지 못했어요', '이미 처리된 신청일 수 있어요.');
    } finally {
      setBusyId(null);
      load();
    }
  }

  function confirmApprove(app: TrainerApplicationRow) {
    Alert.alert(
      `${app.realName}(${app.nickname})님을 트레이너로 승인할까요?`,
      '이 헬스장 오운완 댓글에 트레이너 배지가 붙고, PT 상담을 받을 수 있어요.',
      [{ text: '취소', style: 'cancel' }, { text: '승인', onPress: () => review(app, true) }],
    );
  }

  function confirmRemove(m: GymStaffRow) {
    Alert.alert(`${m.realName}님의 트레이너 권한을 해제할까요?`, '이미 단 댓글의 배지는 그대로 남아요.', [
      { text: '취소', style: 'cancel' },
      {
        text: '권한 해제', style: 'destructive', onPress: async () => {
          try { await removeGymTrainer(gymId, m.userId); onChanged?.(); load(); }
          catch { Alert.alert('처리하지 못했어요'); }
        },
      },
    ]);
  }

  return (
    <>
      <Text style={s.section}>트레이너 신청 {apps.length > 0 ? apps.length : ''}</Text>
      <View style={s.card}>
        {apps.length === 0
          ? <Text style={s.empty}>대기 중인 신청이 없어요. 트레이너에게 헬스장 상세 › '트레이너 신청'을 눌러달라고 해주세요.</Text>
          : apps.map(a => (
              <View key={a.id} style={s.row}>
                <View style={{ flex: 1 }}>
                  <Text style={s.name} numberOfLines={1}>{a.realName} <Text style={s.nick}>· {a.nickname}</Text></Text>
                  {a.intro ? <Text style={s.intro} numberOfLines={2}>{a.intro}</Text> : null}
                  <Text style={s.meta}>{timeAgo(a.createdAt)} 신청</Text>
                </View>
                <TouchableOpacity style={[s.smallBtn, s.rejectBtn]} onPress={() => review(a, false)} disabled={busyId === a.id} activeOpacity={0.8}>
                  <Text style={s.rejectText}>거절</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.smallBtn, s.approveBtn]} onPress={() => confirmApprove(a)} disabled={busyId === a.id} activeOpacity={0.8}>
                  <Text style={s.approveText}>승인</Text>
                </TouchableOpacity>
              </View>
            ))}
      </View>

      <Text style={s.section}>트레이너 {staff.length}명</Text>
      <View style={s.card}>
        {staff.length === 0
          ? <Text style={s.empty}>아직 트레이너가 없어요</Text>
          : staff.map(m => (
              <View key={m.userId} style={s.row}>
                <View style={{ flex: 1 }}>
                  <Text style={s.name} numberOfLines={1}>{m.realName} <Text style={s.nick}>· {m.nickname}</Text></Text>
                  {m.intro ? <Text style={s.intro} numberOfLines={2}>{m.intro}</Text> : null}
                </View>
                <TouchableOpacity onPress={() => confirmRemove(m)} hitSlop={8} activeOpacity={0.7}>
                  <Text style={s.removeText}>권한 해제</Text>
                </TouchableOpacity>
              </View>
            ))}
      </View>
    </>
  );
}

const s = StyleSheet.create({
  section:     { color: C.text, fontSize: 15, fontWeight: '800', marginTop: 24, marginBottom: 10 },
  card:        { backgroundColor: C.surface, borderRadius: R.card, borderWidth: 1, borderColor: C.border, overflow: 'hidden' },
  empty:       { color: C.textSub, fontSize: 13, padding: 16, lineHeight: 19 },
  row:         { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: C.border },
  name:        { color: C.text, fontSize: 15, fontWeight: '700' },
  nick:        { color: C.textSub, fontSize: 13, fontWeight: '500' },
  intro:       { color: C.text, fontSize: 13, marginTop: 3, lineHeight: 18 },
  meta:        { color: C.textSub, fontSize: 12, marginTop: 2 },
  smallBtn:    { paddingHorizontal: 14, paddingVertical: 8, borderRadius: R.pill },
  approveBtn:  { backgroundColor: C.accent },
  approveText: { color: C.bg, fontWeight: '800', fontSize: 13 },
  rejectBtn:   { backgroundColor: C.surfaceHigh, borderWidth: 1, borderColor: C.border },
  rejectText:  { color: C.textSub, fontWeight: '700', fontSize: 13 },
  removeText:  { color: C.danger, fontSize: 13, fontWeight: '600' },
});
