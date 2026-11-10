import React, { useCallback, useEffect, useState } from 'react';
import { Modal, View, Text, TouchableOpacity, ScrollView, StyleSheet, Alert, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { C, R } from '../../../theme';
import {
  memberDisplayName,
  fetchGymInviteCode, fetchGymMembers, fetchGymMemberRequests, reviewGymMemberRequest, removeGymMember,
  type GymMemberRow, type GymMemberRequestRow,
} from '../../../lib/db/gymMembers';
import InviteCodeSection from './InviteCodeSection';
import { MemberItem, MemberRequestItem } from './MemberRows';
import TrainerSection from './TrainerSection';

// 2026-11-09: 관장님 회원 관리 (초대 QR·코드 / 가입 신청 / 트레이너 / 회원 목록)
// 매니저 대시보드와 헬스장 상세(관장님 본인일 때) 두 곳에서 연다.

interface Props {
  visible:   boolean;
  gymId:     string | null;
  gymName:   string;
  onClose:   () => void;
  /** 승인·거절·내보내기 후 대기/회원 수가 바뀌었을 때 */
  onChanged?: () => void;
}

export default function GymMembersModal({ visible, gymId, gymName, onClose, onChanged }: Props) {
  const [code,       setCode]       = useState<string | null>(null);
  const [codeLoad,   setCodeLoad]   = useState(true);
  const [requests,   setRequests]   = useState<GymMemberRequestRow[]>([]);
  const [members,    setMembers]    = useState<GymMemberRow[]>([]);
  const [busyId,     setBusyId]     = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [version,    setVersion]    = useState(0);

  const loadLists = useCallback(async () => {
    if (!gymId) return;
    const [r, m] = await Promise.all([fetchGymMemberRequests(gymId), fetchGymMembers(gymId)]);
    setRequests(r);
    setMembers(m);
  }, [gymId]);

  useEffect(() => {
    if (!visible || !gymId) return;
    setCode(null);
    setCodeLoad(true);
    fetchGymInviteCode(gymId)
      .then(setCode)
      .catch(() => Alert.alert('초대 코드를 불러오지 못했어요'))
      .finally(() => setCodeLoad(false));
    loadLists();
  }, [visible, gymId, loadLists]);

  async function rotate() {
    if (!gymId) return;
    setCodeLoad(true);
    try { setCode(await fetchGymInviteCode(gymId, true)); }
    catch { Alert.alert('새 코드를 만들지 못했어요'); }
    finally { setCodeLoad(false); }
  }

  async function review(req: GymMemberRequestRow, approve: boolean) {
    setBusyId(req.id);
    try {
      await reviewGymMemberRequest(req.id, approve);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await loadLists();
      onChanged?.();
    } catch {
      Alert.alert('처리하지 못했어요', '이미 처리된 신청일 수 있어요.');
      await loadLists();
    } finally {
      setBusyId(null);
    }
  }

  function confirmRemove(m: GymMemberRow) {
    if (!gymId) return;
    Alert.alert(`${memberDisplayName(m).primary}님을 내보낼까요?`, '회원 전용 기능을 더 이상 쓸 수 없어요. 다시 가입할 수 있어요.', [
      { text: '취소', style: 'cancel' },
      {
        text: '내보내기', style: 'destructive', onPress: async () => {
          try { await removeGymMember(gymId, m.userId); await loadLists(); onChanged?.(); }
          catch { Alert.alert('내보내지 못했어요'); }
        },
      },
    ]);
  }

  async function onRefresh() {
    setRefreshing(true);
    setVersion(v => v + 1);
    await loadLists();
    setRefreshing(false);
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
        <View style={s.header}>
          <View style={{ flex: 1 }}>
            <Text style={s.headerTitle}>회원 · 트레이너 관리</Text>
            <Text style={s.headerSub} numberOfLines={1}>{gymName}</Text>
          </View>
          <TouchableOpacity onPress={onClose} hitSlop={8} activeOpacity={0.7}>
            <Ionicons name="close" size={22} color={C.textSub} />
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={s.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.accent} />}
        >
          <Text style={s.section}>회원 초대</Text>
          {gymId && (
            <InviteCodeSection gymId={gymId} gymName={gymName} code={code} loading={codeLoad} onRotate={rotate} />
          )}

          <Text style={s.section}>가입 신청 {requests.length > 0 ? requests.length : ''}</Text>
          <View style={s.card}>
            {requests.length === 0
              ? <Text style={s.empty}>대기 중인 신청이 없어요</Text>
              : requests.map(r => (
                  <MemberRequestItem
                    key={r.id}
                    item={r}
                    busy={busyId === r.id}
                    onApprove={() => review(r, true)}
                    onReject={() => review(r, false)}
                  />
                ))}
          </View>

          {gymId && <TrainerSection gymId={gymId} version={version} onChanged={onChanged} />}

          <Text style={s.section}>회원 {members.length}명</Text>
          <View style={s.card}>
            {members.length === 0
              ? <Text style={s.empty}>아직 회원이 없어요. 위 QR을 카운터에 붙여 보세요.</Text>
              : members.map(m => <MemberItem key={m.userId} item={m} onRemove={() => confirmRemove(m)} />)}
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const s = StyleSheet.create({
  safe:        { flex: 1, backgroundColor: C.bg },
  header:      { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.border },
  headerTitle: { fontSize: 17, fontWeight: '800', color: C.text },
  headerSub:   { fontSize: 12, color: C.textSub, marginTop: 1 },
  content:     { padding: 16, paddingBottom: 40 },
  section:     { color: C.text, fontSize: 15, fontWeight: '800', marginTop: 24, marginBottom: 10 },
  card:        { backgroundColor: C.surface, borderRadius: R.card, borderWidth: 1, borderColor: C.border, overflow: 'hidden' },
  empty:       { color: C.textSub, fontSize: 13, padding: 16, lineHeight: 19 },
});
