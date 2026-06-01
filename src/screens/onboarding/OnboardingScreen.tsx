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
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import GymPickLogo from '../../components/GymPickLogo';

const { width: SW, height: SH } = Dimensions.get('window');
const LIME = '#C6FF00';

// TODO: replace with actual screenshots
const IMGS = {
  machine_to_gym:  require('../../assets/onboarding/slide_02_machine_to_gym.webp'),
  gym_to_machine:  require('../../assets/onboarding/slide_03_gym_to_machine.webp'),
  machine_select:  require('../../assets/onboarding/slide_04_machine_select.webp'),
  routine_input:   require('../../assets/onboarding/slide_05_routine_input.webp'),
  ounwan_create:   require('../../assets/onboarding/slide_06_ounwan_create.webp'),
  save_photobook:  require('../../assets/onboarding/slide_07_save_photobook.webp'),
  today_ounwan:    require('../../assets/onboarding/slide_08_today_ounwan.webp'),
};

type SlideType = 'welcome' | 'image' | 'complete';

interface Slide {
  type: SlideType;
  image?: any;
  btnLabel: string;
}

const SLIDES: Slide[] = [
  { type: 'welcome',  btnLabel: '시작하기' },
  { type: 'image',    btnLabel: '다음 →', image: IMGS.machine_to_gym },
  { type: 'image',    btnLabel: '다음 →', image: IMGS.gym_to_machine },
  { type: 'image',    btnLabel: '다음 →', image: IMGS.machine_select },
  { type: 'image',    btnLabel: '다음 →', image: IMGS.routine_input },
  { type: 'image',    btnLabel: '다음 →', image: IMGS.ounwan_create },
  { type: 'image',    btnLabel: '다음 →', image: IMGS.save_photobook },
  { type: 'image',    btnLabel: '다음 →', image: IMGS.today_ounwan },
  { type: 'complete', btnLabel: '짐픽 시작하기' },
];

const LAST     = SLIDES.length - 1; // 8
const DOT_COUNT = LAST - 1;         // 7 (슬라이드 2~8)

export default function OnboardingScreen({ navigation, route }: { navigation: any; route?: any }) {
  const isReview  = route?.params?.isReview === true;
  const insets    = useSafeAreaInsets();
  const [current, setCurrent] = useState(0);
  const currentRef    = useRef(0);
  const transitioning = useRef(false);

  const slideX     = useRef(new Animated.Value(0)).current;
  const btnScale   = useRef(new Animated.Value(1)).current;
  const checkScale = useRef(new Animated.Value(0)).current;
  const textFade   = useRef(new Animated.Value(0)).current;

  const dotAnims = useRef(
    Array.from({ length: DOT_COUNT }, () => new Animated.Value(6))
  ).current;

  const animateDots = useCallback((to: number) => {
    if (to < 1 || to >= LAST) return;
    const dotIdx = to - 1;
    Animated.parallel(
      dotAnims.map((a, i) =>
        Animated.timing(a, {
          toValue: i === dotIdx ? 20 : 6,
          duration: 200,
          useNativeDriver: false,
        })
      )
    ).start();
  }, [dotAnims]);

  const goToSlide = useCallback((next: number) => {
    if (transitioning.current) return;
    transitioning.current = true;

    slideX.setValue(SW);
    setCurrent(next);

    Animated.timing(slideX, {
      toValue: 0,
      duration: 260,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (!finished) return;
      currentRef.current = next;
      transitioning.current = false;

      requestAnimationFrame(() => animateDots(next));

      if (next === LAST) {
        checkScale.setValue(0);
        textFade.setValue(0);
        Animated.sequence([
          Animated.delay(150),
          Animated.spring(checkScale, {
            toValue: 1.1,
            useNativeDriver: true,
            tension: 120,
            friction: 8,
          }),
        ]).start(() => {
          Animated.spring(checkScale, { toValue: 1.0, useNativeDriver: true }).start();
        });
        Animated.sequence([
          Animated.delay(250),
          Animated.timing(textFade, { toValue: 1, duration: 280, useNativeDriver: true }),
        ]).start();
      }
    });
  }, [animateDots, slideX, checkScale, textFade]);

  const goToSlideRef = useRef(goToSlide);
  goToSlideRef.current = goToSlide;

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, { dx, dy }) =>
        Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy),
      onPanResponderRelease: (_, { dx }) => {
        const cur = currentRef.current;
        if (dx < -50 && cur < LAST) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          goToSlideRef.current(cur + 1);
        } else if (dx > 50 && cur >= 1 && cur < LAST) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          goToSlideRef.current(cur - 1);
        }
      },
    })
  ).current;

  async function complete() {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    if (isReview) {
      navigation.reset({ index: 0, routes: [{ name: 'Main' }] });
    } else {
      await AsyncStorage.setItem('onboarding_completed', 'true');
      navigation.reset({ index: 0, routes: [{ name: 'Main' }] });
    }
  }

  async function skip() {
    if (isReview) {
      navigation.goBack();
    } else {
      await AsyncStorage.setItem('onboarding_completed', 'true');
      navigation.reset({ index: 0, routes: [{ name: 'Main' }] });
    }
  }

  function onBtnPress() {
    const cur = currentRef.current;
    if (cur === LAST) { complete(); return; }
    if (cur > 0) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    goToSlide(cur + 1);
  }

  function renderContent(idx: number) {
    const slide = SLIDES[idx];

    // 1장 — 환영
    if (slide.type === 'welcome') {
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
          <Text style={ss.welcomeMain}>{'헬스장 갈 때,\n픽하고 기록하자'}</Text>
          <Text style={ss.welcomeSub}>머신 중심 헬스 플랫폼</Text>
        </View>
      );
    }

    // 마지막 — 완료
    if (slide.type === 'complete') {
      return (
        <View style={[ss.fill, ss.center]}>
          <Animated.View style={{ transform: [{ scale: checkScale }] }}>
            <Ionicons name="checkmark-circle" size={64} color={LIME} />
          </Animated.View>
          <Animated.View style={[ss.completeTextWrap, { opacity: textFade }]}>
            <Text style={ss.completeMain}>짐픽을 시작할 준비가 됐어요</Text>
            <Text style={ss.completeSub}>{'머신 기준으로 헬스장을 탐색하고\n운동을 기록해보세요'}</Text>
          </Animated.View>
        </View>
      );
    }

    // 이미지 슬라이드 — 텍스트 없이 풀스크린 이미지만
    return (
      <View style={ss.fill}>
        <Image
          source={slide.image}
          style={{ width: SW, height: SH }}
          resizeMode="cover"
        />
      </View>
    );
  }

  // 도트: 슬라이드 2~8 (index 1~7)에서만 표시
  const showDots = current > 0 && current < LAST;

  return (
    <View style={ss.root} {...panResponder.panHandlers}>
      <StatusBar barStyle="light-content" backgroundColor="#000000" translucent />

      {/* 슬라이드 레이어 */}
      <Animated.View
        style={[StyleSheet.absoluteFill, { transform: [{ translateX: slideX }] }]}
      >
        {renderContent(current)}
      </Animated.View>

      {/* 도트 인디케이터 */}
      {showDots && (
        <View style={ss.dotsWrap} pointerEvents="none">
          {dotAnims.map((anim, i) => (
            <Animated.View
              key={i}
              style={[
                ss.dot,
                {
                  width: anim,
                  backgroundColor: i === current - 1 ? '#ffffff' : '#444444',
                },
              ]}
            />
          ))}
        </View>
      )}

      {/* CTA 버튼 */}
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

  // 건너뛰기
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

  // 환영 슬라이드
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

  // 완료 슬라이드
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

  // 도트 인디케이터
  dotsWrap: {
    position: 'absolute',
    bottom: 116,
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

  // CTA 버튼
  ctaBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 24,
    paddingTop: 12,
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
