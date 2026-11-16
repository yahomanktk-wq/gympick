import React, { useContext, useState } from 'react';
import { Text, TouchableOpacity, type StyleProp, type TextStyle } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useAuth } from '../../context/AuthContext';
import { track } from '../../lib/analytics';
import { UserJournalContext } from './UserJournalContext';

// 2026-11-16: 닉네임을 누르면 그 사람의 운동일지가 열린다 (오운완 상세·댓글·Q&A·후기 공용).
// - 로그인하지 않았거나, 이미 그 사람 운동일지 안이면 그냥 글자로 보인다.

interface Props {
  userId?:        string | null;
  nickname:       string;
  style?:         StyleProp<TextStyle>;
  numberOfLines?: number;
}

export default function UserNameLink({ userId, nickname, style, numberOfLines = 1 }: Props) {
  const { user } = useAuth();
  const viewingUserId = useContext(UserJournalContext);
  const [open, setOpen] = useState(false);

  const linkable = !!user?.id && !!userId && viewingUserId !== userId;
  if (!linkable) {
    return <Text style={style} numberOfLines={numberOfLines}>{nickname}</Text>;
  }

  return (
    <>
      <TouchableOpacity
        activeOpacity={0.6}
        hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
        style={{ flexShrink: 1 }}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          track('view_user_journal', { is_me: userId === user?.id });
          setOpen(true);
        }}
      >
        <Text style={style} numberOfLines={numberOfLines}>{nickname}</Text>
      </TouchableOpacity>
      {open && (() => {
        // FeedDetailModal → UserNameLink → UserJournalModal → FeedDetailModal 순환 import를 피하려고
        // 운동일지 모달은 열 때 불러온다 (그때는 모든 모듈이 이미 준비돼 있음)
        const UserJournalModal = require('./UserJournalModal').default as typeof import('./UserJournalModal').default;
        return <UserJournalModal userId={userId as string} onClose={() => setOpen(false)} />;
      })()}
    </>
  );
}
