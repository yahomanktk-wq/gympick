import React, { useCallback, useEffect, useState } from 'react';
import {
  Modal, View, Text, TouchableOpacity, ScrollView, StyleSheet, KeyboardAvoidingView, Platform,
  ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useKeyboardHeight } from '../../../lib/useKeyboardHeight';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { C, R } from '../../../theme';
import { useAuth } from '../../../context/AuthContext';
import { timeAgo } from '../../../lib/timeAgo';
import { containsBannedWord } from '../../../lib/bannedWords';
import {
  fetchGymQuestion, fetchGymAnswers, addGymAnswer, deleteGymAnswer, deleteGymQuestion, QNA_ANSWER_MAX,
  type GymQuestion, type GymAnswer,
} from '../../../lib/db/gymQna';
import { fetchFeedPostById } from '../../../lib/db/feedPosts';
import type { WorkoutFeedPost } from '../../../data/types';
import ContentMenuButton from '../../moderation/ContentMenuButton';
import CommentInput from '../../feed/comments/CommentInput';
import FeedDetailModal from '../../feed/FeedDetailModal';
import AnswerItem from './AnswerItem';
import QnaStatusPill from './QnaStatusPill';

// 2026-11-09: Q&A 질문 상세 (회원만). 본문 · 붙인 오운완 · 답변 목록 · 답변 입력
// 트레이너·관장님 답변은 맨 위. 삭제: 작성자 / 어드민 (관장님 삭제 불가)

interface Props {
  questionId: string | null;
  onClose:    () => void;
  /** 질문 삭제·답변 추가 등으로 목록이 바뀌었을 때 */
  onChanged?: () => void;
}

export default function GymQuestionModal({ questionId, onClose, onChanged }: Props) {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [question, setQuestion] = useState<GymQuestion | null>(null);
  const [answers,  setAnswers]  = useState<GymAnswer[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [missing,  setMissing]  = useState(false);
  const [post,     setPost]     = useState<WorkoutFeedPost | null>(null);
  const [postOpen, setPostOpen] = useState(false);
  // 키보드가 답변 입력칸을 가리지 않게
  const insets = useSafeAreaInsets();
  const kbHeight = useKeyboardHeight();
  const kbPad = kbHeight > 0 ? Math.max(0, kbHeight - insets.bottom) : 0;

  const loadAnswers = useCallback(async () => {
    if (questionId) setAnswers(await fetchGymAnswers(questionId));
  }, [questionId]);

  useEffect(() => {
    if (!questionId) return;
    let alive = true;
    setLoading(true); setMissing(false); setQuestion(null); setAnswers([]); setPost(null);
    (async () => {
      const q = await fetchGymQuestion(questionId);
      if (!alive) return;
      if (!q) { setMissing(true); setLoading(false); return; }
      setQuestion(q);
      const [a, p] = await Promise.all([
        fetchGymAnswers(questionId),
        q.attachedPostId ? fetchFeedPostById(q.attachedPostId) : Promise.resolve(null),
      ]);
      if (!alive) return;
      setAnswers(a); setPost(p); setLoading(false);
    })();
    return () => { alive = false; };
  }, [questionId]);

  if (!questionId) return null;

  async function submitAnswer(text: string): Promise<boolean> {
    if (await containsBannedWord(text)) { Alert.alert('사용할 수 없는 표현이 있어요'); return false; }
    try {
      await addGymAnswer(questionId!, text);
      await loadAnswers();
      onChanged?.();
      return true;
    } catch {
      Alert.alert('답변을 올리지 못했어요', '이 헬스장 회원만 답할 수 있어요.');
      return false;
    }
  }

  async function removeAnswer(id: string) {
    await deleteGymAnswer(id);
    setAnswers(prev => prev.filter(a => a.id !== id));
    onChanged?.();
  }

  async function removeQuestion() {
    await deleteGymQuestion(questionId!);
    onChanged?.();
    onClose();
  }

  function onBlocked(userId: string) {
    if (question && userId === question.userId) { onChanged?.(); onClose(); return; }
    setAnswers(prev => prev.filter(a => a.userId !== userId));
  }

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
        <View style={{ flex: 1, paddingBottom: kbPad }}>
          <View style={s.header}>
            <TouchableOpacity onPress={onClose} hitSlop={8}><Ionicons name="chevron-down" size={24} color={C.text} /></TouchableOpacity>
            <Text style={s.headerTitle}>Q&A</Text>
            {question ? (
              <ContentMenuButton
                targetType="qna_question"
                targetId={question.id}
                authorId={question.userId}
                authorNickname={question.nickname}
                canDelete={question.userId === user?.id || isAdmin}
                onDelete={removeQuestion}
                onBlocked={onBlocked}
              />
            ) : <View style={{ width: 24 }} />}
          </View>

          {loading ? (
            <ActivityIndicator color={C.accent} style={{ marginTop: 40 }} />
          ) : missing || !question ? (
            <Text style={s.missing}>볼 수 없는 질문이에요.{'\n'}삭제됐거나 이 헬스장 회원만 볼 수 있어요.</Text>
          ) : (
            <ScrollView contentContainerStyle={{ paddingBottom: 24 }} keyboardShouldPersistTaps="handled">
              <View style={s.qBox}>
                <QnaStatusPill done={question.staffAnswered} long />
                <Text style={s.title}>{question.title}</Text>
                <Text style={s.meta}>{question.nickname} · {timeAgo(question.createdAt)}</Text>
                <Text style={s.body}>{question.content}</Text>

                {question.attachedPostId && (
                  post ? (
                    <TouchableOpacity style={s.attach} onPress={() => setPostOpen(true)} activeOpacity={0.85}>
                      <Image source={{ uri: post.thumbnailUri ?? post.compositeUri ?? post.photoUri }} style={s.attachImg} contentFit="cover" />
                      <View style={{ flex: 1 }}>
                        <Text style={s.attachTitle}>첨부한 오운완</Text>
                        <Text style={s.attachSub} numberOfLines={1}>{post.gymName} · 운동 루틴 보기</Text>
                      </View>
                      <Ionicons name="chevron-forward" size={16} color={C.textDim} />
                    </TouchableOpacity>
                  ) : (
                    <Text style={s.attachGone}>첨부한 오운완을 볼 수 없어요 (삭제·나만 보기)</Text>
                  )
                )}
              </View>

              <Text style={s.answersTitle}>답변 {answers.length > 0 ? answers.length : ''}</Text>
              {answers.length === 0 ? (
                <Text style={s.empty}>아직 답변이 없어요. 트레이너에게 알림이 갔어요.</Text>
              ) : answers.map(a => (
                <AnswerItem
                  key={a.id}
                  answer={a}
                  gymId={question.gymId}
                  canDelete={a.userId === user?.id || isAdmin}
                  onDelete={removeAnswer}
                  onBlocked={onBlocked}
                />
              ))}
            </ScrollView>
          )}

          {question && (
            <View style={s.inputBar}>
              <CommentInput placeholder="답변을 남겨보세요" maxLength={QNA_ANSWER_MAX} onSubmit={submitAnswer} />
            </View>
          )}
        </View>
      </SafeAreaView>

      {postOpen && post && (
        <FeedDetailModal
          post={post}
          onClose={() => setPostOpen(false)}
          onPressGym={() => setPostOpen(false)}
          onPressMachine={() => setPostOpen(false)}
        />
      )}
    </Modal>
  );
}

const s = StyleSheet.create({
  safe:         { flex: 1, backgroundColor: C.bg },
  header:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.border },
  headerTitle:  { color: C.text, fontSize: 16, fontWeight: '800' },
  missing:      { color: C.textSub, fontSize: 14, lineHeight: 21, textAlign: 'center', marginTop: 60 },
  qBox:         { padding: 16, gap: 8, borderBottomWidth: 1, borderBottomColor: C.border },
  statusRow:    { flexDirection: 'row' },
  status:       { color: C.textSub, fontSize: 11, fontWeight: '800', paddingHorizontal: 8, paddingVertical: 3, borderRadius: R.pill, backgroundColor: C.surfaceHigh, overflow: 'hidden' },
  statusDone:   { color: C.bg, backgroundColor: C.accent },
  title:        { color: C.text, fontSize: 19, fontWeight: '800', lineHeight: 26 },
  meta:         { color: C.textSub, fontSize: 12 },
  body:         { color: C.text, fontSize: 15, lineHeight: 23, marginTop: 4 },
  attach:       { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.surface, borderRadius: R.inner, borderWidth: 1, borderColor: C.border, padding: 10, marginTop: 8 },
  attachImg:    { width: 48, height: 64, borderRadius: 8 },
  attachTitle:  { color: C.text, fontSize: 14, fontWeight: '700' },
  attachSub:    { color: C.textSub, fontSize: 12, marginTop: 2 },
  attachGone:   { color: C.textSub, fontSize: 12, marginTop: 8 },
  answersTitle: { color: C.text, fontSize: 15, fontWeight: '800', paddingHorizontal: 16, paddingTop: 18, paddingBottom: 6 },
  empty:        { color: C.textSub, fontSize: 13, paddingHorizontal: 16, paddingVertical: 10 },
  inputBar:     { paddingHorizontal: 12, paddingTop: 8, paddingBottom: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.border, backgroundColor: C.bg },
});
