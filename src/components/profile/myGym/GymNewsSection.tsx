import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { C, R } from '../../../theme';
import { timeAgo } from '../../../lib/timeAgo';
import { fetchGymQuestionList, fetchMyGymQuestions, type GymQuestionSummary } from '../../../lib/db/gymQna';
import GymQuestionModal from '../../gym/qna/GymQuestionModal';
import QuestionComposeModal from '../../gym/qna/QuestionComposeModal';
import QnaStatusPill from '../../gym/qna/QnaStatusPill';

// 2026-11-09: 프로필 '내 헬스장' > 헬스장 소식
// - 내 질문 (답변 수 · 트레이너 답변 여부)
// - 이 헬스장의 최근 Q&A 3개
// (공지사항은 아직 서버에 저장되지 않아 넣지 않음 — 스마트 공지와 함께 보류)

interface Props {
  gymId:   string;
  userId:  string;
  version: number;
  /** 2026-11-09: 트레이너는 답하는 입장 — 질문하기·'내 질문' 대신 '답변을 기다리는 질문' */
  role:    'member' | 'trainer';
}

function QuestionRow({ q, onPress }: { q: GymQuestionSummary; onPress: () => void }) {
  return (
    <TouchableOpacity style={s.row} onPress={onPress} activeOpacity={0.8}>
      <QnaStatusPill done={q.staffAnswered} />
      <View style={{ flex: 1 }}>
        <Text style={s.title} numberOfLines={1}>{q.title}</Text>
        <Text style={s.meta}>{timeAgo(q.createdAt)}{q.answerCount > 0 ? ` · 답변 ${q.answerCount}` : ''}</Text>
      </View>
      <Ionicons name="chevron-forward" size={14} color={C.textDim} />
    </TouchableOpacity>
  );
}

export default function GymNewsSection({ gymId, userId, version, role }: Props) {
  const isTrainer = role === 'trainer';
  const [mine,      setMine]      = useState<GymQuestionSummary[]>([]);
  const [recent,    setRecent]    = useState<GymQuestionSummary[]>([]);
  const [openId,    setOpenId]    = useState<string | null>(null);
  const [composing, setComposing] = useState(false);

  const load = useCallback(async () => {
    if (isTrainer) {
      const list = await fetchGymQuestionList(gymId, undefined, 20);
      setMine(list.filter(q => !q.staffAnswered).slice(0, 5));          // 답변을 기다리는 질문
      setRecent(list.filter(q => q.staffAnswered).slice(0, 3));         // 최근 답변 완료
      return;
    }
    const [m, r] = await Promise.all([fetchMyGymQuestions(gymId, userId), fetchGymQuestionList(gymId, undefined, 6)]);
    setMine(m);
    setRecent(r.filter(q => !q.isMine).slice(0, 3));
  }, [gymId, userId, isTrainer]);
  useEffect(() => { load(); }, [load, version]);

  return (
    <View style={s.card}>
      <View style={s.head}>
        <Text style={s.headTitle}>헬스장 소식</Text>
        {!isTrainer && (
          <TouchableOpacity onPress={() => setComposing(true)} hitSlop={8}>
            <Text style={s.link}>질문하기</Text>
          </TouchableOpacity>
        )}
      </View>

      <Text style={s.label}>{isTrainer ? '답변을 기다리는 질문' : '내 질문'}</Text>
      {mine.length === 0
        ? <Text style={s.empty}>{isTrainer ? '답변을 기다리는 질문이 없어요.' : '아직 질문이 없어요.'}</Text>
        : mine.map(q => <QuestionRow key={q.id} q={q} onPress={() => setOpenId(q.id)} />)}

      {recent.length > 0 && (
        <>
          <Text style={[s.label, { marginTop: 12 }]}>{isTrainer ? '최근 답변 완료' : '최근 Q&A'}</Text>
          {recent.map(q => <QuestionRow key={q.id} q={q} onPress={() => setOpenId(q.id)} />)}
        </>
      )}

      <QuestionComposeModal
        visible={composing}
        gymId={gymId}
        userId={userId}
        onClose={() => setComposing(false)}
        onPosted={load}
      />
      {openId && <GymQuestionModal questionId={openId} onClose={() => { setOpenId(null); load(); }} onChanged={load} />}
    </View>
  );
}

const s = StyleSheet.create({
  card:       { backgroundColor: C.surface, borderRadius: R.card, borderWidth: 1, borderColor: C.border, padding: 14, gap: 6 },
  head:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  headTitle:  { color: C.text, fontSize: 15, fontWeight: '800' },
  link:       { color: C.accent, fontSize: 13, fontWeight: '700' },
  label:      { color: C.textDim, fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  empty:      { color: C.textSub, fontSize: 13, lineHeight: 19 },
  row:        { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  status:     { color: C.textSub, fontSize: 10, fontWeight: '800', paddingHorizontal: 7, paddingVertical: 3, borderRadius: R.pill, backgroundColor: C.surfaceHigh, overflow: 'hidden' },
  statusDone: { color: C.bg, backgroundColor: C.accent },
  title:      { color: C.text, fontSize: 14, fontWeight: '700' },
  meta:       { color: C.textSub, fontSize: 11, marginTop: 2 },
});
