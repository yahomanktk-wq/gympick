import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { C, R, T } from '../../theme';
import { addManagerApplication } from '../../data/managerApplicationStore';
import { useAuth } from '../../context/AuthContext';
import { geocodeAddress } from '../../lib/geocoding';

interface Props {
  visible: boolean;
  userId: string;
  onClose: () => void;
}

type Step = 'form' | 'complete';

export default function ManagerRequestModal({ visible, userId, onClose }: Props) {
  const { user } = useAuth();
  const [step,     setStep]     = useState<Step>('form');
  const [gymName,  setGymName]  = useState('');
  const [location, setLocation] = useState('');
  const [phone,    setPhone]    = useState('');
  const [message,  setMessage]  = useState('');
  const [loading,  setLoading]  = useState(false);

  function handleClose() {
    setStep('form');
    setGymName('');
    setLocation('');
    setPhone('');
    setMessage('');
    setLoading(false);
    onClose();
  }

  async function handleSubmit() {
    if (!gymName.trim() || !location.trim()) return;
    setLoading(true);
    const coords = await geocodeAddress(location.trim());
    if (!coords) {
      setLoading(false);
      Alert.alert(
        '주소를 확인해주세요',
        `"${location.trim()}" 주소를 찾을 수 없어요.\n\n도로명 주소나 지번 주소를 정확하게 입력해주세요.\n예) 서울 강남구 테헤란로 152`,
        [{ text: '확인', style: 'default' }],
      );
      return;
    }
    try {
      const { supabase } = await import('../../lib/supabase');

      // 이미 pending 상태인 신청이 있는지 확인
      const { data: existing } = await supabase
        .from('manager_requests')
        .select('id')
        .eq('user_id', userId)
        .eq('status', 'pending')
        .maybeSingle();

      if (existing) {
        setLoading(false);
        const { Alert } = await import('react-native');
        Alert.alert(
          '신청 진행 중',
          '이미 매니저 신청이 접수되어 있어요.\n승인 또는 거절 후 다시 신청할 수 있어요.'
        );
        return;
      }

      // 이미 매니저 계정인지 확인 (gyms 테이블에 manager_id로 연결된 헬스장 있는지)
      const { data: managedGym } = await supabase
        .from('gyms')
        .select('id, name')
        .eq('manager_id', userId)
        .maybeSingle();

      if (managedGym) {
        setLoading(false);
        const { Alert } = await import('react-native');
        Alert.alert(
          '이미 관리 중인 헬스장이 있어요',
          `현재 ${managedGym.name} 헬스장을 관리 중이에요.\n매니저는 하나의 헬스장만 관리할 수 있어요.`
        );
        return;
      }

      // Supabase manager_requests 테이블에 저장
      const { error } = await supabase.from('manager_requests').insert({
        user_id:  userId,
        gym_name: gymName.trim(),
        location: location.trim(),
        phone:    phone.trim(),
        message:  message.trim(),
        status:   'pending',
      });

      if (error) {
        console.warn('[ManagerRequestModal] Supabase 저장 실패:', error.message);
      }

      // 로컬 Mock에도 저장 (Fallback)
      addManagerApplication({
        applicantUserId: userId,
        applicantName: user?.name ?? user?.nickname ?? userId,
        gymName: gymName.trim(),
        location: location.trim(),
        phone: phone.trim(),
        message: message.trim(),
      });

      setStep('complete');
    } catch (e: any) {
      console.warn('[ManagerRequestModal] 오류:', e.message);
      setStep('complete');
    } finally {
      setLoading(false);
    }
  }

  const canSubmit = gymName.trim().length > 0 && location.trim().length > 0 && !loading;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={handleClose}>
      <SafeAreaView style={s.safe}>
        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity style={s.headerBtn} onPress={handleClose} activeOpacity={0.7}>
            <Ionicons name="close" size={20} color={C.text} />
          </TouchableOpacity>
          <Text style={s.headerTitle}>헬스장 매니저 신청</Text>
          <View style={s.headerBtn} />
        </View>

        {step === 'complete' ? (
          /* ── Complete screen ── */
          <View style={s.completeWrap}>
            <View style={s.completeIcon}>
              <Ionicons name="checkmark-circle" size={72} color={C.accent} />
            </View>
            <Text style={s.completeTitle}>신청이 완료되었습니다!</Text>
            <Text style={s.completeBody}>1~2 영업일 내 검토 후 안내드리겠습니다.</Text>
            <Text style={s.completeSub}>승인 후 헬스장 관리 기능이 활성화됩니다.</Text>
            <TouchableOpacity style={s.completeBtn} onPress={handleClose} activeOpacity={0.85}>
              <Text style={s.completeBtnText}>확인</Text>
            </TouchableOpacity>
          </View>
        ) : (
          /* ── Form ── */
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={s.scroll}
              keyboardShouldPersistTaps="handled"
            >
              <Text style={s.desc}>
                헬스장 운영자라면 신청 후 승인을 받아 헬스장을 GymPick에 등록하고 관리할 수 있습니다.
              </Text>

              <Text style={s.fieldLabel}>헬스장 이름 <Text style={s.required}>*</Text></Text>
              <TextInput
                style={s.input}
                value={gymName}
                onChangeText={v => setGymName(v)}
                placeholder="예: IronHub Fitness 강남점"
                placeholderTextColor={C.textDim}
                autoCorrect={false}
                autoCapitalize="none"
                spellCheck={false}
              />

              <Text style={s.fieldLabel}>위치 <Text style={s.required}>*</Text></Text>
              <TextInput
                style={s.input}
                value={location}
                onChangeText={v => setLocation(v)}
                placeholder="예: 서울 강남구 테헤란로 123"
                placeholderTextColor={C.textDim}
                autoCorrect={false}
                autoCapitalize="none"
                spellCheck={false}
              />

              <Text style={s.fieldLabel}>전화번호</Text>
              <TextInput
                style={s.input}
                value={phone}
                onChangeText={v => setPhone(v)}
                placeholder="예: 02-1234-5678"
                placeholderTextColor={C.textDim}
                keyboardType="phone-pad"
                autoCorrect={false}
                spellCheck={false}
              />

              <Text style={s.fieldLabel}>추가 메시지</Text>
              <TextInput
                style={[s.input, s.inputMulti]}
                value={message}
                onChangeText={v => setMessage(v)}
                placeholder="운영 중인 헬스장에 대해 자유롭게 적어주세요."
                placeholderTextColor={C.textDim}
                multiline
                numberOfLines={4}
                autoCorrect={false}
                autoCapitalize="none"
                spellCheck={false}
                textAlignVertical="top"
              />

              <View style={s.noteCard}>
                <Ionicons name="information-circle-outline" size={14} color={C.textDim} />
                <Text style={s.noteText}>
                  신청 내용은 GymPick 관리팀이 검토하며, 승인 시 이메일로 안내드립니다.
                </Text>
              </View>

              <View style={{ height: 32 }} />
            </ScrollView>

            <View style={s.ctaBar}>
              <TouchableOpacity
                style={[s.submitBtn, !canSubmit && s.submitBtnDisabled]}
                onPress={handleSubmit}
                activeOpacity={0.85}
                disabled={!canSubmit}
              >
                <Text style={[s.submitBtnText, !canSubmit && s.submitBtnTextDisabled]}>
                  {loading ? '신청 중...' : '매니저 신청하기'}
                </Text>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        )}
      </SafeAreaView>
    </Modal>
  );
}

const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: C.bg },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 8, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  headerBtn:   { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', ...T.section, color: C.text },

  scroll: { padding: 20, paddingBottom: 16 },

  desc: {
    fontSize: 13, color: C.textSub, lineHeight: 20,
    marginBottom: 24,
  },

  fieldLabel: {
    fontSize: 12, fontWeight: '700', color: C.textDim,
    letterSpacing: 0.8, textTransform: 'uppercase',
    marginBottom: 8, marginTop: 4,
  },
  required: { color: C.accent },

  input: {
    backgroundColor: C.surface,
    borderRadius: R.inner,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: C.text,
    fontSize: 15,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: C.border,
  },
  inputMulti: {
    minHeight: 110,
    paddingTop: 14,
  },

  noteCard: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: C.surface,
    borderRadius: R.inner,
    padding: 14,
    marginTop: 4,
  },
  noteText: { flex: 1, fontSize: 12, color: C.textDim, lineHeight: 18 },

  ctaBar: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: C.border,
    backgroundColor: C.bg,
  },
  submitBtn: {
    backgroundColor: C.accent,
    borderRadius: R.btn,
    paddingVertical: 16,
    alignItems: 'center',
  },
  submitBtnDisabled: { backgroundColor: C.surfaceHigh },
  submitBtnText:         { fontSize: 16, fontWeight: '800', color: C.bg },
  submitBtnTextDisabled: { color: C.textDim },

  // Complete screen
  completeWrap: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 32,
  },
  completeIcon:  { marginBottom: 20 },
  completeTitle: { ...T.title, color: C.text, textAlign: 'center', marginBottom: 12 },
  completeBody:  { fontSize: 15, color: C.textSub, textAlign: 'center', lineHeight: 22, marginBottom: 6 },
  completeSub:   { fontSize: 13, color: C.textDim, textAlign: 'center', marginBottom: 40 },
  completeBtn: {
    backgroundColor: C.accent,
    borderRadius: R.btn,
    paddingVertical: 14,
    paddingHorizontal: 48,
  },
  completeBtnText: { fontSize: 16, fontWeight: '800', color: C.bg },
});
