// 2026-11-28: 헬스장 선택 화면 — 위치 권한이 없을 때 ? 아이콘으로 안내 문구 표시
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { C, R } from '../../theme';

export default function LocationPermissionInfo() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <TouchableOpacity
        onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setOpen(true); }}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        activeOpacity={0.7}
        accessibilityLabel="위치 권한 안내"
      >
        <Ionicons name="help-circle-outline" size={18} color={C.textSub} />
      </TouchableOpacity>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={s.backdrop} onPress={() => setOpen(false)}>
          <View style={s.box}>
            <Ionicons name="location-outline" size={16} color={C.textSub} />
            <Text style={s.text}>위치 권한이 없어 거리 정보를 표시할 수 없어요</Text>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: '#00000080', alignItems: 'center', justifyContent: 'center', padding: 32 },
  box:      { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.surface, borderRadius: R.inner, borderWidth: 1, borderColor: C.border, paddingHorizontal: 16, paddingVertical: 14 },
  text:     { fontSize: 13, color: C.text, flexShrink: 1 },
});
