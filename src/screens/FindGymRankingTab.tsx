import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { C, R } from '../theme';
import type {
  WeeklyRankingEntry,
  FavoriteRankingEntry,
  GymRankingEntry,
  RankingTabData,
} from '../lib/db/rankingQueries';

// ── Constants ───────────────────────────────────────────────────────────────

const WEEKLY_THRESHOLD = 100;
const RANKING_MUSCLES  = ['CHEST', 'BACK', 'LEGS', 'SHOULDERS', 'ARMS', 'GLUTES'];

const MEDAL: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };

// ── Helpers ─────────────────────────────────────────────────────────────────

function formatUpdatedAt(iso: string): string {
  const d = new Date(iso);
  const m   = d.getMonth() + 1;
  const day = d.getDate();
  const hh  = String(d.getHours()).padStart(2, '0');
  const mm  = String(d.getMinutes()).padStart(2, '0');
  return `${m}/${day} ${hh}:${mm}`;
}

// ── EmptyState ───────────────────────────────────────────────────────────────

function RankingEmpty({ icon, title, sub }: { icon: any; title: string; sub: string }) {
  return (
    <View style={rs.emptyBox}>
      <Ionicons name={icon} size={28} color={C.textDim} style={{ marginBottom: 8 }} />
      <Text style={rs.emptyTitle}>{title}</Text>
      <Text style={rs.emptySub}>{sub}</Text>
    </View>
  );
}

// ── Weekly Ranking Row ───────────────────────────────────────────────────────

function WeeklyRow({ entry, onPress }: { entry: WeeklyRankingEntry; onPress: () => void }) {
  return (
    <TouchableOpacity style={rs.rankRow} onPress={onPress} activeOpacity={0.75}>
      <Text style={rs.medal}>{MEDAL[entry.rank] ?? `${entry.rank}`}</Text>
      <View style={{ flex: 1 }}>
        <Text style={rs.rankName} numberOfLines={1}>{entry.machineName}</Text>
        <Text style={rs.rankSub}>{entry.machineBrand}</Text>
      </View>
      <View style={rs.rankScoreBox}>
        <Text style={rs.rankScore}>{entry.setCount.toLocaleString()}</Text>
        <Text style={rs.rankScoreLabel}>세트</Text>
      </View>
    </TouchableOpacity>
  );
}

// ── Favorite Ranking Row ─────────────────────────────────────────────────────

function FavoriteRow({ entry, onPress }: { entry: FavoriteRankingEntry; onPress: () => void }) {
  return (
    <TouchableOpacity style={rs.rankRow} onPress={onPress} activeOpacity={0.75}>
      <Text style={rs.medal}>{MEDAL[entry.rank] ?? `${entry.rank}`}</Text>
      <View style={{ flex: 1 }}>
        <Text style={rs.rankName} numberOfLines={1}>{entry.machineName}</Text>
        <Text style={rs.rankSub}>{entry.machineBrand} · {entry.targetMuscle}</Text>
      </View>
      <View style={rs.rankScoreBox}>
        <Text style={rs.rankScore}>{entry.favoriteCount.toLocaleString()}</Text>
        <Text style={rs.rankScoreLabel}>즐겨찾기</Text>
      </View>
    </TouchableOpacity>
  );
}

// ── Gym Ranking Row ──────────────────────────────────────────────────────────

function GymRow({ entry, onPress }: { entry: GymRankingEntry; onPress: () => void }) {
  return (
    <TouchableOpacity style={rs.rankRow} onPress={onPress} activeOpacity={0.75}>
      <Text style={rs.medal}>{MEDAL[entry.rank] ?? `${entry.rank}`}</Text>
      <View style={{ flex: 1 }}>
        <Text style={rs.rankName} numberOfLines={1}>{entry.gymName}</Text>
        <Text style={rs.rankSub} numberOfLines={1}>{entry.location}</Text>
      </View>
      <View style={rs.rankScoreBox}>
        <Text style={rs.rankScoreLabel}>❤️ {entry.favoriteCount}</Text>
      </View>
      <Ionicons name="chevron-forward" size={14} color={C.textDim} />
    </TouchableOpacity>
  );
}

// ── Section Card ─────────────────────────────────────────────────────────────

function SectionCard({ children }: { children: React.ReactNode }) {
  return <View style={rs.sectionCard}>{children}</View>;
}

function SectionHeader({ icon, title, sub }: { icon: any; title: string; sub?: string }) {
  return (
    <View style={rs.sectionHeader}>
      <Ionicons name={icon} size={18} color={C.accent} />
      <View style={{ flex: 1 }}>
        <Text style={rs.sectionTitle}>{title}</Text>
        {sub ? <Text style={rs.sectionSub}>{sub}</Text> : null}
      </View>
    </View>
  );
}

// ── Main RankingTab ──────────────────────────────────────────────────────────

interface RankingTabProps {
  data:           RankingTabData | null;
  loading:        boolean;
  onPressMachine: (machineId: string, machineName: string, machineBrand: string, targetMuscle: string) => void;
  onPressGym:     (gymId: string) => void;
}

export function RankingTab({ data, loading, onPressMachine, onPressGym }: RankingTabProps) {
  const [weeklyMuscle, setWeeklyMuscle] = useState('CHEST');

  if (loading) {
    return (
      <View style={rs.loadingBox}>
        <ActivityIndicator size="large" color={C.accent} />
        <Text style={rs.loadingText}>랭킹 불러오는 중...</Text>
      </View>
    );
  }

  if (!data) {
    return (
      <RankingEmpty
        icon="wifi-outline"
        title="랭킹을 불러올 수 없어요"
        sub="잠시 후 다시 시도해주세요"
      />
    );
  }

  const weeklyInsufficient = data.weeklyTotal < WEEKLY_THRESHOLD;
  const weeklyByMuscle     = data.weekly.filter(e => e.targetMuscle === weeklyMuscle);
  const updatedStr         = formatUpdatedAt(data.updatedAt);

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={rs.scroll}
    >

      {/* ── 1. 이번 주 인기 머신 ── */}
      <SectionCard>
        <SectionHeader
          icon="flame"
          title="이번 주 인기 머신"
          sub={`1시간마다 업데이트 · ${updatedStr}`}
        />

        {weeklyInsufficient ? (
          <RankingEmpty
            icon="bar-chart-outline"
            title="데이터를 수집 중이에요"
            sub="운동 기록이 쌓이면 인기 머신 랭킹을 보여드릴게요 💪"
          />
        ) : (
          <>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={rs.chipRow}
            >
              {RANKING_MUSCLES.map(muscle => {
                const active = muscle === weeklyMuscle;
                return (
                  <TouchableOpacity
                    key={muscle}
                    style={[rs.chip, active && rs.chipActive]}
                    onPress={() => setWeeklyMuscle(muscle)}
                    activeOpacity={0.75}
                  >
                    <Text style={[rs.chipText, active && rs.chipTextActive]}>
                      {muscle}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {weeklyByMuscle.length === 0 ? (
              <RankingEmpty
                icon="barbell-outline"
                title={`이번 주 ${weeklyMuscle} 기록이 없어요`}
                sub="운동을 기록하면 랭킹에 반영돼요"
              />
            ) : (
              weeklyByMuscle.slice(0, 10).map(entry => (
                <WeeklyRow
                  key={entry.machineId}
                  entry={entry}
                  onPress={() => onPressMachine(
                    entry.machineId,
                    entry.machineName,
                    entry.machineBrand,
                    entry.targetMuscle,
                  )}
                />
              ))
            )}
          </>
        )}
      </SectionCard>

      {/* ── 2. 즐겨찾기 인기 머신 ── */}
      <SectionCard>
        <SectionHeader
          icon="heart"
          title="즐겨찾기 인기 머신"
          sub="유저들이 가장 많이 저장한 머신"
        />

        {data.favorites.length === 0 ? (
          <RankingEmpty
            icon="heart-outline"
            title="데이터를 수집 중이에요"
            sub="즐겨찾기가 쌓이면 인기 머신을 보여드릴게요 ❤️"
          />
        ) : (
          data.favorites.slice(0, 10).map(entry => (
            <FavoriteRow
              key={entry.machineId}
              entry={entry}
              onPress={() => onPressMachine(
                entry.machineId,
                entry.machineName,
                entry.machineBrand,
                entry.targetMuscle,
              )}
            />
          ))
        )}
      </SectionCard>

      {/* ── 3. 인기 헬스장 ── */}
      <SectionCard>
        <SectionHeader
          icon="trophy"
          title="인기 헬스장"
          sub="즐겨찾기 + 리뷰 기반 종합 점수"
        />

        {data.gyms.length === 0 ? (
          <RankingEmpty
            icon="business-outline"
            title="데이터를 수집 중이에요"
            sub="헬스장 데이터가 쌓이면 랭킹을 보여드릴게요 🏆"
          />
        ) : (
          data.gyms.slice(0, 10).map(entry => (
            <GymRow
              key={entry.gymId}
              entry={entry}
              onPress={() => onPressGym(entry.gymId)}
            />
          ))
        )}
      </SectionCard>

      <View style={{ height: 32 }} />
    </ScrollView>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const rs = StyleSheet.create({
  scroll: { padding: 16, gap: 16 },

  loadingBox: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingVertical: 80, gap: 12,
  },
  loadingText: { fontSize: 13, color: C.textDim },

  emptyBox: {
    alignItems: 'center', paddingVertical: 28, paddingHorizontal: 20,
  },
  emptyTitle: { fontSize: 14, fontWeight: '700', color: C.textSub, marginBottom: 6, textAlign: 'center' },
  emptySub:   { fontSize: 12, color: C.textDim, textAlign: 'center', lineHeight: 18 },

  sectionCard: {
    backgroundColor: C.surface,
    borderRadius: R.card,
    borderWidth: 1,
    borderColor: C.border,
    overflow: 'hidden',
    paddingBottom: 8,
  },
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    padding: 16, borderBottomWidth: 1, borderBottomColor: C.border,
    marginBottom: 4,
  },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: C.text },
  sectionSub:   { fontSize: 11, color: C.textDim, marginTop: 2 },

  chipRow: { gap: 8, paddingHorizontal: 16, paddingVertical: 10 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 6,
    borderRadius: R.pill, backgroundColor: C.surfaceHigh,
    borderWidth: 1, borderColor: C.border,
  },
  chipActive:     { backgroundColor: C.accentBg, borderColor: C.accent },
  chipText:       { fontSize: 12, fontWeight: '600', color: C.textSub },
  chipTextActive: { color: C.accent },

  rankRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: C.border,
    gap: 12,
  },
  medal:          { fontSize: 20, width: 28, textAlign: 'center' },
  rankName:       { fontSize: 14, fontWeight: '700', color: C.text, marginBottom: 2 },
  rankSub:        { fontSize: 11, color: C.textSub },
  rankScoreBox:   { alignItems: 'flex-end' },
  rankScore:      { fontSize: 16, fontWeight: '900', color: C.accent },
  rankScoreLabel: { fontSize: 10, color: C.textDim, marginTop: 1 },
});
