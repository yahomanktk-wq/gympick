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
import * as Haptics from 'expo-haptics';
import { C, R } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import TermsOfServiceScreen from './TermsOfServiceScreen';
import LocationPolicyScreen from './LocationPolicyScreen';
import PrivacyPolicyScreen  from '../PrivacyPolicyScreen';

interface Props {
  onBack:         () => void;
  onVerification: () => void;
}

function isValidEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
}

// ── 모듈 레벨 상수 & 컴포넌트 ────────────────────────────────────────────────

const SIGNUP_CONSENT_ITEMS = [
  { id: 'terms',     label: '서비스 이용약관 동의 (필수)',     required: true,  hasLink: true  },
  { id: 'privacy',   label: '개인정보 처리방침 동의 (필수)',   required: true,  hasLink: true  },
  { id: 'location',  label: '위치정보 수집·이용 동의 (필수)', required: true,  hasLink: true  },
  { id: 'age',       label: '만 14세 이상입니다 (필수)',       required: true,  hasLink: false },
  { id: 'marketing', label: '마케팅 정보 수신 동의 (선택)',    required: false, hasLink: false },
] as const;

const SignupConsentItem = React.memo(({
  item, checked, onToggle, onPressLink,
}: {
  item:         typeof SIGNUP_CONSENT_ITEMS[number];
  checked:      boolean;
  onToggle:     () => void;
  onPressLink?: () => void;
}) => (
  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 }}>
    <TouchableOpacity
      onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onToggle(); }}
      activeOpacity={0.7}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    >
      <View style={[s.checkbox, checked && s.checkboxActive]}>
        {checked && <Ionicons name="checkmark" size={12} color={C.bg} />}
      </View>
    </TouchableOpacity>
    <Text style={s.consentLabel}>{item.label}</Text>
    {item.hasLink && onPressLink && (
      <TouchableOpacity onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onPressLink!(); }} activeOpacity={0.7}>
        <Text style={s.consentLink}>보기</Text>
      </TouchableOpacity>
    )}
  </View>
));

// ── Screen ───────────────────────────────────────────────────────────────────

export default function SignUpScreen({ onBack, onVerification }: Props) {
  const { signUp } = useAuth();

  const [email,     setEmail]     = useState('');
  const [password,  setPassword]  = useState('');
  const [confirm,   setConfirm]   = useState('');
  const [name,      setName]      = useState('');
  const [year,      setYear]      = useState('');
  const [month,     setMonth]     = useState('');
  const [day,       setDay]       = useState('');
  const [error,     setError]     = useState<string | null>(null);
  const [loading,   setLoading]   = useState(false);
  const [showTerms,    setShowTerms]    = useState(false);
  const [showPrivacy,  setShowPrivacy]  = useState(false);
  const [showLocation, setShowLocation] = useState(false);
  const [termsChecked, setTermsChecked] = useState({
    terms: false, privacy: false, location: false, age: false, marketing: false,
  });

  const allRequiredChecked = ['terms', 'privacy', 'location', 'age'].every(
    id => termsChecked[id as keyof typeof termsChecked]
  );

  async function handleSignUp() {
    setError(null);

    if (!name.trim())         return setError('이름을 입력해주세요.');
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
    const result = await signUp(email.trim(), password, name.trim(), birthDate);
    setLoading(false);

    if (result.error) { setError(result.error); return; }

    // 약관 동의 Supabase 저장
    try {
      const { supabase } = await import('../../lib/supabase');
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from('profiles').update({
          terms_agreed_at:  new Date().toISOString(),
          location_agreed:  true,
          marketing_agreed: termsChecked.marketing,
        }).eq('id', user.id);
      }
    } catch (e) {
      if (__DEV__) console.warn('[SignUp] terms save error:', e);
    }

    if (result.needsVerification) { onVerification(); }
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
        <TouchableOpacity style={s.backBtn} activeOpacity={0.7} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onBack(); }}>
          <Ionicons name="chevron-back" size={20} color={C.textSub} />
          <Text style={s.backText}>로그인</Text>
        </TouchableOpacity>

        <Text style={s.title}>GymPick 계정 만들기</Text>
        <Text style={s.sub}>운동을 기록하고 성장을 추적해보세요.</Text>

        {/* Fields */}
        <View style={s.fields}>
          <TextInput
            style={s.input}
            placeholder="이름"
            placeholderTextColor={C.textSub}
            value={name}
            onChangeText={setName}
            returnKeyType="next"
          />
          <View style={s.divider} />
          <TextInput
            style={s.input}
            placeholder="이메일"
            placeholderTextColor={C.textSub}
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
            placeholderTextColor={C.textSub}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            returnKeyType="next"
          />
          <View style={s.divider} />
          <TextInput
            style={s.input}
            placeholder="비밀번호 확인"
            placeholderTextColor={C.textSub}
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
                placeholderTextColor={C.textSub}
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
                placeholderTextColor={C.textSub}
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
                placeholderTextColor={C.textSub}
                value={day}
                onChangeText={t => setDay(t.replace(/\D/g, '').slice(0, 2))}
                keyboardType="numeric"
                maxLength={2}
                returnKeyType="done"
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

        {/* 약관 동의 */}
        <View style={s.consentSection}>
          <Text style={s.consentTitle}>약관 동의</Text>
          {SIGNUP_CONSENT_ITEMS.map((item, idx) => (
            <React.Fragment key={item.id}>
              <SignupConsentItem
                item={item}
                checked={!!termsChecked[item.id as keyof typeof termsChecked]}
                onToggle={() =>
                  setTermsChecked(prev => ({ ...prev, [item.id]: !prev[item.id as keyof typeof prev] }))
                }
                onPressLink={
                  item.id === 'terms'    ? () => setShowTerms(true)    :
                  item.id === 'privacy'  ? () => setShowPrivacy(true)  :
                  item.id === 'location' ? () => setShowLocation(true) :
                  undefined
                }
              />
              {idx < SIGNUP_CONSENT_ITEMS.length - 1 && <View style={s.consentDivider} />}
            </React.Fragment>
          ))}
        </View>

        {/* 회원가입 버튼 */}
        <TouchableOpacity
          style={[s.btn, (loading || !allRequiredChecked) && s.btnDisabled]}
          activeOpacity={0.85}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); handleSignUp(); }}
          disabled={loading || !allRequiredChecked}
        >
          {loading
            ? <ActivityIndicator color={C.bg} />
            : <Text style={s.btnText}>회원가입</Text>
          }
        </TouchableOpacity>

        {/* Already have account */}
        <TouchableOpacity style={s.linkBtn} activeOpacity={0.7} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onBack(); }}>
          <Text style={s.linkText}>
            이미 계정이 있으신가요?{' '}
            <Text style={s.linkAccent}>로그인</Text>
          </Text>
        </TouchableOpacity>

        <Modal
          visible={showTerms}
          animationType="slide"
          onRequestClose={() => setShowTerms(false)}
        >
          <TermsOfServiceScreen onClose={() => setShowTerms(false)} />
        </Modal>
        <Modal
          visible={showPrivacy}
          animationType="slide"
          onRequestClose={() => setShowPrivacy(false)}
        >
          <PrivacyPolicyScreen onClose={() => setShowPrivacy(false)} />
        </Modal>
        <Modal
          visible={showLocation}
          animationType="slide"
          onRequestClose={() => setShowLocation(false)}
        >
          <LocationPolicyScreen onClose={() => setShowLocation(false)} />
        </Modal>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  scroll: {
    flexGrow:          1,
    paddingHorizontal: 28,
    paddingTop:        24,
    paddingBottom:     48,
  },

  backBtn: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           4,
    marginBottom:  32,
    alignSelf:     'flex-start',
  },
  backText: { fontSize: 14, color: C.textSub, fontWeight: '600' },

  title: { fontSize: 28, fontWeight: '900', color: C.text, letterSpacing: -0.8, marginBottom: 8 },
  sub:   { fontSize: 14, color: C.textSub, lineHeight: 21, marginBottom: 28 },

  fields: {
    backgroundColor: C.surface,
    borderRadius:    R.card,
    overflow:        'hidden',
    marginBottom:    12,
  },
  input: {
    paddingHorizontal: 16,
    paddingVertical:   16,
    fontSize:          15,
    color:             C.text,
    fontWeight:        '500',
  },
  divider: { height: 1, backgroundColor: C.border },

  dateRow:    { paddingHorizontal: 16, paddingVertical: 12 },
  dateLabel:  { fontSize: 12, color: C.textSub, fontWeight: '600', marginBottom: 8 },
  dateInputs: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dateInput: {
    paddingHorizontal: 8,
    paddingVertical:   10,
    backgroundColor:   C.surfaceHigh,
    borderRadius:      R.inner,
    textAlign:         'center',
    fontSize:          15,
    color:             C.text,
    fontWeight:        '500',
  },
  dateInputYear:  { width: 76 },
  dateInputMonth: { width: 48 },
  dateInputDay:   { width: 48 },
  dateSep: { fontSize: 16, color: C.textDim, fontWeight: '700' },

  errorBox: {
    flexDirection:    'row',
    alignItems:       'center',
    gap:              8,
    marginBottom:     12,
    paddingHorizontal: 4,
  },
  errorText: { fontSize: 13, color: '#ff6b6b', fontWeight: '600', flex: 1 },

  consentSection: {
    backgroundColor:   C.surface,
    borderRadius:      R.card,
    borderWidth:       1,
    borderColor:       C.border,
    paddingHorizontal: 16,
    marginBottom:      16,
  },
  consentTitle: {
    fontSize:      12,
    fontWeight:    '700',
    color:         C.textDim,
    letterSpacing: 0.8,
    paddingTop:    14,
    paddingBottom: 8,
  },
  consentDivider: { height: 1, backgroundColor: C.border },
  consentLabel:   { flex: 1, fontSize: 13, fontWeight: '600', color: C.text },
  consentLink:    { fontSize: 12, color: C.accent, fontWeight: '700' },
  checkbox: {
    width:           20,
    height:          20,
    borderRadius:    5,
    borderWidth:     1.5,
    borderColor:     C.border,
    backgroundColor: C.surfaceHigh,
    alignItems:      'center',
    justifyContent:  'center',
  },
  checkboxActive: { backgroundColor: C.accent, borderColor: C.accent },

  btn: {
    backgroundColor: C.accent,
    borderRadius:    R.btn,
    paddingVertical: 16,
    alignItems:      'center',
    marginBottom:    20,
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { fontSize: 15, fontWeight: '800', color: C.bg },

  linkBtn:    { alignItems: 'center' },
  linkText:   { fontSize: 14, color: C.textSub },
  linkAccent: { color: C.accent, fontWeight: '700' },
});
