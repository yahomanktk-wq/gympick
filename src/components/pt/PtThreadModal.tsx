import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Modal, View, Text, TouchableOpacity, StyleSheet, FlatList, KeyboardAvoidingView, Platform, Alert, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useKeyboardHeight } from '../../lib/useKeyboardHeight';
import { Ionicons } from '@expo/vector-icons';
import { C, R } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import { timeAgo } from '../../lib/timeAgo';
import { containsBannedWord } from '../../lib/bannedWords';
import {
  fetchPtMessages, sendPtMessage, closePtRequest, PT_MESSAGE_MAX, PT_STATUS_LABEL,
  type PtMessage, type PtRequest,
} from '../../lib/db/ptRequests';
import CommentInput from '../feed/comments/CommentInput';

// 2026-11-09: PT 상담 대화방 (신청 1건 = 대화방 1개)
// 닫기(관장님·트레이너 '상담 완료' / 회원 '신청 취소')는 목록(PtRequestsModal) 카드에서. 닫힌 뒤에는 읽기만.

interface Props {
  request:   PtRequest | null;
  onClose:   () => void;
  /** 완료·취소 후 목록 갱신용 */
  onChanged?: () => void;
}

export default function PtThreadModal({ request, onClose, onChanged }: Props) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<PtMessage[]>([]);
  const [status,   setStatus]   = useState(request?.status ?? 'open');
  const listRef = useRef<FlatList<PtMessage>>(null);
  // 키보드가 입력칸을 가리지 않게 (SafeAreaView가 이미 하단 여백만큼 띄워 두므로 그만큼 뺀다)
  const insets = useSafeAreaInsets();
  const kbHeight = useKeyboardHeight();
  const kbPad = kbHeight > 0 ? Math.max(0, kbHeight - insets.bottom) : 0;

  const load = useCallback(async () => {
    if (!request) return;
    setMessages(await fetchPtMessages(request.id));
  }, [request?.id]);

  useEffect(() => { setStatus(request?.status ?? 'open'); setMessages([]); load(); }, [request?.id]);

  if (!request) return null;
  const isMember = request.myRole === 'member';
  const open = status === 'open';
  const title = isMember ? `${request.trainerNickname} 트레이너` : `${request.memberNickname}님`;

  async function send(text: string): Promise<boolean> {
    if (await containsBannedWord(text)) { Alert.alert('사용할 수 없는 표현이 있어요'); return false; }
    try {
      await sendPtMessage(request!.id, text);
      await load();
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
      return true;
    } catch {
      Alert.alert('보내지 못했어요', '상담이 끝났거나 잠시 문제가 있어요.');
      return false;
    }
  }

  function confirmClose() {
    Alert.alert(
      isMember ? '신청을 취소할까요?' : '상담을 완료할까요?',
      '닫으면 더 이상 메시지를 보낼 수 없어요.',
      [
        { text: '아니요', style: 'cancel' },
        {
          text: isMember ? '신청 취소' : '상담 완료', style: 'destructive', onPress: async () => {
            try { await closePtRequest(request!.id); setStatus(isMember ? 'cancelled' : 'closed'); onChanged?.(); }
            catch { Alert.alert('처리하지 못했어요'); }
          },
        },
      ],
    );
  }

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
        <View style={{ flex: 1, paddingBottom: kbPad }}>
          <View style={s.header}>
            <TouchableOpacity onPress={onClose} hitSlop={8}><Ionicons name="chevron-down" size={24} color={C.text} /></TouchableOpacity>
            <View style={{ flex: 1, alignItems: 'center' }}>
              <Text style={s.headerTitle} numberOfLines={1}>{title}</Text>
              <Text style={s.headerSub} numberOfLines={1}>{request.gymName} · {PT_STATUS_LABEL[status]}</Text>
            </View>
            {/* 2026-11-09: 완료·취소 버튼은 목록 카드로 이동 */}
            <View style={{ width: 24 }} />
          </View>

          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={m => m.id}
            contentContainerStyle={{ padding: 16, gap: 10 }}
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
            ListHeaderComponent={
              <View style={s.requestCard}>
                <Text style={s.requestLabel}>상담 신청 내용 · {timeAgo(request.createdAt)}</Text>
                <Text style={s.requestBody}>{request.content}</Text>
                {request.phone && !isMember ? (
                  <TouchableOpacity onPress={() => Linking.openURL(`tel:${request.phone}`)} style={s.phoneRow}>
                    <Ionicons name="call-outline" size={14} color={C.accent} />
                    <Text style={s.phoneText}>{request.phone}</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            }
            renderItem={({ item }) => {
              const mine = item.senderId === user?.id;
              return (
                <View style={[s.bubbleWrap, mine && { alignItems: 'flex-end' }]}>
                  {!mine && <Text style={s.sender}>{item.senderNickname}</Text>}
                  <View style={[s.bubble, mine ? s.bubbleMine : s.bubbleOther]}>
                    <Text style={[s.bubbleText, mine && { color: C.bg }]}>{item.content}</Text>
                  </View>
                  <Text style={s.time}>{timeAgo(item.createdAt)}</Text>
                </View>
              );
            }}
          />

          <View style={s.inputBar}>
            {open ? (
              <CommentInput placeholder="메시지 보내기" maxLength={PT_MESSAGE_MAX} onSubmit={send} submitLabel="보내기" />
            ) : (
              <Text style={s.closedText}>{status === 'cancelled' ? '취소된 상담이에요' : '완료된 상담이에요'}</Text>
            )}
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const s = StyleSheet.create({
  safe:         { flex: 1, backgroundColor: C.bg },
  header:       { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.border },
  headerTitle:  { color: C.text, fontSize: 16, fontWeight: '800' },
  headerSub:    { color: C.textSub, fontSize: 12, marginTop: 1 },
  closeText:    { color: C.danger, fontSize: 14, fontWeight: '700' },
  requestCard:  { backgroundColor: C.surface, borderRadius: R.inner, borderWidth: 1, borderColor: C.border, padding: 14, marginBottom: 6, gap: 6 },
  requestLabel: { color: C.textSub, fontSize: 12, fontWeight: '600' },
  requestBody:  { color: C.text, fontSize: 14, lineHeight: 20 },
  phoneRow:     { flexDirection: 'row', alignItems: 'center', gap: 6 },
  phoneText:    { color: C.accent, fontSize: 14, fontWeight: '700' },
  bubbleWrap:   { alignItems: 'flex-start', gap: 3 },
  sender:       { color: C.textSub, fontSize: 12, fontWeight: '700' },
  bubble:       { maxWidth: '80%', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 9 },
  bubbleMine:   { backgroundColor: C.accent },
  bubbleOther:  { backgroundColor: C.surfaceHigh },
  bubbleText:   { color: C.text, fontSize: 14, lineHeight: 20 },
  time:         { color: C.textDim, fontSize: 10 },
  inputBar:     { paddingHorizontal: 12, paddingTop: 8, paddingBottom: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.border },
  closedText:   { color: C.textSub, fontSize: 13, textAlign: 'center', paddingVertical: 10 },
});
