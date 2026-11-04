import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { C, R } from '../../../theme';
import { useAuth } from '../../../context/AuthContext';
import {
  fetchGymReviews, canWriteGymReview, addGymReview, deleteGymReview, replyGymReview,
  GymReview, REVIEW_MAX_LENGTH,
} from '../../../lib/db/gymReviews';
import { containsBannedWord } from '../../../lib/bannedWords';
import GymReviewItem from './GymReviewItem';
import TextComposeModal from './TextComposeModal';

// 2026-11-04: 헬스장 상세 > 커뮤니티 탭의 후기 게시판.
// - 이 헬스장에서 운동 기록 1회 이상이면 '후기 쓰기' (운동 횟수는 표시하지 않음)
// - 자유 텍스트 500자, 수정 없이 삭제만
// - 관장님(이 헬스장 매니저)은 답글만 (삭제 불가)
// 부모가 ScrollView라 FlatList 대신 map으로 그린다.

interface Props {
  gymId:      string;
  /** 정보 탭 미리보기와 맞추기 위한 갱신 번호 */
  version?:   number;
  onChanged?: () => void;
}

const PAGE = 20;

export default function GymReviewBoard({ gymId, version = 0, onChanged }: Props) {
  const { user } = useAuth();
  const isAdmin   = user?.role === 'admin';
  const isManager = !!user && (user.managedGymIds ?? []).includes(gymId);

  const [reviews,    setReviews]    = useState<GymReview[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [canWrite,   setCanWrite]   = useState(false);
  const [shown,      setShown]      = useState(PAGE);
  const [composing,  setComposing]  = useState(false);
  const [replyingTo, setReplyingTo] = useState<GymReview | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [list, eligible] = await Promise.all([
        fetchGymReviews(gymId),
        canWriteGymReview(gymId, user?.id),
      ]);
      setReviews(list);
      setCanWrite(eligible);
    } finally {
      setLoading(false);
    }
  }, [gymId, user?.id]);

  useEffect(() => { load(); }, [load, version]);

  async function submitReview(text: string): Promise<boolean> {
    if (await containsBannedWord(text)) {
      Alert.alert('사용할 수 없는 표현이 있어요', '후기 내용을 다시 확인해주세요.');
      return false;
    }
    try {
      const created = await addGymReview(gymId, text);
      setReviews(prev => [created, ...prev]);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onChanged?.();
      return true;
    } catch {
      Alert.alert('후기를 남기지 못했어요', '이 헬스장에서 운동을 기록한 뒤 남길 수 있어요.');
      return false;
    }
  }

  async function submitReply(text: string): Promise<boolean> {
    if (!replyingTo) return false;
    if (await containsBannedWord(text)) {
      Alert.alert('사용할 수 없는 표현이 있어요', '답글 내용을 다시 확인해주세요.');
      return false;
    }
    try {
      await replyGymReview(replyingTo.id, text);
      const now = new Date().toISOString();
      setReviews(prev => prev.map(r => r.id === replyingTo.id ? { ...r, replyContent: text.trim(), replyAt: now } : r));
      onChanged?.();
      return true;
    } catch {
      Alert.alert('오류', '답글을 남기지 못했어요.');
      return false;
    }
  }

  function confirmDeleteReply(review: GymReview) {
    Alert.alert('답글을 삭제할까요?', undefined, [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제', style: 'destructive',
        onPress: async () => {
          try {
            await replyGymReview(review.id, '');
            setReviews(prev => prev.map(r => r.id === review.id ? { ...r, replyContent: null, replyAt: null } : r));
            onChanged?.();
          } catch {
            Alert.alert('오류', '답글을 삭제하지 못했어요.');
          }
        },
      },
    ]);
  }

  async function handleDelete(id: string) {
    await deleteGymReview(id);
    setReviews(prev => prev.filter(r => r.id !== id));
    onChanged?.();
  }

  function handleBlocked(userId: string) {
    setReviews(prev => prev.filter(r => r.userId !== userId));
    onChanged?.();
  }

  return (
    <View style={s.wrap}>
      <View style={s.titleRow}>
        <Text style={s.title}>후기{reviews.length > 0 ? ` ${reviews.length}` : ''}</Text>
        {canWrite && (
          <TouchableOpacity style={s.writeBtn} activeOpacity={0.8} onPress={() => setComposing(true)}>
            <Ionicons name="create-outline" size={14} color={C.bg} />
            <Text style={s.writeText}>후기 쓰기</Text>
          </TouchableOpacity>
        )}
      </View>

      {!loading && !canWrite && (
        <Text style={s.notice}>
          {user?.id
            ? '이 헬스장에서 운동을 기록하면 후기를 쓸 수 있어요'
            : '로그인하고 이 헬스장에서 운동을 기록하면 후기를 쓸 수 있어요'}
        </Text>
      )}

      {loading ? (
        <View style={{ paddingVertical: 20, alignItems: 'center' }}>
          <ActivityIndicator size="small" color={C.accent} />
        </View>
      ) : reviews.length === 0 ? (
        <Text style={s.empty}>아직 후기가 없어요</Text>
      ) : (
        <>
          {reviews.slice(0, shown).map(r => (
            <GymReviewItem
              key={r.id}
              review={r}
              myUserId={user?.id}
              isAdmin={isAdmin}
              isManager={isManager}
              onDelete={handleDelete}
              onBlocked={handleBlocked}
              onReply={setReplyingTo}
              onDeleteReply={confirmDeleteReply}
            />
          ))}
          {reviews.length > shown && (
            <TouchableOpacity style={s.more} activeOpacity={0.75} onPress={() => setShown(n => n + PAGE)}>
              <Text style={s.moreText}>후기 더 보기</Text>
            </TouchableOpacity>
          )}
        </>
      )}

      <TextComposeModal
        visible={composing}
        title="후기 쓰기"
        placeholder="이 헬스장은 어땠나요? 머신 상태, 분위기 등을 자유롭게 남겨주세요"
        guide="욕설·비방, 광고, 개인정보가 담긴 후기는 신고되면 삭제될 수 있어요."
        maxLength={REVIEW_MAX_LENGTH}
        onClose={() => setComposing(false)}
        onSubmit={submitReview}
      />
      <TextComposeModal
        visible={!!replyingTo}
        title={replyingTo?.replyContent ? '답글 수정' : '답글 달기'}
        placeholder="회원님의 후기에 답글을 남겨주세요"
        maxLength={REVIEW_MAX_LENGTH}
        initialText={replyingTo?.replyContent ?? ''}
        onClose={() => setReplyingTo(null)}
        onSubmit={submitReply}
      />
    </View>
  );
}

const s = StyleSheet.create({
  wrap:      { marginBottom: 24 },
  titleRow:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  title:     { fontSize: 18, fontWeight: '700', letterSpacing: -0.3, color: C.text },
  writeBtn:  {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: R.pill, backgroundColor: C.accent,
  },
  writeText: { fontSize: 13, fontWeight: '800', color: C.bg },
  notice:    { fontSize: 12, color: C.textSub, marginTop: 6, marginBottom: 4 },
  empty:     { fontSize: 13, color: C.textSub, paddingVertical: 14 },
  more:      { paddingVertical: 14, alignItems: 'center' },
  moreText:  { fontSize: 13, fontWeight: '700', color: C.textSub },
});
