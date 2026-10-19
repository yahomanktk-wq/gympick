import React, { useEffect, useState } from 'react';
import { useFonts } from 'expo-font';
import { Modal } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as Linking from 'expo-linking';
import * as SplashScreen from 'expo-splash-screen';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { AuthProvider } from './src/context/AuthContext';
import { supabase } from './src/lib/supabase';
import { fetchAppUpdateConfig, getUpdateStatus, type UpdateStatus } from './src/lib/db/appUpdate';
import AppUpdateModal from './src/components/AppUpdateModal';
import TabNavigator from './src/navigation/TabNavigator';
import WorkoutFeedScreen from './src/screens/WorkoutFeedScreen';
import WorkoutAnalyticsScreen from './src/screens/WorkoutAnalyticsScreen';
import MachineRankingScreen   from './src/screens/MachineRankingScreen';
import MachineHistoryScreen   from './src/screens/MachineHistoryScreen';
import ResetPasswordScreen from './src/screens/auth/ResetPasswordScreen';
import OnboardingScreen from './src/screens/onboarding/OnboardingScreen';
import { initAnalytics, track } from './src/lib/analytics';
import { perfStart, perfEnd } from './src/lib/perf';

const Stack = createNativeStackNavigator();
initAnalytics();

SplashScreen.preventAutoHideAsync();

// 2026-10-16: 모듈이 처음 평가되는 시점(JS 번들 로드 직후)을 콜드스타트
// 측정 시작점으로 잡는다 — 스플래시가 실제로 사라지는 시점까지의 총
// 소요시간을 보기 위함.
perfStart('App:coldstart_total');

export default function App() {
  React.useEffect(() => {
    track('app_open');
  }, []);

  const [showResetPassword, setShowResetPassword] = useState(false);
  const [appReady, setAppReady] = useState(false);
  const [onboardingDone, setOnboardingDone] = useState<boolean | null>(null);

  // --- 업데이트 안내 팝업 (강제/권장) ---
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>('none');
  const [updateMessage, setUpdateMessage] = useState<string | undefined>(undefined);
  const [updateDismissed, setUpdateDismissed] = useState(false);

  useEffect(() => {
    (async () => {
      perfStart('App:fetchAppUpdateConfig');
      const config = await fetchAppUpdateConfig();
      perfEnd('App:fetchAppUpdateConfig');
      if (!config) return; // 설정 없음/네트워크 오류 → 조용히 체크 스킵
      const currentVersion = Constants.expoConfig?.version ?? '0.0.0';
      setUpdateStatus(getUpdateStatus(currentVersion, config));
      setUpdateMessage(config.message);
    })();
  }, []);

  const [fontsLoaded] = useFonts({
    'KCC-Ganpan':            require('./assets/fonts/kcc_ganpan.ttf'),
    'Mat Saleh':             require('./assets/fonts/mat_saleh.ttf'),
    'Matcha Cih':            require('./assets/fonts/matcha_cih.ttf'),
    'Quicksilver-Italic':    require('./assets/fonts/quicksilver_italic.ttf'),
    'SportypoReguler':       require('./assets/fonts/sportypo_reguler_demo.ttf'),
    'Stadium1956-Regular':   require('./assets/fonts/stadium1956_regular.otf'),
    'Vdevaca-Bold':          require('./assets/fonts/v_de_vacia_defharo.ttf'),
    'BlackwoodCastle':       require('./assets/fonts/blacc.ttf'),
    'BlackwoodCastleShadow': require('./assets/fonts/blaccs.ttf'),
    'CollegeBoy':            require('./assets/fonts/college_boy.otf'),
    'Flamer':                require('./assets/fonts/flamer.ttf'),
    'HeavyHeapRg-Regular':   require('./assets/fonts/heavy_heap_rg.otf'),
    'Honfleur-Heavy':        require('./assets/fonts/honfleur_heavy.otf'),
    'BasicFont':             require('./assets/fonts/basif.ttf'),
    'Abrakadaboom':          require('./assets/fonts/abrakadaboom.ttf'),
    'KERISKEDU_Line':        require('./assets/fonts/keriskedu_line.ttf'),
    'HeirofLightRegular':    require('./assets/fonts/heiroflightregular.ttf'),
    'BMkkubulimTTF-Regular': require('./assets/fonts/bmkkubulim.ttf'),
    'biergartenlt':          require('./assets/fonts/biergartenlt.ttf'),
    ...((() => {
      try {
        return { 'Oklahoma': require('./assets/fonts/oklahoma.ttf') };
      } catch {
        return {};
      }
    })()),
  });

  useEffect(() => {
    const prepare = async () => {
      perfStart('App:onboarding_check');
      try {
        // AsyncStorage 읽기에 최대 3초 timeout 적용
        const val = await Promise.race([
          AsyncStorage.getItem('onboarding_completed'),
          new Promise<null>(resolve => setTimeout(() => resolve(null), 3000)),
        ]);
        setOnboardingDone(val === 'true');
      } catch {
        // 읽기 실패 시 온보딩 완료로 처리 (기존 유저 보호)
        setOnboardingDone(true);
      } finally {
        perfEnd('App:onboarding_check');
        // 최소 1초 스플래시 유지 보장
        perfStart('App:min_splash_wait');
        await new Promise(resolve => setTimeout(resolve, 1000));
        perfEnd('App:min_splash_wait');
        setAppReady(true);
        try {
          await SplashScreen.hideAsync();
        } catch {}
      }
    };
    prepare();
  }, []);

  // 2026-10-16: appReady/onboardingDone/fontsLoaded 셋 다 갖춰져 실제로
  // 스플래시가 사라지는(아래 return null 가드를 벗어나는) 시점에 콜드스타트
  // 총 소요시간을 1회만 찍는다.
  const coldstartLogged = React.useRef(false);
  useEffect(() => {
    if (coldstartLogged.current) return;
    if (appReady && onboardingDone !== null && fontsLoaded) {
      coldstartLogged.current = true;
      perfEnd('App:coldstart_total');
    }
  }, [appReady, onboardingDone, fontsLoaded]);

  useEffect(() => {
    // 앱이 열려있는 상태에서 딥링크 수신
    const subscription = Linking.addEventListener('url', handleDeepLink);

    // 앱이 종료된 상태에서 딥링크로 열린 경우
    Linking.getInitialURL().then(url => {
      if (url) handleDeepLink({ url });
    });

    return () => subscription.remove();
  }, []);

  async function handleDeepLink({ url }: { url: string }) {
    if (!url) return;

    // gympick://reset-password?... 형태 처리
    if (!url.includes('reset-password')) return;

    // URL에서 토큰 파싱
    // Supabase가 보내는 링크: gympick://reset-password#access_token=...&refresh_token=...
    const hashPart = url.split('#')[1] ?? url.split('?')[1] ?? '';
    const params = new URLSearchParams(hashPart);

    const accessToken  = params.get('access_token');
    const refreshToken = params.get('refresh_token');

    if (accessToken && refreshToken) {
      // Supabase 세션 설정
      const { error } = await supabase.auth.setSession({
        access_token:  accessToken,
        refresh_token: refreshToken,
      });

      if (!error) {
        setShowResetPassword(true);
      }
    }
  }

  if (!appReady || onboardingDone === null || !fontsLoaded) return null;

  return (
    <AuthProvider>
      <SafeAreaProvider>
        <NavigationContainer>
          <Stack.Navigator screenOptions={{ headerShown: false, gestureEnabled: false }}>
            {!onboardingDone ? (
              <Stack.Screen name="Onboarding" component={OnboardingScreen} />
            ) : null}
            <Stack.Screen name="Main"              component={TabNavigator}            options={{ gestureEnabled: false }} />
            <Stack.Screen name="WorkoutFeed"      component={WorkoutFeedScreen}       options={{ gestureEnabled: true, fullScreenGestureEnabled: true }} />
            <Stack.Screen name="WorkoutAnalytics" component={WorkoutAnalyticsScreen}  options={{ gestureEnabled: true, fullScreenGestureEnabled: true }} />
            <Stack.Screen name="MachineRanking"   component={MachineRankingScreen}    options={{ gestureEnabled: true, fullScreenGestureEnabled: true }} />
            <Stack.Screen name="MachineHistory"   component={MachineHistoryScreen}    options={{ gestureEnabled: true, fullScreenGestureEnabled: true }} />
          </Stack.Navigator>
        </NavigationContainer>

        {/* 비밀번호 재설정 화면 (딥링크로 진입 시) */}
        <Modal
          visible={showResetPassword}
          animationType="slide"
          onRequestClose={() => setShowResetPassword(false)}
        >
          <ResetPasswordScreen
            onComplete={() => {
              setShowResetPassword(false);
              // 로그아웃 처리 (새 비밀번호로 다시 로그인 유도)
              supabase.auth.signOut();
            }}
          />
        </Modal>

        <AppUpdateModal
          visible={updateStatus === 'required' || (updateStatus === 'recommended' && !updateDismissed)}
          required={updateStatus === 'required'}
          message={updateMessage}
          onDismiss={() => setUpdateDismissed(true)}
        />

        <StatusBar style="light" />
      </SafeAreaProvider>
    </AuthProvider>
  );
}
