import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { C, R, T } from '../theme';

interface Props {
  onClose: () => void;
}

interface Section {
  title: string;
  items: string[];
}

const SECTIONS: Section[] = [
  {
    title: '1. 수집하는 개인정보',
    items: [
      '이름, 이메일 주소 (회원가입 시)',
      '운동 기록 데이터 (운동일지 작성 시)',
      '위치 정보 (주변 헬스장 검색 시, 앱 사용 중에만 수집)',
      '기기 정보 (앱 운영 및 오류 수정 목적)',
    ],
  },
  {
    title: '2. 개인정보 수집 및 이용 목적',
    items: [
      '회원 서비스 제공 및 관리',
      '주변 헬스장 검색 기능 제공',
      '운동 기록 저장 및 분석',
      '서비스 개선 및 오류 수정',
    ],
  },
  {
    title: '3. 개인정보 보유 및 이용 기간',
    items: [
      '회원 탈퇴 시까지 보유',
      '관련 법령에 따라 일정 기간 보관이 필요한 경우 해당 기간 동안 보관',
    ],
  },
  {
    title: '4. 개인정보의 제3자 제공',
    items: [
      '짐픽은 사용자의 개인정보를 제3자에게 제공하지 않습니다.',
      '단, 법령에 의거하거나 수사기관의 요청이 있는 경우는 예외입니다.',
    ],
  },
  {
    title: '5. 위치정보 이용',
    items: [
      '위치 정보는 주변 헬스장 검색 목적으로만 사용됩니다.',
      '백그라운드에서 위치 정보를 수집하지 않습니다.',
      '앱 사용 중(포그라운드)에만 위치 정보에 접근합니다.',
    ],
  },
  {
    title: '6. 사용자의 권리',
    items: [
      '개인정보 열람, 수정, 삭제를 요청할 수 있습니다.',
      '문의: gympick.official@gmail.com',
    ],
  },
  {
    title: '7. 개인정보처리방침 변경',
    items: [
      '본 방침은 2026년 3월 20일부터 적용됩니다.',
      '변경 시 앱 내 공지를 통해 안내드립니다.',
    ],
  },
];

export default function PrivacyPolicyScreen({ onClose }: Props) {
  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />

      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={onClose} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={22} color={C.text} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>개인정보처리방침</Text>
        <View style={s.headerSpacer} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.scroll}
      >
        <Text style={s.intro}>
          GymPick(이하 "짐픽")은 사용자의 개인정보를 소중히 여기며, 관련 법령에 따라 안전하게 처리합니다.
        </Text>

        {SECTIONS.map((section) => (
          <View key={section.title} style={s.card}>
            <Text style={s.sectionTitle}>{section.title}</Text>
            {section.items.map((item, i) => (
              <View key={i} style={s.itemRow}>
                <Text style={s.bullet}>•</Text>
                <Text style={s.itemText}>{item}</Text>
              </View>
            ))}
          </View>
        ))}

        {/* Company info */}
        <View style={s.infoCard}>
          <Text style={s.infoLabel}>회사명</Text>
          <Text style={s.infoValue}>GymPick</Text>
          <View style={s.infoDivider} />
          <Text style={s.infoLabel}>이메일</Text>
          <Text style={s.infoValue}>gympick.official@gmail.com</Text>
        </View>

        <Text style={s.lastUpdated}>최종 수정일: 2026년 3월 20일</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: C.bg },
  scroll: { paddingHorizontal: 16, paddingBottom: 48 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '800',
    color: C.text,
    letterSpacing: -0.3,
  },
  headerSpacer: { width: 40 },

  intro: {
    fontSize: 14,
    color: C.textSub,
    lineHeight: 22,
    marginTop: 20,
    marginBottom: 16,
  },

  card: {
    backgroundColor: C.surface,
    borderRadius: R.card,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: C.border,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: C.text,
    marginBottom: 12,
    letterSpacing: -0.2,
  },
  itemRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  bullet: {
    fontSize: 13,
    color: C.accent,
    lineHeight: 20,
    fontWeight: '700',
  },
  itemText: {
    flex: 1,
    fontSize: 13,
    color: C.textSub,
    lineHeight: 20,
  },

  infoCard: {
    backgroundColor: C.surface,
    borderRadius: R.card,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: C.border,
  },
  infoLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: C.textDim,
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: C.text,
  },
  infoDivider: {
    height: 1,
    backgroundColor: C.border,
    marginVertical: 12,
  },

  lastUpdated: {
    fontSize: 12,
    color: C.textDim,
    textAlign: 'center',
    marginBottom: 16,
  },
});
