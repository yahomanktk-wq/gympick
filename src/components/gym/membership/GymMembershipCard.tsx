import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { C, R } from '../../../theme';
import { useGymMembership } from './useGymMembership';
import JoinCodeModal from './JoinCodeModal';

// 2026-11-09: 헬스장 상세 > 정보 탭의 회원 카드
// - 관장님이 있는 헬스장에서만 보인다 (승인할 사람이 있어야 하므로)
// - 로그인하지 않았으면 숨김
// - 관장님 본인·트레이너에게는 숨김 (관장님은 매니저 대시보드 '회원 · 트레이너 관리'에서 관리)
// - 회원: '이 헬스장 회원' + 탈퇴 / 신청 대기: 신청 취소 / 그 외: 초대 코드 입력 · 가입 신청

interface Props {
  gymId:     string;
  gymName:   string;
  managerId: string | null | undefined;
  userId:    string | null | undefined;
}

export default function GymMembershipCard({ gymId, gymName, managerId, userId }: Props) {
  const isOwner = !!userId && !!managerId && userId === managerId;
  const { status, loading, reload, request, cancelRequest, leave } = useGymMembership(isOwner ? null : gymId, userId);
  const [joinOpen,    setJoinOpen]    = useState(false);
  const [busy,        setBusy]        = useState(false);

  // 관장님 본인: 회원·트레이너 관리는 매니저 대시보드에서 (2026-11-09) / 트레이너: 회원 카드 숨김
  if (!managerId || !userId || isOwner || status === 'staff') return null;

  if (loading) {
    return <View style={[s.card, { justifyContent: 'center' }]}><ActivityIndicator color={C.accent} /></View>;
  }

  async function run(fn: () => Promise<unknown>, fail: string) {
    if (busy) return;
    setBusy(true);
    try { await fn(); }
    catch { Alert.alert(fail, '잠시 후 다시 시도해 주세요.'); await reload(); }
    finally { setBusy(false); }
  }

  function onRequest() {
    Alert.alert('회원 가입을 신청할까요?', `${gymName} 관장님이 승인하면 회원이 돼요. 관장님에게 닉네임이 보여요.`, [
      { text: '취소', style: 'cancel' },
      {
        text: '신청', onPress: () => run(async () => {
          const r = await request();
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          if (r === 'already_member') Alert.alert('이미 회원이에요');
        }, '신청하지 못했어요'),
      },
    ]);
  }

  function onCancel() {
    Alert.alert('가입 신청을 취소할까요?', undefined, [
      { text: '아니요', style: 'cancel' },
      { text: '신청 취소', style: 'destructive', onPress: () => run(cancelRequest, '취소하지 못했어요') },
    ]);
  }

  function onLeave() {
    Alert.alert(`${gymName} 회원에서 탈퇴할까요?`, '다시 가입하려면 초대 코드나 신청이 필요해요.', [
      { text: '취소', style: 'cancel' },
      { text: '탈퇴', style: 'destructive', onPress: () => run(leave, '탈퇴하지 못했어요') },
    ]);
  }

  return (
    <>
      {status === 'member' && (
        <View style={s.card}>
          <Ionicons name="checkmark-circle" size={18} color={C.accent} />
          <Text style={[s.title, { flex: 1 }]}>이 헬스장 회원이에요</Text>
          <TouchableOpacity onPress={onLeave} hitSlop={8} disabled={busy}>
            <Text style={s.linkDim}>탈퇴</Text>
          </TouchableOpacity>
        </View>
      )}

      {status === 'pending' && (
        <View style={s.card}>
          <Ionicons name="time-outline" size={18} color={C.textSub} />
          <View style={{ flex: 1 }}>
            <Text style={s.title}>가입 신청 중</Text>
            <Text style={s.sub}>관장님 승인을 기다리고 있어요</Text>
          </View>
          <TouchableOpacity onPress={() => setJoinOpen(true)} hitSlop={8} disabled={busy}>
            <Text style={s.link}>코드 입력</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onCancel} hitSlop={8} disabled={busy}>
            <Text style={s.linkDim}>취소</Text>
          </TouchableOpacity>
        </View>
      )}

      {status === 'none' && (
        <View style={[s.card, s.cardColumn]}>
          <Text style={s.title}>이 헬스장 회원이세요?</Text>
          <Text style={s.sub}>회원이 되면 회원 전용 기능을 함께 쓸 수 있어요.</Text>
          <View style={s.btnRow}>
            <TouchableOpacity style={[s.btn, s.btnPrimary]} activeOpacity={0.85} onPress={() => setJoinOpen(true)} disabled={busy}>
              <Ionicons name="qr-code-outline" size={15} color={C.bg} />
              <Text style={s.btnPrimaryText}>QR · 코드로 가입</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.btn} activeOpacity={0.85} onPress={onRequest} disabled={busy}>
              <Text style={s.btnText}>가입 신청</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <JoinCodeModal
        visible={joinOpen}
        onClose={() => setJoinOpen(false)}
        onJoined={() => reload()}
      />
    </>
  );
}

const s = StyleSheet.create({
  card:           { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.surface, borderRadius: R.card, borderWidth: 1, borderColor: C.border, paddingHorizontal: 16, paddingVertical: 14, marginTop: 14, minHeight: 56 },
  cardColumn:     { flexDirection: 'column', alignItems: 'stretch', gap: 6 },
  title:          { color: C.text, fontSize: 15, fontWeight: '700' },
  sub:            { color: C.textSub, fontSize: 12, marginTop: 2, lineHeight: 17 },
  link:           { color: C.accent, fontSize: 13, fontWeight: '700' },
  linkDim:        { color: C.textSub, fontSize: 13, fontWeight: '600' },
  btnRow:         { flexDirection: 'row', gap: 8, marginTop: 8 },
  btn:            { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: R.pill, backgroundColor: C.surfaceHigh, borderWidth: 1, borderColor: C.border },
  btnText:        { color: C.text, fontSize: 14, fontWeight: '700' },
  btnPrimary:     { backgroundColor: C.accent, borderColor: C.accent },
  btnPrimaryText: { color: C.bg, fontSize: 14, fontWeight: '800' },
  badge:          { minWidth: 20, height: 20, borderRadius: 10, backgroundColor: C.danger, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  badgeText:      { color: '#fff', fontSize: 11, fontWeight: '800' },
});
