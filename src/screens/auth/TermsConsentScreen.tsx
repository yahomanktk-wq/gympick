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
import { C, R } from '../../theme';
import TermsOfServiceScreen from './TermsOfServiceScreen';
import PrivacyPolicyScreen  from '../PrivacyPolicyScreen';

interface Props {
  onComplete: (marketingAgreed: boolean) => void;
}

const CONSENT_ITEMS = [
  {
    id: 'terms', label: '서비스 이용약관 동의 (필수)',
    required: true, hasLink: true, linkLabel: '보기',
    description: null,
  },
  {
    id: 'privacy', label: '개인정보 처리방침 동의 (필수)',
    required: true, hasLink: true, linkLabel: '보기',
    description: null,
  },
  {
    id: 'location', label: '위치정보 수집·이용 동의 (필수)',
    required: true, hasLink: false, linkLabel: null,
    description: '주변 헬스장 탐색을 위해 앱 사용 중에만 위치 정보를 수집합니다. 백그라운드에서는 수집하지 않습니다.',
  },
  {
    id: 'age', label: '만 14세 이상입니다 (필수)',
    required: true, hasLink: false, linkLabel: null,
    description: null,
  },
  {
    id: 'marketing', label: '마케팅 정보 수신 동의 (선택)',
    required: false, hasLink: false, linkLabel: null,
    description: '새로운 헬스장, 머신 업데이트 등 유용한 정보를 받아볼 수 있습니다.',
  },
] as const;

// ── ConsentItem (모듈 레벨) ──────────────────────────────────────────────────

const ConsentItem = React.memo(({
  item, checked, onToggle, onPressLink,
}: {
  item:         typeof CONSENT_ITEMS[number];
  checked:      boolean;
  onToggle:     () => void;
  onPressLink?: () => void;
}) => (
  <View style={cs.itemRow}>
    <TouchableOpacity
      onPress={onToggle}
      activeOpacity={0.7}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    >
      <View style={[cs.checkbox, checked && cs.checkboxActive]}>
        {checked && <Ionicons name="checkmark" size={13} color={C.bg} />}
      </View>
    </TouchableOpacity>
    <View style={{ flex: 1 }}>
      <View style={cs.itemLabelRow}>
        <Text style={cs.itemLabel}>{item.label}</Text>
        {item.hasLink && onPressLink && (
          <TouchableOpacity onPress={onPressLink} activeOpacity={0.7}>
            <Text style={cs.itemLink}>{item.linkLabel}</Text>
          </TouchableOpacity>
        )}
      </View>
      {item.description && (
        <Text style={cs.itemDesc}>{item.description}</Text>
      )}
    </View>
  </View>
));

// ── Screen ───────────────────────────────────────────────────────────────────

export default function TermsConsentScreen({ onComplete }: Props) {
  const [checked, setChecked] = useState({
    terms: false, privacy: false, location: false, age: false, marketing: false,
  });
  const [showTerms,   setShowTerms]   = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);

  const allRequired = ['terms', 'privacy', 'location', 'age'].every(
    id => checked[id as keyof typeof checked]
  );
  const allChecked = CONSENT_ITEMS.every(
    item => checked[item.id as keyof typeof checked]
  );

  function toggleAll() {
    const next = !allChecked;
    setChecked({ terms: next, privacy: next, location: next, age: next, marketing: next });
  }

  function toggle(id: string) {
    setChecked(prev => ({ ...prev, [id]: !prev[id as keyof typeof prev] }));
  }

  return (
    <SafeAreaView style={cs.safe}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />
      <ScrollView contentContainerStyle={cs.scroll} showsVerticalScrollIndicator={false}>

        <View style={cs.header}>
          <Ionicons name="shield-checkmark-outline" size={48} color={C.accent} />
          <Text style={cs.title}>{'서비스 시작 전\n약관에 동의해주세요'}</Text>
          <Text style={cs.sub}>필수 항목에 동의하셔야 서비스를 이용할 수 있어요</Text>
        </View>

        {/* 전체 동의 */}
        <TouchableOpacity style={cs.allAgreeRow} onPress={toggleAll} activeOpacity={0.8}>
          <View style={[cs.checkbox, allChecked && cs.checkboxActive]}>
            {allChecked && <Ionicons name="checkmark" size={13} color={C.bg} />}
          </View>
          <Text style={cs.allAgreeText}>전체 동의</Text>
        </TouchableOpacity>
        <View style={cs.divider} />

        {/* 항목 목록 */}
        <View style={cs.itemsCard}>
          {CONSENT_ITEMS.map((item, idx) => (
            <React.Fragment key={item.id}>
              <ConsentItem
                item={item}
                checked={!!checked[item.id as keyof typeof checked]}
                onToggle={() => toggle(item.id)}
                onPressLink={
                  item.id === 'terms'   ? () => setShowTerms(true)   :
                  item.id === 'privacy' ? () => setShowPrivacy(true) :
                  undefined
                }
              />
              {idx < CONSENT_ITEMS.length - 1 && <View style={cs.itemDivider} />}
            </React.Fragment>
          ))}
        </View>

        <TouchableOpacity
          style={[cs.btn, !allRequired && cs.btnDisabled]}
          onPress={() => allRequired && onComplete(checked.marketing)}
          activeOpacity={0.85}
          disabled={!allRequired}
        >
          <Text style={cs.btnText}>동의하고 계속하기</Text>
        </TouchableOpacity>
      </ScrollView>

      <Modal
        visible={showTerms}
        animationType="slide"
        onRequestClose={() => setShowTerms(false)}
      >
        <TermsOfServiceScreen onClose={() => setShowTerms(false)} />
      </Modal>
      <Modal
        visible={showPrivacy}
        animationType="slide"
        onRequestClose={() => setShowPrivacy(false)}
      >
        <PrivacyPolicyScreen onClose={() => setShowPrivacy(false)} />
      </Modal>
    </SafeAreaView>
  );
}

const cs = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: C.bg },
  scroll: { paddingHorizontal: 24, paddingBottom: 48 },
  header: { alignItems: 'center', paddingTop: 48, paddingBottom: 32, gap: 12 },
  title:  {
    fontSize: 26, fontWeight: '900', color: C.text,
    textAlign: 'center', letterSpacing: -0.5, lineHeight: 34,
  },
  sub: { fontSize: 14, color: C.textSub, textAlign: 'center', lineHeight: 20 },
  allAgreeRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 16 },
  allAgreeText: { fontSize: 16, fontWeight: '800', color: C.text },
  divider: { height: 1, backgroundColor: C.border, marginBottom: 16 },
  itemsCard: {
    backgroundColor: C.surface, borderRadius: R.card,
    borderWidth: 1, borderColor: C.border, overflow: 'hidden', marginBottom: 24,
  },
  itemRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 16 },
  checkbox: {
    width: 22, height: 22, borderRadius: 6, borderWidth: 1.5,
    borderColor: C.border, backgroundColor: C.surfaceHigh,
    alignItems: 'center', justifyContent: 'center',
  },
  checkboxActive: { backgroundColor: C.accent, borderColor: C.accent },
  itemLabelRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 2,
  },
  itemLabel: { fontSize: 14, fontWeight: '600', color: C.text, flex: 1 },
  itemLink:  { fontSize: 13, color: C.accent, fontWeight: '600', marginLeft: 8 },
  itemDesc:  { fontSize: 12, color: C.textSub, lineHeight: 18, marginTop: 4 },
  itemDivider: { height: 1, backgroundColor: C.border, marginHorizontal: 16 },
  btn: {
    backgroundColor: C.accent, borderRadius: R.btn,
    paddingVertical: 16, alignItems: 'center',
  },
  btnDisabled: { opacity: 0.4 },
  btnText: { fontSize: 16, fontWeight: '800', color: C.bg },
});
