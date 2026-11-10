import React, { forwardRef, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, Share, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as MediaLibrary from 'expo-media-library';
import { captureRef } from 'react-native-view-shot';
import QRCode from 'react-native-qrcode-svg';
import { C, R } from '../../../theme';
import GymPickLogo from '../../GymPickLogo';
import { buildJoinUrl } from '../../../lib/joinCode';

// 2026-11-09: 관장님용 회원 초대 QR · 코드
// QR을 짐픽 앱 안에서 찍거나 코드를 입력하면 바로 회원이 된다.
// 재발급하면 이전 QR·코드는 더 이상 쓸 수 없다 (이미 가입한 회원은 그대로).
// 저장용 카드는 인쇄물이라 흰 배경/검정 글씨를 리터럴 색으로 쓴다.

const CARD_W = 260;
const CARD_H = 340;
const CAPTURE_W = 1040;
const CAPTURE_H = 1360;
const LOGO_W = 90;
const LOGO_H = Math.round(LOGO_W * 279 / 2805);

interface Props {
  gymId:     string;
  gymName:   string;
  code:      string | null;
  loading:   boolean;
  onRotate:  () => void;
}

const InviteCard = forwardRef<View, { gymId: string; gymName: string; code: string }>(({ gymId, gymName, code }, ref) => (
  <View ref={ref} collapsable={false} style={s.inviteCard}>
    <GymPickLogo color="#000000" width={LOGO_W} height={LOGO_H} />
    <Text style={s.inviteGym} numberOfLines={2}>{gymName}</Text>
    <QRCode value={buildJoinUrl(gymId, code)} size={150} color="#000000" backgroundColor="#FFFFFF" ecl="M" />
    <Text style={s.inviteCode}>{code}</Text>
    <Text style={s.inviteHint}>짐픽 앱 › 헬스장 상세 › 회원 가입에서{'\n'}QR을 찍거나 코드를 입력하세요</Text>
  </View>
));

export default function InviteCodeSection({ gymId, gymName, code, loading, onRotate }: Props) {
  const cardRef = useRef<View>(null);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (saving || !cardRef.current) return;
    setSaving(true);
    try {
      const perm = await MediaLibrary.requestPermissionsAsync(true);
      if (!perm.granted) { Alert.alert('사진 접근 권한이 필요해요'); return; }
      const uri = await captureRef(cardRef, {
        format: 'png', quality: 1, result: 'tmpfile', width: CAPTURE_W, height: CAPTURE_H,
      });
      await MediaLibrary.saveToLibraryAsync(uri);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('저장 완료', '사진첩에 저장했어요. 카운터에 붙이거나 회원에게 보내주세요.');
    } catch {
      Alert.alert('저장 실패', '다시 시도해 주세요.');
    } finally {
      setSaving(false);
    }
  }

  function handleShare() {
    if (!code) return;
    Share.share({ message: `${gymName} 짐픽 회원 초대 코드: ${code}\n짐픽 앱 › 헬스장 상세 › 회원 가입에서 입력하세요.` })
      .catch(() => {});
  }

  function confirmRotate() {
    Alert.alert(
      '코드를 새로 만들까요?',
      '지금 QR과 코드는 더 이상 쓸 수 없어요. 이미 가입한 회원은 그대로 유지돼요.',
      [{ text: '취소', style: 'cancel' }, { text: '새로 만들기', style: 'destructive', onPress: onRotate }],
    );
  }

  return (
    <View style={s.wrap}>
      <View style={s.preview}>
        {loading || !code
          ? <View style={[s.inviteCard, { justifyContent: 'center' }]}><ActivityIndicator color="#000" /></View>
          : <InviteCard ref={cardRef} gymId={gymId} gymName={gymName} code={code} />}
      </View>

      <View style={s.btnRow}>
        <TouchableOpacity style={s.btn} activeOpacity={0.8} onPress={handleSave} disabled={!code || saving}>
          <Ionicons name="download-outline" size={15} color={C.accent} />
          <Text style={s.btnText}>{saving ? '저장 중…' : '가입 QR 저장'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.btn} activeOpacity={0.8} onPress={handleShare} disabled={!code}>
          <Ionicons name="share-outline" size={15} color={C.accent} />
          <Text style={s.btnText}>코드 보내기</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.btn} activeOpacity={0.8} onPress={confirmRotate} disabled={!code}>
          <Ionicons name="refresh-outline" size={15} color={C.textSub} />
          <Text style={[s.btnText, { color: C.textSub }]}>새로 만들기</Text>
        </TouchableOpacity>
      </View>
      <Text style={s.note}>QR이나 코드로 들어오면 승인 없이 바로 회원이 돼요. 코드가 밖으로 퍼졌다면 새로 만들어 주세요.</Text>
    </View>
  );
}

const s = StyleSheet.create({
  wrap:       { gap: 12 },
  preview:    { alignItems: 'center' },
  inviteCard: { width: CARD_W, height: CARD_H, backgroundColor: '#FFFFFF', borderRadius: 4, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 20 },
  inviteGym:  { fontSize: 18, fontWeight: '800', color: '#000000', textAlign: 'center' },
  inviteCode: { fontSize: 24, fontWeight: '900', color: '#000000', letterSpacing: 6 },
  inviteHint: { fontSize: 11, color: '#555555', textAlign: 'center', lineHeight: 16 },
  btnRow:     { flexDirection: 'row', gap: 8 },
  btn:        { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 11, borderRadius: R.inner, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border },
  btnText:    { color: C.accent, fontSize: 13, fontWeight: '700' },
  note:       { color: C.textSub, fontSize: 12, lineHeight: 17 },
});
