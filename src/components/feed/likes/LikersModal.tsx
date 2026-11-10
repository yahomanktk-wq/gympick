import React, { useEffect, useState } from 'react';
import { Modal, View, Text, TouchableOpacity, FlatList, StyleSheet, ActivityIndicator, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { C, R } from '../../../theme';
import { timeAgo } from '../../../lib/timeAgo';
import { fetchOunwanLikers, type OunwanLiker } from '../../../lib/db/ounwanLikes';

// 2026-11-09: 내 오운완에 하트를 누른 사람 목록 (오운완 주인만)

export default function LikersModal({ visible, postId, onClose }: { visible: boolean; postId: string; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const [items,   setItems]   = useState<OunwanLiker[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!visible) return;
    setLoading(true);
    fetchOunwanLikers(postId).then(r => { setItems(r); setLoading(false); });
  }, [visible, postId]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={s.backdrop} onPress={onClose}>
        <Pressable style={[s.sheet, { paddingBottom: Math.max(insets.bottom, 12) }]} onPress={() => {}}>
          <View style={s.header}>
            <Text style={s.title}>하트 {items.length > 0 ? items.length : ''}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={8}><Ionicons name="close" size={20} color={C.textSub} /></TouchableOpacity>
          </View>
          {loading ? (
            <ActivityIndicator color={C.accent} style={{ paddingVertical: 24 }} />
          ) : (
            <FlatList
              data={items}
              keyExtractor={i => i.userId}
              style={{ maxHeight: 420 }}
              ListEmptyComponent={<Text style={s.empty}>아직 하트가 없어요</Text>}
              renderItem={({ item }) => (
                <View style={s.row}>
                  <Ionicons name="heart" size={14} color={C.danger} />
                  <Text style={s.nick} numberOfLines={1}>{item.nickname}</Text>
                  <Text style={s.time}>{timeAgo(item.createdAt)}</Text>
                </View>
              )}
            />
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  sheet:    { backgroundColor: C.surface, borderTopLeftRadius: R.card, borderTopRightRadius: R.card, paddingHorizontal: 16, paddingTop: 14 },
  header:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 8 },
  title:    { color: C.text, fontSize: 16, fontWeight: '800' },
  row:      { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border },
  nick:     { flex: 1, color: C.text, fontSize: 14, fontWeight: '700' },
  time:     { color: C.textSub, fontSize: 12 },
  empty:    { color: C.textSub, fontSize: 13, paddingVertical: 20, textAlign: 'center' },
});
