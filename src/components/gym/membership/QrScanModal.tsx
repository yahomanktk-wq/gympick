import React, { useEffect, useRef } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, Linking } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { C, R } from '../../../theme';
import { parseJoinCode } from '../../../lib/joinCode';

// 2026-11-09: 헬스장 회원 가입 QR 스캐너
// 짐픽 초대 QR이 아니면 무시하고 계속 스캔한다. 한 번 읽으면 onScanned 후 멈춘다.

interface Props {
  visible:   boolean;
  onClose:   () => void;
  onScanned: (code: string) => void;
}

export default function QrScanModal({ visible, onClose, onScanned }: Props) {
  const [permission, requestPermission] = useCameraPermissions();
  const doneRef = useRef(false);
  // Modal 안에서는 SafeAreaView 여백이 0으로 잡히는 경우가 있어 직접 계산한다 (2026-11-09: X가 상태바에 붙던 문제)
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!visible) return;
    doneRef.current = false;
    if (permission && !permission.granted && permission.canAskAgain) requestPermission();
  }, [visible, permission?.granted]);

  function handleScan({ data }: { data: string }) {
    if (doneRef.current) return;
    const code = parseJoinCode(data);
    if (!code) return;
    doneRef.current = true;
    onScanned(code);
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={s.root}>
        {permission?.granted ? (
          <CameraView
            style={StyleSheet.absoluteFill}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            onBarcodeScanned={visible ? handleScan : undefined}
          />
        ) : (
          <View style={s.noPerm}>
            <Ionicons name="camera-outline" size={40} color={C.textSub} />
            <Text style={s.noPermText}>QR을 읽으려면 카메라 권한이 필요해요</Text>
            <TouchableOpacity
              style={s.permBtn}
              activeOpacity={0.85}
              onPress={() => (permission?.canAskAgain === false ? Linking.openSettings() : requestPermission())}
            >
              <Text style={s.permBtnText}>{permission?.canAskAgain === false ? '설정에서 허용하기' : '카메라 허용'}</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={[s.overlay, { paddingTop: Math.max(insets.top, 20), paddingBottom: Math.max(insets.bottom, 20) }]} pointerEvents="box-none">
          {permission?.granted ? (
            <View style={s.center} pointerEvents="none">
              <View style={s.frame} />
              {/* 2026-11-09: Text에 둥근 배경을 직접 주면 iOS에서 글자 양끝이 잘려 View로 감쌈 */}
              <View style={s.hintPill}>
                <Text style={s.hint}>헬스장에 있는 짐픽 회원 QR을 비춰주세요</Text>
              </View>
            </View>
          ) : <View style={{ flex: 1 }} pointerEvents="none" />}
          {/* 닫기: 한 손으로 누르기 쉽게 화면 아래쪽 */}
          <TouchableOpacity onPress={onClose} style={s.closeBtn} activeOpacity={0.8} hitSlop={10}>
            <Ionicons name="close" size={22} color="#fff" />
            <Text style={s.closeText}>닫기</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  root:     { flex: 1, backgroundColor: '#000' },
  overlay:  { ...StyleSheet.absoluteFillObject },
  closeBtn: { alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 22, paddingVertical: 13, borderRadius: R.pill, backgroundColor: 'rgba(0,0,0,0.55)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)' },
  closeText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  center:   { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 20 },
  frame:    { width: 230, height: 230, borderRadius: 24, borderWidth: 3, borderColor: C.accent },
  hintPill: { backgroundColor: 'rgba(0,0,0,0.55)', paddingHorizontal: 16, paddingVertical: 9, borderRadius: R.pill },
  hint:     { color: '#fff', fontSize: 14, fontWeight: '600', textAlign: 'center' },
  noPerm:   { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, paddingHorizontal: 32 },
  noPermText: { color: C.text, fontSize: 15, textAlign: 'center' },
  permBtn:  { backgroundColor: C.accent, paddingHorizontal: 20, paddingVertical: 12, borderRadius: R.pill },
  permBtnText: { color: C.bg, fontWeight: '700', fontSize: 14 },
});
