import React, { useState, useEffect, useCallback } from 'react';
import {
  Modal, View, Text, FlatList, TouchableOpacity, SafeAreaView, StyleSheet, ActivityIndicator, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { C, R } from '../../theme';
import { fetchBlockedUsers, unblockUser, BlockedUser } from '../../lib/db/moderation';
import { invalidateActiveFeedPostsCache } from '../../data/feedPostsCache';

// 2026-11-04: 프로필 > 설정 > 차단한 사용자 (목록 확인 · 차단 해제)

interface Props {
  visible: boolean;
  onClose: () => void;
}

function BlockedRow({ item, onUnblock }: { item: BlockedUser; onUnblock: (u: BlockedUser) => void }) {
  return (
    <View style={s.row}>
      <View style={s.avatar}>
        <Ionicons name="person" size={16} color={C.textSub} />
      </View>
      <Text style={s.nick} numberOfLines={1}>{item.nickname}</Text>
      <TouchableOpacity style={s.unblockBtn} activeOpacity={0.8} onPress={() => onUnblock(item)}>
        <Text style={s.unblockText}>차단 해제</Text>
      </TouchableOpacity>
    </View>
  );
}

export default function BlockedUsersModal({ visible, onClose }: Props) {
  const [list,    setList]    = useState<BlockedUser[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try { setList(await fetchBlockedUsers()); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { if (visible) load(); }, [visible, load]);

  function confirmUnblock(u: BlockedUser) {
    Alert.alert(`${u.nickname}님의 차단을 해제할까요?`, '이 사람의 오운완·댓글·후기가 다시 보여요.', [
      { text: '취소', style: 'cancel' },
      {
        text: '해제',
        onPress: async () => {
          try {
            await unblockUser(u.blockedId);
            invalidateActiveFeedPostsCache();
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setList(prev => prev.filter(x => x.blockedId !== u.blockedId));
          } catch {
            Alert.alert('오류', '차단을 해제하지 못했어요.');
          }
        },
      },
    ]);
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
        <View style={s.header}>
          <View style={{ width: 40 }} />
          <Text style={s.title}>차단한 사용자</Text>
          <TouchableOpacity onPress={onClose} style={{ width: 40, alignItems: 'flex-end' }}>
            <Ionicons name="close" size={22} color={C.textSub} />
          </TouchableOpacity>
        </View>
        {loading ? (
          <View style={s.center}><ActivityIndicator color={C.accent} /></View>
        ) : list.length === 0 ? (
          <View style={s.center}>
            <Ionicons name="shield-checkmark-outline" size={40} color={C.textDim} />
            <Text style={s.empty}>차단한 사용자가 없어요</Text>
          </View>
        ) : (
          <FlatList
            data={list}
            keyExtractor={u => u.blockedId}
            renderItem={({ item }) => <BlockedRow item={item} onUnblock={confirmUnblock} />}
            contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 8 }}
          />
        )}
      </SafeAreaView>
    </Modal>
  );
}

const s = StyleSheet.create({
  header:      {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border,
  },
  title:       { fontSize: 16, fontWeight: '800', color: C.text },
  center:      { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  empty:       { fontSize: 14, color: C.textSub, fontWeight: '600' },
  row:         {
    flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border,
  },
  avatar:      { width: 36, height: 36, borderRadius: 18, backgroundColor: C.surfaceHigh, alignItems: 'center', justifyContent: 'center' },
  nick:        { flex: 1, fontSize: 15, fontWeight: '700', color: C.text },
  unblockBtn:  { paddingHorizontal: 12, paddingVertical: 7, borderRadius: R.pill, borderWidth: 1, borderColor: C.border },
  unblockText: { fontSize: 13, fontWeight: '700', color: C.text },
});
