import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { C, R } from '../../theme';
import { supabase } from '../../lib/supabase';

type Step = 'input' | 'sent';

interface Props {
  onBack: () => void;
}

export default function ForgotPasswordScreen({ onBack }: Props) {
  const [step,    setStep]    = useState<Step>('input');
  const [email,   setEmail]   = useState('');
  const [error,   setError]   = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSend() {
    setError(null);
    const e = email.trim();
    if (!e) { setError('이메일을 입력해주세요.'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) {
      setError('유효한 이메일을 입력해주세요.');
      return;
    }
    setLoading(true);
    const { error: err } = await supabase.auth.resetPasswordForEmail(e, {
      redirectTo: 'gympick://reset-password',
    });
    console.log('[ForgotPassword] error:', JSON.stringify(err));
    console.log('[ForgotPassword] email:', e);
    setLoading(false);
    if (err) {
      setError('재설정 이메일 발송에 실패했어요. 잠시 후 다시 시도해주세요.');
      return;
    }
    setStep('sent');
  }

  if (step === 'sent') {
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
          <TouchableOpacity style={s.backBtn} onPress={onBack} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={22} color={C.text} />
          </TouchableOpacity>

          <View style={s.iconRing}>
            <Ionicons name="mail-outline" size={32} color={C.accent} />
          </View>

          <Text style={s.title}>이메일을 확인해주세요</Text>
          <Text style={s.sub}>
            {`${email}으로\n비밀번호 재설정 링크를 보냈어요.\n\n이메일이 도착하지 않으면 가입 시 사용한\n이메일인지 확인해주세요.`}
          </Text>

          <TouchableOpacity style={s.btn} activeOpacity={0.85} onPress={onBack}>
            <Text style={s.btnText}>로그인으로 돌아가기</Text>
          </TouchableOpacity>

          <TouchableOpacity style={s.retryBtn} activeOpacity={0.7} onPress={() => setStep('input')}>
            <Text style={s.retryText}>다른 이메일로 다시 보내기</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
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
        <TouchableOpacity style={s.backBtn} onPress={onBack} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={22} color={C.text} />
        </TouchableOpacity>

        <View style={s.iconRing}>
          <Ionicons name="lock-open-outline" size={32} color={C.accent} />
        </View>

        <Text style={s.title}>비밀번호 재설정</Text>
        <Text style={s.sub}>
          {'가입 시 사용한 이메일을 입력하면\n재설정 링크를 보내드려요.'}
        </Text>

        <TextInput
          style={s.input}
          placeholder="이메일"
          placeholderTextColor={C.textDim}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
          returnKeyType="send"
          autoFocus
          onSubmitEditing={handleSend}
        />

        {error && (
          <View style={s.errorBox}>
            <Ionicons name="alert-circle-outline" size={15} color="#ff6b6b" />
            <Text style={s.errorText}>{error}</Text>
          </View>
        )}

        <TouchableOpacity
          style={[s.btn, (!email.trim() || loading) && s.btnDisabled]}
          activeOpacity={0.85}
          onPress={handleSend}
          disabled={!email.trim() || loading}
        >
          {loading
            ? <ActivityIndicator color={C.bg} />
            : <Text style={s.btnText}>재설정 링크 보내기</Text>
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

  backBtn: {
    alignSelf: 'flex-start',
    marginBottom: 24,
    padding: 4,
  },

  iconRing: {
    width:           72,
    height:          72,
    borderRadius:    36,
    backgroundColor: C.accentBg,
    alignItems:      'center',
    justifyContent:  'center',
    marginBottom:    24,
  },

  title: { fontSize: 24, fontWeight: '900', color: C.text, letterSpacing: -0.5, marginBottom: 8, textAlign: 'center' },
  sub:   { fontSize: 14, color: C.textSub, textAlign: 'center', lineHeight: 21, marginBottom: 32 },

  input: {
    alignSelf: 'stretch',
    backgroundColor: C.surface,
    borderRadius: R.card,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 15,
    color: C.text,
    fontWeight: '500',
    marginBottom: 12,
  },

  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'stretch',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  errorText: { fontSize: 13, color: '#ff6b6b', fontWeight: '600', flex: 1 },

  btn: {
    alignSelf: 'stretch',
    backgroundColor: C.accent,
    borderRadius: R.btn,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  btnDisabled: { opacity: 0.4 },
  btnText: { fontSize: 15, fontWeight: '800', color: C.bg },

  retryBtn: {
    alignSelf: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  retryText: { fontSize: 13, color: C.accent, fontWeight: '600' },
});
