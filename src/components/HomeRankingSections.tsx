import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { C } from '../theme';
import { screenPad } from '../theme/responsive';
import { fetchMachinePopularityRanking, type PopularityRankingEntry } from '../lib/db/rankingQueries';
import { fetchMachines, getMachinesCacheSync } from '../lib/db';
import { MachineWithGyms } from '../data/types';
import {
  SectionCard,
  SectionHeader,
  RankingEmpty,
  WeeklyRow,
  RANKING_MUSCLES,
  formatUpdatedAt,
  rs,
} from '../screens/FindGymRankingTab';
import MachineDetailModal from '../screens/flow/MachineDetailModal';
import GymDetailModal from '../screens/flow/GymDetailModal';

// ── HomeRankingSections ──────────────────────────────────────────────────────
// 2026-09-09: '머신,헬스장 찾기' 화면의 랭킹 탭 삭제에 따라, 그 중 '이번 주 인기 머신'과
// '인기 헬스장' 두 섹션만 홈 화면(오운완 피드 하단)으로 이전한 컴포넌트.
// 즐겨찾기 인기 머신 / 머신 올림픽 랭킹 섹션은 이번 작업 범위에서 제외 — FindGymRankingTab.tsx에는
// 그대로 남아있음 (추후 별도 처리 예정).
// 2026-09-09: '인기 헬스장' 섹션은 삭제, '이번 주 인기 머신'은 '인기 머신'으로 이름 변경.
// (gymDetailId/gymDetailVisible/GymDetailModal은 아래 MachineDetailModal의 onSelectGym에서
// 여전히 사용하므로 남겨둠)
// 2026-09-09: 선정 기준을 "이번 주 세트 수"에서 "전체 기간 · 즐겨찾기 35% + 운동일지 작성
// 횟수 20% + 상세페이지 조회수 35% + 보유 헬스장 수 10% 가중치 합산 점수"로 변경. 계산은
// Supabase machine_popularity_ranking 뷰(신규)에서 이미 끝난 상태로 내려오며, free weight
// 제외도 뷰 안에서 처리되므로 클라이언트에서 따로 걸러낼 필요가 없어짐.

export default function HomeRankingSections() {
  const [entries, setEntries] = useState<PopularityRankingEntry[]>([]);
  const [updatedAt, setUpdatedAt] = useState(() => new Date().toISOString());
  const [loading, setLoading] = useState(true);
  const [popularMuscle, setPopularMuscle] = useState('CHEST');
  const [machines, setMachines] = useState<MachineWithGyms[]>(() => getMachinesCacheSync());
  const [detailMachine, setDetailMachine] = useState<MachineWithGyms | null>(null);
  const [gymDetailId, setGymDetailId] = useState<string | null>(null);
  const [gymDetailVisible, setGymDetailVisible] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchMachinePopularityRanking()
      .then(list => { if (!cancelled) { setEntries(list); setUpdatedAt(new Date().toISOString()); } })
      .catch(() => { if (!cancelled) setEntries([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchMachines()
      .then(list => { if (!cancelled) setMachines(list); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  function openMachine(machineId: string) {
    const found = machines.find(m => m.id === machineId);
    if (found) setDetailMachine(found);
  }

  if (loading) {
    return (
      <View style={hs.loadingBox}>
        <ActivityIndicator size="small" color={C.accent} />
      </View>
    );
  }

  const popularEmpty   = entries.length === 0;
  // 2026-09-09: target_muscle이 "Chest, Shoulder"처럼 여러 부위가 콤마로 묶여
  // 들어있는 머신이 있어서(확인됨: 16개), 정확히 일치하는지가 아니라 그 안에
  // 선택한 부위가 포함되는지로 비교해야 함 (GymDetailModal의 parseMuscles 처리와 동일한 방식).
  const popularByMuscle = entries.filter(e =>
    e.targetMuscle.split(',').map(t => t.trim()).includes(popularMuscle)
  );
  const updatedStr      = formatUpdatedAt(updatedAt);

  return (
    <View style={hs.wrap}>

      {/* ── 인기 머신 ── */}
      <SectionCard>
        <SectionHeader
          icon="flame"
          title="인기 머신"
          sub={`실시간 업데이트 · ${updatedStr}`}
        />

        {popularEmpty ? (
          <RankingEmpty
            icon="bar-chart-outline"
            title="데이터를 수집 중이에요"
            sub="즐겨찾기·운동 기록이 쌓이면 인기 머신 랭킹을 보여드릴게요 💪"
          />
        ) : (
          <>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={rs.chipRow}
            >
              {RANKING_MUSCLES.map(muscle => {
                const active = muscle === popularMuscle;
                return (
                  <TouchableOpacity
                    key={muscle}
                    style={[rs.chip, active && rs.chipActive]}
                    onPress={() => setPopularMuscle(muscle)}
                    activeOpacity={0.75}
                  >
                    <Text style={[rs.chipText, active && rs.chipTextActive]}>
                      {muscle}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {popularByMuscle.length === 0 ? (
              <RankingEmpty
                icon="barbell-outline"
                title={`${popularMuscle} 기록이 아직 없어요`}
                sub="즐겨찾기하거나 운동을 기록하면 랭킹에 반영돼요"
              />
            ) : (
              // 2026-09-09: entry.rank는 부위 구분 없이 전체 목록 기준 순위라서
              // (예: CHEST만 걸러도 1,5,6,7...처럼 보임) 그대로 쓰면 순번이 어긋난다.
              // 부위별로 걸러낸 이 목록 안에서의 위치(i+1)로 순위를 다시 매겨서 표시.
              popularByMuscle.slice(0, 10).map((entry, i) => (
                <WeeklyRow
                  key={entry.machineId}
                  entry={{
                    machineId:    entry.machineId,
                    machineName:  entry.machineName,
                    machineBrand: entry.machineBrand,
                    targetMuscle: entry.targetMuscle,
                    setCount:     entry.logCount,
                    gymCount:     entry.gymCount,
                    score:        entry.score,
                    rank:         i + 1,
                  }}
                  onPress={() => openMachine(entry.machineId)}
                />
              ))
            )}
          </>
        )}
      </SectionCard>

      <MachineDetailModal
        visible={detailMachine !== null}
        machine={detailMachine}
        onClose={() => setDetailMachine(null)}
        onSelectGym={(gymId) => {
          setDetailMachine(null);
          setTimeout(() => {
            setGymDetailId(gymId);
            setGymDetailVisible(true);
          }, 350);
        }}
      />

      <GymDetailModal
        visible={gymDetailVisible}
        gymId={gymDetailId}
        onClose={() => setGymDetailVisible(false)}
      />
    </View>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const hs = StyleSheet.create({
  wrap: {
    marginTop:        24,
    marginHorizontal: screenPad,
    gap:              16,
  },
  loadingBox: {
    paddingVertical: 24,
    alignItems:      'center',
  },
});
