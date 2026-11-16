import React, { useState } from 'react';
import { TouchableOpacity, Share, Alert, ActivityIndicator, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { C, R } from '../../theme';
import { fetchMyJournalPrivate, getMyJournalShareUrl } from '../../lib/db/userJournal';
import { track } from '../../lib/analytics';

// 2026-11-16: 운동일지 탭 상단 '공유' — gympick.app/u/{코드} 링크를 만들어 공유 시트로 보낸다.
// 웹페이지에는 전체 공개 오운완만 보인다. 비공개 상태면 먼저 안내.

interface Props {
  userId:   string;
  nickname: string;
}

export default function JournalShareButton({ userId, nickname }: Props) {
  const [busy, setBusy] = useState(false);

  async function share() {
    const url = await getMyJournalShareUrl();
    if (!url) {
      Alert.alert('링크를 만들지 못했어요', '잠시 후 다시 시도해 주세요.');
      return;
    }
    track('share_user_journal');
    await Share.share({ message: `${nickname}님의 짐픽 운동일지\n${url}`, url });
  }

  async function onPress() {
    if (busy) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setBusy(true);
    try {
      const isPrivate = await fetchMyJournalPrivate(userId);
      if (isPrivate) {
        Alert.alert(
          '지금은 비공개 상태예요',
          '링크를 받은 사람에게 오운완이 보이지 않아요. 프로필 > 운동일지 비공개를 끄면 보여요.',
          [
            { text: '취소', style: 'cancel' },
            { text: '그래도 공유', onPress: () => { share(); } },
          ],
        );
        return;
      }
      await share();
    } finally {
      setBusy(false);
    }
  }

  return (
    <TouchableOpacity style={s.btn} onPress={onPress} activeOpacity={0.8} accessibilityLabel="운동일지 링크 공유">
      {busy ? <ActivityIndicator size="small" color={C.text} /> : <Ionicons name="share-outline" size={18} color={C.text} />}
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  btn: {
    width: 40, height: 40, borderRadius: R.btn, alignItems: 'center', justifyContent: 'center',
    backgroundColor: C.surfaceHigh,
  },
});
