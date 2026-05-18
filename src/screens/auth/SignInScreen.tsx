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
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as AppleAuthentication from 'expo-apple-authentication';
import { C, R } from '../../theme';
import { useAuth } from '../../context/AuthContext';

interface Props {
  onSignUp:         () => void;
  onForgotPassword: () => void;
}

export default function SignInScreen({ onSignUp, onForgotPassword }: Props) {
  const { signIn, signInGoogle, signInApple } = useAuth();

  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState<string | null>(null);
  const [loading,  setLoading]  = useState(false);

  async function loginWithDemo() {
    setEmail('demo@gympick.app');
    setPassword('Demo1234!');
    setError(null);
    setLoading(true);
    const result = await signIn('demo@gympick.app', 'Demo1234!');
    setLoading(false);
    if (result.error) setError(result.error);
  }

  async function handleGoogleSignIn() {
    setLoading(true);
    const { error } = await signInGoogle();
    setLoading(false);
    if (error) Alert.alert('로그인 실패', error);
  }

  async function handleAppleSignIn() {
    setLoading(true);
    const { error } = await signInApple();
    setLoading(false);
    if (error && error !== 'Apple 로그인이 취소되었습니다.') {
      Alert.alert('로그인 실패', error);
    }
  }

  async function handleSignIn() {
    setError(null);
    const e = email.trim();
    if (!e || !password) {
      setError('이메일과 비밀번호를 입력해주세요.');
      return;
    }
    setLoading(true);
    const result = await signIn(e, password);
    setLoading(false);
    if (result.error) setError(result.error);
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
        {/* Logo / icon */}
        <View style={s.iconRing}>
          <Ionicons name="barbell" size={32} color={C.accent} />
        </View>

        <Text style={s.title}>로그인</Text>
        <Text style={s.sub}>
          운동을 기록하고, 진행 상황을 추적하고,{'\n'}즐겨찾기를 저장하세요.
        </Text>

        {/* Fields */}
        <View style={s.fields}>
          <TextInput
            style={s.input}
            placeholder="이메일"
            placeholderTextColor={C.textDim}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
            returnKeyType="next"
          />
          <View style={s.divider} />
          <TextInput
            style={s.input}
            placeholder="비밀번호"
            placeholderTextColor={C.textDim}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            returnKeyType="done"
            onSubmitEditing={handleSignIn}
          />
        </View>

        {/* 비밀번호 재설정 링크 */}
        <TouchableOpacity
          style={{ alignSelf: 'flex-end', marginBottom: 8, marginTop: 4 }}
          onPress={onForgotPassword}
          activeOpacity={0.7}
        >
          <Text style={{ fontSize: 13, color: C.accent, fontWeight: '600' }}>
            비밀번호를 잊으셨나요?
          </Text>
        </TouchableOpacity>

        {/* Error */}
        {error && (
          <View style={s.errorBox}>
            <Ionicons name="alert-circle-outline" size={15} color="#ff6b6b" />
            <Text style={s.errorText}>{error}</Text>
          </View>
        )}

        {/* Sign In button */}
        <TouchableOpacity
          style={[s.btn, loading && s.btnDisabled]}
          activeOpacity={0.85}
          onPress={handleSignIn}
          disabled={loading}
        >
          {loading
            ? <ActivityIndicator color={C.bg} />
            : <Text style={s.btnText}>로그인</Text>
          }
        </TouchableOpacity>

        {/* Create account */}
        <TouchableOpacity style={s.secondaryBtn} activeOpacity={0.7} onPress={onSignUp}>
          <Text style={s.secondaryText}>계정 만들기</Text>
        </TouchableOpacity>

        {/* 구분선 */}
        <View style={s.dividerRow}>
          <View style={s.dividerLine} />
          <Text style={s.dividerText}>또는</Text>
          <View style={s.dividerLine} />
        </View>

        {/* Google 로그인 */}
        <TouchableOpacity
          style={s.socialBtn}
          onPress={handleGoogleSignIn}
          activeOpacity={0.85}
          disabled={loading}
        >
          <View style={s.socialBtnInner}>
            <Text style={s.socialBtnIcon}>G</Text>
            <Text style={s.socialBtnText}>Google로 계속하기</Text>
          </View>
        </TouchableOpacity>

        {/* Apple 로그인 (iOS만) */}
        {Platform.OS === 'ios' && (
          <AppleAuthentication.AppleAuthenticationButton
            buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
            buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
            cornerRadius={12}
            style={s.appleBtn}
            onPress={handleAppleSignIn}
          />
        )}

        {/* Demo account section for App Store reviewers */}
        <View style={s.demoSection}>
          <Text style={s.demoTitle}>앱 심사용 데모 계정</Text>
          <Text style={s.demoText}>이메일: demo@gympick.app</Text>
          <Text style={s.demoText}>비밀번호: Demo1234!</Text>
          <TouchableOpacity style={s.demoBtn} activeOpacity={0.85} onPress={loginWithDemo} disabled={loading}>
            <Text style={s.demoBtnText}>데모 계정으로 로그인</Text>
          </TouchableOpacity>
        </View>

        <Text style={s.footer}>
          로그인 없이 헬스장과 머신을 탐색할 수 있어요.
        </Text>
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

  fields: {
    alignSelf: 'stretch',
    backgroundColor: C.surface,
    borderRadius: R.card,
    overflow: 'hidden',
    marginBottom: 12,
  },
  input: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 15,
    color: C.text,
    fontWeight: '500',
  },
  divider: { height: 1, backgroundColor: C.border },

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
  btnDisabled: { opacity: 0.6 },
  btnText: { fontSize: 15, fontWeight: '800', color: C.bg },

  secondaryBtn: {
    alignSelf: 'stretch',
    borderRadius: R.btn,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: C.border,
    marginBottom: 24,
  },
  secondaryText: { fontSize: 15, fontWeight: '700', color: C.text },

  demoSection: {
    alignSelf: 'stretch',
    backgroundColor: C.surface,
    borderRadius: R.card,
    borderWidth: 1,
    borderColor: C.border,
    padding: 16,
    marginBottom: 20,
  },
  demoTitle: { fontSize: 11, fontWeight: '800', color: C.textDim, letterSpacing: 0.8, marginBottom: 8, textAlign: 'center' },
  demoText:  { fontSize: 13, color: C.textSub, marginBottom: 4 },
  demoBtn: {
    backgroundColor: C.surfaceHigh,
    borderRadius: R.btn,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 10,
    borderWidth: 1,
    borderColor: C.border,
  },
  demoBtnText: { fontSize: 13, fontWeight: '700', color: C.text },

  footer: { fontSize: 12, color: C.textDim, textAlign: 'center', lineHeight: 18 },

  dividerRow: {
    flexDirection: 'row', alignItems: 'center',
    alignSelf: 'stretch', marginVertical: 20, gap: 12,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: C.border },
  dividerText: { fontSize: 12, color: C.textDim, fontWeight: '600' },

  socialBtn: {
    alignSelf: 'stretch',
    backgroundColor: C.surface,
    borderRadius: R.btn,
    borderWidth: 1,
    borderColor: C.border,
    paddingVertical: 14,
    marginBottom: 12,
  },
  socialBtnInner: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: 10,
  },
  socialBtnIcon: { fontSize: 16, fontWeight: '900', color: '#4285F4' },
  socialBtnText: { fontSize: 15, fontWeight: '700', color: C.text },

  appleBtn: { alignSelf: 'stretch', height: 50, marginBottom: 12 },
});
