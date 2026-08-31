import React, { useEffect, useState } from 'react';
import { Modal, View, ActivityIndicator } from 'react-native';
import { SafeAreaView, SafeAreaProvider } from 'react-native-safe-area-context';
import { C } from '../../theme';
import type { WorkoutLog, WorkoutEntry, WorkoutSet } from '../../data/types';
import { getMachinePRsFromSets } from '../../data/workoutSessions';
import { fetchWorkoutEntriesForSessions, fetchWorkoutSetsForEntries } from '../../lib/db/workouts';
import { FREE_WEIGHTS } from '../../data/freeWeights';
import { WorkoutDoneStep, ExerciseInfo, SetEntry } from './PostWorkoutLogModal';

interface Props {
  session: WorkoutLog;
  allSessions: WorkoutLog[];
  onClose: () => void;
}

interface SummaryData {
  exercises: ExerciseInfo[];
  logs: Record<string, SetEntry[]>;
  detectedPRs: { name: string; weight: number; reps: number }[];
  selectedMuscles: Set<string>;
  pastSessions: WorkoutLog[];
  pastEntries: WorkoutEntry[];
  pastSets: WorkoutSet[];
  realPRs: Record<string, { weight: number; reps: number }>;
}

// 저장된 운동일지를 저장 이후에 다시 열어보기 위한 화면.
// 운동일지 작성 완료 직후 뜨는 WorkoutDoneStep과 동일한 컴포넌트를 그대로 재사용하되,
// 비교 대상(pastEntries/pastSets/sessions)과 PR 기준(realPRs)을 전부
// "이 운동일지가 저장된 시점보다 이전" 데이터로만 한정해서 넘긴다.
// → 이후에 새 운동일지를 더 쌓아도, 예전에 저장했던 요약 내용은 그대로 유지된다.
export default function WorkoutLogSummaryModal({ session, allSessions, onClose }: Props) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<SummaryData | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const allSessionIds = allSessions.map(s => s.id);
      const allEntries    = await fetchWorkoutEntriesForSessions(allSessionIds);
      const allEntryIds   = allEntries.map(e => e.id);
      const allSets       = await fetchWorkoutSetsForEntries(allEntryIds);
      if (cancelled) return;

      const entriesForTarget = allEntries.filter(e => e.sessionId === session.id);
      const targetEntryIds   = new Set(entriesForTarget.map(e => e.id));
      const setsForTarget    = allSets.filter(st => targetEntryIds.has(st.entryId));

      // "그 당시 직전 기록" 기준: 이 운동일지보다 날짜가 이른 세션들만 비교 대상으로 사용
      const pastSessions   = allSessions.filter(s => s.id !== session.id && s.date < session.date);
      const pastSessionIds = new Set(pastSessions.map(s => s.id));
      const pastEntries    = allEntries.filter(e => pastSessionIds.has(e.sessionId));
      const pastEntryIds   = new Set(pastEntries.map(e => e.id));
      const pastSets       = allSets.filter(st => pastEntryIds.has(st.entryId));

      // "그 세션 시점까지의 PR" — 이후에 세운 PR은 반영하지 않는다
      const realPRs = getMachinePRsFromSets(pastEntries, pastSets);

      const exercises: ExerciseInfo[] = entriesForTarget.map(e => ({
        id: `${e.machineId}#${e.id}`,
        name: e.machineName,
        brand: e.machineBrand,
        targetMuscle: e.targetMuscle,
      }));

      const logs: Record<string, SetEntry[]> = {};
      for (const e of entriesForTarget) {
        logs[`${e.machineId}#${e.id}`] = setsForTarget
          .filter(st => st.entryId === e.id)
          .sort((a, b) => a.setNumber - b.setNumber)
          .map(st => ({ weight: st.weight, reps: st.reps }));
      }

      // 오늘 PR 배너: 실시간 작성 흐름과 동일한 판정 기준(그 세션 시점까지의 PR 대비)
      const detectedPRs: { name: string; weight: number; reps: number }[] = [];
      for (const e of entriesForTarget) {
        const sets   = logs[`${e.machineId}#${e.id}`] ?? [];
        const curMax = sets.length ? Math.max(...sets.map(s => s.weight)) : 0;
        const hist   = realPRs[e.machineId];
        if (curMax > 0 && (hist === undefined || curMax > hist.weight)) {
          const best = sets.reduce<SetEntry | null>((b, s) => (!b || s.weight > b.weight ? s : b), null);
          detectedPRs.push({ name: e.machineName, weight: curMax, reps: best?.reps ?? 0 });
        }
      }

      const selectedMuscles = new Set(
        session.targetMuscles && session.targetMuscles.length > 0
          ? session.targetMuscles
          : entriesForTarget.map(e => e.targetMuscle),
      );

      if (!cancelled) {
        setData({ exercises, logs, detectedPRs, selectedMuscles, pastSessions, pastEntries, pastSets, realPRs });
        setLoading(false);
      }
    })();

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.id, allSessions.map(s => s.id).join(',')]);

  return (
    <Modal visible animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <SafeAreaProvider>
        {loading || !data ? (
          <SafeAreaView style={{ flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator color={C.accent} />
          </SafeAreaView>
        ) : (
          <View style={{ flex: 1, backgroundColor: C.bg }}>
            <WorkoutDoneStep
              gym={{ name: session.gymName }}
              exercises={data.exercises}
              logs={data.logs}
              detectedPRs={data.detectedPRs}
              selectedMuscles={data.selectedMuscles}
              freeWeights={FREE_WEIGHTS}
              sessions={data.pastSessions}
              pastEntries={data.pastEntries}
              pastSets={data.pastSets}
              realPRs={data.realPRs}
              photoUri={session.compositeUri ?? session.photoUri}
              onClose={onClose}
            />
          </View>
        )}
      </SafeAreaProvider>
    </Modal>
  );
}
