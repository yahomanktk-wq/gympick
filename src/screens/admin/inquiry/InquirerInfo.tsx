// 어드민 유저 문의 카드 상단의 작성자 정보 (닉네임 · 이메일 · 매니저면 관리 헬스장)
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { C, R } from '../../../theme';
import type { InquirerProfile } from '../../../lib/db/userInquiries';

interface Props {
  profile:         InquirerProfile | undefined;
  loading:         boolean;
  managedGymNames: string[];
}

export default function InquirerInfo({ profile, loading, managedGymNames }: Props) {
  if (!profile) {
    return (
      <View style={styles.wrap}>
        <View style={styles.row}>
          <Ionicons name="person-outline" size={11} color={C.textSub} />
          <Text style={styles.muted}>{loading ? '작성자 정보 불러오는 중…' : '작성자 정보 없음'}</Text>
        </View>
      </View>
    );
  }

  const isManager = profile.role === 'manager';

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <Ionicons name="person-outline" size={11} color={C.textSub} />
        <Text style={styles.nickname} numberOfLines={1}>{profile.nickname || '닉네임 정보 없음'}</Text>
        {isManager && (
          <View style={styles.managerBadge}>
            <Text style={styles.managerBadgeText}>매니저</Text>
          </View>
        )}
      </View>
      <View style={styles.row}>
        <Ionicons name="mail-outline" size={11} color={C.textSub} />
        <Text style={styles.muted} numberOfLines={1} ellipsizeMode="tail">{profile.email || '이메일 정보 없음'}</Text>
      </View>
      {isManager && (
        <View style={styles.row}>
          <Ionicons name="business-outline" size={11} color={C.textSub} />
          <Text style={styles.muted} numberOfLines={1} ellipsizeMode="tail">
            관리 헬스장: {managedGymNames.length > 0 ? managedGymNames.join(', ') : '없음'}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 4,
    paddingBottom: 10,
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  row:      { flexDirection: 'row', alignItems: 'center', gap: 5 },
  nickname: { flexShrink: 1, fontSize: 12, fontWeight: '700', color: C.text },
  muted:    { flexShrink: 1, fontSize: 11, color: C.textDim, fontWeight: '600' },
  managerBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: R.pill,
    backgroundColor: C.accentBg,
  },
  managerBadgeText: { fontSize: 10, fontWeight: '700', color: C.accent },
});
