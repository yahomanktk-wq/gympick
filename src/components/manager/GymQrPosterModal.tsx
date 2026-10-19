import React, { forwardRef, useRef, useState } from 'react';
import { Modal, View, Text, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as MediaLibrary from 'expo-media-library';
import { captureRef } from 'react-native-view-shot';
import QRCode from 'react-native-qrcode-svg';
import { C, R } from '../../theme';
import GymPickLogo from '../GymPickLogo';
import { getGymShareUrl } from '../../lib/share';

// 2026-10-19 (F6-1): 매니저용 'QR 포스터' — 헬스장 보유머신 웹페이지
// (https://gympick.app/gym/{gymId}) QR을 담은 A4 비율 포스터를 미리 보고
// 사진첩에 저장한다. QR은 앱에서 즉석 생성하며 서버에 저장하지 않는다.
// 포스터 자체는 인쇄물이라 흰 배경/검정 글씨를 리터럴 색으로 쓴다.

const POSTER_W = 300;
const POSTER_H = 424;            // A4 비율 (1 : 1.414)
const CAPTURE_W = 1240;          // A4 @150dpi
const CAPTURE_H = 1754;
// GymPickLogo viewBox 2805 x 279
const LOGO_W = 96;              // 2026-10-20: 120 → 96 (20% 축소)
const LOGO_H = Math.round(LOGO_W * 279 / 2805);

interface Props {
  visible: boolean;
  gymId: string;
  gymName: string;
  onClose: () => void;
}

interface QrPosterProps {
  gymId: string;
  gymName: string;
}

const QrPoster = forwardRef<View, QrPosterProps>(({ gymId, gymName }, ref) => (
  <View
    ref={ref}
    collapsable={false}
    style={{
      width: POSTER_W, height: POSTER_H,
      backgroundColor: '#FFFFFF',
      padding: 28,
      alignItems: 'center', justifyContent: 'center',
      gap: 16,
    }}
  >
    <GymPickLogo color="#000000" width={LOGO_W} height={LOGO_H} />
    <Text
      style={{ fontSize: 22, fontWeight: '800', color: '#000000', textAlign: 'center' }}
      numberOfLines={2}
    >
      {gymName}
    </Text>
    <QRCode
      value={getGymShareUrl(gymId)}
      size={190}
      color="#000000"
      backgroundColor="#FFFFFF"
      ecl="M"
    />
    <Text style={{ fontSize: 13, color: '#333333', textAlign: 'center' }}>
      헬스장의 보유 머신을 확인해 보세요
    </Text>
    <Text style={{ fontSize: 11, color: '#777777' }}>gympick.app</Text>
  </View>
));

export default function GymQrPosterModal({ visible, gymId, gymName, onClose }: Props) {
  const posterRef = useRef<View>(null);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (saving || !posterRef.current) return;
    setSaving(true);
    try {
      // 사진첩에 '쓰기'만 필요하므로 writeOnly 권한으로 요청
      const perm = await MediaLibrary.requestPermissionsAsync(true);
      if (!perm.granted) {
        Alert.alert('사진 접근 권한이 필요해요');
        return;
      }
      // Android는 width/height를 명시하지 않으면 해상도 지정이 무시되므로 양 플랫폼 모두 명시
      const uri = await captureRef(posterRef, {
        format: 'png', quality: 1, result: 'tmpfile',
        width: CAPTURE_W, height: CAPTURE_H,
      });
      await MediaLibrary.saveToLibraryAsync(uri);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('저장 완료', '사진첩에 저장했어요. 출력해서 헬스장에 붙여주세요.');
    } catch (e) {
      if (__DEV__) console.warn('[GymQrPosterModal] save error:', e);
      Alert.alert('저장 실패', '다시 시도해 주세요.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={['top', 'bottom']}>
        {/* 헤더 */}
        <View style={{
          flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
          paddingHorizontal: 16, paddingVertical: 12,
          borderBottomWidth: 1, borderBottomColor: C.border,
        }}>
          <Text style={{ fontSize: 17, fontWeight: '800', color: C.text }}>QR 포스터</Text>
          <TouchableOpacity onPress={onClose} hitSlop={8} activeOpacity={0.7}>
            <Ionicons name="close" size={22} color={C.textSub} />
          </TouchableOpacity>
        </View>

        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 }}>
          {/* 종이처럼 보이도록 얇은 테두리 */}
          <View style={{ borderWidth: 1, borderColor: C.border }}>
            <QrPoster ref={posterRef} gymId={gymId} gymName={gymName} />
          </View>
        </View>

        <View style={{ paddingHorizontal: 16, paddingBottom: 16, gap: 10 }}>
          <TouchableOpacity
            style={{
              height: 52, borderRadius: R.btn,
              backgroundColor: C.accent,
              alignItems: 'center', justifyContent: 'center',
              opacity: saving ? 0.6 : 1,
            }}
            onPress={handleSave}
            disabled={saving}
            activeOpacity={0.85}
          >
            <Text style={{ color: C.bg, fontWeight: '700', fontSize: 15 }}>
              {saving ? '저장 중…' : '사진첩에 저장'}
            </Text>
          </TouchableOpacity>
          <Text style={{ fontSize: 12, color: C.textSub, textAlign: 'center' }}>
            QR은 보유머신 웹페이지로 연결돼요. 앱 설치 안내도 그 페이지에 있어요.
          </Text>
        </View>
      </SafeAreaView>
    </Modal>
  );
}
