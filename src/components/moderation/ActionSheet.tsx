import React from 'react';
import { Modal, View, Text, TouchableOpacity, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C, R } from '../../theme';

// 2026-11-04: 아래에서 올라오는 선택 메뉴 (신고 / 차단 / 삭제 등).
// Android의 Alert는 버튼을 3개까지만 보여줘서, 선택지가 많을 때는 이 시트를 쓴다.

export interface ActionSheetOption {
  label:        string;
  destructive?: boolean;
  onPress:      () => void;
}

interface Props {
  visible:  boolean;
  title?:   string;
  options:  ActionSheetOption[];
  onClose:  () => void;
}

export default function ActionSheet({ visible, title, options, onClose }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={s.backdrop} onPress={onClose}>
        <Pressable style={[s.sheet, { paddingBottom: Math.max(insets.bottom, 12) }]} onPress={() => {}}>
          {title ? <Text style={s.title} numberOfLines={1}>{title}</Text> : null}
          {options.map((opt, i) => (
            <TouchableOpacity
              key={`${opt.label}-${i}`}
              style={s.row}
              activeOpacity={0.7}
              onPress={() => { onClose(); opt.onPress(); }}
            >
              <Text style={[s.rowText, opt.destructive && { color: C.danger }]}>{opt.label}</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity style={[s.row, s.cancelRow]} activeOpacity={0.7} onPress={onClose}>
            <Text style={[s.rowText, { color: C.textSub }]}>취소</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop:  { flex: 1, backgroundColor: '#00000099', justifyContent: 'flex-end' },
  sheet:     {
    backgroundColor: C.surface,
    borderTopLeftRadius: R.card, borderTopRightRadius: R.card,
    paddingTop: 8, paddingHorizontal: 16,
  },
  title:     { fontSize: 13, fontWeight: '700', color: C.textSub, textAlign: 'center', paddingVertical: 10 },
  row:       { paddingVertical: 15, alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border },
  cancelRow: { borderBottomWidth: 0, marginTop: 4 },
  rowText:   { fontSize: 16, fontWeight: '600', color: C.text },
});
