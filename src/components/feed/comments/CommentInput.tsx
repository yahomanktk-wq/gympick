import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { C, R } from '../../../theme';

// 2026-11-04: 댓글 입력칸 (오운완 댓글 200자 / 헬스장 후기 500자 공용).
// 한글 입력 버그를 막기 위해 모듈 레벨 컴포넌트로 두고, 입력 값은 이 컴포넌트 안에서만 관리한다.

interface Props {
  placeholder: string;
  maxLength:   number;
  /** true를 돌려주면 입력칸을 비운다 */
  onSubmit:    (text: string) => Promise<boolean>;
  submitLabel?: string;
  multiline?:  boolean;
  autoFocus?:  boolean;
}

export default function CommentInput({
  placeholder, maxLength, onSubmit, submitLabel = '등록', multiline = true, autoFocus,
}: Props) {
  const [text,    setText]    = useState('');
  const [sending, setSending] = useState(false);
  const canSend = text.trim().length > 0 && !sending;

  async function send() {
    if (!canSend) return;
    setSending(true);
    try {
      const ok = await onSubmit(text);
      if (ok) setText('');
    } finally {
      setSending(false);
    }
  }

  return (
    <View style={s.wrap}>
      <View style={s.inputBox}>
        <TextInput
          style={[s.input, multiline && { maxHeight: 110 }]}
          value={text}
          onChangeText={t => setText(t.slice(0, maxLength))}
          placeholder={placeholder}
          placeholderTextColor={C.textDim}
          maxLength={maxLength}
          multiline={multiline}
          autoFocus={autoFocus}
        />
        {text.length > 0 && (
          <Text style={s.count}>{text.length}/{maxLength}</Text>
        )}
      </View>
      <TouchableOpacity
        style={[s.btn, !canSend && { opacity: 0.4 }]}
        disabled={!canSend}
        activeOpacity={0.8}
        onPress={send}
      >
        {sending
          ? <ActivityIndicator size="small" color={C.bg} />
          : <Text style={s.btnText}>{submitLabel}</Text>}
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  wrap:     { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  inputBox: {
    flex: 1, backgroundColor: C.surfaceHigh, borderRadius: R.inner,
    paddingHorizontal: 12, paddingTop: 10, paddingBottom: 8,
  },
  input:    { fontSize: 14, color: C.text, padding: 0, minHeight: 20, textAlignVertical: 'top' },
  count:    { fontSize: 10, color: C.textSub, textAlign: 'right', marginTop: 4 },
  btn:      {
    height: 40, minWidth: 56, paddingHorizontal: 14, borderRadius: R.inner,
    backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center',
  },
  btnText:  { fontSize: 14, fontWeight: '800', color: C.bg },
});
