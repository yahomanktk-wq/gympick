/**
 * RoutineReferenceScreen
 * PostWorkoutLogModal 내부 스텝 컴포넌트 (Modal 아님).
 * 헬스장·부위 선택 직후 등장, 4개 섹션 제공:
 *   1) 새 루틴 작성 (Start Fresh)
 *   2) 이전 운동일지 참고
 *   3) 헬스장 추천 루틴
 *   4) 다른 유저 루틴
 *
 * onSelectMachineIds(ids) → 선택한 루틴의 machineId 배열 반환
 * onSelectMachineIds([])  → Start Fresh (빈 리스트)
 */

import React, { useMemo, useState, useEffect, useRef } from 'react';
import type { OnboardingPointKey } from '../../data/onboardingSteps';
import type { SpotlightRect } from '../../components/OnboardingTooltip';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { C, R, T } from '../../theme';
import { WorkoutLog } from '../../data/types';
import { MACHINES } from '../../data';
import {
  getCommunityRoutines,
  GymRoutine,
  CommunityRoutine,
} from '../../data/routineStore';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type MachineExtraInfo = Record<string, { name: string; brand: string; targetMuscle: string }>;

export interface RoutineReferenceScreenProps {
  gymId: string;
  gymName: string;
  selectedMuscles: string[]; // e.g. ['Chest', 'Back']
  pastSessions: WorkoutLog[];
  onSelectMachineIds: (ids: string[], extraInfo?: MachineExtraInfo) => void; // [] = start fresh
  onBack: () => void;
  onClose: () => void;
  onRegisterRect?: (key: OnboardingPointKey, rect: SpotlightRect) => void;
  onboardingActive?: boolean;
  onboardingKey?: OnboardingPointKey | null;
  onJumpToExerciseGrid?: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const MACHINE_NAME: Record<string, string> = Object.fromEntries(
  MACHINES.map((m) => [m.id, m.name]),
);

function machineName(id: string) {
  return MACHINE_NAME[id] ?? id;
}

/** Format "2026-03-10" → "Mar 10" */
function fmtDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ─────────────────────────────────────────────────────────────────────────────
// NavHeader atom (mirrors PostWorkoutLogModal atom)
// ─────────────────────────────────────────────────────────────────────────────

function NavHeader({
  title,
  onBack,
  onClose,
}: {
  title: string;
  onBack?: () => void;
  onClose: () => void;
}) {
  return (
    <View style={s.navHeader}>
      {onBack ? (
        <TouchableOpacity style={s.navBtn} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onBack!(); }} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={20} color={C.text} />
        </TouchableOpacity>
      ) : (
        <View style={s.navBtn} />
      )}
      <Text style={s.navTitle} numberOfLines={1}>
        {title}
      </Text>
      <TouchableOpacity style={s.navBtn} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onClose(); }} activeOpacity={0.7}>
        <Ionicons name="close" size={20} color={C.textSub} />
      </TouchableOpacity>
    </View>
  );
}

function StepBar({ total, current }: { total: number; current: number }) {
  return (
    <View style={s.stepBar}>
      {Array.from({ length: total }).map((_, i) => (
        <View
          key={i}
          style={[s.stepSeg, { backgroundColor: i <= current ? C.accent : C.border }]}
        />
      ))}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Section header
// ─────────────────────────────────────────────────────────────────────────────

function SectionHeader({ icon, label }: { icon: React.ComponentProps<typeof Ionicons>['name']; label: string }) {
  return (
    <View style={s.sectionHeader}>
      <Ionicons name={icon} size={15} color={C.accent} />
      <Text style={s.sectionLabel}>{label}</Text>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Section 2 – Past workout log card
// ─────────────────────────────────────────────────────────────────────────────

function PastSessionCard({
  session,
  onPress,
}: {
  session: WorkoutLog;
  onPress: () => void;
}) {
  const machineList = session.machines.map((m) => m.machineName).join(' · ');
  const muscles = [...new Set(session.machines.map((m) => m.targetMuscle))];

  return (
    <TouchableOpacity style={s.card} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onPress(); }} activeOpacity={0.8}>
      <View style={s.cardRow}>
        <View style={s.cardIcon}>
          <Ionicons name="calendar-outline" size={18} color={C.accent} />
        </View>
        <View style={{ flex: 1 }}>
          <View style={s.cardTopRow}>
            <Text style={s.cardTitle}>{fmtDate(session.date)}</Text>
            <View style={s.tagRow}>
              {muscles.slice(0, 2).map((m) => (
                <View key={m} style={s.muscleTag}>
                  <Text style={s.muscleTagText}>{m}</Text>
                </View>
              ))}
            </View>
          </View>
          <Text style={s.cardSub} numberOfLines={1}>
            {machineList}
          </Text>
          <Text style={s.cardHint}>
            {session.machines.length} machine{session.machines.length !== 1 ? 's' : ''}
            {'  ·  '}
            Machine list only — sets not copied
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={15} color={C.textDim} style={s.cardChevron} />
      </View>
    </TouchableOpacity>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Section 3 – Gym recommended routine card
// ─────────────────────────────────────────────────────────────────────────────

function GymRoutineCard({
  routine,
  onPress,
}: {
  routine: GymRoutine;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={s.card} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onPress(); }} activeOpacity={0.8}>
      <View style={s.cardRow}>
        <View style={[s.cardIcon, { backgroundColor: C.tagBrand.bg }]}>
          <Ionicons name="medal-outline" size={18} color={C.tagBrand.fg} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.cardTitle}>{routine.name}</Text>
          <Text style={s.cardSub} numberOfLines={1}>
            {routine.machineIds.map(machineName).join(' · ')}
          </Text>
          <Text style={s.cardHint}>
            by {routine.authorLabel}{'  ·  '}{routine.machineIds.length}개 머신
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={15} color={C.textDim} style={s.cardChevron} />
      </View>
    </TouchableOpacity>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Section 4 – Community routine card
// ─────────────────────────────────────────────────────────────────────────────

function CommunityRoutineCard({
  routine,
  onPress,
}: {
  routine: CommunityRoutine;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={s.card} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onPress(); }} activeOpacity={0.8}>
      <View style={s.cardRow}>
        <View style={[s.cardIcon, { backgroundColor: C.tagCategory.bg }]}>
          <Ionicons name="people-outline" size={18} color={C.tagCategory.fg} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.cardTitle}>{routine.name}</Text>
          <Text style={s.cardSub} numberOfLines={1}>
            {routine.machineIds.map(machineName).join(' · ')}
          </Text>
          <Text style={s.cardHint}>
            공유: {routine.sharedByLabel}{'  ·  '}{routine.machineIds.length}개 머신
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={15} color={C.textDim} style={s.cardChevron} />
      </View>
    </TouchableOpacity>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

export default function RoutineReferenceScreen({
  gymId,
  gymName,
  selectedMuscles,
  pastSessions,
  onSelectMachineIds,
  onBack,
  onClose,
  onRegisterRect,
  onboardingActive,
  onboardingKey,
  onJumpToExerciseGrid,
}: RoutineReferenceScreenProps) {
  const startFreshRef   = useRef<View>(null);
  const pastSessionsRef = useRef<View>(null);
  const gymRoutinesRef  = useRef<View>(null);
  const scrollRef       = useRef<ScrollView>(null);
  const scrollYRef      = useRef(0);

  useEffect(() => {
    if (!onboardingActive) return;
    const measure = (key: OnboardingPointKey, ref: React.RefObject<View | null>) => {
      requestAnimationFrame(() => {
        ref.current?.measureInWindow((x, y, width, height) => {
          onRegisterRect?.(key, { x, y, width, height });
        });
      });
    };
    if (onboardingKey === 'routine-new')  measure('routine-new', startFreshRef);
    if (onboardingKey === 'routine-past') measure('routine-past', pastSessionsRef);
    if (onboardingKey === 'routine-recommended') {
      // 1) 현재 화면 기준 위치 측정
      gymRoutinesRef.current?.measureInWindow((mx, my, mw, mh) => {
        const screenHeight = Dimensions.get('window').height;
        // 화면 아래로 잘려 있으면 스크롤 이동
        if (my + mh > screenHeight || my < 0) {
          const targetY = scrollYRef.current + my - 100;
          scrollRef.current?.scrollTo({ y: Math.max(targetY, 0), animated: true });
          setTimeout(() => {
            gymRoutinesRef.current?.measureInWindow((mx2, my2, mw2, mh2) => {
              onRegisterRect?.('routine-recommended', { x: mx2, y: my2, width: mw2, height: mh2 });
            });
          }, 350);
        } else {
          onRegisterRect?.('routine-recommended', { x: mx, y: my, width: mw, height: mh });
        }
      });
    }
  }, [onboardingActive, onboardingKey]);

  useEffect(() => {
    // 3단계 툴팁이 모두 끝나면 (onboardingKey가 routine 관련 키에서 벗어나면) 최상단으로 스크롤
    const routineKeys: (OnboardingPointKey | null | undefined)[] = ['routine-new', 'routine-past', 'routine-recommended'];
    if (!onboardingActive || (onboardingKey !== null && routineKeys.includes(onboardingKey))) return;
    // onboardingKey가 routine 키가 아닌 다른 키이거나 null이면 최상단으로
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  }, [onboardingKey, onboardingActive]);

  // Filter past sessions: same gym, at least one muscle overlap
  const filteredPast = useMemo(() => {
    const muscleSet = new Set(selectedMuscles);
    return pastSessions
      .filter(
        (s) =>
          s.gymId === gymId &&
          s.machines.some((m) => muscleSet.has(m.targetMuscle)),
      )
      .slice(0, 5); // show up to 5 recent
  }, [pastSessions, gymId, selectedMuscles]);

  const [gymRoutines, setGymRoutines] = useState<GymRoutine[]>([]);

  useEffect(() => {
    async function load() {
      try {
        const { supabase } = await import('../../lib/supabase');
        const { data, error } = await supabase
          .from('gym_routines')
          .select('id, gym_id, name, body_part, machine_ids, created_at')
          .eq('gym_id', gymId)
          .order('created_at', { ascending: true });

        if (error || !data) return;

        const filtered = selectedMuscles.length === 1
          ? data.filter(r => r.body_part === selectedMuscles[0] || r.body_part === '전체')
          : data;

        setGymRoutines(filtered.map(r => ({
          id:          r.id as string,
          gymId:       r.gym_id as string,
          name:        r.name as string,
          bodyPart:    r.body_part as string,
          machineIds:  (r.machine_ids ?? []) as string[],
          authorLabel: '',
        })));
      } catch (e) {
        if (__DEV__) console.warn('[RoutineReferenceScreen] gym_routines fetch error:', e);
      }
    }
    load();
  }, [gymId, selectedMuscles]);

  const communityRoutines = useMemo(
    () =>
      selectedMuscles.length === 1
        ? getCommunityRoutines(gymId, selectedMuscles[0])
        : getCommunityRoutines(gymId),
    [gymId, selectedMuscles],
  );

  const muscleLabel = selectedMuscles.join(' + ');

  return (
    <SafeAreaView style={s.safe}>
      <NavHeader title="Choose a Routine" onBack={onBack} onClose={onClose} />
      <StepBar total={6} current={2} />

      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.scroll}
        onScroll={(e) => { scrollYRef.current = e.nativeEvent.contentOffset.y; }}
        scrollEventThrottle={16}
      >
        <Text style={s.gymLabel}>
          <Ionicons name="location-outline" size={12} color={C.textSub} />
          {'  '}{gymName}{'  ·  '}{muscleLabel}
        </Text>

        {/* ── Section 1: Start Fresh ─────────────────────────── */}
        <View
          ref={startFreshRef}
          onLayout={() => {
            if (onboardingActive) {
              startFreshRef.current?.measureInWindow((x, y, width, height) => {
                onRegisterRect?.('routine-new', { x, y, width, height });
              });
            }
          }}
        >
          <SectionHeader icon="add-circle-outline" label="Start Fresh" />
          <TouchableOpacity
            style={[s.card, s.startFreshCard]}
            onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            if (onboardingActive) onJumpToExerciseGrid?.();
            onSelectMachineIds([]);
          }}
            activeOpacity={0.8}
          >
            <View style={s.cardRow}>
              <View style={[s.cardIcon, { backgroundColor: C.accentBg ?? C.accent + '18' }]}>
                <Ionicons name="create-outline" size={18} color={C.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.cardTitle, { color: C.accent }]}>새 루틴 작성하기</Text>
                <Text style={s.cardSub}>
                  머신을 직접 추가하며 오늘 루틴을 만들어요
                </Text>
                <Text style={s.cardHint}>운동 종료 후 루틴 저장 옵션 제공</Text>
              </View>
              <Ionicons name="chevron-forward" size={15} color={C.accent} style={s.cardChevron} />
            </View>
          </TouchableOpacity>
        </View>

        {/* ── Section 2: Past workout logs ──────────────────── */}
        <View
          ref={pastSessionsRef}
          onLayout={() => {
            if (onboardingActive) {
              pastSessionsRef.current?.measureInWindow((x, y, width, height) => {
                onRegisterRect?.('routine-past', { x, y, width, height });
              });
            }
          }}
        >
          <SectionHeader icon="time-outline" label="이전 운동일지 참고" />
          {filteredPast.length === 0 ? (
            <View style={s.emptyBox}>
              <Text style={s.emptyText}>
                {gymName}에서 {muscleLabel} 기록이 없어요
              </Text>
            </View>
          ) : (
            filteredPast.map((session) => (
              <PastSessionCard
                key={session.id}
                session={session}
                onPress={() => {
                  const ids = session.machines.map((m) => m.machineId);
                  const extraInfo: MachineExtraInfo = {};
                  session.machines.forEach((m) => {
                    extraInfo[m.machineId] = {
                      name: m.machineName,
                      brand: m.machineBrand ?? '',
                      targetMuscle: m.targetMuscle,
                    };
                  });
                  onSelectMachineIds(ids, extraInfo);
                }}
              />
            ))
          )}
        </View>

        {/* ── Section 3: Gym recommended routines ───────────── */}
        <View
          ref={gymRoutinesRef}
          onLayout={() => {
            if (onboardingActive) {
              gymRoutinesRef.current?.measureInWindow((x, y, width, height) => {
                onRegisterRect?.('routine-recommended', { x, y, width, height });
              });
            }
          }}
        >
          <SectionHeader icon="medal-outline" label="헬스장 추천 루틴" />
          {gymRoutines.length === 0 ? (
            <View style={s.emptyBox}>
              <Text style={s.emptyText}>등록된 추천 루틴이 없어요</Text>
            </View>
          ) : (
            gymRoutines.map((r) => (
              <GymRoutineCard
                key={r.id}
                routine={r}
                onPress={() => onSelectMachineIds(r.machineIds)}
              />
            ))
          )}
        </View>

        {/* ── Section 4: Community routines ─────────────────── */}
        <SectionHeader icon="people-outline" label="다른 유저 루틴" />
        {communityRoutines.length === 0 ? (
          <View style={s.emptyBox}>
            <Text style={s.emptyText}>공유된 루틴이 없어요</Text>
          </View>
        ) : (
          communityRoutines.map((r) => (
            <CommunityRoutineCard
              key={r.id}
              routine={r}
              onPress={() => onSelectMachineIds(r.machineIds)}
            />
          ))
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: C.bg,
  },

  // NavHeader
  navHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.border,
  },
  navBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  navTitle: {
    flex: 1,
    textAlign: 'center',
    ...T.section,
    color: C.text,
  },

  // StepBar
  stepBar: {
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  stepSeg: {
    flex: 1,
    height: 3,
    borderRadius: 2,
  },

  // Scroll
  scroll: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },

  gymLabel: {
    ...T.micro,
    color: C.textSub,
    marginBottom: 16,
  },

  // Section header
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 20,
    marginBottom: 10,
  },
  sectionLabel: {
    ...T.label,
    color: C.textSub,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },

  // Generic card
  card: {
    backgroundColor: C.surface,
    borderRadius: R.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.border,
    marginBottom: 8,
    padding: 14,
  },
  startFreshCard: {
    borderColor: C.accent + '40',
    backgroundColor: C.accent + '08',
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  cardIcon: {
    width: 36,
    height: 36,
    borderRadius: R.inner,
    backgroundColor: C.surfaceHigh,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 1,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  cardTitle: {
    ...T.body,
    color: C.text,
    fontWeight: '600',
  },
  cardSub: {
    ...T.label,
    color: C.textSub,
    marginTop: 2,
  },
  cardHint: {
    ...T.micro,
    color: C.textDim,
    marginTop: 4,
  },
  cardChevron: {
    alignSelf: 'center',
    marginLeft: 4,
  },

  // Muscle tags
  tagRow: {
    flexDirection: 'row',
    gap: 4,
  },
  muscleTag: {
    backgroundColor: C.tagMachine.bg,
    borderRadius: R.pill,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  muscleTagText: {
    ...T.micro,
    color: C.tagMachine.fg,
  },

  // Empty state
  emptyBox: {
    backgroundColor: C.surface,
    borderRadius: R.inner,
    paddingVertical: 16,
    paddingHorizontal: 14,
    marginBottom: 8,
    alignItems: 'center',
  },
  emptyText: {
    ...T.label,
    color: C.textDim,
  },
});
