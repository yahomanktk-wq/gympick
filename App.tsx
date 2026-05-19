import React, { useEffect, useState } from 'react';
import { Modal } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as Linking from 'expo-linking';
import { AuthProvider } from './src/context/AuthContext';
import { supabase } from './src/lib/supabase';
import TabNavigator from './src/navigation/TabNavigator';
import WorkoutFeedScreen from './src/screens/WorkoutFeedScreen';
import WorkoutAnalyticsScreen from './src/screens/WorkoutAnalyticsScreen';
import MachineRankingScreen   from './src/screens/MachineRankingScreen';
import MachineHistoryScreen   from './src/screens/MachineHistoryScreen';
import ResetPasswordScreen from './src/screens/auth/ResetPasswordScreen';

const Stack = createNativeStackNavigator();

export default function App() {
  const [showResetPassword, setShowResetPassword] = useState(false);

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

  return (
    <AuthProvider>
      <SafeAreaProvider>
        <NavigationContainer>
          <Stack.Navigator screenOptions={{ headerShown: false, gestureEnabled: false }}>
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

        <StatusBar style="light" />
      </SafeAreaProvider>
    </AuthProvider>
  );
}
