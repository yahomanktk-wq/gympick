import React, { useEffect, useState } from 'react';
import {
  Modal, View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform,
  ActivityIndicator, Alert, Pressable, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { C, R } from '../../theme';
import { containsBannedWord } from '../../lib/bannedWords';
import { createPtRequest, PT_CONTENT_MAX } from '../../lib/db/ptRequests';

// 2026-11-09: PT 상담 신청 (상담 내용 + 연락처 선택·동의)
// 신청하면 그 트레이너와 관장님에게 알림이 가고, 신청 1건마다 대화방이 생긴다.
// 한글 입력 버그 방지를 위해 모듈 레벨 컴포넌트, 입력 값은 이 안에서만 관리.

interface Props {
  visible:         boolean;
  gymId:           string;
  trainerId:       string;
  trainerNickname: string;
  onClose:         () => void;
  onCreated:       (requestId: string) => void;
}

export default function PtRequestModal({ visible, gymId, trainerId, trainerNickname, onClose, onCreated }: Props) {
  const [content, setContent] = useState('');
  const [phone,   setPhone]   = useState('');
  const [consent, setConsent] = useState(false);
  const [busy,    setBusy]    = useState(false);

  useEffect(() => { if (visible) { setContent(''); setPhone(''); setConsent(false); setBusy(false); } }, [visible]);

  const hasPhone = phone.trim().length > 0;
  const ready = content.trim().length > 0 && (!hasPhone || consent) && !busy;

  async function submit() {
    if (!ready) return;
    setBusy(true);
    try {
      if (await containsBannedWord(content)) {
        Alert.alert('사용할 수 없는 표현이 있어요');
        return;
      }
      const id = await createPtRequest(gymId, trainerId, content, hasPhone ? phone : null);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onCreated(id);
      onClose();
    } catch (e: any) {
      const msg = String(e?.message ?? '');
      if (msg.includes('cannot_request_self')) Alert.alert('본인에게는 신청할 수 없어요');
      else if (msg.includes('not_gym_trainer')) Alert.alert('지금은 이 헬스장 트레이너가 아니에요');
      else Alert.alert('신청하지 못했어요', '잠시 후 다시 시도해 주세요.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={s.backdrop} onPress={onClose}>
          <Pressable style={s.card} onPress={() => {}}>
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 8 }}>
              <Text style={s.title}>PT 상담 신청</Text>
              <Text style={s.sub}>{trainerNickname} 트레이너와 관장님에게 전달돼요. 답장은 앱 안 대화로 받아요.</Text>

              <Text style={s.label}>상담 내용</Text>
              <TextInput
                value={content}
                onChangeText={setContent}
                placeholder="목표, 가능한 요일·시간대 등을 적어주세요"
                placeholderTextColor={C.textDim}
                maxLength={PT_CONTENT_MAX}
                multiline
                style={[s.input, { minHeight: 96, textAlignVertical: 'top' }]}
              />

              <Text style={s.label}>연락처 (선택)</Text>
              <TextInput
                value={phone}
                onChangeText={setPhone}
                placeholder="010-0000-0000"
                placeholderTextColor={C.textDim}
                keyboardType="phone-pad"
                maxLength={20}
                style={s.input}
              />
              {hasPhone && (
                <TouchableOpacity style={s.consentRow} onPress={() => setConsent(v => !v)} activeOpacity={0.8}>
                  <Ionicons name={consent ? 'checkbox' : 'square-outline'} size={20} color={consent ? C.accent : C.textSub} />
                  <Text style={s.consentText}>
                    상담을 위해 연락처를 이 헬스장 관장님·트레이너에게 제공하는 데 동의해요.
                    상담이 끝나고 90일이 지나면 삭제돼요.
                  </Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity style={[s.primaryBtn, !ready && { opacity: 0.4 }]} disabled={!ready} activeOpacity={0.85} onPress={submit}>
                {busy ? <ActivityIndicator color={C.bg} /> : <Text style={s.primaryText}>신청하기</Text>}
              </TouchableOpacity>
            </ScrollView>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop:    { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 20 },
  card:        { backgroundColor: C.surface, borderRadius: R.card, padding: 20, borderWidth: 1, borderColor: C.border, maxHeight: '90%' },
  title:       { color: C.text, fontSize: 18, fontWeight: '800' },
  sub:         { color: C.textSub, fontSize: 13, lineHeight: 19, marginBottom: 4 },
  label:       { color: C.text, fontSize: 13, fontWeight: '700', marginTop: 6 },
  input:       { backgroundColor: C.surfaceHigh, borderRadius: R.inner, borderWidth: 1, borderColor: C.border, color: C.text, fontSize: 15, paddingHorizontal: 14, paddingVertical: 12 },
  consentRow:  { flexDirection: 'row', gap: 8, alignItems: 'flex-start', marginTop: 4 },
  consentText: { flex: 1, color: C.textSub, fontSize: 12, lineHeight: 18 },
  primaryBtn:  { backgroundColor: C.accent, borderRadius: R.pill, paddingVertical: 14, alignItems: 'center', marginTop: 10 },
  primaryText: { color: C.bg, fontWeight: '800', fontSize: 15 },
});
