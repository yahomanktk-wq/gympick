import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { C } from '../../../theme';
import { OunwanComment } from '../../../lib/db/ounwanComments';
import { timeAgo } from '../../../lib/timeAgo';
import ContentMenuButton from '../../moderation/ContentMenuButton';

// 2026-11-04: 오운완 댓글 한 줄. '…' 메뉴로 신고 · 차단 · 삭제

interface Props {
  comment:    OunwanComment;
  /** 댓글 작성자 본인이거나 오운완 주인이면 삭제 가능 */
  canDelete:  boolean;
  onDelete:   (id: string) => Promise<void>;
  onBlocked:  (userId: string) => void;
}

export default function CommentItem({ comment, canDelete, onDelete, onBlocked }: Props) {
  return (
    <View style={s.row}>
      <View style={{ flex: 1 }}>
        <View style={s.head}>
          <Text style={s.nick} numberOfLines={1}>{comment.nickname}</Text>
          <Text style={s.time}>{timeAgo(comment.createdAt)}</Text>
        </View>
        <Text style={s.body}>{comment.content}</Text>
      </View>
      <ContentMenuButton
        targetType="comment"
        targetId={comment.id}
        authorId={comment.userId}
        authorNickname={comment.nickname}
        canDelete={canDelete}
        onDelete={() => onDelete(comment.id)}
        onBlocked={onBlocked}
        size={16}
      />
    </View>
  );
}

const s = StyleSheet.create({
  row:  {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 3 },
  nick: { fontSize: 13, fontWeight: '800', color: C.text, flexShrink: 1 },
  time: { fontSize: 11, color: C.textSub },
  body: { fontSize: 14, lineHeight: 20, color: C.text },
});
