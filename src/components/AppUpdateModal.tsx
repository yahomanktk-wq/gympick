// AppUpdateModal.tsx — 강제/권장 업데이트 안내 팝업
// App.tsx가 appUpdate.ts로 판단한 상태(required/recommended)에 따라 표시한다.
// required=true면 닫기 버튼이 없고 onRequestClose도 무시되어 강제 업데이트를 유도한다.

import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, Linking, Platform } from 'react-native';
import { C, R, S, T } from '../theme';

const IOS_APP_STORE_URL      = 'https://apps.apple.com/kr/app/gympick-짐픽/id6765884695';
const ANDROID_PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.gympick.app';

interface AppUpdateModalProps {
  visible: boolean;
  required: boolean;
  message?: string;
  onDismiss: () => void;
}

export default function AppUpdateModal({ visible, required, message, onDismiss }: AppUpdateModalProps) {
  const openStore = () => {
    const url = Platform.OS === 'ios' ? IOS_APP_STORE_URL : ANDROID_PLAY_STORE_URL;
    Linking.openURL(url).catch(() => {});
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={() => { if (!required) onDismiss(); }}
    >
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>
            {required ? '업데이트가 필요해요' : '새 버전이 나왔어요'}
          </Text>
          <Text style={styles.body}>
            {message ?? (required
              ? '원활한 이용을 위해 최신 버전으로 업데이트해주세요.'
              : '더 나은 경험을 위해 최신 버전으로 업데이트해보세요.')}
          </Text>

          <TouchableOpacity style={styles.primaryBtn} activeOpacity={0.85} onPress={openStore}>
            <Text style={styles.primaryBtnTxt}>스토어로 이동</Text>
          </TouchableOpacity>

          {!required && (
            <TouchableOpacity style={styles.secondaryBtn} activeOpacity={0.7} onPress={onDismiss}>
              <Text style={styles.secondaryBtnTxt}>다음에 하기</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: S.lg,
  },
  card: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: C.surface,
    borderRadius: R.card,
    borderWidth: 1,
    borderColor: C.border,
    padding: S.lg,
    alignItems: 'center',
  },
  title: {
    ...T.section,
    color: C.text,
    marginBottom: S.sm,
    textAlign: 'center',
  },
  body: {
    ...T.body,
    color: C.textSub,
    textAlign: 'center',
    marginBottom: S.lg,
    lineHeight: 21,
  },
  primaryBtn: {
    width: '100%',
    backgroundColor: C.accent,
    borderRadius: R.btn,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryBtnTxt: {
    ...T.label,
    color: C.bg,
    fontSize: 15,
  },
  secondaryBtn: {
    marginTop: S.sm,
    paddingVertical: 10,
  },
  secondaryBtnTxt: {
    ...T.label,
    color: C.textDim,
  },
});
