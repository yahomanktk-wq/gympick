import React, { useState, useEffect } from 'react';
import { SafeAreaView, StatusBar, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { C } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import { fetchSplitConfig } from '../../lib/db/splitRoutine';
import { supabase } from '../../lib/supabase';
import SignInScreen   from './SignInScreen';
import SignUpScreen   from './SignUpScreen';
import VerifyScreen   from './VerifyScreen';
import TermsConsentScreen  from './TermsConsentScreen';
import WorkoutSplitSetupScreen from '../flow/WorkoutSplitSetupScreen';

type Page = 'terms' | 'signin' | 'signup' | 'verify' | 'split-setup';

interface Props {
  initialPage?: Exclude<Page, 'split-setup' | 'terms'>;
  onComplete?:  () => void;
}

export default function AuthFlow({ initialPage = 'signin', onComplete }: Props) {
  const [page, setPage] = useState<Page>('terms');
  const { user } = useAuth();

  // 이미 약관에 동의한 경우 terms 화면 건너뜀
  useEffect(() => {
    AsyncStorage.getItem('terms_completed').then(val => {
      if (val === 'true') setPage(initialPage);
    });
  }, []);

  // 로그인 완료 후: 약관 Supabase 저장 + 분할 설정 확인
  useEffect(() => {
    if (!user?.id) return;

    const savePendingTerms = async () => {
      const pending = await AsyncStorage.getItem('pending_terms_agreed');
      if (pending) {
        const data = JSON.parse(pending);
        await supabase.from('profiles').update({
          terms_agreed_at:  new Date().toISOString(),
          location_agreed:  true,
          marketing_agreed: data.marketing ?? false,
        }).eq('id', user.id);
        await AsyncStorage.removeItem('pending_terms_agreed');
      }
    };
    savePendingTerms().catch(() => {});

    fetchSplitConfig(user.id)
      .then(config => {
        const isEmpty =
          !config ||
          (Array.isArray(config.workoutSplit) && config.workoutSplit.length === 0);
        if (isEmpty) {
          setPage('split-setup');
        } else {
          onComplete?.();
        }
      })
      .catch(() => { onComplete?.(); });
  }, [user?.id]);

  if (page === 'terms') {
    return (
      <TermsConsentScreen
        onComplete={() => {
          AsyncStorage.setItem('terms_completed', 'true');
          setPage('signin');
        }}
      />
    );
  }

  if (page === 'split-setup' && user) {
    return (
      <WorkoutSplitSetupScreen
        userId={user.id}
        onComplete={() => onComplete?.()}
      />
    );
  }

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />

      {page === 'signup' ? (
        <SignUpScreen
          onBack={() => setPage('signin')}
          onVerification={() => setPage('verify')}
        />
      ) : page === 'verify' ? (
        <VerifyScreen onBack={() => setPage('signin')} />
      ) : (
        <SignInScreen onSignUp={() => setPage('signup')} />
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
});
