import React, { useState } from 'react';
import { Modal, View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { C } from '../../theme';
import type { WorkoutFeedPost } from '../../data/types';
import FeedDetailModal from '../feed/FeedDetailModal';
import { UserJournalContext } from './UserJournalContext';
import { useUserJournal } from './useUserJournal';
import JournalProfileHeader from './JournalProfileHeader';
import JournalNotice from './JournalNotice';
import UserWeeklyGrid from './UserWeeklyGrid';

// 2026-11-16: 다른 사람(또는 나)의 운동일지 — 인스타그램 프로필처럼 닉네임을 누르면 열린다.
// 모달 위에서 열리는 경우가 많아(iOS) 이 모달을 띄운 컴포넌트 안에서 바로 렌더링한다.

interface Props {
  userId:  string;
  onClose: () => void;
}

export default function UserJournalModal({ userId, onClose }: Props) {
  const { header, posts, loading, missing, reload, setPosts } = useUserJournal(userId);
  const [openPost, setOpenPost] = useState<WorkoutFeedPost | null>(null);

  const note = header?.isMe
    ? '다른 사람에게는 공개 범위에 맞는 오운완만 보여요. 비공개는 프로필 > 운동일지에서 바꿀 수 있어요.'
    : undefined;

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <UserJournalContext.Provider value={userId}>
        <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
          <View style={s.topBar}>
            <TouchableOpacity onPress={onClose} hitSlop={8}>
              <Ionicons name="chevron-down" size={24} color={C.text} />
            </TouchableOpacity>
            <Text style={s.title}>운동일지</Text>
            <View style={{ width: 24 }} />
          </View>

          {loading ? (
            <ActivityIndicator color={C.accent} style={{ marginTop: 48 }} />
          ) : missing || !header ? (
            <JournalNotice kind="missing" />
          ) : (
            <ScrollView showsVerticalScrollIndicator={false}>
              <JournalProfileHeader nickname={header.nickname} avatarUrl={header.avatarUrl} note={note} />
              {header.isBlocked ? (
                <JournalNotice kind="blocked" />
              ) : header.isPrivate ? (
                <JournalNotice kind="private" />
              ) : posts.length === 0 ? (
                <JournalNotice kind="empty" />
              ) : (
                <UserWeeklyGrid posts={posts} onOpenPost={setOpenPost} />
              )}
            </ScrollView>
          )}
        </SafeAreaView>

        {openPost && (
          <FeedDetailModal
            post={openPost}
            onClose={() => setOpenPost(null)}
            onPressGym={() => setOpenPost(null)}
            onPressMachine={() => setOpenPost(null)}
            onVisibilityChanged={header?.isMe ? (postId, visibility) => {
              setPosts(prev => prev.map(p => (p.id === postId ? { ...p, visibility } : p)));
            } : undefined}
            onAuthorBlocked={() => { setOpenPost(null); reload(); }}
          />
        )}
      </UserJournalContext.Provider>
    </Modal>
  );
}

const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: C.bg },
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border,
  },
  title:  { fontSize: 16, fontWeight: '800', color: C.text },
});
