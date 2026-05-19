import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform,
  ScrollView, ActivityIndicator, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { C, R } from '../../theme';
import { supabase } from '../../lib/supabase';

interface Props {
  onComplete: () => void;
}

export default function ResetPasswordScreen({ onComplete }: Props) {
  const [password,  setPassword]  = useState('');
  const [confirm,   setConfirm]   = useState('');
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState<string | null>(null);
  const [showPw,    setShowPw]    = useState(false);
  const [showCf,    setShowCf]    = useState(false);

  async function handleReset() {
    setError(null);
    if (password.length < 6) {
      setError('비밀번호는 6자 이상이어야 해요.');
      return;
    }
    if (password !== confirm) {
      setError('비밀번호가 일치하지 않아요.');
      return;
    }

    setLoading(true);
    const { error: err } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (err) {
      setError('비밀번호 변경에 실패했어요. 다시 시도해주세요.');
      return;
    }

    Alert.alert(
      '변경 완료',
      '비밀번호가 성공적으로 변경되었어요.',
      [{ text: '확인', onPress: onComplete }]
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={s.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* 아이콘 */}
        <View style={s.iconRing}>
          <Ionicons name="lock-closed-outline" size={32} color={C.accent} />
        </View>

        <Text style={s.title}>새 비밀번호 설정</Text>
        <Text style={s.sub}>새로 사용할 비밀번호를 입력해주세요.</Text>

        {/* 비밀번호 입력 */}
        <View style={s.fields}>
          <View style={s.inputRow}>
            <TextInput
              style={s.input}
              placeholder="새 비밀번호 (6자 이상)"
              placeholderTextColor={C.textDim}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPw}
              returnKeyType="next"
              autoFocus
            />
            <TouchableOpacity
              style={s.eyeBtn}
              onPress={() => setShowPw(v => !v)}
              activeOpacity={0.7}
            >
              <Ionicons
                name={showPw ? 'eye-off-outline' : 'eye-outline'}
                size={18}
                color={C.textDim}
              />
            </TouchableOpacity>
          </View>
          <View style={s.divider} />
          <View style={s.inputRow}>
            <TextInput
              style={s.input}
              placeholder="비밀번호 확인"
              placeholderTextColor={C.textDim}
              value={confirm}
              onChangeText={setConfirm}
              secureTextEntry={!showCf}
              returnKeyType="done"
              onSubmitEditing={handleReset}
            />
            <TouchableOpacity
              style={s.eyeBtn}
              onPress={() => setShowCf(v => !v)}
              activeOpacity={0.7}
            >
              <Ionicons
                name={showCf ? 'eye-off-outline' : 'eye-outline'}
                size={18}
                color={C.textDim}
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* 에러 */}
        {error && (
          <View style={s.errorBox}>
            <Ionicons name="alert-circle-outline" size={15} color="#ff6b6b" />
            <Text style={s.errorText}>{error}</Text>
          </View>
        )}

        {/* 변경 버튼 */}
        <TouchableOpacity
          style={[s.btn, (loading || !password || !confirm) && s.btnDisabled]}
          onPress={handleReset}
          activeOpacity={0.85}
          disabled={loading || !password || !confirm}
        >
          {loading
            ? <ActivityIndicator color={C.bg} />
            : <Text style={s.btnText}>비밀번호 변경</Text>
          }
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  scroll: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    paddingVertical: 48,
  },
  iconRing: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: C.accentBg,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 24, fontWeight: '900', color: C.text,
    letterSpacing: -0.5, marginBottom: 8, textAlign: 'center',
  },
  sub: {
    fontSize: 14, color: C.textSub,
    textAlign: 'center', lineHeight: 21, marginBottom: 32,
  },
  fields: {
    alignSelf: 'stretch',
    backgroundColor: C.surface,
    borderRadius: R.card,
    overflow: 'hidden',
    marginBottom: 12,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 15,
    color: C.text,
    fontWeight: '500',
  },
  eyeBtn: {
    paddingHorizontal: 14,
    paddingVertical: 16,
  },
  divider: { height: 1, backgroundColor: C.border },
  errorBox: {
    flexDirection: 'row', alignItems: 'center',
    gap: 8, alignSelf: 'stretch',
    marginBottom: 12, paddingHorizontal: 4,
  },
  errorText: { fontSize: 13, color: '#ff6b6b', fontWeight: '600', flex: 1 },
  btn: {
    alignSelf: 'stretch',
    backgroundColor: C.accent,
    borderRadius: R.btn,
    paddingVertical: 16,
    alignItems: 'center',
  },
  btnDisabled: { opacity: 0.4 },
  btnText: { fontSize: 15, fontWeight: '800', color: C.bg },
});
