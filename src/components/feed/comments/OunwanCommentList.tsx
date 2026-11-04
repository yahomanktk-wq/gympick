import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { C } from '../../../theme';
import { OunwanComment } from '../../../lib/db/ounwanComments';
import CommentItem from './CommentItem';

// 2026-11-04: 오운완 상세의 댓글 목록 (부모 ScrollView 안에 그리므로 FlatList 대신 map)

interface Props {
  comments:   OunwanComment[];
  loading:    boolean;
  myUserId?:  string;
  postOwnerId: string;
  onDelete:   (id: string) => Promise<void>;
  onBlocked:  (userId: string) => void;
}

export default function OunwanCommentList({
  comments, loading, myUserId, postOwnerId, onDelete, onBlocked,
}: Props) {
  const iOwnPost = !!myUserId && myUserId === postOwnerId;
  return (
    <View style={s.wrap}>
      <Text style={s.title}>
        댓글{comments.length > 0 ? ` ${comments.length}` : ''}
      </Text>
      {loading ? (
        <View style={{ paddingVertical: 16, alignItems: 'center' }}>
          <ActivityIndicator size="small" color={C.accent} />
        </View>
      ) : comments.length === 0 ? (
        <Text style={s.empty}>첫 댓글을 남겨보세요</Text>
      ) : (
        comments.map(c => (
          <CommentItem
            key={c.id}
            comment={c}
            canDelete={iOwnPost || (!!myUserId && myUserId === c.userId)}
            onDelete={onDelete}
            onBlocked={onBlocked}
          />
        ))
      )}
    </View>
  );
}

const s = StyleSheet.create({
  wrap:  { paddingHorizontal: 16, paddingTop: 20 },
  title: { fontSize: 15, fontWeight: '800', color: C.text, marginBottom: 4 },
  empty: { fontSize: 13, color: C.textSub, paddingVertical: 14 },
});
