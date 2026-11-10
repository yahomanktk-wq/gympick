import React, { useEffect, useState } from 'react';
import {
  Modal, View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, ScrollView,
  ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useKeyboardHeight } from '../../../lib/useKeyboardHeight';
import { Ionicons } from '@expo/vector-icons';
import { C, R } from '../../../theme';
import { containsBannedWord } from '../../../lib/bannedWords';
import { addGymQuestion, QNA_CONTENT_MAX, QNA_TITLE_MAX } from '../../../lib/db/gymQna';
import AttachOunwanPicker from './AttachOunwanPicker';

// 2026-11-09: Q&A 질문 쓰기 (제목 · 본문 · 내 오운완 첨부)
// 제목은 짐픽 유저 누구나 볼 수 있어서 작성 화면에 안내한다.
// 한글 입력 버그 방지를 위해 모듈 레벨 컴포넌트, 입력 값은 이 안에서만 관리.

interface Props {
  visible:  boolean;
  gymId:    string;
  userId:   string;
  onClose:  () => void;
  onPosted: () => void;
}

export default function QuestionComposeModal({ visible, gymId, userId, onClose, onPosted }: Props) {
  const [title,    setTitle]    = useState('');
  const [content,  setContent]  = useState('');
  const [attached, setAttached] = useState<string | null>(null);
  const [busy,     setBusy]     = useState(false);
  const insets = useSafeAreaInsets();
  const kbHeight = useKeyboardHeight();
  const kbPad = kbHeight > 0 ? Math.max(0, kbHeight - insets.bottom) : 0;

  useEffect(() => { if (visible) { setTitle(''); setContent(''); setAttached(null); setBusy(false); } }, [visible]);

  const ready = title.trim().length > 0 && content.trim().length > 0 && !busy;

  async function submit() {
    if (!ready) return;
    setBusy(true);
    try {
      if ((await containsBannedWord(title)) || (await containsBannedWord(content))) {
        Alert.alert('사용할 수 없는 표현이 있어요');
        return;
      }
      await addGymQuestion(gymId, title, content, attached);
      onPosted();
      onClose();
    } catch {
      Alert.alert('질문을 올리지 못했어요', '이 헬스장 회원만 질문할 수 있어요.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
        <View style={{ flex: 1, paddingBottom: kbPad }}>
          <View style={s.header}>
            <TouchableOpacity onPress={onClose} hitSlop={8}><Text style={s.cancel}>취소</Text></TouchableOpacity>
            <Text style={s.headerTitle}>질문하기</Text>
            <TouchableOpacity onPress={submit} disabled={!ready} hitSlop={8}>
              {busy ? <ActivityIndicator color={C.accent} /> : <Text style={[s.submit, !ready && { opacity: 0.35 }]}>등록</Text>}
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="제목"
              placeholderTextColor={C.textDim}
              maxLength={QNA_TITLE_MAX}
              style={s.titleInput}
            />
            <View style={s.notice}>
              <Ionicons name="eye-outline" size={13} color={C.textSub} />
              <Text style={s.noticeText}>제목은 짐픽 유저 누구나 볼 수 있어요. 본문과 답변은 이 헬스장 회원만 봐요.</Text>
            </View>

            <TextInput
              value={content}
              onChangeText={setContent}
              placeholder="운동하다 궁금한 점을 적어주세요. 트레이너와 회원들이 답해줘요."
              placeholderTextColor={C.textDim}
              maxLength={QNA_CONTENT_MAX}
              multiline
              style={s.bodyInput}
            />
            <Text style={s.count}>{content.length}/{QNA_CONTENT_MAX}</Text>

            <Text style={s.label}>내 오운완 붙이기 (선택)</Text>
            <AttachOunwanPicker userId={userId} value={attached} onChange={setAttached} />
          </ScrollView>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const s = StyleSheet.create({
  safe:        { flex: 1, backgroundColor: C.bg },
  header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.border },
  headerTitle: { color: C.text, fontSize: 16, fontWeight: '800' },
  cancel:      { color: C.textSub, fontSize: 15 },
  submit:      { color: C.accent, fontSize: 15, fontWeight: '800' },
  content:     { padding: 16, gap: 10 },
  titleInput:  { color: C.text, fontSize: 18, fontWeight: '800', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.border },
  notice:      { flexDirection: 'row', gap: 6, alignItems: 'flex-start' },
  noticeText:  { flex: 1, color: C.textSub, fontSize: 12, lineHeight: 17 },
  bodyInput:   { color: C.text, fontSize: 15, lineHeight: 22, minHeight: 160, textAlignVertical: 'top', backgroundColor: C.surface, borderRadius: R.inner, borderWidth: 1, borderColor: C.border, padding: 14, marginTop: 6 },
  count:       { color: C.textDim, fontSize: 11, textAlign: 'right' },
  label:       { color: C.text, fontSize: 13, fontWeight: '700', marginTop: 6 },
});
