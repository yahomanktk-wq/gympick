import React, { useState, useEffect } from 'react';
import { SafeAreaView, StatusBar, StyleSheet } from 'react-native';
import { C } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import { fetchSplitConfig } from '../../lib/db/splitRoutine';
import { supabase } from '../../lib/supabase';
import SignInScreen          from './SignInScreen';
import SignUpScreen          from './SignUpScreen';
import VerifyScreen          from './VerifyScreen';
import TermsConsentScreen    from './TermsConsentScreen';
import ForgotPasswordScreen  from './ForgotPasswordScreen';
import WorkoutSplitSetupScreen from '../flow/WorkoutSplitSetupScreen';

type Page = 'terms' | 'signin' | 'signup' | 'verify' | 'split-setup' | 'forgot-password';

interface Props {
  initialPage?: Exclude<Page, 'split-setup' | 'terms' | 'forgot-password'>;
  onComplete?:  () => void;
}

export default function AuthFlow({ initialPage = 'signin', onComplete }: Props) {
  const [page, setPage] = useState<Page>(initialPage);
  const { user } = useAuth();

  // 로그인 완료 후: terms_agreed_at 확인 → 약관 or split-setup or 완료
  useEffect(() => {
    if (!user?.id) return;

    const run = async () => {
      const { data: profile } = await supabase
        .from('profiles')
        .select('terms_agreed_at, workout_split, split_current_index, split_type')
        .eq('id', user.id)
        .single();

      if (!profile?.terms_agreed_at) {
        // 소셜 신규 유저 → 약관 화면
        setPage('terms');
        return;
      }

      // 기존 유저 → split-setup 또는 완료
      const isEmpty =
        !profile.workout_split ||
        (Array.isArray(profile.workout_split) && profile.workout_split.length === 0);

      if (isEmpty) {
        setPage('split-setup');
      } else {
        onComplete?.();
      }
    };

    run().catch(() => { onComplete?.(); });
  }, [user?.id]);

  // 소셜 신규 유저 약관 화면
  if (page === 'terms' && user) {
    return (
      <TermsConsentScreen
        onComplete={async (marketingAgreed) => {
          await supabase.from('profiles').update({
            terms_agreed_at:  new Date().toISOString(),
            location_agreed:  true,
            marketing_agreed: marketingAgreed,
          }).eq('id', user.id);

          const config = await fetchSplitConfig(user.id).catch(() => null);
          const isEmpty =
            !config ||
            (Array.isArray(config.workoutSplit) && config.workoutSplit.length === 0);
          if (isEmpty) {
            setPage('split-setup');
          } else {
            onComplete?.();
          }
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

      {page === 'forgot-password' ? (
        <ForgotPasswordScreen onBack={() => setPage('signin')} />
      ) : page === 'signup' ? (
        <SignUpScreen
          onBack={() => setPage('signin')}
          onVerification={() => setPage('verify')}
        />
      ) : page === 'verify' ? (
        <VerifyScreen onBack={() => setPage('signin')} />
      ) : (
        <SignInScreen
          onSignUp={() => setPage('signup')}
          onForgotPassword={() => setPage('forgot-password')}
        />
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
});
