// 어드민 유저 문의 — 처리 완료 카드 (탭하면 펼쳐서 문의 내용·답변 전문 확인, 읽기 전용)
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { C, R } from '../../../theme';
import type { UserInquiry, InquirerProfile } from '../../../lib/db/userInquiries';
import InquirerInfo from './InquirerInfo';

interface Props {
  inquiry:         UserInquiry;
  profile:         InquirerProfile | undefined;
  profileLoading:  boolean;
  managedGymNames: string[];
  expanded:        boolean;
  onToggle:        () => void;
}

// answeredAt(ISO) → 기기 로컬 시간 "YYYY-MM-DD HH:mm"
function formatDateTime(iso: string): string | null {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function AnsweredInquiryCard({
  inquiry, profile, profileLoading, managedGymNames, expanded, onToggle,
}: Props) {
  const answeredAt = inquiry.answeredAt ? formatDateTime(inquiry.answeredAt) : null;

  return (
    <TouchableOpacity
      style={[styles.card, { opacity: expanded ? 1 : 0.6 }]}
      onPress={onToggle}
      activeOpacity={0.8}
    >
      <InquirerInfo profile={profile} loading={profileLoading} managedGymNames={managedGymNames} />
      <View style={styles.cardTop}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{inquiry.title}</Text>
          {!expanded && <Text style={styles.desc} numberOfLines={1}>{inquiry.answer}</Text>}
        </View>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>완료</Text>
        </View>
        <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={14} color={C.textDim} style={styles.chevron} />
      </View>

      {expanded && (
        <View style={styles.detail}>
          <Text style={styles.meta}>문의일 {inquiry.createdAt.slice(0, 10)}</Text>
          <View style={styles.divider} />
          <View style={styles.section}>
            <Text style={styles.label}>문의 내용</Text>
            <Text style={styles.body}>{inquiry.content}</Text>
          </View>
          <View style={styles.answerBox}>
            <Text style={styles.label}>답변</Text>
            <Text style={styles.answerText}>{inquiry.answer}</Text>
          </View>
          {answeredAt && <Text style={styles.meta}>답변일 {answeredAt}</Text>}
        </View>
      )}
    </TouchableOpacity>
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
  cardTop:   { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  title:     { fontSize: 15, fontWeight: '700', color: C.text, marginBottom: 5 },
  desc:      { fontSize: 13, color: C.textSub, lineHeight: 18 },
  badge:     { paddingHorizontal: 10, paddingVertical: 4, borderRadius: R.pill, backgroundColor: C.accentBg },
  badgeText: { fontSize: 11, fontWeight: '700', color: C.accent },
  chevron:   { marginTop: 4 },
  detail:    { marginTop: 8, gap: 10 },
  meta:      { fontSize: 11, color: C.textDim, fontWeight: '600' },
  divider:   { height: 1, backgroundColor: C.border },
  section:   { gap: 4 },
  label:     { fontSize: 11, fontWeight: '700', color: C.textDim },
  body:      { fontSize: 13, color: C.textSub, lineHeight: 18 },
  answerBox: { backgroundColor: C.surfaceHigh, borderRadius: R.inner, padding: 12, gap: 4 },
  answerText:{ fontSize: 13, color: C.text, lineHeight: 18 },
});
