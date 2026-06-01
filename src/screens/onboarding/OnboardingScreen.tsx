import React, { useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  Animated,
  Easing,
  PanResponder,
  Image,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import GymPickLogo from '../../components/GymPickLogo';

const { width: SW } = Dimensions.get('window');
const LIME = '#C6FF00';

// TODO: replace with actual screenshot
const IMGS = {
  find:      require('../../assets/onboarding/slide_02_find.png'),
  record:    require('../../assets/onboarding/slide_03_record.png'),
  community: require('../../assets/onboarding/slide_04_community.png'),
};

const SLIDES = [
  {
    key: 'welcome',
    mainText: '헬스장 갈 때,\n픽하고 기록하자',
    subText: '머신 중심 헬스 플랫폼',
    btnLabel: '시작하기',
  },
  {
    key: 'find',
    tag: 'FIND',
    mainText: '내 머신이 있는 헬스장 찾기',
    subText: '없는 헬스장이나 머신 정보가 다르면\n직접 제보할 수 있어요',
    btnLabel: '다음 →',
    image: IMGS.find,
  },
  {
    key: 'record',
    tag: 'RECORD',
    mainText: '머신으로 기록,\n오운완으로 마무리',
    subText: '나만의 인증샷 템플릿으로 완성해요',
    btnLabel: '다음 →',
    image: IMGS.record,
  },
  {
    key: 'community',
    tag: 'COMMUNITY',
    mainText: '다른 사람들의 루틴 구경하기',
    subText: '오운완 · 루틴 · 머신 사용법\n보고 따라하고 공유해요',
    btnLabel: '다음 →',
    image: IMGS.community,
  },
  {
    key: 'complete',
    mainText: '짐픽을 시작할 준비가 됐어요',
    subText: '머신 기준으로 헬스장을 탐색하고\n운동을 기록해보세요',
    btnLabel: '짐픽 시작하기',
  },
] as const;

export default function OnboardingScreen({ navigation }: { navigation: any }) {
  const insets = useSafeAreaInsets();
  const [current, setCurrent]   = useState(0);
  const [incoming, setIncoming] = useState<number | null>(null);
  const currentRef   = useRef(0);
  const transitioning = useRef(false);

  const outOpacity   = useRef(new Animated.Value(1)).current;
  const inTranslateX = useRef(new Animated.Value(SW)).current;
  const btnScale     = useRef(new Animated.Value(1)).current;
  const checkScale   = useRef(new Animated.Value(0)).current;
  const textFade     = useRef(new Animated.Value(0)).current;
  const dotAnims     = useRef([0, 1, 2, 3].map(() => new Animated.Value(6))).current;

  const animateDots = useCallback((to: number) => {
    if (to < 1) return;
    Animated.parallel(
      dotAnims.map((a, i) =>
        Animated.timing(a, { toValue: i === to - 1 ? 20 : 6, duration: 200, useNativeDriver: false })
      )
    ).start();
  }, [dotAnims]);

  const goToSlide = useCallback((next: number) => {
    if (transitioning.current) return;
    transitioning.current = true;
    inTranslateX.setValue(SW);
    setIncoming(next);

    requestAnimationFrame(() => {
      Animated.parallel([
        Animated.timing(outOpacity, {
          toValue: 0,
          duration: 280,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(inTranslateX, {
          toValue: 0,
          duration: 280,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start(() => {
        currentRef.current = next;
        setCurrent(next);
        setIncoming(null);
        outOpacity.setValue(1);
        transitioning.current = false;
        animateDots(next);

        if (next === 4) {
          checkScale.setValue(0);
          textFade.setValue(0);
          Animated.sequence([
            Animated.delay(200),
            Animated.spring(checkScale, { toValue: 1.1, useNativeDriver: true, tension: 120, friction: 8 }),
          ]).start(() => {
            Animated.spring(checkScale, { toValue: 1.0, useNativeDriver: true }).start();
          });
          Animated.sequence([
            Animated.delay(300),
            Animated.timing(textFade, { toValue: 1, duration: 300, useNativeDriver: true }),
          ]).start();
        }
      });
    });
  }, [animateDots, outOpacity, inTranslateX, checkScale, textFade]);

  const goToSlideRef = useRef(goToSlide);
  goToSlideRef.current = goToSlide;

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, { dx, dy }) =>
        Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy),
      onPanResponderRelease: (_, { dx }) => {
        const cur = currentRef.current;
        if (dx < -50 && cur < 4) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          goToSlideRef.current(cur + 1);
        } else if (dx > 50 && cur >= 2 && cur <= 4) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          goToSlideRef.current(cur - 1);
        }
      },
    })
  ).current;

  async function complete() {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await AsyncStorage.setItem('onboarding_completed', 'true');
    navigation.reset({ index: 0, routes: [{ name: 'Main' }] });
  }

  async function skip() {
    await AsyncStorage.setItem('onboarding_completed', 'true');
    navigation.reset({ index: 0, routes: [{ name: 'Main' }] });
  }

  function onBtnPress() {
    const cur = currentRef.current;
    if (cur === 4) { complete(); return; }
    if (cur > 0) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    goToSlide(cur + 1);
  }

  function renderContent(idx: number) {
    const slide = SLIDES[idx];

    if (slide.key === 'welcome') {
      return (
        <View style={[ss.fill, ss.center]} pointerEvents="box-none">
          <TouchableOpacity
            style={[ss.skipBtn, { top: insets.top + 12 }]}
            onPress={skip}
            activeOpacity={0.7}
          >
            <Text style={ss.skipTxt}>건너뛰기</Text>
          </TouchableOpacity>
          <GymPickLogo color="#ffffff" height={36} />
          <View style={{ height: 40 }} />
          <Text style={ss.welcomeMain}>{slide.mainText}</Text>
          <Text style={ss.welcomeSub}>{slide.subText}</Text>
        </View>
      );
    }

    if (slide.key === 'complete') {
      return (
        <View style={[ss.fill, ss.center]}>
          <Animated.View style={{ transform: [{ scale: checkScale }] }}>
            <Ionicons name="checkmark-circle" size={64} color={LIME} />
          </Animated.View>
          <Animated.View style={[ss.completeTextWrap, { opacity: textFade }]}>
            <Text style={ss.completeMain}>{slide.mainText}</Text>
            <Text style={ss.completeSub}>{slide.subText}</Text>
          </Animated.View>
        </View>
      );
    }

    // Image slides (find / record / community)
    const s = slide as typeof SLIDES[1];
    return (
      <View style={ss.fill}>
        <Image source={s.image} style={StyleSheet.absoluteFill} resizeMode="cover" />
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.97)']}
          style={ss.gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
        />
        <View style={[ss.imgBottom, { paddingBottom: 100 + insets.bottom }]}>
          <Text style={ss.tag}>{s.tag}</Text>
          <Text style={ss.imgMain}>{slide.mainText}</Text>
          <Text style={ss.imgSub}>{slide.subText}</Text>
        </View>
      </View>
    );
  }

  const activeDot = current - 1;

  return (
    <View style={ss.root} {...panResponder.panHandlers}>
      <StatusBar barStyle="light-content" backgroundColor="#000000" translucent />

      {/* Outgoing layer */}
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: outOpacity }]}>
        {renderContent(current)}
      </Animated.View>

      {/* Incoming layer */}
      {incoming !== null && (
        <Animated.View
          style={[StyleSheet.absoluteFill, { transform: [{ translateX: inTranslateX }] }]}
        >
          {renderContent(incoming)}
        </Animated.View>
      )}

      {/* Dot indicator (slides 2–5, i.e. index 1–4) */}
      {current > 0 && (
        <View style={ss.dotsWrap} pointerEvents="none">
          {dotAnims.map((anim, i) => (
            <Animated.View
              key={i}
              style={[
                ss.dot,
                {
                  width: anim,
                  backgroundColor: i === activeDot ? '#ffffff' : '#444444',
                },
              ]}
            />
          ))}
        </View>
      )}

      {/* CTA bar */}
      <View style={[ss.ctaBar, { paddingBottom: insets.bottom + 16 }]}>
        <Animated.View style={{ transform: [{ scale: btnScale }] }}>
          <TouchableOpacity
            style={ss.btn}
            onPress={onBtnPress}
            onPressIn={() =>
              Animated.spring(btnScale, { toValue: 0.96, useNativeDriver: true }).start()
            }
            onPressOut={() =>
              Animated.spring(btnScale, { toValue: 1.0, useNativeDriver: true }).start()
            }
            activeOpacity={1}
          >
            <Text style={ss.btnTxt}>{SLIDES[current].btnLabel}</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </View>
  );
}

const ss = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000000',
  },
  fill: {
    flex: 1,
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },

  // Skip button
  skipBtn: {
    position: 'absolute',
    right: 20,
    zIndex: 10,
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  skipTxt: {
    fontSize: 13,
    color: '#888888',
  },

  // Welcome slide
  welcomeMain: {
    fontSize: 28,
    fontWeight: '700',
    color: '#ffffff',
    textAlign: 'center',
    lineHeight: 38,
    marginBottom: 12,
  },
  welcomeSub: {
    fontSize: 15,
    color: '#888888',
    textAlign: 'center',
  },

  // Image slides
  gradient: {
    position: 'absolute',
    top: '45%',
    left: 0,
    right: 0,
    bottom: 0,
  },
  imgBottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 28,
  },
  tag: {
    fontSize: 11,
    fontWeight: '700',
    color: LIME,
    letterSpacing: 2,
    marginBottom: 12,
  },
  imgMain: {
    fontSize: 22,
    fontWeight: '700',
    color: '#ffffff',
    lineHeight: 30,
    marginBottom: 10,
  },
  imgSub: {
    fontSize: 14,
    color: '#aaaaaa',
    lineHeight: 21,
  },

  // Complete slide
  completeTextWrap: {
    alignItems: 'center',
    marginTop: 24,
  },
  completeMain: {
    fontSize: 24,
    fontWeight: '700',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 12,
  },
  completeSub: {
    fontSize: 14,
    color: '#888888',
    textAlign: 'center',
    lineHeight: 22,
  },

  // Dots
  dotsWrap: {
    position: 'absolute',
    bottom: 100,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    height: 6,
    borderRadius: 3,
  },

  // CTA bar
  ctaBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 24,
    paddingTop: 12,
    backgroundColor: 'transparent',
  },
  btn: {
    backgroundColor: LIME,
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
  },
  btnTxt: {
    fontSize: 16,
    fontWeight: '800',
    color: '#000000',
    letterSpacing: -0.3,
  },
});
