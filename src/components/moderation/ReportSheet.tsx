import React, { useState, useEffect } from 'react';
import {
  Modal, View, Text, TextInput, TouchableOpacity, Pressable, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C, R } from '../../theme';
import {
  REPORT_REASONS, REPORT_TARGET_LABEL, reportContent,
  ReportReason, ReportTargetType,
} from '../../lib/db/moderation';

// 2026-11-04: 신고 사유 선택 시트 (오운완 / 댓글 / 후기 공용)
// 사유: 욕설·비방 / 음란·선정 / 광고·스팸 / 개인정보 노출 / 기타(직접 입력)
// 접수된 신고는 어드민이 직접 확인하고 처리한다.

export interface ReportTarget {
  type:     ReportTargetType;
  id:       string;
  userId?:  string;
}

interface Props {
  target:  ReportTarget | null;
  onClose: () => void;
}

const DETAIL_MAX = 300;

export default function ReportSheet({ target, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const [reason,  setReason]  = useState<ReportReason | null>(null);
  const [detail,  setDetail]  = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (target) { setReason(null); setDetail(''); setSending(false); }
  }, [target?.type, target?.id]);

  const needsDetail = reason === 'other';
  const canSubmit   = !!reason && (!needsDetail || detail.trim().length > 0) && !sending;

  async function submit() {
    if (!target || !reason || !canSubmit) return;
    setSending(true);
    try {
      const result = await reportContent({
        targetType:   target.type,
        targetId:     target.id,
        targetUserId: target.userId,
        reason,
        detail:       needsDetail ? detail : undefined,
      });
      onClose();
      setTimeout(() => {
        Alert.alert(
          result === 'duplicate' ? '이미 신고했어요' : '신고가 접수됐어요',
          result === 'duplicate' ? '검토 중인 신고예요.' : '운영자가 확인 후 조치할게요.',
        );
      }, 300);
    } catch {
      Alert.alert('오류', '신고를 보내지 못했어요. 잠시 후 다시 시도해주세요.');
      setSending(false);
    }
  }

  return (
    <Modal visible={!!target} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable style={s.backdrop} onPress={onClose}>
          <Pressable style={[s.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]} onPress={() => {}}>
            <Text style={s.title}>
              {target ? `${REPORT_TARGET_LABEL[target.type]} 신고` : '신고'}
            </Text>
            <Text style={s.sub}>신고 사유를 선택해주세요</Text>

            {REPORT_REASONS.map(r => {
              const active = reason === r.key;
              return (
                <TouchableOpacity
                  key={r.key}
                  style={s.reasonRow}
                  activeOpacity={0.7}
                  onPress={() => setReason(r.key)}
                >
                  <Ionicons
                    name={active ? 'radio-button-on' : 'radio-button-off'}
                    size={20}
                    color={active ? C.accent : C.textSub}
                  />
                  <Text style={[s.reasonText, active && { color: C.text }]}>{r.label}</Text>
                </TouchableOpacity>
              );
            })}

            {needsDetail && (
              <TextInput
                style={s.input}
                value={detail}
                onChangeText={t => setDetail(t.slice(0, DETAIL_MAX))}
                placeholder="신고 사유를 입력해주세요"
                placeholderTextColor={C.textDim}
                multiline
                maxLength={DETAIL_MAX}
              />
            )}

            <TouchableOpacity
              style={[s.submit, !canSubmit && { opacity: 0.4 }]}
              activeOpacity={0.8}
              disabled={!canSubmit}
              onPress={submit}
            >
              {sending
                ? <ActivityIndicator size="small" color={C.bg} />
                : <Text style={s.submitText}>신고하기</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={s.cancel} activeOpacity={0.7} onPress={onClose}>
              <Text style={s.cancelText}>취소</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop:   { flex: 1, backgroundColor: '#00000099', justifyContent: 'flex-end' },
  sheet:      {
    backgroundColor: C.surface,
    borderTopLeftRadius: R.card, borderTopRightRadius: R.card,
    paddingTop: 20, paddingHorizontal: 20,
  },
  title:      { fontSize: 17, fontWeight: '800', color: C.text },
  sub:        { fontSize: 13, color: C.textSub, marginTop: 4, marginBottom: 8 },
  reasonRow:  { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12 },
  reasonText: { fontSize: 15, fontWeight: '600', color: C.textSub },
  input:      {
    minHeight: 80, maxHeight: 140, marginTop: 4,
    backgroundColor: C.surfaceHigh, borderRadius: R.inner,
    paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 14, color: C.text, textAlignVertical: 'top',
  },
  submit:     {
    marginTop: 16, paddingVertical: 14, borderRadius: R.btn,
    backgroundColor: C.accent, alignItems: 'center',
  },
  submitText: { fontSize: 15, fontWeight: '800', color: C.bg },
  cancel:     { paddingVertical: 14, alignItems: 'center' },
  cancelText: { fontSize: 15, fontWeight: '600', color: C.textSub },
});
