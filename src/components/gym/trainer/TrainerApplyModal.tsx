import React, { useEffect, useState } from 'react';
import {
  Modal, View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform,
  ActivityIndicator, Alert, Pressable,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { C, R } from '../../../theme';
import { containsBannedWord } from '../../../lib/bannedWords';
import { applyGymTrainer, TRAINER_INTRO_MAX, TRAINER_NAME_MAX } from '../../../lib/db/gymTrainers';

// 2026-11-09: 트레이너 신청 (실명 + 한 줄 소개). 승인 후 헬스장 상세 트레이너 목록에 공개.
// 한글 입력 버그 방지를 위해 모듈 레벨 컴포넌트, 입력 값은 이 안에서만 관리.

interface Props {
  visible:   boolean;
  gymId:     string;
  gymName:   string;
  onClose:   () => void;
  onApplied: () => void;
}

export default function TrainerApplyModal({ visible, gymId, gymName, onClose, onApplied }: Props) {
  const [name,  setName]  = useState('');
  const [intro, setIntro] = useState('');
  const [busy,  setBusy]  = useState(false);

  useEffect(() => { if (visible) { setName(''); setIntro(''); setBusy(false); } }, [visible]);

  const ready = name.trim().length > 0 && !busy;

  async function submit() {
    if (!ready) return;
    setBusy(true);
    try {
      if ((await containsBannedWord(name)) || (await containsBannedWord(intro))) {
        Alert.alert('사용할 수 없는 표현이 있어요');
        return;
      }
      const r = await applyGymTrainer(gymId, name, intro);
      if (r === 'already') Alert.alert('이미 이 헬스장 트레이너예요');
      else if (r === 'duplicate') Alert.alert('이미 신청했어요', '관장님 승인을 기다려 주세요.');
      else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert('신청 완료', '관장님이 승인하면 알림으로 알려드릴게요.');
      }
      onApplied();
      onClose();
    } catch {
      Alert.alert('신청하지 못했어요', '잠시 후 다시 시도해 주세요.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={s.backdrop} onPress={onClose}>
          <Pressable style={s.card} onPress={() => {}}>
            <Text style={s.title}>트레이너 신청</Text>
            <Text style={s.sub}>{gymName} 관장님이 승인하면 이 헬스장 오운완 댓글에 트레이너 배지가 붙어요.</Text>

            <Text style={s.label}>이름 (실명)</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="관장님이 알아볼 수 있는 이름"
              placeholderTextColor={C.textDim}
              maxLength={TRAINER_NAME_MAX}
              style={s.input}
            />

            <Text style={s.label}>한 줄 소개 (선택)</Text>
            <TextInput
              value={intro}
              onChangeText={setIntro}
              placeholder="예: 평일 오후 PT 담당"
              placeholderTextColor={C.textDim}
              maxLength={TRAINER_INTRO_MAX}
              style={s.input}
            />

            <Text style={s.notice}>승인되면 이름과 소개가 헬스장 상세의 트레이너 목록에 공개돼요. 소개는 나중에 바꿀 수 있어요.</Text>

            <TouchableOpacity style={[s.primaryBtn, !ready && { opacity: 0.4 }]} disabled={!ready} activeOpacity={0.85} onPress={submit}>
              {busy ? <ActivityIndicator color={C.bg} /> : <Text style={s.primaryText}>신청하기</Text>}
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop:    { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 24 },
  card:        { backgroundColor: C.surface, borderRadius: R.card, padding: 22, gap: 8, borderWidth: 1, borderColor: C.border },
  title:       { color: C.text, fontSize: 18, fontWeight: '800' },
  sub:         { color: C.textSub, fontSize: 13, lineHeight: 19, marginBottom: 4 },
  label:       { color: C.text, fontSize: 13, fontWeight: '700', marginTop: 6 },
  input:       { backgroundColor: C.surfaceHigh, borderRadius: R.inner, borderWidth: 1, borderColor: C.border, color: C.text, fontSize: 15, paddingHorizontal: 14, paddingVertical: 12 },
  notice:      { color: C.textSub, fontSize: 12, lineHeight: 17, marginTop: 6 },
  primaryBtn:  { backgroundColor: C.accent, borderRadius: R.pill, paddingVertical: 14, alignItems: 'center', marginTop: 8 },
  primaryText: { color: C.bg, fontWeight: '800', fontSize: 15 },
});
