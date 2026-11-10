import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { C, R } from '../../../theme';
import { useAuth } from '../../../context/AuthContext';
import { timeAgo } from '../../../lib/timeAgo';
import { fetchGymQuestionList, type GymQuestionSummary } from '../../../lib/db/gymQna';
import { useIsGymMember } from '../../feed/visibility/useIsGymMember';
import QuestionComposeModal from './QuestionComposeModal';
import GymQuestionModal from './GymQuestionModal';
import QnaStatusPill from './QnaStatusPill';

// 2026-11-09: 헬스장 상세 > 커뮤니티 > Q&A
// - 목록(제목 · 답변 상태 · 답변 수)은 누구나
// - 탭해서 본문·답변 보기, 질문하기는 그 헬스장 회원만 (비회원은 안내)
// 부모가 ScrollView라 FlatList 대신 map으로 그린다.

const PAGE = 20;

export default function GymQnaBoard({ gymId }: { gymId: string }) {
  const { user } = useAuth();
  const isMember = useIsGymMember(gymId, user?.id);
  const isAdmin = user?.role === 'admin';
  const canRead = isMember === true || isAdmin;

  const [items,     setItems]     = useState<GymQuestionSummary[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [hasMore,   setHasMore]   = useState(false);
  const [composing, setComposing] = useState(false);
  const [openId,    setOpenId]    = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const list = await fetchGymQuestionList(gymId, undefined, PAGE);
    setItems(list);
    setHasMore(list.length === PAGE);
    setLoading(false);
  }, [gymId]);
  useEffect(() => { load(); }, [load]);

  async function loadMore() {
    const last = items[items.length - 1];
    if (!last) return;
    const more = await fetchGymQuestionList(gymId, last.createdAt, PAGE);
    setItems(prev => [...prev, ...more]);
    setHasMore(more.length === PAGE);
  }

  function openQuestion(q: GymQuestionSummary) {
    if (canRead) { setOpenId(q.id); return; }
    Alert.alert(
      '회원만 볼 수 있어요',
      user ? '이 헬스장 회원이 되면 질문과 답변을 볼 수 있어요. 정보 탭에서 회원 가입을 해주세요.' : '로그인 후 이 헬스장 회원이 되면 볼 수 있어요.',
    );
  }

  function onPressWrite() {
    if (isMember === true) { setComposing(true); return; }
    Alert.alert('회원만 질문할 수 있어요', '정보 탭에서 이 헬스장 회원으로 가입해 주세요.');
  }

  return (
    <View style={{ marginBottom: 20 }}>
      <View style={s.headRow}>
        <Text style={s.title}>Q&A</Text>
        <TouchableOpacity style={[s.writeBtn, isMember !== true && { opacity: 0.5 }]} onPress={onPressWrite} activeOpacity={0.85}>
          <Ionicons name="create-outline" size={14} color={C.bg} />
          <Text style={s.writeText}>질문하기</Text>
        </TouchableOpacity>
      </View>
      <Text style={s.sub}>운동하다 궁금한 점을 이 헬스장 트레이너·회원에게 물어보세요. 본문은 회원만 볼 수 있어요.</Text>

      <View style={s.card}>
        {loading ? (
          <ActivityIndicator color={C.accent} style={{ paddingVertical: 20 }} />
        ) : items.length === 0 ? (
          <Text style={s.empty}>아직 질문이 없어요</Text>
        ) : items.map((q, i) => (
          <TouchableOpacity key={q.id} style={[s.row, i > 0 && s.border]} onPress={() => openQuestion(q)} activeOpacity={0.8}>
            <QnaStatusPill done={q.staffAnswered} />
            <View style={{ flex: 1 }}>
              <Text style={s.qTitle} numberOfLines={1}>{q.title}</Text>
              <Text style={s.meta}>
                {q.isMine ? '내 질문 · ' : ''}{timeAgo(q.createdAt)}{q.answerCount > 0 ? ` · 답변 ${q.answerCount}` : ''}
              </Text>
            </View>
            {!canRead && <Ionicons name="lock-closed-outline" size={14} color={C.textDim} />}
          </TouchableOpacity>
        ))}
      </View>
      {hasMore && (
        <TouchableOpacity onPress={loadMore} style={{ alignSelf: 'center' }}>
          <Text style={s.more}>더 보기</Text>
        </TouchableOpacity>
      )}

      {user?.id && (
        <QuestionComposeModal
          visible={composing}
          gymId={gymId}
          userId={user.id}
          onClose={() => setComposing(false)}
          onPosted={load}
        />
      )}
      {openId && <GymQuestionModal questionId={openId} onClose={() => setOpenId(null)} onChanged={load} />}
    </View>
  );
}

const s = StyleSheet.create({
  headRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title:      { color: C.text, fontSize: 17, fontWeight: '800' },
  sub:        { color: C.textSub, fontSize: 12, lineHeight: 17, marginTop: 4, marginBottom: 10 },
  writeBtn:   { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: C.accent, borderRadius: R.pill, paddingHorizontal: 12, paddingVertical: 7 },
  writeText:  { color: C.bg, fontSize: 13, fontWeight: '800' },
  card:       { backgroundColor: C.surface, borderRadius: R.card, borderWidth: 1, borderColor: C.border, overflow: 'hidden' },
  empty:      { color: C.textSub, fontSize: 13, padding: 16 },
  row:        { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 12 },
  border:     { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.border },
  status:     { color: C.textSub, fontSize: 10, fontWeight: '800', paddingHorizontal: 7, paddingVertical: 3, borderRadius: R.pill, backgroundColor: C.surfaceHigh, overflow: 'hidden' },
  statusDone: { color: C.bg, backgroundColor: C.accent },
  qTitle:     { color: C.text, fontSize: 14, fontWeight: '700' },
  meta:       { color: C.textSub, fontSize: 11, marginTop: 2 },
  more:       { color: C.textSub, fontSize: 13, paddingVertical: 12 },
});
