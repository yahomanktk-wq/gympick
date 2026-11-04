import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { C, R } from '../../../theme';
import { GymReview } from '../../../lib/db/gymReviews';
import { timeAgo } from '../../../lib/timeAgo';
import ContentMenuButton from '../../moderation/ContentMenuButton';

// 2026-11-04: 헬스장 후기 한 개 + 관장님 답글.
// - '…' 메뉴: 남의 후기 신고·차단 / 내 후기 삭제 (관장님은 삭제 불가)
// - 관장님(이 헬스장 매니저)에게만 '답글 달기 / 답글 수정' 버튼

interface Props {
  review:      GymReview;
  myUserId?:   string;
  isAdmin:     boolean;
  isManager:   boolean;
  /** 미리보기(정보 탭)에서는 줄 수를 제한하고 메뉴·답글 버튼을 숨긴다 */
  compact?:    boolean;
  onDelete?:   (id: string) => Promise<void>;
  onBlocked?:  (userId: string) => void;
  onReply?:    (review: GymReview) => void;
  onDeleteReply?: (review: GymReview) => void;
}

export default function GymReviewItem({
  review, myUserId, isAdmin, isManager, compact, onDelete, onBlocked, onReply, onDeleteReply,
}: Props) {
  const isMine = !!myUserId && myUserId === review.userId;
  return (
    <View style={s.wrap}>
      <View style={s.head}>
        <Text style={s.nick} numberOfLines={1}>{review.nickname}</Text>
        <Text style={s.time}>{timeAgo(review.createdAt)}</Text>
        <View style={{ flex: 1 }} />
        {!compact && (
          <ContentMenuButton
            targetType="gym_review"
            targetId={review.id}
            authorId={review.userId}
            authorNickname={review.nickname}
            canDelete={isMine || isAdmin}
            onDelete={() => onDelete?.(review.id)}
            onBlocked={onBlocked}
            size={16}
          />
        )}
      </View>
      <Text style={s.body} numberOfLines={compact ? 3 : undefined}>{review.content}</Text>

      {review.replyContent ? (
        <View style={s.reply}>
          <View style={s.replyHead}>
            <Ionicons name="return-down-forward" size={13} color={C.accent} />
            <Text style={s.replyLabel}>관장님 답글</Text>
            {review.replyAt ? <Text style={s.time}>{timeAgo(review.replyAt)}</Text> : null}
          </View>
          <Text style={s.replyBody} numberOfLines={compact ? 2 : undefined}>{review.replyContent}</Text>
        </View>
      ) : null}

      {!compact && isManager && onReply && (
        <View style={{ flexDirection: 'row', gap: 16 }}>
          <TouchableOpacity style={s.replyBtn} activeOpacity={0.75} onPress={() => onReply(review)}>
            <Ionicons name="chatbubble-outline" size={13} color={C.accent} />
            <Text style={s.replyBtnText}>{review.replyContent ? '답글 수정' : '답글 달기'}</Text>
          </TouchableOpacity>
          {review.replyContent && onDeleteReply ? (
            <TouchableOpacity style={s.replyBtn} activeOpacity={0.75} onPress={() => onDeleteReply(review)}>
              <Text style={[s.replyBtnText, { color: C.textSub }]}>답글 삭제</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  wrap:         { paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border, gap: 6 },
  head:         { flexDirection: 'row', alignItems: 'center', gap: 6 },
  nick:         { fontSize: 13, fontWeight: '800', color: C.text, flexShrink: 1 },
  time:         { fontSize: 11, color: C.textSub },
  body:         { fontSize: 14, lineHeight: 21, color: C.text },
  reply:        { marginTop: 4, padding: 10, borderRadius: R.inner, backgroundColor: C.surfaceHigh, gap: 4 },
  replyHead:    { flexDirection: 'row', alignItems: 'center', gap: 5 },
  replyLabel:   { fontSize: 12, fontWeight: '800', color: C.accent },
  replyBody:    { fontSize: 13, lineHeight: 19, color: C.text },
  replyBtn:     { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', paddingVertical: 4 },
  replyBtnText: { fontSize: 12, fontWeight: '700', color: C.accent },
});
