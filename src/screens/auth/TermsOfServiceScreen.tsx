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

const SECTIONS = [
  {
    title: '제1조 (목적)',
    content: '이 약관은 GymPick(이하 "서비스")이 제공하는 헬스장 탐색 및 운동 기록 서비스의 이용 조건과 절차, 이용자와 서비스 간의 권리·의무 및 책임사항을 규정함을 목적으로 합니다.',
  },
  {
    title: '제2조 (이용자 자격)',
    content: '서비스는 만 14세 이상인 자가 이용할 수 있습니다. 만 14세 미만의 경우 법정대리인의 동의가 필요하며, 동의 없이 가입한 경우 서비스 이용이 제한될 수 있습니다.',
  },
  {
    title: '제3조 (계정 관리)',
    content: '• 이용자는 자신의 계정 정보를 타인에게 양도하거나 공유할 수 없습니다.\n• 계정 도용 또는 무단 사용이 발견된 경우 즉시 서비스에 신고해야 합니다.\n• 1년 이상 로그인하지 않은 계정은 사전 통보 후 휴면 처리될 수 있습니다.',
  },
  {
    title: '제4조 (게시물 및 저작권)',
    content: '• 이용자가 서비스에 게시한 운동 기록, 사진(오운완) 등의 저작권은 이용자에게 귀속됩니다.\n• 이용자는 서비스에 게시물을 올림으로써 GymPick에 해당 게시물의 서비스 내 활용 권한을 부여합니다.\n• 타인의 사진, 개인정보 등을 무단으로 게시하는 행위는 금지됩니다.\n• 서비스는 운영 정책에 위반되는 게시물을 사전 고지 없이 삭제할 수 있습니다.',
  },
  {
    title: '제5조 (서비스 정보의 정확성)',
    content: '• GymPick이 제공하는 헬스장 정보(보유 머신, 운영시간, 위치 등)는 실제와 다를 수 있습니다.\n• 서비스는 정보의 정확성을 위해 노력하나, 정보 오류로 인한 손해에 대해 책임을 지지 않습니다.\n• 오류 정보 발견 시 앱 내 제보 기능을 통해 신고해 주시기 바랍니다.',
  },
  {
    title: '제6조 (서비스 변경 및 중단)',
    content: '• 서비스는 운영상 필요에 따라 서비스 내용을 변경하거나 중단할 수 있습니다.\n• 서비스 중단 시 앱 내 공지를 통해 사전 안내드립니다.\n• 불가피한 사정(천재지변, 시스템 장애 등)으로 인한 서비스 중단에 대해서는 책임을 지지 않습니다.',
  },
  {
    title: '제7조 (금지 행위)',
    content: '• 타인의 개인정보 무단 수집 및 사용\n• 서비스의 정상적인 운영을 방해하는 행위\n• 허위 정보 등록 및 유포\n• 상업적 목적의 무단 광고 게시\n• 관련 법령을 위반하는 일체의 행위',
  },
  {
    title: '제8조 (면책 조항)',
    content: '• 서비스는 이용자 간 분쟁에 대해 개입하거나 책임을 지지 않습니다.\n• 이용자의 귀책사유로 인한 서비스 이용 장애에 대해 책임을 지지 않습니다.\n• 서비스가 제공하는 헬스장, 머신 정보는 참고용이며 실제 방문 전 확인을 권장합니다.',
  },
  {
    title: '제9조 (약관 변경)',
    content: '약관 변경 시 앱 내 공지를 통해 7일 전 안내드립니다. 변경된 약관에 동의하지 않는 경우 서비스 이용을 중단하고 탈퇴할 수 있습니다.',
  },
  {
    title: '제10조 (준거법 및 관할)',
    content: '이 약관은 대한민국 법령에 따라 해석되며, 서비스 이용과 관련한 분쟁은 대한민국 법원을 관할 법원으로 합니다.',
  },
  {
    title: '부칙',
    content: '이 약관은 2026년 3월 20일부터 시행됩니다.',
  },
];

export default function TermsOfServiceScreen({ onClose }: Props) {
  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />

      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={onClose} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={22} color={C.text} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>서비스 이용약관</Text>
        <View style={s.headerSpacer} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.scroll}
      >
        <Text style={s.intro}>
          GymPick 서비스를 이용하시기 전에 아래 약관을 반드시 읽어주시기 바랍니다.
        </Text>

        {SECTIONS.map((section) => (
          <View key={section.title} style={s.card}>
            <Text style={s.sectionTitle}>{section.title}</Text>
            <Text style={s.sectionContent}>{section.content}</Text>
          </View>
        ))}

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
    width:            40,
    height:           40,
    alignItems:       'center',
    justifyContent:   'center',
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
    marginBottom:  10,
    letterSpacing: -0.2,
  },
  sectionContent: {
    fontSize:   13,
    color:      C.textSub,
    lineHeight: 20,
  },

  lastUpdated: {
    fontSize:     12,
    color:        C.textDim,
    textAlign:    'center',
    marginBottom: 16,
  },
});
