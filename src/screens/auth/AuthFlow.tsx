import React, { useState, useEffect } from 'react';
import { SafeAreaView, StatusBar, StyleSheet } from 'react-native';
import { C } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import { fetchSplitConfig } from '../../lib/db/splitRoutine';
import SignInScreen   from './SignInScreen';
import SignUpScreen   from './SignUpScreen';
import VerifyScreen   from './VerifyScreen';
import WorkoutSplitSetupScreen from '../flow/WorkoutSplitSetupScreen';

type Page = 'signin' | 'signup' | 'verify' | 'split-setup';

interface Props {
  initialPage?: Exclude<Page, 'split-setup'>;
  onComplete?:  () => void;
}

export default function AuthFlow({ initialPage = 'signin', onComplete }: Props) {
  const [page, setPage] = useState<Page>(initialPage);
  const { user } = useAuth();

  useEffect(() => {
    if (!user?.id) return;
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
      .catch(() => {
        onComplete?.();
      });
  }, [user?.id]);

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
