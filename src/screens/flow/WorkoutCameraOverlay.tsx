import React, { useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { CameraView, useCameraPermissions, type CameraView as CameraViewType } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { C, R } from '../../theme';
import { ClassicOverlay, LeftColOverlay, GridOverlay } from './PostWorkoutLogModal';

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
  overlayStyle?: 'classic' | 'leftcol' | 'grid';
  onCaptureDone: (uri: string) => void;
  onCancel: () => void;
}

export default function WorkoutCameraOverlay({
  gym,
  exercises,
  logs,
  nickname,
  textColor,
  overlayStyle,
  onCaptureDone,
  onCancel,
}: Props) {
  const [permission, requestPermission] = useCameraPermissions();
  const [flash,        setFlash]        = useState<'off' | 'on'>('off');
  const [capturing,    setCapturing]    = useState(false);
  const [cameraReady,  setCameraReady]  = useState(false);
  const cameraRef = useRef<CameraViewType>(null);

  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const ENG_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const dateLabel   = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}(${ENG_DAYS[now.getDay()]})`;
  const timestamp   = `${dateLabel}_${pad(now.getHours())}:${pad(now.getMinutes())}`;
  const displayName = nickname ?? 'gympick_user';

  const muscleCounts = exercises.reduce<Record<string, number>>((acc, ex) => {
    acc[ex.targetMuscle] = (acc[ex.targetMuscle] ?? 0) + 1;
    return acc;
  }, {});
  const sortedMuscles = Object.entries(muscleCounts)
    .sort(([, a], [, b]) => b - a)
    .map(([m]) => m);
  const muscleLabel = sortedMuscles.length > 1
    ? sortedMuscles.slice(0, 2).join(' + ')
    : `${sortedMuscles[0] ?? 'WORKOUT'} Day`;

  const tc = textColor;

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
      <TouchableOpacity
        activeOpacity={1}
        onPress={handleTap}
        style={[styles.cameraWrap, { height: PHOTO_H }]}
        disabled={capturing || !cameraReady}
      >
        {/* 실제 카메라 피드 */}
        <CameraView
          ref={cameraRef}
          style={StyleSheet.absoluteFill}
          facing="back"
          flash={flash}
          onCameraReady={() => setCameraReady(true)}
          pictureSize="Photo"
        />

        {/* 오버레이: 실시간 미리보기용 (캡처 대상 아님) */}
        <View style={StyleSheet.absoluteFill} pointerEvents="none">

          {/* 스타일별 오버레이 분기 */}
          {(!overlayStyle || overlayStyle === 'classic') && (
            <ClassicOverlay
              exercises={exercises}
              logs={logs}
              nickname={displayName}
              timestamp={timestamp}
              muscleLabel={muscleLabel}
              tc={tc}
              photoW={PHOTO_W}
              photoH={PHOTO_H}
            />
          )}
          {overlayStyle === 'leftcol' && (
            <LeftColOverlay
              exercises={exercises}
              logs={logs}
              nickname={displayName}
              timestamp={timestamp}
              muscleLabel={muscleLabel}
              tc={tc}
              photoW={PHOTO_W}
              photoH={PHOTO_H}
            />
          )}
          {overlayStyle === 'grid' && (
            <GridOverlay
              exercises={exercises}
              logs={logs}
              nickname={displayName}
              timestamp={timestamp}
              muscleLabel={muscleLabel}
              tc={tc}
              photoW={PHOTO_W}
              photoH={PHOTO_H}
            />
          )}

          {/* 테두리 */}
          <View style={[styles.border, { borderColor: tc }]} />

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
