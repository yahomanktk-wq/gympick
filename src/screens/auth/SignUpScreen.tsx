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
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { C, R } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import PrivacyPolicyScreen from '../PrivacyPolicyScreen';

interface Props {
  onBack:         () => void;
  onVerification: () => void;
}

function isValidEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
}

export default function SignUpScreen({ onBack, onVerification }: Props) {
  const { signUp } = useAuth();

  const [email,     setEmail]     = useState('');
  const [password,  setPassword]  = useState('');
  const [confirm,   setConfirm]   = useState('');
  const [name,      setName]      = useState('');
  const [nickname,  setNickname]  = useState('');
  const [year,      setYear]      = useState('');
  const [month,     setMonth]     = useState('');
  const [day,       setDay]       = useState('');
  const [error,     setError]     = useState<string | null>(null);
  const [loading,   setLoading]   = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);

  async function handleSignUp() {
    setError(null);

    if (!name.trim())      return setError('이름을 입력해주세요.');
    if (!nickname.trim())  return setError('닉네임을 입력해주세요.');
    if (!isValidEmail(email)) return setError('유효한 이메일을 입력해주세요.');
    if (password.length < 6)  return setError('비밀번호는 6자 이상이어야 해요.');
    if (password !== confirm)  return setError('비밀번호가 일치하지 않아요.');
    if (!year || !month || !day) return setError('생년월일을 입력해주세요.');

    const y = parseInt(year, 10);
    const m = parseInt(month, 10);
    const d = parseInt(day, 10);
    if (isNaN(y) || y < 1900 || y > 2025) return setError('유효한 연도를 입력해주세요.');
    if (isNaN(m) || m < 1 || m > 12)      return setError('유효한 월을 입력해주세요.');
    if (isNaN(d) || d < 1 || d > 31)      return setError('유효한 일을 입력해주세요.');

    const birthDate = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

    setLoading(true);
    const result = await signUp(email.trim(), password, name.trim(), nickname.trim(), birthDate);
    setLoading(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    if (result.needsVerification) {
      onVerification();
    }
    // If no verification needed, user is now signed in — AuthContext user state updated.
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
        {/* Back */}
        <TouchableOpacity style={s.backBtn} activeOpacity={0.7} onPress={onBack}>
          <Ionicons name="chevron-back" size={20} color={C.textSub} />
          <Text style={s.backText}>로그인</Text>
        </TouchableOpacity>

        <Text style={s.title}>GymPick 계정 만들기</Text>
        <Text style={s.sub}>
          운동을 기록하고 성장을 추적해보세요.
        </Text>

        {/* Fields */}
        <View style={s.fields}>
          <TextInput
            style={s.input}
            placeholder="이름"
            placeholderTextColor={C.textDim}
            value={name}
            onChangeText={setName}
            returnKeyType="next"
          />
          <View style={s.divider} />
          <TextInput
            style={s.input}
            placeholder="닉네임"
            placeholderTextColor={C.textDim}
            value={nickname}
            onChangeText={setNickname}
            autoCapitalize="none"
            returnKeyType="next"
          />
          <View style={s.divider} />
          <TextInput
            style={s.input}
            placeholder="이메일"
            placeholderTextColor={C.textDim}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            returnKeyType="next"
          />
          <View style={s.divider} />
          <TextInput
            style={s.input}
            placeholder="비밀번호 (6자 이상)"
            placeholderTextColor={C.textDim}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            returnKeyType="next"
          />
          <View style={s.divider} />
          <TextInput
            style={s.input}
            placeholder="비밀번호 확인"
            placeholderTextColor={C.textDim}
            value={confirm}
            onChangeText={setConfirm}
            secureTextEntry
            returnKeyType="next"
          />
          <View style={s.divider} />

          {/* Birth date */}
          <View style={s.dateRow}>
            <Text style={s.dateLabel}>생년월일</Text>
            <View style={s.dateInputs}>
              <TextInput
                style={[s.dateInput, s.dateInputYear]}
                placeholder="YYYY"
                placeholderTextColor={C.textDim}
                value={year}
                onChangeText={t => setYear(t.replace(/\D/g, '').slice(0, 4))}
                keyboardType="numeric"
                maxLength={4}
                returnKeyType="next"
              />
              <Text style={s.dateSep}>/</Text>
              <TextInput
                style={[s.dateInput, s.dateInputMonth]}
                placeholder="MM"
                placeholderTextColor={C.textDim}
                value={month}
                onChangeText={t => setMonth(t.replace(/\D/g, '').slice(0, 2))}
                keyboardType="numeric"
                maxLength={2}
                returnKeyType="next"
              />
              <Text style={s.dateSep}>/</Text>
              <TextInput
                style={[s.dateInput, s.dateInputDay]}
                placeholder="DD"
                placeholderTextColor={C.textDim}
                value={day}
                onChangeText={t => setDay(t.replace(/\D/g, '').slice(0, 2))}
                keyboardType="numeric"
                maxLength={2}
                returnKeyType="done"
                onSubmitEditing={handleSignUp}
              />
            </View>
          </View>
        </View>

        {/* Error */}
        {error && (
          <View style={s.errorBox}>
            <Ionicons name="alert-circle-outline" size={15} color="#ff6b6b" />
            <Text style={s.errorText}>{error}</Text>
          </View>
        )}

        {/* Create account button */}
        <TouchableOpacity
          style={[s.btn, loading && s.btnDisabled]}
          activeOpacity={0.85}
          onPress={handleSignUp}
          disabled={loading}
        >
          {loading
            ? <ActivityIndicator color={C.bg} />
            : <Text style={s.btnText}>회원가입</Text>
          }
        </TouchableOpacity>

        {/* Privacy policy consent */}
        <View style={s.privacyRow}>
          <Text style={s.privacyText}>
            가입하면{' '}
            <Text style={s.privacyLink} onPress={() => setShowPrivacy(true)}>
              개인정보처리방침
            </Text>
            에 동의하는 것으로 간주됩니다.
          </Text>
        </View>

        {/* Already have account */}
        <TouchableOpacity style={s.linkBtn} activeOpacity={0.7} onPress={onBack}>
          <Text style={s.linkText}>
            이미 계정이 있으신가요?{' '}
            <Text style={s.linkAccent}>로그인</Text>
          </Text>
        </TouchableOpacity>

        <Modal visible={showPrivacy} animationType="slide" onRequestClose={() => setShowPrivacy(false)}>
          <PrivacyPolicyScreen onClose={() => setShowPrivacy(false)} />
        </Modal>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 28,
    paddingTop: 24,
    paddingBottom: 48,
  },

  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 32,
    alignSelf: 'flex-start',
  },
  backText: { fontSize: 14, color: C.textSub, fontWeight: '600' },

  title: { fontSize: 28, fontWeight: '900', color: C.text, letterSpacing: -0.8, marginBottom: 8 },
  sub:   { fontSize: 14, color: C.textSub, lineHeight: 21, marginBottom: 28 },

  fields: {
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

  dateRow: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  dateLabel: { fontSize: 12, color: C.textSub, fontWeight: '600', marginBottom: 8 },
  dateInputs: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dateInput: {
    paddingHorizontal: 8,
    paddingVertical: 10,
    backgroundColor: C.surfaceHigh,
    borderRadius: R.inner,
    textAlign: 'center',
    fontSize: 15,
    color: C.text,
    fontWeight: '500',
  },
  dateInputYear:  { width: 76 },
  dateInputMonth: { width: 48 },
  dateInputDay:   { width: 48 },
  dateSep: { fontSize: 16, color: C.textDim, fontWeight: '700' },

  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  errorText: { fontSize: 13, color: '#ff6b6b', fontWeight: '600', flex: 1 },

  btn: {
    backgroundColor: C.accent,
    borderRadius: R.btn,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 20,
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { fontSize: 15, fontWeight: '800', color: C.bg },

  privacyRow: { alignItems: 'center', marginBottom: 20 },
  privacyText: { fontSize: 12, color: C.textDim, textAlign: 'center', lineHeight: 18 },
  privacyLink: { color: C.accent, fontWeight: '700' },

  linkBtn: { alignItems: 'center' },
  linkText:   { fontSize: 14, color: C.textSub },
  linkAccent: { color: C.accent, fontWeight: '700' },
});
