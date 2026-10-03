import React, { useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
  PanResponder,
} from 'react-native';
import { CameraView, useCameraPermissions, type CameraView as CameraViewType } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { C, R } from '../../theme';
import { LinearGradient } from 'expo-linear-gradient';
import GymPickLogo from '../../components/GymPickLogo';
import { LeftColOverlayB, ClassicOverlay, GridOverlayC, GridOverlayD, GridOverlayE, getFontSet, getLayoutType, type OverlayStyle } from './PostWorkoutLogModal';
import { useFonts } from 'expo-font';

const LOGO_STRIP_H = 14;
const LOGO_STRIP_W = Math.round(LOGO_STRIP_H * (2805 / 279));
const OVERLAY_PAD_C = 20;

const { width: SCREEN_W } = Dimensions.get('window');
const PHOTO_W = SCREEN_W - 32;
const PHOTO_H = Math.round(PHOTO_W * (4 / 3));

const OVERLAY_PAD = 20;

interface Props {
  gym: { name: string };
  exercises: { id: string; name: string; brand: string; targetMuscle: string }[];
  logs: Record<string, { weight: number; reps: number }[]>;
  nickname?: string;
  textColor: string;
  muscleLabel: string;
  overlayStyle?: OverlayStyle;
  onCaptureDone: (uri: string) => void;
  onCancel: () => void;
}

export default function WorkoutCameraOverlay({
  gym,
  exercises,
  logs,
  nickname,
  textColor,
  muscleLabel,
  overlayStyle,
  onCaptureDone,
  onCancel,
}: Props) {
  const [permission, requestPermission] = useCameraPermissions();
  const [flash,        setFlash]        = useState<'off' | 'on'>('off');
  const [capturing,    setCapturing]    = useState(false);
  const [cameraReady,  setCameraReady]  = useState(false);
  const [zoom,         setZoom]         = useState(0);

  useFonts({
    'KCC-Ganpan':               require('../../../assets/fonts/kcc_ganpan.ttf'),
    'Mat Saleh':                require('../../../assets/fonts/mat_saleh.ttf'),
    'Matcha Cih':               require('../../../assets/fonts/matcha_cih.ttf'),
    'Quicksilver-Italic':       require('../../../assets/fonts/quicksilver_italic.ttf'),
    'Stadium1956-Regular':      require('../../../assets/fonts/stadium1956_regular.otf'),
    'BlackwoodCastle':          require('../../../assets/fonts/blacc.ttf'),
    'BlackwoodCastleShadow':    require('../../../assets/fonts/blaccs.ttf'),
    'CollegeBoy':               require('../../../assets/fonts/college_boy.otf'),
    'Flamer':                   require('../../../assets/fonts/flamer.ttf'),
    'HeavyHeapRg-Regular':      require('../../../assets/fonts/heavy_heap_rg.otf'),
    'Honfleur-Heavy':           require('../../../assets/fonts/honfleur_heavy.otf'),
    'BasicFont':                require('../../../assets/fonts/basif.ttf'),
    'Abrakadaboom':             require('../../../assets/fonts/abrakadaboom.ttf'),
    'KERISKEDU_Line':           require('../../../assets/fonts/keriskedu_line.ttf'),
    'HeirofLightRegular':       require('../../../assets/fonts/heiroflightregular.ttf'),
    'BMkkubulimTTF-Regular':    require('../../../assets/fonts/bmkkubulim.ttf'),
    'biergartenlt':             require('../../../assets/fonts/biergartenlt.ttf'),
  });
  const lastZoom        = useRef(0);
  const currentZoomRef  = useRef(0);
  const initialDistance = useRef<number | null>(null);
  const cameraRef = useRef<CameraViewType>(null);

  function getTouchDistance(touches: any[]): number {
    const [a, b] = touches;
    const dx = a.pageX - b.pageX;
    const dy = a.pageY - b.pageY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  const pinchResponder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: (evt) => evt.nativeEvent.touches.length === 2,
    onMoveShouldSetPanResponder:  (evt) => evt.nativeEvent.touches.length === 2,
    onPanResponderGrant: (evt) => {
      if (evt.nativeEvent.touches.length === 2) {
        initialDistance.current = getTouchDistance(evt.nativeEvent.touches as any);
      }
    },
    onPanResponderMove: (evt) => {
      if (evt.nativeEvent.touches.length === 2 && initialDistance.current !== null) {
        const currentDist = getTouchDistance(evt.nativeEvent.touches as any);
        const ratio = currentDist / initialDistance.current;
        const delta = (ratio - 1) * 0.3;
        const newZoom = Math.min(0.8, Math.max(0, lastZoom.current + delta));
        currentZoomRef.current = newZoom;
        setZoom(newZoom);
      }
    },
    onPanResponderRelease: () => {
      lastZoom.current = currentZoomRef.current;
      initialDistance.current = null;
    },
  })).current;

  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const ENG_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const dateLabel   = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}(${ENG_DAYS[now.getDay()]})`;
  const timestamp   = `${dateLabel}_${pad(now.getHours())}:${pad(now.getMinutes())}`;
  const displayName = nickname ?? 'gympick_user';

  const tc = textColor;
  // 레이아웃 E(각진 모서리 + 테두리선 없음)만 프레임 스타일이 달라서 미리 계산해둔다.
  const currentLayoutType = getLayoutType(overlayStyle ?? 's1a');

  const handleTap = useCallback(async () => {
    if (capturing || !cameraReady || !cameraRef.current) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setCapturing(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 1,
        skipProcessing: false,
        exif: true,
      });
      if (photo?.uri) {
        onCaptureDone(photo.uri);
      } else {
        setCapturing(false);
      }
    } catch (e) {
      console.error('[WorkoutCameraOverlay] 촬영 오류:', e);
      setCapturing(false);
    }
  }, [capturing, cameraReady, onCaptureDone]);

  if (!permission) {
    return (
      <View style={styles.container}>
        <ActivityIndicator color={C.accent} />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Ionicons name="camera-outline" size={48} color={C.textDim} />
        <Text style={styles.permText}>카메라 권한이 필요합니다</Text>
        <TouchableOpacity style={styles.permBtn} onPress={requestPermission} activeOpacity={0.85}>
          <Text style={styles.permBtnText}>권한 허용</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.cancelBtn} onPress={onCancel} activeOpacity={0.8}>
          <Text style={styles.cancelBtnText}>취소</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* 상단 컨트롤: 돌아가기 + 힌트 텍스트 + 플래시 */}
      <View style={styles.controls}>
        <TouchableOpacity
          style={styles.cancelRowBtn}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onCancel(); }}
          activeOpacity={0.8}
        >
          <Ionicons name="chevron-back" size={16} color={C.text} />
          <Text style={styles.cancelRowBtnText}>돌아가기</Text>
        </TouchableOpacity>

        <Text style={styles.hint}>
          {cameraReady ? '화면을 탭하여 촬영' : '카메라 준비 중...'}
        </Text>

        <TouchableOpacity
          style={[styles.flashBtn, flash === 'on' && styles.flashBtnOn]}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setFlash(f => f === 'off' ? 'on' : 'off'); }}
          activeOpacity={0.8}
        >
          <Ionicons
            name={flash === 'on' ? 'flash' : 'flash-off'}
            size={16}
            color={flash === 'on' ? C.bg : C.text}
          />
          <Text style={[styles.flashBtnText, flash === 'on' && { color: C.bg }]}>
            {flash === 'on' ? '플래시 ON' : '플래시 OFF'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* 카메라 뷰파인더 + 오버레이 미리보기 */}
      <View
        style={[styles.cameraWrap, { height: PHOTO_H, borderRadius: currentLayoutType === 'e' ? 0 : 20 }]}
        {...pinchResponder.panHandlers}
      >
        <TouchableOpacity
          activeOpacity={1}
          onPress={handleTap}
          style={StyleSheet.absoluteFill}
          disabled={capturing || !cameraReady}
        >
          {/* 실제 카메라 피드 */}
          <CameraView
            ref={cameraRef}
            style={StyleSheet.absoluteFill}
            facing="back"
            flash={flash}
            zoom={zoom}
            onCameraReady={() => setCameraReady(true)}
            pictureSize="Photo"
          />

        {/* 오버레이: 실시간 미리보기용 (캡처 대상 아님) */}
        <View style={StyleSheet.absoluteFill} pointerEvents="none">

          {/* 스타일별 오버레이 분기 */}
          {(() => {
            const style = overlayStyle ?? 's1a';
            const fs = getFontSet(style);
            const layout = getLayoutType(style);
            const commonProps = { exercises, logs, nickname: displayName, timestamp, muscleLabel, tc, photoW: PHOTO_W, photoH: PHOTO_H };

            if (layout === 'a') {
              return (
                <ClassicOverlay
                  exercises={exercises}
                  logs={logs}
                  nickname={displayName}
                  timestamp={timestamp}
                  muscleLabel={muscleLabel}
                  tc={tc}
                  photoW={PHOTO_W}
                  photoH={PHOTO_H}
                  fontSet={fs}
                />
              );
            }
            if (layout === 'b') {
              return <LeftColOverlayB {...commonProps} fontSet={fs} />;
            }
            if (layout === 'd') {
              return <GridOverlayD
                exercises={exercises}
                logs={logs}
                nickname={displayName}
                timestamp={timestamp}
                muscleLabel={muscleLabel}
                tc={tc}
                photoW={PHOTO_W}
                photoH={PHOTO_H}
                fontSet={fs}
              />;
            }
            if (layout === 'c') {
              return (
                <GridOverlayC
                  exercises={exercises}
                  logs={logs}
                  nickname={displayName}
                  timestamp={timestamp}
                  muscleLabel={muscleLabel}
                  tc={tc}
                  photoW={PHOTO_W}
                  photoH={PHOTO_H}
                  fontSet={fs}
                />
              );
            }
            if (layout === 'e') {
              return (
                <GridOverlayE
                  exercises={exercises}
                  logs={logs}
                  nickname={displayName}
                  timestamp={timestamp}
                  muscleLabel={muscleLabel}
                  tc={tc}
                  photoW={PHOTO_W}
                  photoH={PHOTO_H}
                  fontSet={fs}
                />
              );
            }
            return null;
          })()}

          {/* 테두리 — 레이아웃 E는 각진 디자인이라 생략 */}
          {currentLayoutType !== 'e' && (
            <View style={[styles.border, { borderColor: tc }]} />
          )}

          {/* 카메라 준비 중 딤 */}
          {!cameraReady && (
            <View style={styles.loadingDim}>
              <ActivityIndicator color={C.accent} size="large" />
            </View>
          )}

          {/* 촬영 중 딤 */}
          {capturing && (
            <View style={styles.capturingDim}>
              <ActivityIndicator color={C.accent} size="large" />
            </View>
          )}
        </View>
        </TouchableOpacity>
      </View>

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  hint: {
    fontSize: 12,
    color: C.text,
    fontWeight: '700',
  },
  cameraWrap: {
    width: PHOTO_W,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#000',
    marginBottom: 20,
  },
  border: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    borderRadius: 20,
    borderWidth: 2,
  },
  loadingDim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  capturingDim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  controls: {
    width: PHOTO_W,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  cancelRowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 9,
    paddingHorizontal: 11,
    borderRadius: R.pill,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
  },
  cancelRowBtnText: { fontSize: 12, fontWeight: '600', color: C.text },
  flashBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: R.pill,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
  },
  flashBtnOn:   { backgroundColor: C.accent, borderColor: C.accent },
  flashBtnText: { fontSize: 12, fontWeight: '700', color: C.text },
  permText:     { fontSize: 14, fontWeight: '600', color: C.textSub, textAlign: 'center', marginTop: 12 },
  permBtn:      { backgroundColor: C.accent, borderRadius: R.btn, paddingVertical: 12, paddingHorizontal: 24, marginTop: 8 },
  permBtnText:  { fontSize: 14, fontWeight: '800', color: C.bg },
  cancelBtn:    { borderRadius: R.btn, paddingVertical: 12, paddingHorizontal: 24, borderWidth: 1, borderColor: C.border, marginTop: 4 },
  cancelBtnText:{ fontSize: 14, fontWeight: '600', color: C.textSub },
});
