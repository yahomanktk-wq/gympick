import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { C, R } from '../../theme';
import TermsOfServiceScreen from './TermsOfServiceScreen';
import PrivacyPolicyScreen  from '../PrivacyPolicyScreen';

interface Props {
  onComplete: () => void;
}

const CONSENT_ITEMS = [
  {
    id:          'terms',
    label:       '서비스 이용약관 동의',
    required:    true,
    linkLabel:   '보기',
    screen:      'terms-of-service',
    description: undefined as string | undefined,
  },
  {
    id:          'privacy',
    label:       '개인정보 처리방침 동의',
    required:    true,
    linkLabel:   '보기',
    screen:      'privacy-policy',
    description: undefined as string | undefined,
  },
  {
    id:          'location',
    label:       '위치정보 수집·이용 동의',
    required:    true,
    linkLabel:   null,
    screen:      undefined,
    description: '주변 헬스장 탐색을 위해 앱 사용 중 위치 정보를 수집합니다. 백그라운드에서는 수집하지 않습니다.',
  },
  {
    id:          'age',
    label:       '만 14세 이상입니다',
    required:    true,
    linkLabel:   null,
    screen:      undefined,
    description: undefined as string | undefined,
  },
  {
    id:          'marketing',
    label:       '마케팅 정보 수신 동의 (선택)',
    required:    false,
    linkLabel:   null,
    screen:      undefined,
    description: '새로운 헬스장, 머신 업데이트 등 유용한 정보를 받아볼 수 있습니다.',
  },
] as const;

// ── 모듈 레벨 스타일 ─────────────────────────────────────────────────────────

const checkboxWrapStyle = {
  padding:      4,
  marginRight:  10,
  alignSelf:    'flex-start' as const,
  paddingTop:   0,
};

const checkboxStyle = {
  width:           22,
  height:          22,
  borderRadius:    6,
  borderWidth:     1.5,
  borderColor:     C.border,
  backgroundColor: C.surface,
  alignItems:      'center' as const,
  justifyContent:  'center' as const,
};

const checkboxActiveStyle = {
  backgroundColor: C.accent,
  borderColor:     C.accent,
};

const consentItemStyle = {
  flexDirection:  'row' as const,
  alignItems:     'flex-start' as const,
  paddingVertical: 12,
};

const consentLabelStyle = {
  fontSize:   14,
  fontWeight: '600' as const,
  color:      C.text,
};

const consentLinkStyle = {
  fontSize:   13,
  color:      C.accent,
  fontWeight: '600' as const,
};

const consentDescStyle = {
  fontSize:   12,
  color:      C.textSub,
  marginTop:  4,
  lineHeight: 18,
};

// ── ConsentItem (모듈 레벨) ──────────────────────────────────────────────────

const ConsentItem = React.memo(({
  item,
  checked,
  onToggle,
  onPressLink,
}: {
  item:         typeof CONSENT_ITEMS[number];
  checked:      boolean;
  onToggle:     () => void;
  onPressLink?: () => void;
}) => (
  <View style={consentItemStyle}>
    <TouchableOpacity onPress={onToggle} style={checkboxWrapStyle} activeOpacity={0.7}>
      <View style={[checkboxStyle, checked && checkboxActiveStyle]}>
        {checked && <Ionicons name="checkmark" size={14} color={C.bg} />}
      </View>
    </TouchableOpacity>
    <View style={{ flex: 1 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={consentLabelStyle}>{item.label}</Text>
        {item.linkLabel && onPressLink && (
          <TouchableOpacity onPress={onPressLink} activeOpacity={0.7}>
            <Text style={consentLinkStyle}>{item.linkLabel}</Text>
          </TouchableOpacity>
        )}
      </View>
      {item.description && (
        <Text style={consentDescStyle}>{item.description}</Text>
      )}
    </View>
  </View>
));

// ── Screen ───────────────────────────────────────────────────────────────────

export default function TermsConsentScreen({ onComplete }: Props) {
  const [checked, setChecked] = useState<Record<string, boolean>>({
    terms: false, privacy: false, location: false, age: false, marketing: false,
  });
  const [showTerms,   setShowTerms]   = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);

  const allChecked      = Object.values(checked).every(Boolean);
  const requiredChecked = ['terms', 'privacy', 'location', 'age'].every(id => checked[id]);

  const toggleAll = () => {
    const next = !allChecked;
    setChecked({ terms: next, privacy: next, location: next, age: next, marketing: next });
  };

  const toggle = (id: string) => {
    setChecked(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleStart = async () => {
    if (!requiredChecked) return;
    await AsyncStorage.setItem(
      'pending_terms_agreed',
      JSON.stringify({ location: true, marketing: checked.marketing }),
    );
    onComplete();
  };

  const getLinkHandler = (item: typeof CONSENT_ITEMS[number]) => {
    if (item.screen === 'terms-of-service')  return () => setShowTerms(true);
    if (item.screen === 'privacy-policy')    return () => setShowPrivacy(true);
    return undefined;
  };

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.scroll}
      >
        {/* 상단 헤더 */}
        <View style={s.top}>
          <Text style={s.logoText}>GymPick</Text>
          <Text style={s.title}>{'서비스 시작 전\n약관에 동의해주세요'}</Text>
          <Text style={s.subtitle}>아래 약관을 확인하고 동의해주세요</Text>
        </View>

        <View style={s.card}>
          {/* 전체 동의 */}
          <TouchableOpacity
            style={s.allRow}
            onPress={toggleAll}
            activeOpacity={0.7}
          >
            <View style={[checkboxStyle, allChecked && checkboxActiveStyle]}>
              {allChecked && <Ionicons name="checkmark" size={14} color={C.bg} />}
            </View>
            <Text style={s.allLabel}>전체 동의</Text>
          </TouchableOpacity>

          <View style={s.divider} />

          {/* 동의 항목 목록 */}
          {CONSENT_ITEMS.map((item, idx) => (
            <View key={item.id}>
              <ConsentItem
                item={item}
                checked={!!checked[item.id]}
                onToggle={() => toggle(item.id)}
                onPressLink={getLinkHandler(item)}
              />
              {idx < CONSENT_ITEMS.length - 1 && <View style={s.itemDivider} />}
            </View>
          ))}
        </View>
      </ScrollView>

      {/* 하단 버튼 */}
      <View style={s.ctaBar}>
        <TouchableOpacity
          style={[s.ctaBtn, !requiredChecked && s.ctaBtnDisabled]}
          onPress={handleStart}
          activeOpacity={0.85}
          disabled={!requiredChecked}
        >
          <Text style={s.ctaBtnText}>시작하기</Text>
        </TouchableOpacity>
      </View>

      {/* 약관 모달 */}
      {showTerms && (
        <Modal animationType="slide" presentationStyle="pageSheet">
          <TermsOfServiceScreen onClose={() => setShowTerms(false)} />
        </Modal>
      )}
      {showPrivacy && (
        <Modal animationType="slide" presentationStyle="pageSheet">
          <PrivacyPolicyScreen onClose={() => setShowPrivacy(false)} />
        </Modal>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: C.bg },
  scroll: { paddingHorizontal: 20, paddingBottom: 120 },

  top: {
    alignItems:   'center',
    paddingTop:   48,
    paddingBottom: 32,
  },
  logoText: {
    fontSize:      22,
    fontWeight:    '900',
    color:         C.accent,
    letterSpacing: -0.5,
    marginBottom:  20,
  },
  title: {
    fontSize:      26,
    fontWeight:    '800',
    color:         C.text,
    textAlign:     'center',
    lineHeight:    34,
    letterSpacing: -0.5,
    marginBottom:  10,
  },
  subtitle: {
    fontSize:  14,
    color:     C.textSub,
    textAlign: 'center',
  },

  card: {
    backgroundColor: C.surface,
    borderRadius:    R.card,
    borderWidth:     1,
    borderColor:     C.border,
    paddingHorizontal: 16,
    paddingVertical:   4,
  },

  allRow: {
    flexDirection:  'row',
    alignItems:     'center',
    gap:            12,
    paddingVertical: 16,
  },
  allLabel: {
    fontSize:   16,
    fontWeight: '800',
    color:      C.text,
  },

  divider:     { height: 1, backgroundColor: C.border, marginBottom: 4 },
  itemDivider: { height: StyleSheet.hairlineWidth, backgroundColor: C.border },

  ctaBar: {
    position:          'absolute',
    bottom:            0,
    left:              0,
    right:             0,
    paddingHorizontal: 20,
    paddingVertical:   16,
    paddingBottom:     32,
    backgroundColor:   C.bg,
    borderTopWidth:    1,
    borderTopColor:    C.border,
  },
  ctaBtn: {
    backgroundColor: C.accent,
    borderRadius:    R.btn,
    height:          52,
    alignItems:      'center',
    justifyContent:  'center',
  },
  ctaBtnDisabled: { opacity: 0.4 },
  ctaBtnText: {
    fontSize:   16,
    fontWeight: '800',
    color:      C.bg,
  },
});
