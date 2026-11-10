import React, { useEffect, useState } from 'react';
import {
  Modal, View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform,
  ActivityIndicator, Alert, Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { C, R } from '../../../theme';
import { JOIN_CODE_LENGTH, isValidJoinCode, normalizeJoinCode } from '../../../lib/joinCode';
import { joinGymByCode, type JoinResult } from '../../../lib/db/gymMembers';
import QrScanModal from './QrScanModal';

// 2026-11-09: 초대 코드 입력 / QR 스캔으로 헬스장 회원 가입 (즉시 가입)
// 한글 입력 버그 방지를 위해 모듈 레벨 컴포넌트, 입력 값은 이 안에서만 관리.

interface Props {
  visible:  boolean;
  onClose:  () => void;
  onJoined: (result: JoinResult) => void;
}

export default function JoinCodeModal({ visible, onClose, onJoined }: Props) {
  const [code,     setCode]     = useState('');
  const [busy,     setBusy]     = useState(false);
  const [scanning, setScanning] = useState(false);

  useEffect(() => { if (visible) { setCode(''); setBusy(false); } }, [visible]);

  async function submit(raw: string) {
    if (busy) return;
    const value = normalizeJoinCode(raw);
    if (!isValidJoinCode(value)) {
      Alert.alert('코드를 확인해 주세요', `초대 코드는 영문·숫자 ${JOIN_CODE_LENGTH}자리예요.`);
      return;
    }
    setBusy(true);
    try {
      const result = await joinGymByCode(value);
      if (result === 'invalid') {
        Alert.alert('잘못된 코드예요', '코드가 바뀌었을 수 있어요. 헬스장에 새 코드를 확인해 주세요.');
        return;
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onJoined(result);
      onClose();
      Alert.alert(
        result.already ? '이미 회원이에요' : '회원 가입 완료',
        result.already ? `${result.gymName} 회원이에요.` : `${result.gymName} 회원이 되었어요.`,
      );
    } catch {
      Alert.alert('가입하지 못했어요', '잠시 후 다시 시도해 주세요.');
    } finally {
      setBusy(false);
    }
  }

  const ready = normalizeJoinCode(code).length === JOIN_CODE_LENGTH && !busy;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={s.backdrop} onPress={onClose}>
          <Pressable style={s.card} onPress={() => {}}>
            <Text style={s.title}>초대 코드로 가입</Text>
            <Text style={s.sub}>헬스장에서 받은 코드를 입력하거나 QR을 찍으면 바로 회원이 돼요.</Text>

            <TextInput
              value={code}
              onChangeText={t => setCode(t.toUpperCase())}
              placeholder="예: 3K4KU3"
              placeholderTextColor={C.textDim}
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={JOIN_CODE_LENGTH + 2}
              style={s.input}
              returnKeyType="done"
              onSubmitEditing={() => submit(code)}
            />

            <TouchableOpacity
              style={[s.primaryBtn, !ready && { opacity: 0.4 }]}
              disabled={!ready}
              activeOpacity={0.85}
              onPress={() => submit(code)}
            >
              {busy ? <ActivityIndicator color={C.bg} /> : <Text style={s.primaryText}>가입하기</Text>}
            </TouchableOpacity>

            <TouchableOpacity style={s.scanBtn} activeOpacity={0.8} onPress={() => setScanning(true)}>
              <Ionicons name="qr-code-outline" size={16} color={C.accent} />
              <Text style={s.scanText}>QR 찍어서 가입</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>

      <QrScanModal
        visible={scanning}
        onClose={() => setScanning(false)}
        onScanned={c => { setScanning(false); setCode(c); submit(c); }}
      />
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop:    { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 24 },
  card:        { backgroundColor: C.surface, borderRadius: R.card, padding: 22, gap: 12, borderWidth: 1, borderColor: C.border },
  title:       { color: C.text, fontSize: 18, fontWeight: '800' },
  sub:         { color: C.textSub, fontSize: 13, lineHeight: 19 },
  input:       { backgroundColor: C.surfaceHigh, borderRadius: R.inner, borderWidth: 1, borderColor: C.border, color: C.text, fontSize: 22, fontWeight: '800', letterSpacing: 6, textAlign: 'center', paddingVertical: 14, marginTop: 4 },
  primaryBtn:  { backgroundColor: C.accent, borderRadius: R.pill, paddingVertical: 14, alignItems: 'center' },
  primaryText: { color: C.bg, fontWeight: '800', fontSize: 15 },
  scanBtn:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10 },
  scanText:    { color: C.accent, fontWeight: '700', fontSize: 14 },
});
