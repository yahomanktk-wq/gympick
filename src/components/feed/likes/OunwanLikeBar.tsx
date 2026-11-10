import React, { useState } from 'react';
import { Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { C, R } from '../../../theme';
import { useOunwanLike, isLikeablePostId } from './useOunwanLike';
import LikersModal from './LikersModal';

// 2026-11-09: 오운완 상세의 하트 버튼 (이모지 리액션 5종 대체)
// 처음엔 한 줄을 통째로 쓰는 하트 바였는데, 자리를 줄이려고 댓글 입력칸 왼쪽의 작은 버튼으로 바꿈.
// - 다른 사람 글: 하트 누르기/취소
// - 내 글: 하트 수만 보여주고, 탭하면 누가 눌렀는지 목록 (따로 '누가 눌렀나요' 글자는 두지 않음)

interface Props {
  postId:     string;
  likeCount:  number;
  isMine:     boolean;
  userId:     string | null | undefined;
  /** 나만 보기 글이면 하트를 누를 수 없음 */
  disabled?:  boolean;
}

export default function OunwanLikeButton({ postId, likeCount, isMine, userId, disabled }: Props) {
  const { liked, count, toggle } = useOunwanLike(postId, likeCount, userId);
  const [showLikers, setShowLikers] = useState(false);

  if (!isLikeablePostId(postId)) return null;

  async function onPress() {
    if (isMine) {
      if (count > 0) setShowLikers(true);
      return;
    }
    if (!userId) { Alert.alert('로그인하면 하트를 누를 수 있어요'); return; }
    if (disabled) return;
    Haptics.impactAsync(liked ? Haptics.ImpactFeedbackStyle.Light : Haptics.ImpactFeedbackStyle.Medium);
    const ok = await toggle();
    if (!ok) Alert.alert('하트를 누르지 못했어요', '잠시 후 다시 시도해 주세요.');
  }

  const filled = isMine ? count > 0 : liked;

  return (
    <>
      <TouchableOpacity
        style={[s.btn, filled && !isMine && s.btnActive]}
        onPress={onPress}
        activeOpacity={0.7}
        disabled={!isMine && disabled}
        hitSlop={6}
      >
        <Ionicons name={filled ? 'heart' : 'heart-outline'} size={22} color={filled ? C.danger : C.textSub} />
        <Text style={[s.count, filled && { color: C.text }]}>{count}</Text>
      </TouchableOpacity>
      {isMine && <LikersModal visible={showLikers} postId={postId} onClose={() => setShowLikers(false)} />}
    </>
  );
}

const s = StyleSheet.create({
  btn:       { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, height: 44, borderRadius: R.pill, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border },
  btnActive: { borderColor: C.danger + '60' },
  count:     { color: C.textSub, fontSize: 14, fontWeight: '800', minWidth: 10 },
});
