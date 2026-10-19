import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Modal,
  Dimensions,
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  PixelRatio,
  ActionSheetIOS,
} from 'react-native';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as MediaLibrary from 'expo-media-library';
import { captureRef } from 'react-native-view-shot';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect, useRoute } from '@react-navigation/native';
import { Image as ExpoImage } from 'expo-image';
import { brandLogos } from '../constants/brandLogos';
import { getMachineImageUrl } from '../lib/machineImageUrl';
import { getTransformedImageUrl } from '../lib/photoImageUrl';
import { C, R, T } from '../theme';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { WorkoutLog, Machine, UserSplitConfig, SequentialSplit, WeekdaySplit } from '../data/types';
import { fetchSplitConfig, updateSplitIndex } from '../lib/db/splitRoutine';
import { getTodayTargets, isRestToday, getNextTargets, collectRoutineMuscles, calcNextIndex, extractCompletedTargets } from '../lib/splitUtils';
import { getSessionPRMachines } from '../data/workoutSessions';
import { fetchWorkoutLogs } from '../lib/db';
import { deleteWorkoutSession } from '../lib/db/workouts';
import { removeSession } from '../data/sessionStore';
import { deleteFeedPostBySession, fetchFeedPostPublicStatusBatch, updateFeedPostPublic, updateFeedPostShowOnGym } from '../lib/db/feedPosts';
import { useFetch } from '../lib/useFetch';
import { perfStart, perfEnd } from '../lib/perf';
import { useAuth } from '../context/AuthContext';
import PostWorkoutLogModal, {
  ClassicOverlay, LeftColOverlayB, GridOverlayC, GridOverlayD, GridOverlayE, PosterOverlay, RosterOverlay,
  getFontSet, getLayoutType,
  type OverlayStyle, type SetEntry, type ExerciseInfo,
} from './flow/PostWorkoutLogModal';
import MachineDetailModal from './flow/MachineDetailModal';
import WorkoutLogSummaryModal from './flow/WorkoutLogSummaryModal';
import GymPickLogo from '../components/GymPickLogo';
import * as Haptics from 'expo-haptics';

const { width: SCREEN_W } = Dimensions.get('window');

// Session detail photo dimensions
const DET_PHOTO_W = SCREEN_W - 32;
const DET_PHOTO_H = Math.round(DET_PHOTO_W * (4 / 3));

// Retro grid cell dimensions — 3.5 visible per row, 4:3 ratio
const RETRO_CELL_W = Math.floor((SCREEN_W - 32) / 3.5);
const RETRO_CELL_H = Math.round(RETRO_CELL_W * 4 / 3);

const IMAGE_PIXEL_RATIO = PixelRatio.get();

// --- Helpers

function getWeekStart(date: Date, weekOffset = 0): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const dow = d.getDay();
  const diffToMon = dow === 0 ? -6 : 1 - dow;
  d.setDate(d.getDate() + diffToMon + weekOffset * 7);
  return d;
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}

function sessionVolume(s: WorkoutLog): number {
  return s.machines.reduce((acc, m) => acc + m.weight * m.reps * m.sets, 0);
}

function weeklyFrequency(sessions: WorkoutLog[]): number[] {
  const now = Date.now();
  return Array.from({ length: 4 }, (_, i) => {
    const end   = now - i * 7 * 86_400_000;
    const start = end - 7 * 86_400_000;
    return sessions.filter(s => {
      const t = new Date(s.date).getTime();
      return t >= start && t < end;
    }).length;
  }).reverse();
}

function getISOWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

function computeNumWeeks(sessions: WorkoutLog[]): number {
  if (sessions.length === 0) return 10;
  const oldest = sessions.reduce((min, s) => s.date < min ? s.date : min, sessions[0].date);
  const diffMs = Date.now() - new Date(oldest).getTime();
  const diffWeeks = Math.ceil(diffMs / (7 * 86_400_000));
  return Math.max(10, diffWeeks + 1);
}

const MUSCLE_COLORS: Record<string, { fg: string; bg: string }> = {
  Chest:       C.tagMachine,
  Back:        C.tagBrand,
  Leg:        C.tagMuscle,
  Shoulder:   { fg: '#ffd166', bg: '#ffd16618' },
  Arms:        C.tagCategory,
  Core:        { fg: '#06d6a0', bg: '#06d6a018' },
  'Full Body': { fg: '#a8dadc', bg: '#a8dadc18' },
  Glutes:      { fg: '#ff9ecd', bg: '#ff9ecd18' },
};

function mp(muscle: string) {
  return MUSCLE_COLORS[muscle] ?? { fg: C.textSub, bg: C.border };
}

const RETRO_DAY_LABELS = ['월', '화', '수', '목', '금', '토', '일'];

// --- Split Banner styles (module-level, for SplitBanner sub-component)
const splitBannerStyle = {
  backgroundColor:  C.surface,
  borderRadius:     R.card,
  padding:          14,
  marginHorizontal: 20,
  marginBottom:     12,
};
const splitBannerText = {
  fontSize:   15,
  fontWeight: '700' as const,
  color:      C.text,
};
const splitBannerSub = {
  fontSize:  13,
  color:     C.textSub,
  marginTop: 4,
};

// --- Split Banner
const SplitBanner = React.memo(({ message, sub }: { message: string; sub?: string }) => (
  <View style={splitBannerStyle}>
    <Text style={splitBannerText}>{message}</Text>
    {sub ? <Text style={splitBannerSub}>{sub}</Text> : null}
  </View>
));

// --- Split Banner Message Calculator
function getSplitBannerMessage(
  splitConfig: UserSplitConfig | null,
  todaySessions: WorkoutLog[]
): { message: string; sub?: string } | null {
  if (!splitConfig) return null;
  const split = splitConfig.workoutSplit;
  if (!split || (Array.isArray(split) && split.length === 0)) return null;

  const todayTargets = getTodayTargets(
    splitConfig.splitType,
    split,
    splitConfig.splitCurrentIndex
  );
  const rest = isRestToday(
    splitConfig.splitType,
    split,
    splitConfig.splitCurrentIndex
  );

  if (rest) {
    return { message: '오늘은 휴식 Day예요 🛌' };
  }

  const todayStr = todayTargets.join('·');

  if (todaySessions.length === 0) {
    return todayTargets.length > 0
      ? { message: `오늘은 ${todayStr} Day예요 💪` }
      : null;
  }

  const completedTargets = extractCompletedTargets(todaySessions.flatMap(s => s.machines));
  const nextTargets = getNextTargets(
    splitConfig.splitType,
    split,
    splitConfig.splitCurrentIndex,
    completedTargets
  );
  const nextStr = nextTargets.join('·');

  const routineTargets = collectRoutineMuscles(splitConfig.splitType, split);
  const completedRoutine = completedTargets.filter(t =>
    routineTargets.includes(t) && t !== '휴식'
  );

  if (completedRoutine.length > 0) {
    const completedStr = completedRoutine.join(' + ');
    if (nextTargets.length > 0) {
      return { message: `오늘 ${completedStr} 완료! 🔥`, sub: `다음은 ${nextStr} Day예요` };
    }
    return { message: `오늘 ${completedStr} 완료! 🔥` };
  }

  const completedStr = completedTargets.filter(t => t !== '휴식').join(' + ');
  return {
    message: `오늘은 ${completedStr} 운동 했군요!`,
    sub: todayTargets.length > 0 ? `${todayStr} Day는 다음 운동 때 해요` : undefined,
  };
}

// --- Retro Weekly Grid

function getWeekTargetMap(
  splitConfig: UserSplitConfig | null,
  weekDates:   Date[]
): Record<string, string | null> {
  const result: Record<string, string | null> = {};

  if (!splitConfig || !splitConfig.workoutSplit) {
    weekDates.forEach(d => { result[d.toDateString()] = null; });
    return result;
  }

  if (splitConfig.splitType === 'weekday') {
    const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
    const split = splitConfig.workoutSplit as WeekdaySplit;
    weekDates.forEach(d => {
      const key     = DAY_KEYS[d.getDay()] as keyof WeekdaySplit;
      const targets = (split[key] ?? []) as string[];
      const work = targets.filter(m => m !== '휴식');
      result[d.toDateString()] = work.length > 0 ? work.join('·') : (targets.length > 0 ? '휴식' : null);
    });
    return result;
  }

  const split  = splitConfig.workoutSplit as string[][];
  const len    = split.length;
  if (len === 0) {
    weekDates.forEach(d => { result[d.toDateString()] = null; });
    return result;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const currentIdx = splitConfig.splitCurrentIndex % len;

  weekDates.forEach(d => {
    const date = new Date(d);
    date.setHours(0, 0, 0, 0);
    const diffDays = Math.round((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    const idx = ((currentIdx + diffDays) % len + len) % len;
    const slot = split[idx] ?? [];
    const work = slot.filter(m => m !== '휴식');
    result[d.toDateString()] = work.length > 0 ? work.join('·') : (slot.length > 0 ? '휴식' : null);
  });

  return result;
}

function RetroWeeklyGrid({
  sessions,
  onSelectDay,
  splitConfig,
}: {
  sessions:    WorkoutLog[];
  onSelectDay: (daySessions: WorkoutLog[]) => void;
  splitConfig: UserSplitConfig | null;
}) {
  const today     = useMemo(() => new Date(), []);
  const numWeeks  = computeNumWeeks(sessions);

  const weeks = useMemo(() => {
    const currentWeekStart = getWeekStart(today);
    return Array.from({ length: numWeeks }, (_, i) => {
      const ws = addDays(currentWeekStart, -i * 7);
      const we = addDays(ws, 6);
      return { weekStart: ws, weekEnd: we, weekNum: getISOWeekNumber(ws), key: ws.toISOString() };
    });
  }, [numWeeks]);

  const allWeekDates = useMemo(() => {
    const currentWeekStart = getWeekStart(today);
    const dates: Date[] = [];
    for (let i = 0; i < numWeeks; i++) {
      const ws = addDays(currentWeekStart, -i * 7);
      for (let j = 0; j < 7; j++) {
        dates.push(addDays(ws, j));
      }
    }
    return dates;
  }, [numWeeks, today]);

  const weekTargetMap = useMemo(
    () => getWeekTargetMap(splitConfig, allWeekDates),
    [splitConfig, allWeekDates]
  );

  return (
    <View style={{ paddingBottom: 16 }}>
      {weeks.map(({ weekStart, weekEnd, weekNum, key }) => {
        const days       = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
        const startLabel = `${weekStart.getMonth() + 1}월 ${weekStart.getDate()}일`;
        const endLabel   = `${weekEnd.getMonth() + 1}월 ${weekEnd.getDate()}일`;

        return (
          <View key={key} style={rg.weekSection}>
            {/* Week header */}
            <View style={rg.weekHeader}>
              <Text style={rg.weekNumText}>{weekNum}주</Text>
              <Text style={rg.weekRangeText}>{startLabel} ~ {endLabel}</Text>
              <Text style={rg.weekMore}>···</Text>
            </View>

            {/* Day thumbnails — horizontal scroll, 4 visible */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={rg.dayRow}
            >
              {days.map((day, i) => {
                const session  = sessions.find(s => isSameDay(new Date(s.date), day));
                const isToday  = isSameDay(day, today);
                const isFuture = day > today;
                const rawPhotoSrc = session?.thumbnailUri ?? session?.compositeUri ?? session?.photoUri;
                const photoSrc = getTransformedImageUrl(rawPhotoSrc, {
                  width:  Math.round(RETRO_CELL_W * IMAGE_PIXEL_RATIO),
                  height: Math.round(RETRO_CELL_H * IMAGE_PIXEL_RATIO),
                });

                return (
                  <TouchableOpacity
                    key={i}
                    style={[
                      rg.dayCell,
                      isToday && rg.dayCellToday,
                      isFuture && rg.dayCellFuture,
                    ]}
                    activeOpacity={session ? 0.75 : 1}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      const daySessions = sessions.filter(s => isSameDay(new Date(s.date), day));
                      if (daySessions.length > 0) onSelectDay(daySessions);
                    }}
                  >
                    {photoSrc ? (
                      <ExpoImage
                        source={{ uri: photoSrc }}
                        style={StyleSheet.absoluteFill}
                        contentFit="cover"
                        cachePolicy="memory-disk"
                        onError={() => {}}
                      />
                    ) : (
                      <View style={rg.emptyCell}>
                        <Text style={[
                          rg.emptyCellDate,
                          isSameDay(day, today) && { color: C.accent },
                        ]}>
                          {day.getDate()}
                        </Text>
                        <Text style={rg.emptyCellDay}>{RETRO_DAY_LABELS[i]}</Text>
                        {weekTargetMap[day.toDateString()] && (
                          <Text style={[
                            rg.emptyCellTarget,
                            weekTargetMap[day.toDateString()] === '휴식' && { color: C.textDim },
                          ]}>
                            {weekTargetMap[day.toDateString()]}
                          </Text>
                        )}
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        );
      })}
    </View>
  );
}

// --- Session Detail Modal

function SessionDetailModal({
  sessions,
  prMachines,
  onClose,
  onOpenMachine,
  onOpenSummary,
  onDelete,
  userId,
  nickname,
}: {
  sessions:      WorkoutLog[];
  prMachines:    Set<string>;
  onClose:       () => void;
  onOpenMachine: (machineId: string, machineName: string, machineBrand: string, targetMuscle?: string) => void;
  onOpenSummary: (session: WorkoutLog) => void;
  onDelete:      (sessionId: string) => Promise<void>;
  userId:        string | null;
  nickname?:     string;
}) {
  const photoRefs      = useRef<Record<string, View | null>>({});
  const layoutOnlyRefs = useRef<Record<string, View | null>>({});
  const routineCardRefs = useRef<Record<string, View | null>>({});
  const PHOTO_W_J         = Dimensions.get('window').width - 32;
  const ROUTINE_CARD_H_J  = Math.round(PHOTO_W_J * 4 / 3);
  const RC_ITEMS_PER_PAGE = Math.max(1, Math.floor((ROUTINE_CARD_H_J - 70 - 36) / 90));
  const routinePageRefs   = useRef<Record<string, (View | null)[]>>({});
  const [publicStatusMap, setPublicStatusMap] = useState<
    Record<string, { postId: string; isPublic: boolean; showOnGym: boolean } | null>
  >({});
  const [localPhotoUriMap,   setLocalPhotoUriMap]   = useState<Record<string, string>>({});
  const [localMachineImgMap, setLocalMachineImgMap] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!userId) return;
    // 모달 열릴 때마다 초기화 후 재fetch
    // 2026-10-13: 세션 개수만큼 fetchFeedPostPublicStatus를 각각 호출하던
    // N+1 패턴을 하나의 배치 쿼리(fetchFeedPostPublicStatusBatch)로 합침.
    setPublicStatusMap({});
    (async () => {
      const statusByDate = await fetchFeedPostPublicStatusBatch(
        userId,
        sessions.map(session => session.date),
      );
      const nextMap: Record<string, { postId: string; isPublic: boolean; showOnGym: boolean } | null> = {};
      sessions.forEach(session => {
        nextMap[session.id] = statusByDate[session.date] ?? null;
      });
      setPublicStatusMap(nextMap);
    })();
  }, [sessions.map(s => s.id).join(','), userId]);

  if (sessions.length === 0) return null;

  const firstSession = sessions[0];
  const dateStr = new Date(firstSession.date).toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  });

  async function downloadToLocal(remoteUri: string, filename: string): Promise<string> {
    if (!remoteUri.startsWith('http')) return remoteUri;
    const localPath = `${FileSystem.cacheDirectory ?? ''}gympick_${filename}`;
    try {
      const info = await FileSystem.getInfoAsync(localPath);
      if (info.exists) return localPath;
      const result = await FileSystem.downloadAsync(remoteUri, localPath);
      if (result.status < 200 || result.status >= 300) return remoteUri;
      return result.uri;
    } catch {
      return remoteUri;
    }
  }

  async function prepareCapture(session: WorkoutLog): Promise<void> {
    if (Platform.OS !== 'android') return;
    const rawPhotoUri = session.compositeUri ?? session.photoUri;
    if (rawPhotoUri?.startsWith('http')) {
      const localUri = await downloadToLocal(rawPhotoUri, `photo_${session.id}.png`);
      setLocalPhotoUriMap(prev => ({ ...prev, [session.id]: localUri }));
    }
    const machines = session.machines ?? [];
    const newMap: Record<string, string> = {};
    for (const m of machines) {
      const remoteUrl = getMachineImageUrl(m.machineId, { width: 128 });
      const localUri = await downloadToLocal(remoteUrl, `machine_${m.machineId}.webp`);
      if (localUri !== remoteUrl) newMap[m.machineId] = localUri;
    }
    if (Object.keys(newMap).length > 0) {
      setLocalMachineImgMap(prev => ({ ...prev, ...newMap }));
    }
    await new Promise(resolve =>
      requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(resolve, 300)))
    );
  }

  async function handleSave(session: WorkoutLog) {
    try {
      await prepareCapture(session);
      // 1. 인증샷 저장 — compositeUri는 원격 URL이라 captureRef로 재캡처
      const photoNode = photoRefs.current[session.id];
      if (photoNode) {
        await new Promise(resolve => requestAnimationFrame(resolve));
        const photoRatio = Math.max(PixelRatio.get(), 3);
        const uri = await captureRef(photoNode, {
          format: 'png', quality: 1, result: 'tmpfile',
          pixelRatio: photoRatio,
          ...(Platform.OS === 'android'
            ? { width: Math.round(DET_PHOTO_W * photoRatio), height: Math.round(DET_PHOTO_H * photoRatio) }
            : {}),
        });
        await MediaLibrary.saveToLibraryAsync(uri);
      } else if (session.compositeUri) {
        // photoRef 없을 때만 URL 직접 사용 (로컬 파일인 경우만 동작)
        try { await MediaLibrary.saveToLibraryAsync(session.compositeUri); } catch {}
      }

      // 2. 루틴카드 페이지별 캡처 및 저장 (인스타 방식과 동일)
      const pageRefs = routinePageRefs.current[session.id] ?? [];
      for (const ref of pageRefs) {
        if (ref) {
          await new Promise(resolve => requestAnimationFrame(resolve));
          await new Promise(resolve => setTimeout(resolve, 100));
          const ratio = Math.max(PixelRatio.get(), 4);
          const pageUri = await captureRef(ref, {
            format: 'png', quality: 1, result: 'tmpfile',
            pixelRatio: ratio,
            ...(Platform.OS === 'android'
              ? { width: Math.round(PHOTO_W_J * ratio), height: Math.round(ROUTINE_CARD_H_J * ratio) }
              : {}),
          });
          await MediaLibrary.saveToLibraryAsync(pageUri);
        }
      }

      Alert.alert('저장 완료', '인증샷과 운동 루틴 카드가 저장되었습니다.');
    } catch (e) {
      if (__DEV__) console.warn('[JournalScreen] handleSave 오류:', e);
      Alert.alert('저장 실패', '다시 시도해 주세요.');
    }
  }

  async function handleInstagramShare(session: WorkoutLog) {
    try {
      await prepareCapture(session);
      const savedAssets: MediaLibrary.Asset[] = [];
      let capturedPhotoUri: string | null = null;

      // 1. 인증샷 저장 — photoRefs로 View 직접 캡처 (PNG 투명 배경 보존)
      const photoNode = photoRefs.current[session.id];
      if (photoNode) {
        await new Promise(resolve => requestAnimationFrame(resolve));
        const photoRatio = Math.max(PixelRatio.get(), 3);
        const uri = await captureRef(photoNode, {
          format: 'png', quality: 1, result: 'tmpfile',
          pixelRatio: photoRatio,
          ...(Platform.OS === 'android'
            ? { width: Math.round(DET_PHOTO_W * photoRatio), height: Math.round(DET_PHOTO_H * photoRatio) }
            : {}),
        });
        capturedPhotoUri = uri;
        const asset = await MediaLibrary.createAssetAsync(uri);
        savedAssets.push(asset);
      }

      // 2. 루틴카드 페이지별 캡처 및 저장
      const pageRefs = routinePageRefs.current[session.id] ?? [];
      for (const ref of pageRefs) {
        if (ref) {
          await new Promise(resolve => requestAnimationFrame(resolve));
          await new Promise(resolve => setTimeout(resolve, 100));
          const ratio = Math.max(PixelRatio.get(), 4);
          const pageUri = await captureRef(ref, {
            format: 'png', quality: 1, result: 'tmpfile',
            pixelRatio: ratio,
            ...(Platform.OS === 'android'
              ? { width: Math.round(PHOTO_W_J * ratio), height: Math.round(ROUTINE_CARD_H_J * ratio) }
              : {}),
          });
          const asset = await MediaLibrary.createAssetAsync(pageUri);
          savedAssets.push(asset);
        }
      }

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      // 3. 인스타그램 실행
      if (Platform.OS === 'ios' && savedAssets.length > 0) {
        const instagramUrl = `instagram://library?LocalIdentifier=${savedAssets[0].id}`;
        try {
          await Linking.openURL(instagramUrl);
        } catch {
          Alert.alert('저장 완료', `${savedAssets.length}장이 갤러리에 저장되었습니다.\n인스타그램 앱에서 업로드해주세요.`);
        }
      } else {
        const canShare = await Sharing.isAvailableAsync();
        if (capturedPhotoUri && canShare) {
          await Sharing.shareAsync(capturedPhotoUri, {
            mimeType: 'image/png',
            dialogTitle: '인스타그램에 공유',
          });
        } else {
          Alert.alert('저장 완료', `${savedAssets.length}장이 갤러리에 저장되었습니다.\n인스타그램 앱에서 업로드해주세요.`);
        }
      }
    } catch (e) {
      if (__DEV__) console.warn('[JournalScreen] handleInstagramShare 오류:', e);
      Alert.alert('공유 실패', `오류: ${String(e)}`);
    }
  }

  // 저장된 세션 데이터(머신/세트/부위/오버레이 색상/스타일)로 캡처 당시의 오버레이를
  // 그대로 다시 그린다 — '오버레이만 저장'용 숨김 캡처 뷰에서 사용.
  // session.overlayStyle이 없는(2026-09-03 이전에 저장된) 세션은 null을 반환한다.
  function renderSessionOverlay(session: WorkoutLog) {
    const style = session.overlayStyle as OverlayStyle | undefined;
    if (!style) return null;

    const fs     = getFontSet(style);
    const layout = getLayoutType(style);
    const machines = session.machines ?? [];

    const exercises: ExerciseInfo[] = machines.map(m => ({
      id:           m.machineId,
      name:         m.machineName,
      brand:        m.machineBrand,
      targetMuscle: m.targetMuscle,
    }));

    // 세트별 개별 무게/횟수는 저장돼 있지 않고 최고 세트(weight/reps)와 세트 수만
    // 남아있어서, 세트 수만큼 같은 값을 반복해 근사한다 — 상세화면의 기존 사진
    // 오버레이(det.photoExSet)도 동일한 방식으로 표시하고 있어 표시 결과는 일관됨.
    const logs: Record<string, SetEntry[]> = {};
    machines.forEach(m => {
      logs[m.machineId] = Array.from({ length: Math.max(m.sets, 1) }).map(() => ({
        weight: m.weight,
        reps:   m.reps,
      }));
    });

    const muscles = (session.targetMuscles && session.targetMuscles.length > 0)
      ? session.targetMuscles
      : [...new Set(machines.map(m => m.targetMuscle))];
    const muscleLabel = muscles.length > 1
      ? muscles.join(' + ')
      : `${muscles[0] ?? 'WORKOUT'} Day`;

    const d = new Date(session.date);
    const pad = (n: number) => String(n).padStart(2, '0');
    const ENG_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const dateLabel = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}(${ENG_DAYS[d.getDay()]})`;
    const timestamp = `${dateLabel}_${pad(d.getHours())}:${pad(d.getMinutes())}`;

    const commonProps = {
      exercises,
      logs,
      nickname: nickname ?? 'gympick_user',
      timestamp,
      muscleLabel,
      tc: session.overlayTextColor ?? '#ffffff',
      photoW: DET_PHOTO_W,
      photoH: DET_PHOTO_H,
    };

    if (layout === 'a') return <ClassicOverlay {...commonProps} fontSet={fs} />;
    if (layout === 'b') return <LeftColOverlayB {...commonProps} fontSet={fs} />;
    if (layout === 'd') return <GridOverlayD {...commonProps} fontSet={fs} />;
    if (layout === 'c') return <GridOverlayC {...commonProps} fontSet={fs} />;
    if (layout === 'e') return <GridOverlayE {...commonProps} fontSet={fs} />;
    if (layout === 'f') return <PosterOverlay {...commonProps} fontSet={fs} />;
    if (layout === 'g') return <RosterOverlay {...commonProps} fontSet={fs} />;
    return null;
  }

  async function handleSaveLayoutOnly(session: WorkoutLog) {
    if (!session.overlayStyle) {
      Alert.alert(
        '지원하지 않는 기록',
        '이 운동일지는 오버레이 스타일 정보가 없는 예전 기록이라 오버레이만 저장하는 기능을 지원하지 않습니다.',
      );
      return;
    }
    const layoutNode = layoutOnlyRefs.current[session.id];
    if (!layoutNode) {
      Alert.alert('저장 실패', '다시 시도해 주세요.');
      return;
    }
    try {
      await new Promise(resolve => requestAnimationFrame(resolve));
      const ratio = Math.max(PixelRatio.get(), 4);
      const uri = await captureRef(layoutNode, {
        format: 'png', quality: 1, result: 'tmpfile',
        pixelRatio: ratio,
        ...(Platform.OS === 'android'
          ? { width: Math.round(DET_PHOTO_W * ratio), height: Math.round(DET_PHOTO_H * ratio) }
          : {}),
      });
      await MediaLibrary.saveToLibraryAsync(uri);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('저장 완료', '오버레이 이미지 저장되었습니다.\n앱에서 이미지를 영상 위에 올려서 사용하시면되요!');
    } catch (e) {
      if (__DEV__) console.warn('[JournalScreen] handleSaveLayoutOnly 오류:', e);
      Alert.alert('저장에 실패했습니다', '다시 시도해 주세요.');
    }
  }

  async function handleDelete(session: WorkoutLog) {
    Alert.alert(
      '운동일지 삭제',
      '이 운동일지를 삭제하면 오늘의 오운완에서도 함께 삭제됩니다. 계속할까요?',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '삭제',
          style: 'destructive',
          onPress: async () => {
            try {
              await onDelete(session.id);
            } catch (e) {
              Alert.alert('삭제 실패', '다시 시도해 주세요.');
            }
          },
        },
      ],
    );
  }

  async function handleTogglePublic(session: WorkoutLog) {
    const status = publicStatusMap[session.id];
    if (!status) return;
    try {
      const newIsPublic = !status.isPublic;
      await updateFeedPostPublic(status.postId, newIsPublic);
      setPublicStatusMap(prev => ({
        ...prev,
        [session.id]: { ...status, isPublic: newIsPublic },
      }));
    } catch {
      Alert.alert('오류', '공개 여부 변경에 실패했습니다.');
    }
  }

  async function handleToggleShowOnGym(session: WorkoutLog) {
    const status = publicStatusMap[session.id];
    if (!status) return;
    try {
      const newShowOnGym = !status.showOnGym;
      await updateFeedPostShowOnGym(status.postId, newShowOnGym);
      setPublicStatusMap(prev => ({
        ...prev,
        [session.id]: { ...status, showOnGym: newShowOnGym },
      }));
    } catch {
      Alert.alert('오류', '헬스장 공개 여부 변경에 실패했습니다.');
    }
  }

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={['top']}>
        <View style={det.header}>
          <View style={{ flex: 1 }}>
            <Text style={det.gymName} numberOfLines={1}>{firstSession.gymName}</Text>
            <Text style={det.dateLine}>{dateStr}</Text>
          </View>
          <TouchableOpacity style={det.closeBtn} onPress={onClose} activeOpacity={0.7}>
            <Ionicons name="close" size={20} color={C.textSub} />
          </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 48 }}>
          {sessions.map((session, idx) => {
            const vol        = sessionVolume(session);
            const machines   = session.machines ?? [];
            const totalSets  = machines.reduce((a, m) => a + m.sets, 0);
            const muscles    = (session.targetMuscles && session.targetMuscles.length > 0)
              ? session.targetMuscles
              : [...new Set(machines.map(m => m.targetMuscle))];
            const photoUri   = session.compositeUri ?? session.photoUri;

            const muscleTitle = muscles.length > 1
              ? muscles.map(m => m.toUpperCase()).join(' + ')
              : `${(muscles[0] ?? 'WORKOUT').toUpperCase()} DAY`;

            return (
              <View key={session.id}>
                {idx > 0 && <View style={det.sessionDivider} />}

                {/* 오운완 사진 */}
                <View
                  ref={(ref) => { photoRefs.current[session.id] = ref as View | null; }}
                  style={[det.photoCard, { height: DET_PHOTO_H }]}
                >
                  {photoUri ? (
                    <ExpoImage
                      source={{ uri: localPhotoUriMap[session.id] ?? photoUri }}
                      style={StyleSheet.absoluteFill}
                      contentFit="contain"
                      cachePolicy="memory-disk"
                      onError={() => {}}
                    />
                  ) : (
                    <View style={det.photoBg} />
                  )}

                  {!session.compositeUri && (
                    <>
                      <View style={[det.photoLogoLeftWrap, { transform: [{ rotate: '90deg' }] }]}>
                        <GymPickLogo color="#ffffff" width={64} />
                      </View>
                      <View style={[det.photoLogoRightWrap, { transform: [{ rotate: '270deg' }] }]}>
                        <GymPickLogo color="#ffffff" width={64} />
                      </View>
                      <View style={det.photoOverlay}>
                        <View style={{ gap: 8 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            <Text style={det.photoMuscleTitle}>{muscleTitle}</Text>
                            {prMachines.size > 0 && (
                              <View style={det.photoPRBadge}>
                                <Text style={det.photoPRTxt}>NEW PR</Text>
                              </View>
                            )}
                          </View>
                          <ScrollView
                            showsVerticalScrollIndicator={false}
                            style={{ maxHeight: DET_PHOTO_H * 0.45 }}
                            nestedScrollEnabled
                          >
                            {machines.map(m => {
                              const brandTag = `[${m.machineBrand.toUpperCase().replace(/ /g, '_')}]`;
                              const namePart = m.machineName.toUpperCase().replace(/ /g, '_');
                              return (
                                <View key={m.machineId} style={{ gap: 1, marginBottom: 6 }}>
                                  <Text style={det.photoExName} numberOfLines={1}>{brandTag}_{namePart}</Text>
                                  {Array.from({ length: Math.min(m.sets, 4) }).map((_, si) => (
                                    <Text key={si} style={det.photoExSet}>
                                      {m.weight > 0 ? `${m.weight}kg` : '--'} x {m.reps}
                                    </Text>
                                  ))}
                                </View>
                              );
                            })}
                          </ScrollView>
                        </View>
                        <View />
                      </View>
                    </>
                  )}
                </View>

                {/* '오버레이만 저장'용 숨김 캡처 뷰 — 화면 밖에 투명 배경으로 렌더링해서
                    사진 없이 오버레이 레이아웃만 캡처한다. session.overlayStyle이 있을 때만
                    내용이 그려지고, 없으면 renderSessionOverlay가 null을 반환해 빈 뷰로 남는다. */}
                <View style={{ position: 'absolute', top: -9999, left: -9999, backgroundColor: 'transparent' }} pointerEvents="none">
                  <View
                    ref={(ref) => { layoutOnlyRefs.current[session.id] = ref as View | null; }}
                    collapsable={false}
                    style={{ width: DET_PHOTO_W, height: DET_PHOTO_H, backgroundColor: 'transparent' }}
                  >
                    {renderSessionOverlay(session)}
                  </View>
                </View>

                {/* 이미지 저장 + 공개/비공개 + 삭제 버튼 */}
                <View style={{ flexDirection: 'row', gap: 8, paddingVertical: 12 }}>
                  <TouchableOpacity
                    style={[det.photoActionBtn, { flex: 1 }]}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      if (Platform.OS === 'ios') {
                        ActionSheetIOS.showActionSheetWithOptions(
                          {
                            options: ['취소', '기기에 저장', '인스타그램에 업로드', '오버레이만 저장'],
                            cancelButtonIndex: 0,
                            title: '저장 방식 선택',
                          },
                          (buttonIndex) => {
                            if (buttonIndex === 1) handleSave(session);
                            if (buttonIndex === 2) handleInstagramShare(session);
                            if (buttonIndex === 3) handleSaveLayoutOnly(session);
                          }
                        );
                      } else {
                        Alert.alert(
                          '저장 방식 선택',
                          '어떻게 저장할까요?',
                          [
                            { text: '취소', style: 'cancel' },
                            { text: '기기에 저장', onPress: () => handleSave(session) },
                            { text: '인스타그램에 업로드', onPress: () => handleInstagramShare(session) },
                            { text: '오버레이만 저장', onPress: () => handleSaveLayoutOnly(session) },
                          ]
                        );
                      }
                    }}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="share-outline" size={16} color={C.text} />
                    <Text style={det.photoActionTxt}>저장 / 공유</Text>
                  </TouchableOpacity>

                  {publicStatusMap[session.id] !== undefined && publicStatusMap[session.id] !== null && (
                    <TouchableOpacity
                      style={[
                        det.photoActionBtn,
                        { flex: 1 },
                        publicStatusMap[session.id]?.isPublic
                          ? { borderColor: C.accent + '60', backgroundColor: C.accentBg }
                          : { borderColor: C.border },
                      ]}
                      onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); handleTogglePublic(session); }}
                      activeOpacity={0.8}
                    >
                      <Ionicons
                        name={publicStatusMap[session.id]?.isPublic ? 'eye-outline' : 'eye-off-outline'}
                        size={16}
                        color={publicStatusMap[session.id]?.isPublic ? C.accent : C.textSub}
                      />
                      <Text style={[
                        det.photoActionTxt,
                        { color: publicStatusMap[session.id]?.isPublic ? C.accent : C.textSub },
                      ]}>
                        {publicStatusMap[session.id]?.isPublic ? '공개중' : '비공개'}
                      </Text>
                    </TouchableOpacity>
                  )}

                  <TouchableOpacity
                    style={[det.photoActionBtn, { flex: 1, borderColor: C.danger + '60' }]}
                    onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy); handleDelete(session); }}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="trash-outline" size={16} color={C.danger} />
                    <Text style={[det.photoActionTxt, { color: C.danger }]}>삭제</Text>
                  </TouchableOpacity>
                </View>

                {/* 헬스장 페이지 공개/비공개 (F1-6) */}
                {publicStatusMap[session.id] !== undefined && publicStatusMap[session.id] !== null && (
                  <View style={{ paddingBottom: 12 }}>
                    <TouchableOpacity
                      style={[
                        det.photoActionBtn,
                        publicStatusMap[session.id]?.showOnGym
                          ? { borderColor: C.accent + '60', backgroundColor: C.accentBg }
                          : { borderColor: C.border },
                      ]}
                      onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); handleToggleShowOnGym(session); }}
                      activeOpacity={0.8}
                    >
                      <Ionicons
                        name="business-outline"
                        size={16}
                        color={publicStatusMap[session.id]?.showOnGym ? C.accent : C.textSub}
                      />
                      <Text style={[
                        det.photoActionTxt,
                        { color: publicStatusMap[session.id]?.showOnGym ? C.accent : C.textSub },
                      ]}>
                        {publicStatusMap[session.id]?.showOnGym ? '헬스장 페이지 공개중' : '헬스장 페이지 비공개'}
                      </Text>
                    </TouchableOpacity>
                    {publicStatusMap[session.id]?.isPublic === false && (
                      <Text style={{ fontSize: 11, color: C.textDim, marginTop: 6, textAlign: 'center' }}>
                        피드 비공개 상태라 헬스장 페이지에도 보이지 않아요
                      </Text>
                    )}
                  </View>
                )}

                {/* 운동일지 요약 보기 */}
                <TouchableOpacity
                  style={det.summaryBtn}
                  onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onOpenSummary(session); }}
                  activeOpacity={0.85}
                >
                  <Ionicons name="stats-chart-outline" size={16} color={C.bg} />
                  <Text style={det.summaryBtnTxt}>운동일지 요약 보기</Text>
                </TouchableOpacity>

                {/* 운동 노트 */}
                {machines.some(m => m.note) && (
                  <View style={det.noteSection}>
                    <Text style={det.sectionTitle}>운동 노트</Text>
                    {machines
                      .filter(m => m.note)
                      .map(m => (
                        <View key={m.machineId} style={det.noteSectionItem}>
                          <Text style={det.noteSectionMachine}>{m.machineName}</Text>
                          <Text style={det.noteSectionText}>{m.note}</Text>
                        </View>
                      ))
                    }
                  </View>
                )}

                {/* Stats */}
                <View style={det.statsRow}>
                  {[
                    { val: machines.length, lab: '운동' },
                    { val: totalSets,       lab: '세트' },
                    { val: vol > 0 ? (vol / 1000).toFixed(1) : '--', lab: '볼륨' },
                  ].map((item, i, arr) => (
                    <React.Fragment key={item.lab}>
                      <View style={det.stat}>
                        <Text style={det.statVal}>{item.val}</Text>
                        <Text style={det.statLab}>{item.lab}</Text>
                      </View>
                      {i < arr.length - 1 && <View style={det.statDiv} />}
                    </React.Fragment>
                  ))}
                </View>

                {/* 운동 루틴 + 타겟부위 칩 */}
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <Text style={[det.sectionTitle, { marginBottom: 0 }]}>운동 루틴</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, justifyContent: 'flex-end', flex: 1, marginLeft: 8 }}>
                    {muscles.map(m => {
                      const col = mp(m);
                      return (
                        <View key={m} style={[det.muscleChip, { backgroundColor: col.bg, borderColor: col.fg + '40' }]}>
                          <Text style={{ fontSize: 11, fontWeight: '700', color: col.fg }}>{m}</Text>
                        </View>
                      );
                    })}
                  </View>
                </View>

                {/* 루틴 카드 */}
                <View
                  ref={(ref) => { routineCardRefs.current[session.id] = ref as View | null; }}
                  collapsable={false}
                  style={[det.routineCard, { borderColor: session.overlayTextColor ?? '#ffffff' }]}
                >
                  <View style={det.routineCardHeader}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
                      <Text style={[det.routineCardGymName, { flex: 1, marginRight: 8 }]} numberOfLines={1}>{session.gymName}</Text>
                      <View style={{
                        backgroundColor: session.overlayTextColor ?? '#ffffff',
                        borderRadius: 20,
                        paddingHorizontal: 10,
                        paddingVertical: 3,
                      }}>
                        <Text style={{
                          fontSize: 10,
                          fontWeight: '800',
                          color: '#000000',
                          letterSpacing: 0.5,
                          textTransform: 'uppercase',
                        }}>
                          {(() => {
                            const muscleCounts = machines.reduce<Record<string, number>>((acc, m) => {
                              acc[m.targetMuscle] = (acc[m.targetMuscle] ?? 0) + 1;
                              return acc;
                            }, {});
                            const sorted = Object.entries(muscleCounts)
                              .sort(([, a], [, b]) => b - a)
                              .map(([m]) => m);
                            return sorted.length > 1
                              ? sorted.slice(0, 2).join(' + ')
                              : `${sorted[0] ?? 'WORKOUT'}`;
                          })()}
                        </Text>
                      </View>
                    </View>
                    <Text style={det.routineCardDate}>{(() => {
                      const d = new Date(session.date);
                      const pad = (n: number) => String(n).padStart(2, '0');
                      const ENG_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
                      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}(${ENG_DAYS[d.getDay()]})_${pad(d.getHours())}:${pad(d.getMinutes())}`;
                    })()}</Text>
                  </View>
                  <View style={det.routineDivider} />
                  {machines.map((m, i) => {
                    const brandKey  = m.machineBrand.toUpperCase().replace(/\s+/g, '_');
                    const brandLogo = brandLogos[brandKey];
                    const imageUrl  = getMachineImageUrl(m.machineId, { width: 128 });
                    return (
                      <React.Fragment key={m.machineId}>
                        {i > 0 && <View style={det.routineDivider} />}
                        <View style={det.routineRow}>
                          <TouchableOpacity
                            style={det.routineImgWrap}
                            activeOpacity={0.8}
                            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onOpenMachine(m.machineId, m.machineName, m.machineBrand, m.targetMuscle); }}
                          >
                            <ExpoImage
                              source={{ uri: imageUrl }}
                              style={{ width: '100%', height: '100%', backgroundColor: '#FFFFFF' }}
                              contentFit="contain"
                            />
                          </TouchableOpacity>
                          <View style={det.routineInfo}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                              <Text style={det.routineMachineName} numberOfLines={2}>{m.machineName}</Text>
                            </View>
                            {brandLogo ? (
                              <ExpoImage
                                source={brandLogo}
                                style={det.routineBrandLogo}
                                contentFit="contain"
                              />
                            ) : (
                              <Text style={det.routineBrandText}>{m.machineBrand}</Text>
                            )}
                          </View>
                          <View style={det.routineSets}>
                            {Array.from({ length: m.sets }).map((_, si) => (
                              <Text key={si} style={det.routineSetLine}>
                                {m.weight > 0 ? `${m.weight}kg` : '--'} × {m.reps}
                              </Text>
                            ))}
                          </View>
                        </View>
                      </React.Fragment>
                    );
                  })}
                  <View style={det.routineCardFooter}>
                    <GymPickLogo color="#000000" width={60} height={6} />
                  </View>
                </View>

                {/* 인스타 공유용 루틴카드 페이지 분할 */}
                {(() => {
                  const machines_list = machines ?? [];
                  const pc = Math.ceil(machines_list.length / RC_ITEMS_PER_PAGE);
                  return Array.from({ length: pc }).map((_, pageIdx) => {
                    const pageMachines = machines_list.slice(
                      pageIdx * RC_ITEMS_PER_PAGE,
                      (pageIdx + 1) * RC_ITEMS_PER_PAGE,
                    );
                    return (
                      <View
                        key={`rpage-${session.id}-${pageIdx}`}
                        style={{ position: 'absolute', top: -9999, left: -9999 }}
                        pointerEvents="none"
                      >
                        <View
                          ref={el => {
                            if (!routinePageRefs.current[session.id]) {
                              routinePageRefs.current[session.id] = [];
                            }
                            routinePageRefs.current[session.id][pageIdx] = el as View | null;
                          }}
                          collapsable={false}
                          style={{
                            width: PHOTO_W_J,
                            height: ROUTINE_CARD_H_J,
                            backgroundColor: '#FFFFFF',
                            borderWidth: 3,
                            borderColor: session.overlayTextColor ?? '#ffffff',
                            borderRadius: 16,
                            overflow: 'hidden',
                          }}
                        >
                          {/* 헤더 */}
                          <View style={{ paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#FFFFFF' }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
                              <Text style={{ fontSize: 15, fontWeight: '900', color: '#111111', flex: 1, marginRight: 8 }} numberOfLines={1}>
                                {session.gymName}
                              </Text>
                              <View style={{ backgroundColor: session.overlayTextColor ?? '#ffffff', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3 }}>
                                <Text style={{ fontSize: 10, fontWeight: '800', color: '#000000', letterSpacing: 0.5, textTransform: 'uppercase' }}>
                                  {pc > 1 ? `${pageIdx + 1}/${pc}` : (machines_list[0]?.targetMuscle ?? 'WORKOUT')}
                                </Text>
                              </View>
                            </View>
                            <Text style={{ fontSize: 11, color: '#888888', fontWeight: '500' }}>
                              {(() => {
                                const d = new Date(session.date);
                                const pad = (n: number) => String(n).padStart(2, '0');
                                const ENG_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
                                return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}(${ENG_DAYS[d.getDay()]})_${pad(d.getHours())}:${pad(d.getMinutes())}`;
                              })()}
                            </Text>
                          </View>
                          <View style={{ height: 1, backgroundColor: '#E5E5E5' }} />
                          <View style={{ flex: 1, overflow: 'hidden' }}>
                            {pageMachines.map((m, i) => {
                              const brandKey  = m.machineBrand.toUpperCase().replace(/\s+/g, '_');
                              const brandLogo = brandLogos[brandKey];
                              const imageUrl  = getMachineImageUrl(m.machineId, { width: 128 });
                              return (
                                <React.Fragment key={m.machineId}>
                                  {i > 0 && <View style={{ height: 1, backgroundColor: '#E5E5E5' }} />}
                                  <View style={{ flexDirection: 'row', alignItems: 'flex-start', padding: 12, gap: 10 }}>
                                    <View style={{ width: 64, height: 64, borderRadius: 10, overflow: 'hidden', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5E5E5' }}>
                                      <ExpoImage source={{ uri: localMachineImgMap[m.machineId] ?? imageUrl }} style={{ width: '100%', height: '100%', backgroundColor: '#FFFFFF' }} contentFit="contain" />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                      <Text style={{ fontSize: 12, fontWeight: '700', color: '#000000', lineHeight: 16, marginBottom: 4 }} numberOfLines={2}>
                                        {m.machineName.toUpperCase()}
                                      </Text>
                                      {brandLogo ? (
                                        <ExpoImage source={brandLogo} style={{ width: 56, height: 18 }} contentFit="contain" />
                                      ) : (
                                        <Text style={{ fontSize: 10, color: '#333333' }}>{m.machineBrand}</Text>
                                      )}
                                    </View>
                                    <View style={{ alignItems: 'flex-end', minWidth: 80 }}>
                                      {Array.from({ length: m.sets }).map((_, si) => (
                                        <Text key={si} style={{ fontSize: 11, fontWeight: '600', color: '#000000', lineHeight: 18 }}>
                                          {m.weight > 0 ? `${m.weight}kg` : '--'} × {m.reps}
                                        </Text>
                                      ))}
                                    </View>
                                  </View>
                                </React.Fragment>
                              );
                            })}
                          </View>
                          <View style={{ paddingHorizontal: 16, paddingVertical: 10, alignItems: 'flex-end', backgroundColor: '#FFFFFF' }}>
                            <GymPickLogo color="#000000" width={60} height={6} />
                          </View>
                        </View>
                      </View>
                    );
                  });
                })()}
              </View>
            );
          })}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

// --- Screen

export default function JournalScreen() {
  const { user } = useAuth();
  const nav   = useNavigation<any>();
  const route = useRoute<any>();
  const userId = user?.id ?? '';

  const { data: fetchedSessions, loading, refetch } = useFetch(
    () => {
      perfStart('JournalScreen:fetchWorkoutLogs');
      return fetchWorkoutLogs(userId).finally(() => perfEnd('JournalScreen:fetchWorkoutLogs'));
    },
    [userId],
  );

  useFocusEffect(useCallback(() => { refetch(); }, [refetch]));

  const sessions = useMemo(() => fetchedSessions ?? [], [fetchedSessions]);

  const sessionPRMap = useMemo(
    () => getSessionPRMachines(sessions),
    [sessions],
  );

  const handledSessionId = useRef<string | null>(null);

  const [logVisible,           setLogVisible]           = useState(false);
  const [detailSessions,       setDetailSessions]       = useState<WorkoutLog[]>([]);
  const [detailMachine,        setDetailMachine]        = useState<Machine | null>(null);
  const [machineDetailVisible, setMachineDetailVisible] = useState(false);
  const [splitConfig,    setSplitConfig]    = useState<UserSplitConfig | null>(null);
  const [todaySessions,  setTodaySessions]  = useState<WorkoutLog[]>([]);
  const [summarySession, setSummarySession] = useState<WorkoutLog | null>(null);

  const splitConfigRef = useRef<UserSplitConfig | null>(null);

  useEffect(() => {
    if (!user?.id) return;
    fetchSplitConfig(user.id).then(setSplitConfig).catch(() => {});
  }, [user?.id]);

  useEffect(() => {
    splitConfigRef.current = splitConfig;
  }, [splitConfig]);

  useEffect(() => {
    const today = new Date().toDateString();
    const todayList = sessions.filter(s => new Date(s.date).toDateString() === today);
    setTodaySessions(todayList);
  }, [sessions.map(s => s.id).join(',')]);

  useEffect(() => {
    const cfg = splitConfigRef.current;
    if (!cfg || cfg.splitType !== 'sequential') return;
    if (todaySessions.length === 0) return;
    if (!user?.id) return;

    const run = async () => {
      const lastUpdateKey = `split_updated_${new Date().toDateString()}`;
      const alreadyUpdated = await AsyncStorage.getItem(lastUpdateKey);
      if (alreadyUpdated) return;

      const completedTargets = extractCompletedTargets(
        todaySessions.flatMap(s => s.machines)
      );
      if (completedTargets.length === 0) return;

      const newIndex = calcNextIndex(
        cfg.workoutSplit as SequentialSplit,
        cfg.splitCurrentIndex,
        completedTargets
      );

      if (newIndex !== cfg.splitCurrentIndex) {
        await updateSplitIndex(user.id, newIndex);
        await AsyncStorage.setItem(lastUpdateKey, 'true');
        setSplitConfig(prev =>
          prev ? { ...prev, splitCurrentIndex: newIndex } : prev
        );
      }
    };

    run();
  }, [todaySessions, user?.id]);

  useEffect(() => {
    const id = route.params?.openSessionId;
    if (!id || handledSessionId.current === id) return;
    handledSessionId.current = id;
    const target = sessions.find((s: WorkoutLog) => s.id === id);
    if (target) {
      const daySessions = sessions.filter((s: WorkoutLog) =>
        isSameDay(new Date(s.date), new Date(target.date))
      );
      setDetailSessions(daySessions);
    }
  }, [route.params?.openSessionId]);

  const thisWeekCount = weeklyFrequency(sessions)[3];
  const totalVol      = sessions.reduce((a, s) => a + sessionVolume(s), 0);

  return (
    <SafeAreaView style={st.safe} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />

      <View style={st.header}>
        <View>
          <Text style={st.heading}>운동일지</Text>
          <Text style={st.headingSub}>
            {user
              ? `${sessions.length} 운동 · ${thisWeekCount} 이번 주`
              : '운동 기록'
            }
          </Text>
        </View>
        {user && (
          <TouchableOpacity style={st.logBtn} activeOpacity={0.85} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setLogVisible(true); }}>
            <Ionicons name="add" size={18} color={C.bg} />
            <Text style={st.logBtnText}>기록</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={st.scroll}>

        {/* Guest state */}
        {!user ? (
          <View style={st.emptyState}>
            <Ionicons name="journal-outline" size={48} color={C.textDim} />
            <Text style={st.emptyTitle}>아직 기록된 운동이 없어요.</Text>
            <Text style={st.emptySub}>로그인하고 운동을 기록해보세요.</Text>
            <TouchableOpacity
              style={st.emptySignInBtn}
              activeOpacity={0.85}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); nav.navigate('Profile'); }}
            >
              <Text style={st.emptySignInTxt}>로그인</Text>
            </TouchableOpacity>
          </View>
        ) : loading ? (
          <View style={st.emptyState}>
            <ActivityIndicator size="large" color={C.accent} />
          </View>
        ) : (
          <>
            {/* Stats strip */}
            {sessions.length > 0 && (
              <View style={st.statsRow}>
                {[
                  { val: sessions.length,              lab: '운동'  },
                  { val: thisWeekCount,                lab: '이번 주' },
                  { val: (totalVol / 1000).toFixed(1), lab: '볼륨'   },
                ].map(item => (
                  <View key={item.lab} style={st.statCard}>
                    <Text style={st.statVal}>{item.val}</Text>
                    <Text style={st.statLab}>{item.lab}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Split Banner */}
            {(() => {
              const banner = getSplitBannerMessage(splitConfig, todaySessions);
              return banner ? <SplitBanner message={banner.message} sub={banner.sub} /> : null;
            })()}

            {/* Retro weekly grid */}
            <RetroWeeklyGrid
              sessions={sessions}
              onSelectDay={(daySessions) => setDetailSessions(daySessions)}
              splitConfig={splitConfig}
            />

            {sessions.length === 0 && (
              <View style={[st.emptyState, { marginTop: 0, paddingTop: 40 }]}>
                <Ionicons name="barbell-outline" size={48} color={C.textDim} />
                <Text style={st.emptyTitle}>아직 운동일지가 없어요</Text>
                <Text style={st.emptySub}>"기록" 버튼을 눌러 첫 운동을 기록하세요.</Text>
              </View>
            )}
          </>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {user && (
        <>
          <PostWorkoutLogModal
            visible={logVisible}
            onClose={(saved) => { setLogVisible(false); if (saved) refetch(); }}
          />
          <SessionDetailModal
            sessions={detailSessions}
            prMachines={detailSessions.length > 0 ? (sessionPRMap[detailSessions[0].id] ?? new Set()) : new Set()}
            nickname={user?.nickname ?? user?.name}
            onClose={() => setDetailSessions([])}
            onOpenMachine={(machineId, machineName, machineBrand, targetMuscle) => {
              setDetailMachine({
                id:           machineId,
                name:         machineName,
                displayName:  machineName,
                brand:        machineBrand,
                targetMuscle: targetMuscle ?? '',
                category:     '',
                exerciseKind: 'machine',
              });
              setDetailSessions([]);
              setTimeout(() => setMachineDetailVisible(true), 400);
            }}
            onOpenSummary={(session) => {
              setDetailSessions([]);
              setTimeout(() => setSummarySession(session), 400);
            }}
            onDelete={async (sessionId) => {
              const session = detailSessions.find(s => s.id === sessionId);
              await deleteWorkoutSession(sessionId);
              // 세션이 Supabase 동기화에 실패해 sessionStore에만 존재하는 경우,
              // 위 deleteWorkoutSession은 대상 행이 없어 조용히 아무 일도 하지 않는다.
              // sessionStore에서도 함께 제거해야 refetch 후 목록에 다시 나타나지 않는다.
              removeSession(user?.id ?? 'guest', sessionId);
              if (user?.id) {
                await deleteFeedPostBySession(user.id, sessionId);
              }

              const remaining = detailSessions.filter(s => s.id !== sessionId);
              setDetailSessions(remaining);
              refetch();

              // 삭제 후 오늘 날짜 운동일지가 없으면 분할 인덱스 롤백
              if (user?.id && session) {
                const deletedDate = new Date(session.date);
                const today = new Date();
                const isToday =
                  deletedDate.getFullYear() === today.getFullYear() &&
                  deletedDate.getMonth()    === today.getMonth()    &&
                  deletedDate.getDate()     === today.getDate();

                if (isToday) {
                  const todayRemaining = remaining.filter(s => {
                    const d = new Date(s.date);
                    return (
                      d.getFullYear() === today.getFullYear() &&
                      d.getMonth()    === today.getMonth()    &&
                      d.getDate()     === today.getDate()
                    );
                  });

                  if (todayRemaining.length === 0) {
                    try {
                      const cfg = await fetchSplitConfig(user.id);
                      if (cfg && cfg.splitType === 'sequential') {
                        const split = cfg.workoutSplit as string[][];
                        const len   = split.length;
                        if (len > 0) {
                          const prevIndex = ((cfg.splitCurrentIndex - 1) + len) % len;
                          await updateSplitIndex(user.id, prevIndex);

                          const dateKey       = today.toISOString().slice(0, 10).replace(/-/g, '');
                          const lastUpdateKey = `split_last_update_${user.id}_${dateKey}`;
                          await AsyncStorage.removeItem(lastUpdateKey);

                          setSplitConfig(prev =>
                            prev ? { ...prev, splitCurrentIndex: prevIndex } : prev
                          );
                        }
                      }
                    } catch (e) {
                      if (__DEV__) console.warn('[JournalScreen] split rollback error:', e);
                    }
                  }
                }
              }
            }}
            userId={user?.id ?? null}
          />
          {summarySession && (
            <WorkoutLogSummaryModal
              session={summarySession}
              allSessions={sessions}
              onClose={() => setSummarySession(null)}
            />
          )}
          <MachineDetailModal
            visible={machineDetailVisible}
            machine={detailMachine}
            onClose={() => {
              setMachineDetailVisible(false);
              setDetailMachine(null);
            }}
          />
        </>
      )}
    </SafeAreaView>
  );
}

// --- Retro grid styles

const rg = StyleSheet.create({
  weekSection: {
    marginBottom: 28,
  },
  weekHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  weekNumText: {
    fontSize: 16,
    fontWeight: '700',
    color: C.text,
    marginRight: 10,
  },
  weekRangeText: {
    flex: 1,
    fontSize: 12,
    color: C.textSub,
    textAlign: 'center',
  },
  weekMore: {
    fontSize: 14,
    color: C.textDim,
    marginLeft: 10,
  },
  dayRow: {
    paddingHorizontal: 16,
    gap: 3,
  },
  dayCell: {
    width: RETRO_CELL_W,
    height: RETRO_CELL_H,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: C.surface,
  },
  dayCellToday: {
    borderWidth: 2,
    borderColor: C.accent,
  },
  dayCellFuture: {
    opacity: 0.3,
  },
  emptyCell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  emptyCellDate: {
    fontSize: 18,
    fontWeight: '700',
    color: C.textDim,
  },
  emptyCellDay: {
    fontSize: 10,
    color: C.textDim,
  },
  emptyCellTarget: {
    fontSize:   10,
    fontWeight: '700',
    color:      C.accent,
    marginTop:  2,
    textAlign:  'center',
  },
});

// --- Session detail styles

const det = StyleSheet.create({
  header:   { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 16, paddingVertical: 16 },
  gymName:  { fontSize: 18, fontWeight: '900', color: C.text, letterSpacing: -0.5 },
  dateLine: { fontSize: 12, color: C.textSub, marginTop: 3 },
  closeBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', marginTop: 2 },

  photoCard:          { width: DET_PHOTO_W, borderRadius: R.card, overflow: 'hidden', marginTop: 8, marginBottom: 8, alignSelf: 'center' },
  photoBg:            { ...StyleSheet.absoluteFillObject, backgroundColor: '#07070f' },
  photoLogoLeftWrap:  { position: 'absolute', left: 0, top: 0, bottom: 0, width: 22, justifyContent: 'center', alignItems: 'center', zIndex: 2 },
  photoLogoRightWrap: { position: 'absolute', right: 0, top: 0, bottom: 0, width: 22, justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 32, zIndex: 2 },
  photoOverlay:       { flex: 1, paddingVertical: 18, paddingHorizontal: 28, justifyContent: 'space-between' },
  photoMuscleTitle:   { fontSize: 24, fontWeight: '900', color: '#fff', letterSpacing: -0.5 },
  photoPRBadge:       { paddingHorizontal: 7, paddingVertical: 3, borderRadius: R.pill, backgroundColor: 'rgba(200,255,87,0.18)', borderWidth: 1, borderColor: 'rgba(200,255,87,0.4)' },
  photoPRTxt:         { fontSize: 9, fontWeight: '900', color: '#c8ff57' },
  photoExName:        { fontSize: 9, fontWeight: '900', color: '#fff', letterSpacing: 0.5 },
  photoExSet:         { fontSize: 10, fontWeight: '600', color: 'rgba(255,255,255,0.75)' },

  statsRow: { flexDirection: 'row', backgroundColor: C.surface, borderRadius: R.card, paddingVertical: 16, marginBottom: 16 },
  stat:     { flex: 1, alignItems: 'center' },
  statVal:  { fontSize: 20, fontWeight: '900', color: C.accent },
  statLab:  { fontSize: 10, color: C.textSub, fontWeight: '600', marginTop: 3 },
  statDiv:  { width: 1, backgroundColor: C.border },

  muscleChip:   { paddingHorizontal: 10, paddingVertical: 4, borderRadius: R.pill },
  sectionTitle: { ...T.section, color: C.text, marginBottom: 12 },
  exerciseCard: { backgroundColor: C.surface, borderRadius: R.card, overflow: 'hidden', marginBottom: 20 },
  divider:      { height: 1, backgroundColor: C.border },

  exBlock:   { paddingHorizontal: 14, paddingVertical: 12 },
  exBlockPR: { backgroundColor: C.accentBg },
  exHeader:  { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  exIcon:    { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  exName:    { fontSize: 13, fontWeight: '700', color: C.text },
  exBrand:   { fontSize: 11, color: C.textSub, marginTop: 1 },
  exPRBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: R.pill, backgroundColor: C.accent },
  exPRTxt:   { fontSize: 8, fontWeight: '900', color: '#000000', letterSpacing: 0.5 },

  setsBlock: { gap: 4, paddingLeft: 44 },
  setLine:   { flexDirection: 'row', alignItems: 'center', gap: 12 },
  setNum:    { fontSize: 10, fontWeight: '700', color: C.textDim, width: 40 },
  setVal:    { fontSize: 12, fontWeight: '700', color: C.text },

  noteBlock: { marginTop: 8, paddingLeft: 44 },
  noteLabel: { fontSize: 9, fontWeight: '700', color: C.textDim, letterSpacing: 0.8, marginBottom: 3 },
  noteText:  { fontSize: 12, color: C.textSub, lineHeight: 18 },

  noteSection:        { backgroundColor: C.surface, borderRadius: R.card, padding: 16, marginBottom: 16 },
  noteSectionItem:    { marginBottom: 10 },
  noteSectionMachine: { fontSize: 12, fontWeight: '700', color: C.accent, marginBottom: 4 },
  noteSectionText:    { fontSize: 13, color: C.textSub, lineHeight: 18 },

  routineCard:       { backgroundColor: '#FFFFFF', borderRadius: R.card, overflow: 'hidden', marginBottom: 20, borderWidth: 3, borderColor: '#ffffff' },
  routineCardHeader: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
  },
  routineCardGymName: {
    fontSize: 15,
    fontWeight: '900',
    color: '#111111',
    letterSpacing: -0.3,
    marginBottom: 2,
  },
  routineCardDate: {
    fontSize: 11,
    color: '#888888',
    fontWeight: '500',
  },
  routineCardFooter: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignItems: 'flex-end',
    backgroundColor: '#FFFFFF',
  },
  routineDivider:    { height: 1, backgroundColor: '#E5E5E5' },
  routineRow:        { flexDirection: 'row', alignItems: 'flex-start', padding: 12, gap: 10 },
  routineRowPR:      {},
  routineImgWrap:    { width: 64, height: 64, borderRadius: 10, overflow: 'hidden', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: C.border },
  routineInfo:       { flex: 1, justifyContent: 'center' },
  routineMachineName:{ fontSize: 12, fontWeight: '700', color: '#000000', lineHeight: 16 },
  routineBrandLogo:  { width: 56, height: 18, marginTop: 4 },
  routineBrandText:  { fontSize: 10, color: '#333333', marginTop: 4 },
  routineSets:       { alignItems: 'flex-end', justifyContent: 'center', minWidth: 80 },
  routineSetLine:    { fontSize: 11, fontWeight: '600', color: '#000000', lineHeight: 18 },

  photoActionRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  photoActionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: C.surface, borderRadius: R.inner, paddingVertical: 12, borderWidth: 1, borderColor: C.border },
  photoActionTxt: { fontSize: 13, fontWeight: '700', color: C.text },
  summaryBtn:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: C.accent, borderRadius: R.inner, paddingVertical: 12, marginBottom: 12 },
  summaryBtnTxt:  { fontSize: 13, fontWeight: '800', color: C.bg },
  sessionDivider: { height: 8, backgroundColor: C.surfaceHigh, marginVertical: 8 },
});

// --- Screen styles

const st = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: C.bg },
  scroll: { paddingBottom: 32 },

  header:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 24, paddingBottom: 16 },
  heading:    { fontSize: 28, fontWeight: '900', color: C.text, letterSpacing: -0.8 },
  headingSub: { fontSize: 12, color: C.textSub, marginTop: 4 },
  logBtn:     { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: C.accent, paddingHorizontal: 14, paddingVertical: 10, borderRadius: R.btn },
  logBtnText: { fontSize: 13, fontWeight: '800', color: C.bg },

  statsRow: { flexDirection: 'row', paddingHorizontal: 16, gap: 0, marginBottom: 24 },
  statCard: { flex: 1, alignItems: 'center', paddingVertical: 4 },
  statVal:  { fontSize: 22, fontWeight: '900', color: C.text },
  statLab:  { fontSize: 10, color: C.textSub, marginTop: 3, fontWeight: '600' },

  emptyState:     { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80, paddingBottom: 40 },
  emptyTitle:     { fontSize: 18, fontWeight: '800', color: C.text, marginTop: 16 },
  emptySub:       { fontSize: 13, color: C.textSub, marginTop: 8, textAlign: 'center', paddingHorizontal: 32 },
  emptySignInBtn: {
    marginTop: 24,
    backgroundColor: C.accent,
    borderRadius: R.btn,
    paddingHorizontal: 32,
    paddingVertical: 14,
  },
  emptySignInTxt: { fontSize: 14, fontWeight: '800', color: C.bg },
});
