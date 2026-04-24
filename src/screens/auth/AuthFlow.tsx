import React, { useState } from 'react';
import { SafeAreaView, StatusBar, StyleSheet } from 'react-native';
import { C } from '../../theme';
import SignInScreen   from './SignInScreen';
import SignUpScreen   from './SignUpScreen';
import VerifyScreen   from './VerifyScreen';

type Page = 'signin' | 'signup' | 'verify';

interface Props {
  initialPage?: Page;
}

export default function AuthFlow({ initialPage = 'signin' }: Props) {
  const [page, setPage] = useState<Page>(initialPage);

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
