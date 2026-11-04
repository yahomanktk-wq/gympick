import React, { useState, useEffect } from 'react';
import {
  Modal, View, Text, TextInput, TouchableOpacity, SafeAreaView, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { C, R } from '../../../theme';

// 2026-11-04: 후기 작성 / 관장님 답글 작성용 전체 화면 입력 모달.
// 커뮤니티 탭이 스크롤 안에 있어 키보드에 가려지지 않도록 별도 모달로 띄운다.
// 한글 입력 버그 방지를 위해 모듈 레벨 컴포넌트, 입력 값은 이 안에서만 관리.

interface Props {
  visible:      boolean;
  title:        string;
  placeholder:  string;
  maxLength:    number;
  initialText?: string;
  submitLabel?: string;
  guide?:       string;
  onClose:      () => void;
  /** true를 돌려주면 모달을 닫는다 */
  onSubmit:     (text: string) => Promise<boolean>;
}

export default function TextComposeModal({
  visible, title, placeholder, maxLength, initialText = '', submitLabel = '등록', guide, onClose, onSubmit,
}: Props) {
  const [text,    setText]    = useState(initialText);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (visible) { setText(initialText); setSending(false); }
  }, [visible, initialText]);

  const canSend = text.trim().length > 0 && !sending;

  async function send() {
    if (!canSend) return;
    setSending(true);
    try {
      const ok = await onSubmit(text);
      if (ok) onClose();
    } finally {
      setSending(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={s.header}>
            <TouchableOpacity onPress={onClose} style={s.headerBtn} activeOpacity={0.7}>
              <Text style={s.cancel}>취소</Text>
            </TouchableOpacity>
            <Text style={s.title}>{title}</Text>
            <TouchableOpacity onPress={send} disabled={!canSend} style={s.headerBtn} activeOpacity={0.7}>
              {sending
                ? <ActivityIndicator size="small" color={C.accent} />
                : <Text style={[s.submit, !canSend && { opacity: 0.35 }]}>{submitLabel}</Text>}
            </TouchableOpacity>
          </View>
          {guide ? <Text style={s.guide}>{guide}</Text> : null}
          <TextInput
            style={s.input}
            value={text}
            onChangeText={t => setText(t.slice(0, maxLength))}
            placeholder={placeholder}
            placeholderTextColor={C.textDim}
            maxLength={maxLength}
            multiline
            autoFocus
          />
          <Text style={s.count}>{text.length}/{maxLength}</Text>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const s = StyleSheet.create({
  header:    {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 8, paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border,
  },
  headerBtn: { minWidth: 64, height: 36, alignItems: 'center', justifyContent: 'center' },
  title:     { fontSize: 16, fontWeight: '800', color: C.text },
  cancel:    { fontSize: 15, fontWeight: '600', color: C.textSub },
  submit:    { fontSize: 15, fontWeight: '800', color: C.accent },
  guide:     { fontSize: 12, color: C.textSub, paddingHorizontal: 16, paddingTop: 12, lineHeight: 18 },
  input:     {
    flex: 1, margin: 16, padding: 14,
    backgroundColor: C.surface, borderRadius: R.inner,
    fontSize: 15, lineHeight: 22, color: C.text, textAlignVertical: 'top',
  },
  count:     { fontSize: 11, color: C.textSub, textAlign: 'right', paddingHorizontal: 20, paddingBottom: 12 },
});
