import React, { useEffect, useState } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, Pressable, ActivityIndicator, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { C, R } from '../../../theme';
import { setFeedPostVisibility } from '../../../lib/db/feedPosts';
import type { FeedVisibility } from '../../../lib/feedVisibility';
import VisibilityOptionList from './VisibilityOptionList';
import { useIsGymMember } from './useIsGymMember';

// 2026-11-09: 이미 올린 오운완의 공개 범위 바꾸기 (운동일지 · 오운완 상세 공용)

interface Props {
  visible:   boolean;
  postId:    string;
  gymId:     string;
  userId:    string | null | undefined;
  value:     FeedVisibility;
  onClose:   () => void;
  onChanged: (v: FeedVisibility) => void;
}

export default function VisibilitySheet({ visible, postId, gymId, userId, value, onClose, onChanged }: Props) {
  const insets = useSafeAreaInsets();
  const canUseGym = useIsGymMember(visible ? gymId : null, userId);
  const [picked, setPicked] = useState<FeedVisibility>(value);
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (visible) { setPicked(value); setSaving(false); } }, [visible, value]);

  async function save() {
    if (picked === value) { onClose(); return; }
    setSaving(true);
    try {
      await setFeedPostVisibility(postId, picked);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onChanged(picked);
      onClose();
    } catch {
      Alert.alert('공개 범위를 바꾸지 못했어요', '잠시 후 다시 시도해 주세요.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={s.backdrop} onPress={onClose}>
        <Pressable style={[s.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]} onPress={() => {}}>
          <Text style={s.title}>공개 범위</Text>
          <VisibilityOptionList value={picked} canUseGym={canUseGym} onChange={setPicked} />
          <TouchableOpacity style={[s.saveBtn, saving && { opacity: 0.6 }]} onPress={save} disabled={saving} activeOpacity={0.85}>
            {saving ? <ActivityIndicator color={C.bg} /> : <Text style={s.saveText}>저장</Text>}
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  sheet:    { backgroundColor: C.bg, borderTopLeftRadius: R.card, borderTopRightRadius: R.card, padding: 16, gap: 12, borderWidth: 1, borderColor: C.border },
  title:    { color: C.text, fontSize: 16, fontWeight: '800', marginBottom: 2 },
  saveBtn:  { backgroundColor: C.accent, borderRadius: R.pill, paddingVertical: 14, alignItems: 'center', marginTop: 4 },
  saveText: { color: C.bg, fontWeight: '800', fontSize: 15 },
});
