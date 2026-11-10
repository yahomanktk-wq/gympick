import React, { useCallback, useEffect, useState } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, FlatList, RefreshControl, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { C, R } from '../../theme';
import { timeAgo } from '../../lib/timeAgo';
import { fetchMyPtRequests, closePtRequest, PT_STATUS_LABEL, type PtRequest } from '../../lib/db/ptRequests';
import PtThreadModal from './PtThreadModal';

// 2026-11-09: 내 PT 상담 목록 (회원으로 신청한 것 + 트레이너·관장님으로 받은 것)
// initialRequestId를 주면 그 대화방을 바로 연다 (알림에서 진입)
// 2026-11-09: gymId를 주면 그 헬스장 상담만 (매니저 대시보드: 관장님은 소속 트레이너·회원 대화 전체 조회)
// 2026-11-09: 완료(관장님·트레이너) / 취소(회원)는 대화방 안이 아니라 이 목록의 카드에서

interface Props {
  visible:           boolean;
  onClose:           () => void;
  initialRequestId?: string | null;
  gymId?:            string | null;
  title?:            string;
}

const ROLE_LABEL = { member: '내 신청', trainer: '받은 신청', owner: '헬스장 신청' } as const;

export default function PtRequestsModal({ visible, onClose, initialRequestId, gymId, title }: Props) {
  const [items,      setItems]      = useState<PtRequest[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [openReq,    setOpenReq]    = useState<PtRequest | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const all = await fetchMyPtRequests();
    const list = gymId ? all.filter(r => r.gymId === gymId) : all;
    setItems(list);
    setLoading(false);
    return list;
  }, [gymId]);

  useEffect(() => {
    if (!visible) return;
    load().then(list => {
      if (initialRequestId) setOpenReq(list.find(r => r.id === initialRequestId) ?? null);
    });
  }, [visible, initialRequestId]);

  function confirmClose(item: PtRequest, isMember: boolean) {
    Alert.alert(
      isMember ? '신청을 취소할까요?' : '상담을 완료할까요?',
      '닫으면 더 이상 메시지를 보낼 수 없어요. 대화 내용은 목록에 남아요.',
      [
        { text: '아니요', style: 'cancel' },
        {
          text: isMember ? '신청 취소' : '상담 완료', style: 'destructive', onPress: async () => {
            try { await closePtRequest(item.id); await load(); }
            catch { Alert.alert('처리하지 못했어요'); }
          },
        },
      ],
    );
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
        <View style={s.header}>
          <Text style={s.headerTitle}>{title ?? 'PT 상담'}</Text>
          <TouchableOpacity onPress={onClose} hitSlop={8}><Ionicons name="close" size={22} color={C.textSub} /></TouchableOpacity>
        </View>
        <FlatList
          data={items}
          keyExtractor={r => r.id}
          contentContainerStyle={{ padding: 16, gap: 10 }}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={C.accent} />}
          ListEmptyComponent={!loading ? (
            <Text style={s.empty}>
              {gymId
                ? '아직 이 헬스장에 들어온 PT 상담이 없어요.'
                : '아직 PT 상담이 없어요.\n헬스장 상세의 트레이너 목록이나 트레이너 답변·댓글에서 신청할 수 있어요.'}
            </Text>
          ) : null}
          renderItem={({ item }) => {
            // 관장님은 회원·트레이너 둘 다 보여준다
            const other = item.myRole === 'member'
              ? `${item.trainerNickname} 트레이너`
              : item.myRole === 'owner'
                ? `${item.memberNickname}님 → ${item.trainerNickname} 트레이너`
                : `${item.memberNickname}님`;
            const isMember = item.myRole === 'member';
            return (
              <TouchableOpacity style={[s.card, item.status !== 'open' && { opacity: 0.6 }]} onPress={() => setOpenReq(item)} activeOpacity={0.85}>
                <View style={s.cardHead}>
                  <Text style={s.role}>{ROLE_LABEL[item.myRole]}</Text>
                  <Text style={[s.status, item.status === 'open' && { color: C.accent }]}>{PT_STATUS_LABEL[item.status]}</Text>
                </View>
                <Text style={s.other} numberOfLines={1}>{other} · {item.gymName}</Text>
                <Text style={s.content} numberOfLines={2}>{item.content}</Text>
                <View style={s.footRow}>
                  <Text style={s.time}>{timeAgo(item.lastMessageAt)}</Text>
                  {item.status === 'open' && (
                    <TouchableOpacity
                      onPress={() => confirmClose(item, isMember)}
                      hitSlop={8}
                      style={[s.closeBtn, isMember && s.cancelBtn]}
                      activeOpacity={0.8}
                    >
                      <Text style={[s.closeText, isMember && s.cancelText]}>{isMember ? '신청 취소' : '상담 완료'}</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </TouchableOpacity>
            );
          }}
        />
      </SafeAreaView>
      {openReq && <PtThreadModal request={openReq} onClose={() => { setOpenReq(null); load(); }} onChanged={load} />}
    </Modal>
  );
}

const s = StyleSheet.create({
  safe:        { flex: 1, backgroundColor: C.bg },
  header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.border },
  headerTitle: { fontSize: 17, fontWeight: '800', color: C.text },
  empty:       { color: C.textSub, fontSize: 13, lineHeight: 20, textAlign: 'center', paddingVertical: 40 },
  card:        { backgroundColor: C.surface, borderRadius: R.card, borderWidth: 1, borderColor: C.border, padding: 14, gap: 4 },
  cardHead:    { flexDirection: 'row', justifyContent: 'space-between' },
  role:        { color: C.textSub, fontSize: 12, fontWeight: '700' },
  status:      { color: C.textSub, fontSize: 12, fontWeight: '800' },
  other:       { color: C.text, fontSize: 15, fontWeight: '800' },
  content:     { color: C.text, fontSize: 13, lineHeight: 19 },
  time:        { color: C.textDim, fontSize: 11 },
  footRow:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  closeBtn:    { paddingHorizontal: 12, paddingVertical: 6, borderRadius: R.pill, backgroundColor: C.accent },
  closeText:   { color: C.bg, fontSize: 12, fontWeight: '800' },
  cancelBtn:   { backgroundColor: C.surfaceHigh, borderWidth: 1, borderColor: C.border },
  cancelText:  { color: C.textSub },
});
