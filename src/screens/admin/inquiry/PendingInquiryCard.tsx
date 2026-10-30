// 어드민 유저 문의 — 답변 대기 카드 (작성자 정보 + 본문 + 답변 입력)
import React from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { C, R } from '../../../theme';
import type { UserInquiry, InquirerProfile } from '../../../lib/db/userInquiries';
import InquirerInfo from './InquirerInfo';

interface Props {
  inquiry:         UserInquiry;
  profile:         InquirerProfile | undefined;
  profileLoading:  boolean;
  managedGymNames: string[];
  draft:           string;
  onChangeDraft:   (text: string) => void;
  onSubmit:        () => void;
}

export default function PendingInquiryCard({
  inquiry, profile, profileLoading, managedGymNames, draft, onChangeDraft, onSubmit,
}: Props) {
  const canSubmit = !!draft.trim();

  return (
    <View style={styles.card}>
      <InquirerInfo profile={profile} loading={profileLoading} managedGymNames={managedGymNames} />
      <View style={styles.cardTop}>
        <View style={styles.typeIcon}>
          <Ionicons name="chatbubble-outline" size={16} color="#facc15" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{inquiry.title}</Text>
          <View style={styles.submittedRow}>
            <Ionicons name="time-outline" size={11} color={C.textSub} />
            <Text style={styles.submittedText}>{inquiry.createdAt.slice(0, 10)}</Text>
          </View>
        </View>
      </View>
      <Text style={styles.desc}>{inquiry.content}</Text>
      <TextInput
        style={styles.input}
        value={draft}
        onChangeText={onChangeDraft}
        placeholder="답변을 입력해주세요"
        placeholderTextColor={C.textDim}
        multiline
      />
      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.actionBtn, styles.resolveBtn, { opacity: canSubmit ? 1 : 0.5 }]}
          onPress={onSubmit}
          activeOpacity={0.8}
          disabled={!canSubmit}
        >
          <Ionicons name="checkmark" size={13} color={C.bg} />
          <Text style={[styles.actionText, { color: C.bg }]}>답변 등록</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: C.surface,
    borderRadius: R.card,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: C.border,
  },
  cardTop:       { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 10 },
  typeIcon:      { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: '#facc1518' },
  title:         { fontSize: 15, fontWeight: '700', color: C.text, marginBottom: 5 },
  submittedRow:  { flexDirection: 'row', alignItems: 'center', gap: 5 },
  submittedText: { fontSize: 11, color: C.textDim, fontWeight: '600' },
  desc:          { fontSize: 13, color: C.textSub, lineHeight: 18, marginBottom: 10 },
  input: {
    backgroundColor: C.surfaceHigh,
    borderRadius: R.inner,
    borderWidth: 1,
    borderColor: C.border,
    color: C.text,
    fontSize: 14,
    paddingHorizontal: 12,
    paddingVertical: 11,
    marginBottom: 4,
  },
  actions: { flexDirection: 'row', gap: 8, marginTop: 4, flexWrap: 'wrap' },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: R.pill,
    borderWidth: 1.5,
    borderColor: C.border,
  },
  resolveBtn: { backgroundColor: C.accent, borderColor: C.accent },
  actionText: { fontSize: 12, fontWeight: '700' },
});
