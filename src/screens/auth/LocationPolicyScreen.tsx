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
import { C, R } from '../../theme';

interface Props {
  onClose: () => void;
}

interface Section {
  title: string;
  items: string[];
}

const SECTIONS: Section[] = [
  {
    title: '1. 위치정보 수집 항목',
    items: [
      'GPS 기반 현재 위치 (위도, 경도)',
      '위치 정보는 앱 사용 중(포그라운드)에만 수집됩니다',
      '백그라운드에서는 위치 정보를 수집하지 않습니다',
    ],
  },
  {
    title: '2. 위치정보 수집 및 이용 목적',
    items: [
      '주변 헬스장 탐색 및 거리 계산',
      '내 위치 기반 헬스장 추천',
      '위치 정보는 위 목적 외에 사용되지 않습니다',
    ],
  },
  {
    title: '3. 위치정보 보유 및 이용 기간',
    items: [
      '위치 정보는 서버에 저장되지 않습니다',
      '앱 사용 중 일시적으로만 사용되며 즉시 파기됩니다',
    ],
  },
  {
    title: '4. 위치정보의 제3자 제공',
    items: [
      'GymPick은 위치 정보를 제3자에게 제공하지 않습니다',
      '단, 법령에 의거하거나 수사기관의 요청이 있는 경우는 예외입니다',
    ],
  },
  {
    title: '5. 동의 거부 권리',
    items: [
      '위치정보 수집·이용에 동의하지 않을 권리가 있습니다',
      '동의를 거부하는 경우 주변 헬스장 탐색 기능 이용이 제한됩니다',
      '그 외 운동 기록, 오운완 등 다른 기능은 정상 이용 가능합니다',
    ],
  },
  {
    title: '6. 위치정보 관련 문의',
    items: [
      '문의: gympick.official@gmail.com',
    ],
  },
];

export default function LocationPolicyScreen({ onClose }: Props) {
  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />

      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={onClose} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={22} color={C.text} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>위치정보 수집·이용 동의</Text>
        <View style={s.headerSpacer} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.scroll}
      >
        <Text style={s.intro}>
          GymPick은 더 나은 헬스장 탐색 서비스를 제공하기 위해 위치 정보를 수집합니다.
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

        <View style={s.infoCard}>
          <Text style={s.infoLabel}>서비스명</Text>
          <Text style={s.infoValue}>GymPick</Text>
          <View style={s.infoDivider} />
          <Text style={s.infoLabel}>이메일</Text>
          <Text style={s.infoValue}>gympick.official@gmail.com</Text>
          <View style={s.infoDivider} />
          <Text style={s.infoLabel}>시행일</Text>
          <Text style={s.infoValue}>2026년 3월 20일</Text>
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
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal: 8,
    paddingVertical:   12,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  backBtn: {
    width:          40,
    height:         40,
    alignItems:     'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex:          1,
    textAlign:     'center',
    fontSize:      16,
    fontWeight:    '800',
    color:         C.text,
    letterSpacing: -0.3,
  },
  headerSpacer: { width: 40 },

  intro: {
    fontSize:     14,
    color:        C.textSub,
    lineHeight:   22,
    marginTop:    20,
    marginBottom: 16,
  },

  card: {
    backgroundColor: C.surface,
    borderRadius:    R.card,
    padding:         16,
    marginBottom:    12,
    borderWidth:     1,
    borderColor:     C.border,
  },
  sectionTitle: {
    fontSize:      14,
    fontWeight:    '800',
    color:         C.text,
    marginBottom:  12,
    letterSpacing: -0.2,
  },
  itemRow: {
    flexDirection: 'row',
    gap:           8,
    marginBottom:  8,
  },
  bullet: {
    fontSize:   13,
    color:      C.accent,
    lineHeight: 20,
    fontWeight: '700',
  },
  itemText: {
    flex:       1,
    fontSize:   13,
    color:      C.textSub,
    lineHeight: 20,
  },

  infoCard: {
    backgroundColor: C.surface,
    borderRadius:    R.card,
    padding:         16,
    marginBottom:    20,
    borderWidth:     1,
    borderColor:     C.border,
  },
  infoLabel: {
    fontSize:      11,
    fontWeight:    '700',
    color:         C.textDim,
    letterSpacing: 0.8,
    marginBottom:  4,
  },
  infoValue: {
    fontSize:   14,
    fontWeight: '600',
    color:      C.text,
  },
  infoDivider: {
    height:          1,
    backgroundColor: C.border,
    marginVertical:  12,
  },

  lastUpdated: {
    fontSize:     12,
    color:        C.textDim,
    textAlign:    'center',
    marginBottom: 16,
  },
});
