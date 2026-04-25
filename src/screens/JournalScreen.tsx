import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  Modal,
  Dimensions,
  Image,
  ActivityIndicator,
  Alert,
  Share,
} from 'react-native';
import * as MediaLibrary from 'expo-media-library';
import { captureRef } from 'react-native-view-shot';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect, useRoute } from '@react-navigation/native';
import { Image as ExpoImage } from 'expo-image';
import { brandLogos } from '../constants/brandLogos';
import { C, R, T } from '../theme';
import { WorkoutLog, Machine } from '../data/types';
import { getSessionPRMachines } from '../data/workoutSessions';
import { fetchWorkoutLogs } from '../lib/db';
import { useFetch } from '../lib/useFetch';
import { useAuth } from '../context/AuthContext';
import PostWorkoutLogModal from './flow/PostWorkoutLogModal';
import MachineDetailModal from './flow/MachineDetailModal';
import GymPickLogo from '../components/GymPickLogo';

const { width: SCREEN_W } = Dimensions.get('window');

// Session detail photo dimensions
const DET_PHOTO_W = SCREEN_W - 32;
const DET_PHOTO_H_DEFAULT = Math.round(DET_PHOTO_W * 16 / 9);

// Retro grid cell dimensions — 3.5 visible per row, 4:3 ratio
const RETRO_CELL_W = Math.floor((SCREEN_W - 32) / 3.5);
const RETRO_CELL_H = Math.round(RETRO_CELL_W * 4 / 3);

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
  Legs:        C.tagMuscle,
  Shoulders:   { fg: '#ffd166', bg: '#ffd16618' },
  Arms:        C.tagCategory,
  Core:        { fg: '#06d6a0', bg: '#06d6a018' },
  'Full Body': { fg: '#a8dadc', bg: '#a8dadc18' },
  Glutes:      { fg: '#ff9ecd', bg: '#ff9ecd18' },
};

function mp(muscle: string) {
  return MUSCLE_COLORS[muscle] ?? { fg: C.textSub, bg: C.border };
}

const RETRO_DAY_LABELS = ['월', '화', '수', '목', '금', '토', '일'];

// --- Retro Weekly Grid

function RetroWeeklyGrid({
  sessions,
  onSelectSession,
}: {
  sessions: WorkoutLog[];
  onSelectSession: (s: WorkoutLog) => void;
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
                const photoSrc = session?.compositeUri ?? session?.photoUri;

                return (
                  <TouchableOpacity
                    key={i}
                    style={[
                      rg.dayCell,
                      isToday && rg.dayCellToday,
                      isFuture && rg.dayCellFuture,
                    ]}
                    activeOpacity={session ? 0.75 : 1}
                    onPress={() => session && onSelectSession(session)}
                  >
                    {photoSrc ? (
                      <>
                        <Image
                          source={{ uri: photoSrc }}
                          style={StyleSheet.absoluteFill}
                          resizeMode="cover"
                        />
                        <View style={rg.photoOverlay}>
                          <Text style={rg.photoDate}>{day.getDate()}</Text>
                          <Text style={rg.photoDay}>{RETRO_DAY_LABELS[i]}</Text>
                        </View>
                      </>
                    ) : (
                      <View style={rg.emptyCell}>
                        <Text style={rg.emptyCellDate}>{day.getDate()}</Text>
                        <Text style={rg.emptyCellDay}>{RETRO_DAY_LABELS[i]}</Text>
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
  session,
  prMachines,
  onClose,
  onOpenMachine,
}: {
  session:       WorkoutLog | null;
  prMachines:    Set<string>;
  onClose:       () => void;
  onOpenMachine: (machineId: string, machineName: string, machineBrand: string, targetMuscle?: string) => void;
}) {
  const nav      = useNavigation<any>();
  const photoRef    = useRef<View>(null);
  const [photoHeight, setPhotoHeight] = useState(DET_PHOTO_H_DEFAULT);

  // 이미지 로드 시 실제 비율로 높이 동적 조정
  const photoUri = session?.compositeUri ?? session?.photoUri;
  useEffect(() => {
    if (!photoUri) {
      setPhotoHeight(DET_PHOTO_H_DEFAULT);
      return;
    }
    Image.getSize(
      photoUri,
      (w, h) => {
        const ratio = h / w;
        setPhotoHeight(Math.round(DET_PHOTO_W * ratio));
      },
      () => setPhotoHeight(DET_PHOTO_H_DEFAULT),
    );
  }, [photoUri]);

  if (!session) return null;

  const vol       = sessionVolume(session);
  const totalSets = session.machines.reduce((a, m) => a + m.sets, 0);
  const muscles   = [...new Set(session.machines.map(m => m.targetMuscle))];

  const dateStr = new Date(session.date).toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  });
  const timeStr = new Date(session.date).toLocaleTimeString('en-US', {
    hour: '2-digit', minute: '2-digit',
  });

  const muscleCounts = session.machines.reduce<Record<string, number>>((acc, m) => {
    acc[m.targetMuscle] = (acc[m.targetMuscle] ?? 0) + 1; return acc;
  }, {});
  const sortedMuscles = Object.entries(muscleCounts)
    .sort(([, a], [, b]) => b - a)
    .map(([m]) => m.toUpperCase());
  const muscleTitle = sortedMuscles.length > 1
    ? sortedMuscles.slice(0, 2).join(' + ')
    : `${sortedMuscles[0] ?? 'WORKOUT'} DAY`;

  async function handleSave() {
    if (!session) return;
    const { status } = await MediaLibrary.requestPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('권한 필요', '사진 저장을 위해 사진 라이브러리 접근 권한이 필요합니다.');
      return;
    }
    try {
      if (session.compositeUri) {
        await MediaLibrary.saveToLibraryAsync(session.compositeUri);
        Alert.alert('저장 완료', '이미지가 저장되었습니다.');
      } else if (session.photoUri) {
        const uri = await captureRef(photoRef, { format: 'png', quality: 0.95, result: 'tmpfile' });
        await MediaLibrary.saveToLibraryAsync(uri);
        Alert.alert('저장 완료', '이미지가 저장되었습니다.');
      } else {
        Alert.alert('사진 없음', '저장할 사진이 없습니다.');
      }
    } catch {
      Alert.alert('저장 실패', '다시 시도해 주세요.');
    }
  }

  async function handleShare() {
    if (!session) return;
    const uri = session.compositeUri ?? session.photoUri;
    if (uri) {
      await Share.share({
        url: uri,
        message: `GymPick 운동 기록 - ${session.gymName}`,
        title: 'GymPick 오운완',
      });
    } else {
      const muscleStr = muscles.join(', ');
      await Share.share({
        message: `GymPick 운동 기록\n헬스장: ${session.gymName}\n날짜: ${dateStr}\n운동부위: ${muscleStr}\n총 세트: ${totalSets}세트`,
      });
    }
  }

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
        <View style={det.header}>
          <View style={{ flex: 1 }}>
            <Text style={det.gymName} numberOfLines={1}>{session.gymName}</Text>
            <Text style={det.dateLine}>{dateStr}  {timeStr}</Text>
          </View>
          <TouchableOpacity style={det.closeBtn} onPress={onClose} activeOpacity={0.7}>
            <Ionicons name="close" size={20} color={C.textSub} />
          </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 48 }}>

          {/* 오운완 사진 - 실제 비율로 동적 높이 */}
          <View ref={photoRef} style={[det.photoCard, { height: photoHeight }]}>
            {(session.compositeUri ?? session.photoUri) ? (
              <Image
                source={{ uri: (session.compositeUri ?? session.photoUri)! }}
                style={StyleSheet.absoluteFill}
                resizeMode="contain"
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
                      {session.machines.map(m => {
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

          {/* Save / Share buttons */}
          <View style={det.photoActionRow}>
            <TouchableOpacity style={det.photoActionBtn} onPress={handleSave} activeOpacity={0.8}>
              <Ionicons name="download-outline" size={16} color={C.text} />
              <Text style={det.photoActionTxt}>이미지 저장</Text>
            </TouchableOpacity>
            <TouchableOpacity style={det.photoActionBtn} onPress={handleShare} activeOpacity={0.8}>
              <Ionicons name="share-outline" size={16} color={C.text} />
              <Text style={det.photoActionTxt}>공유하기</Text>
            </TouchableOpacity>
          </View>

          {/* 운동 노트 */}
          {session.machines.some(m => m.note) && (
            <View style={det.noteSection}>
              <Text style={det.sectionTitle}>운동 노트</Text>
              {session.machines
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
              { val: session.machines.length, lab: '운동' },
              { val: totalSets,               lab: '세트'      },
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

          {/* Muscle chips */}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 20 }}>
            {muscles.map(m => {
              const col = mp(m);
              return (
                <View key={m} style={[det.muscleChip, { backgroundColor: col.bg, borderColor: col.fg + '40' }]}>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: col.fg }}>{m}</Text>
                </View>
              );
            })}
          </View>

          {/* 운동 루틴 */}
          <Text style={det.sectionTitle}>운동 루틴</Text>
          <View style={det.routineCard}>
            {session.machines.map((m, i) => {
              const isPR      = prMachines.has(m.machineId);
              const brandKey  = m.machineBrand.toUpperCase().replace(/\s+/g, '_');
              const brandLogo = brandLogos[brandKey];
              const imageUrl  = `https://okrouzqqvfioodfieljv.supabase.co/storage/v1/object/public/machine-images/${m.machineId}.webp`;

              return (
                <React.Fragment key={m.machineId}>
                  {i > 0 && <View style={det.routineDivider} />}
                  <View style={[det.routineRow, isPR && det.routineRowPR]}>

                    {/* 좌측: 머신 이미지 */}
                    <TouchableOpacity
                      style={det.routineImgWrap}
                      activeOpacity={0.8}
                      onPress={() => onOpenMachine(m.machineId, m.machineName, m.machineBrand, m.targetMuscle)}
                    >
                      <ExpoImage
                        source={{ uri: imageUrl }}
                        style={{ width: '100%', height: '100%', backgroundColor: '#FFFFFF' }}
                        contentFit="contain"
                      />
                    </TouchableOpacity>

                    {/* 중간: 머신명 + 제조사 로고 */}
                    <View style={det.routineInfo}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                        <Text style={det.routineMachineName} numberOfLines={2}>{m.machineName}</Text>
                        {isPR && (
                          <View style={det.exPRBadge}>
                            <Text style={det.exPRTxt}>PR</Text>
                          </View>
                        )}
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

                    {/* 우측: 세트 목록 */}
                    <View style={det.routineSets}>
                      {Array.from({ length: Math.min(m.sets, 6) }).map((_, si) => (
                        <Text
                          key={si}
                          style={det.routineSetLine}
                        >
                          {m.weight > 0 ? `${m.weight}kg` : '--'} × {m.reps}
                        </Text>
                      ))}
                      {m.sets > 6 && (
                        <Text style={det.routineSetMore}>+{m.sets - 6}세트</Text>
                      )}
                    </View>

                  </View>
                </React.Fragment>
              );
            })}
          </View>
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
    () => fetchWorkoutLogs(userId),
    [userId],
  );

  useFocusEffect(useCallback(() => { refetch(); }, [refetch]));

  const sessions = fetchedSessions ?? [];

  const sessionPRMap = useMemo(
    () => getSessionPRMachines(sessions),
    [sessions],
  );

  const [logVisible,           setLogVisible]           = useState(false);
  const [detailSession,        setDetailSession]        = useState<WorkoutLog | null>(null);
  const [detailMachine,        setDetailMachine]        = useState<Machine | null>(null);
  const [machineDetailVisible, setMachineDetailVisible] = useState(false);

  useEffect(() => {
    const openSessionId = route.params?.openSessionId;
    if (openSessionId && sessions.length > 0) {
      const target = sessions.find((s: WorkoutLog) => s.id === openSessionId);
      if (target) setDetailSession(target);
    }
  }, [route.params?.openSessionId, sessions]);

  const thisWeekCount = weeklyFrequency(sessions)[3];
  const totalVol      = sessions.reduce((a, s) => a + sessionVolume(s), 0);

  return (
    <SafeAreaView style={st.safe}>
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
          <TouchableOpacity style={st.logBtn} activeOpacity={0.85} onPress={() => setLogVisible(true)}>
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
              onPress={() => nav.navigate('Profile')}
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

            {/* Retro weekly grid */}
            <RetroWeeklyGrid
              sessions={sessions}
              onSelectSession={setDetailSession}
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
            session={detailSession}
            prMachines={detailSession ? (sessionPRMap[detailSession.id] ?? new Set()) : new Set()}
            onClose={() => setDetailSession(null)}
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
              setDetailSession(null);
              setTimeout(() => setMachineDetailVisible(true), 400);
            }}
          />
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
  photoOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.52)',
    paddingHorizontal: 5,
    paddingVertical: 4,
  },
  photoDate: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
    lineHeight: 14,
  },
  photoDay: {
    fontSize: 9,
    color: 'rgba(255,255,255,0.8)',
    lineHeight: 11,
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
  exPRBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: R.pill, backgroundColor: C.accentBg, borderWidth: 1, borderColor: C.accent + '60' },
  exPRTxt:   { fontSize: 8, fontWeight: '900', color: C.accent, letterSpacing: 0.5 },

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

  routineCard:       { backgroundColor: '#FFFFFF', borderRadius: R.card, overflow: 'hidden', marginBottom: 20 },
  routineDivider:    { height: 1, backgroundColor: '#E5E5E5' },
  routineRow:        { flexDirection: 'row', alignItems: 'flex-start', padding: 12, gap: 10 },
  routineRowPR:      { backgroundColor: '#F0FFF0' },
  routineImgWrap:    { width: 64, height: 64, borderRadius: 10, overflow: 'hidden', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: C.border },
  routineInfo:       { flex: 1, justifyContent: 'center' },
  routineMachineName:{ fontSize: 12, fontWeight: '700', color: '#000000', lineHeight: 16 },
  routineBrandLogo:  { width: 56, height: 18, marginTop: 4 },
  routineBrandText:  { fontSize: 10, color: '#333333', marginTop: 4 },
  routineSets:       { alignItems: 'flex-end', justifyContent: 'center', minWidth: 80 },
  routineSetLine:    { fontSize: 11, fontWeight: '600', color: '#000000', lineHeight: 18 },
  routineSetMore:    { fontSize: 10, color: '#666666', marginTop: 2 },

  photoActionRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  photoActionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: C.surface, borderRadius: R.inner, paddingVertical: 12 },
  photoActionTxt: { fontSize: 13, fontWeight: '700', color: C.text },
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
