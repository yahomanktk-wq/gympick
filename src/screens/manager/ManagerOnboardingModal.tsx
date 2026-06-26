import React, { useRef, useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { C, R } from '../../theme';
import { MANAGER_ONBOARDING_SLIDES } from '../../data/managerManual';

const { width: SCREEN_W } = Dimensions.get('window');

export default function ManagerOnboardingModal({
  visible,
  onComplete,
  onFinish,
}: {
  visible:    boolean;
  onComplete: () => void;
  onFinish?:  () => void;
}) {
  const scrollRef = useRef<ScrollView>(null);
  const [index, setIndex] = useState(0);
  const slides = MANAGER_ONBOARDING_SLIDES;
  const isLast = index >= slides.length - 1;

  function goNext() {
    if (isLast) { onComplete(); onFinish?.(); return; }
    const next = index + 1;
    scrollRef.current?.scrollTo({ x: next * SCREEN_W, animated: true });
    setIndex(next);
  }

  function onMomentumEnd(e: any) {
    const x = e.nativeEvent.contentOffset.x;
    setIndex(Math.round(x / SCREEN_W));
  }

  return (
    <Modal visible={visible} animationType="fade" onRequestClose={onComplete}>
      <SafeAreaView style={styles.safe}>
        {/* 건너뛰기 */}
        <View style={styles.topBar}>
          <TouchableOpacity onPress={onComplete} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={styles.skip}>건너뛰기</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={onMomentumEnd}
          style={{ flex: 1 }}
        >
          {slides.map((s, i) => (
            <View key={i} style={[styles.slide, { width: SCREEN_W }]}>
              <View style={styles.iconCircle}>
                <Ionicons name={s.icon} size={48} color={C.accent} />
              </View>
              <Text style={styles.title}>{s.title}</Text>
              <Text style={styles.body}>{s.body}</Text>
            </View>
          ))}
        </ScrollView>

        {/* 페이지 닷 */}
        <View style={styles.dots}>
          {slides.map((_, i) => (
            <View key={i} style={[styles.dot, i === index && styles.dotActive]} />
          ))}
        </View>

        {/* 버튼 */}
        <View style={styles.footer}>
          <TouchableOpacity style={styles.cta} onPress={goNext} activeOpacity={0.85}>
            <Text style={styles.ctaText}>{isLast ? '시작하기' : '다음'}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: C.bg },
  topBar:  { flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: 20, paddingTop: 8, height: 36 },
  skip:    { fontSize: 14, fontWeight: '600', color: C.textSub },
  slide:   { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  iconCircle: {
    width: 96, height: 96, borderRadius: 48,
    backgroundColor: C.accentBg,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 32,
  },
  title:   { fontSize: 25, fontWeight: '900', color: C.text, textAlign: 'center', marginBottom: 18, letterSpacing: -0.5 },
  body:    { fontSize: 17, color: C.textSub, textAlign: 'center', lineHeight: 28 },
  dots:    { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 16 },
  dot:     { width: 7, height: 7, borderRadius: 4, backgroundColor: C.border },
  dotActive: { width: 20, backgroundColor: C.accent },
  footer:  { paddingHorizontal: 20, paddingBottom: 16 },
  cta:     { backgroundColor: C.accent, borderRadius: R.btn, paddingVertical: 16, alignItems: 'center' },
  ctaText: { fontSize: 16, fontWeight: '800', color: C.bg },
});
