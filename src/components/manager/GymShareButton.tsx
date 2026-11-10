import React, { useState } from 'react';
import { TouchableOpacity, Text, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { C } from '../../theme';
import ActionSheet from '../moderation/ActionSheet';
import { getGymShareUrl } from '../../lib/share';
import { shareGymLink } from '../../lib/shareGymLink';

// 2026-11-09: 매니저 대시보드 '보유 머신 링크 공유' — 예전 '보유머신 웹페이지 공유' + 'QR 포스터' 버튼을 하나로.
// 탭하면 QR 포스터로 저장할지, 링크를 공유(복사 포함)할지 고른다.

const SHEET_GAP_MS = 350;   // 시트가 닫힌 뒤 다음 창을 띄워야 iOS에서 안 막힌다

interface Props {
  gym:        { id: string; slug?: string | null; short_code?: string | null; name: string };
  onOpenQr:   () => void;
  style:      StyleProp<ViewStyle>;
  textStyle:  any;
}

export default function GymShareButton({ gym, onOpenQr, style, textStyle }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <TouchableOpacity
        style={style}
        onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setOpen(true); }}
        activeOpacity={0.8}
      >
        <Ionicons name="share-outline" size={14} color={C.accent} />
        <Text style={textStyle}>보유 머신 링크 공유</Text>
      </TouchableOpacity>
      <ActionSheet
        visible={open}
        title={gym.name}
        onClose={() => setOpen(false)}
        options={[
          { label: 'QR 포스터로 저장', onPress: () => setTimeout(onOpenQr, SHEET_GAP_MS) },
          { label: '링크 복사 · 공유하기', onPress: () => setTimeout(() => shareGymLink(getGymShareUrl(gym as any)), SHEET_GAP_MS) },
        ]}
      />
    </>
  );
}

export const _styles = StyleSheet.create({});
