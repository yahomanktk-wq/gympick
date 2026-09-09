import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { C, R } from '../theme';
import { brandLogos } from '../constants/brandLogos';
import type {
  WeeklyRankingEntry,
  FavoriteRankingEntry,
  GymRankingEntry,
  RankingTabData,
} from '../lib/db/rankingQueries';
import type { OlympicRankingEntry } from '../lib/db/olympicRankings';

// 2026-09-09: '이번 주 인기 머신' 랭킹 행에 브랜드 로고를 머신명 옆에 표시하기 위한 조회 헬퍼.
function brandLogoFor(brand: string | undefined) {
  if (!brand) return undefined;
  const key = brand.toUpperCase().replace(/\s+/g, '_');
  return brandLogos[key];
}

// ── Constants ───────────────────────────────────────────────────────────────

export const WEEKLY_THRESHOLD = 100;
export const RANKING_MUSCLES  = ['CHEST', 'BACK', 'LEG', 'SHOULDER', 'ARMS', 'GLUTES'];

const MEDAL: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };

// ── Helpers ─────────────────────────────────────────────────────────────────

export function formatUpdatedAt(iso: string): string {
  const d = new Date(iso);
  const m   = d.getMonth() + 1;
  const day = d.getDate();
  const hh  = String(d.getHours()).padStart(2, '0');
  const mm  = String(d.getMinutes()).padStart(2, '0');
  return `${m}/${day} ${hh}:${mm}`;
}

// ── EmptyState ───────────────────────────────────────────────────────────────

export function RankingEmpty({ icon, title, sub }: { icon: any; title: string; sub: string }) {
  return (
    <View style={rs.emptyBox}>
      <Ionicons name={icon} size={28} color={C.textDim} style={{ marginBottom: 8 }} />
      <Text style={rs.emptyTitle}>{title}</Text>
      <Text style={rs.emptySub}>{sub}</Text>
    </View>
  );
}

// ── Weekly Ranking Row ───────────────────────────────────────────────────────

export function WeeklyRow({ entry, onPress }: { entry: WeeklyRankingEntry; onPress: () => void }) {
  const logo = brandLogoFor(entry.machineBrand);
  return (
    <TouchableOpacity style={rs.rankRow} onPress={onPress} activeOpacity={0.75}>
      <Text style={rs.medal}>{MEDAL[entry.rank] ?? `${entry.rank}`}</Text>
      {/* 2026-09-09: 로고를 머신명 옆 인라인 배지 → 흰 배경 박스로 바꾸고, 높이를
          제조사명 라인까지 확장해 머신명+제조사명 두 줄 옆에 나란히 표시 (시인성 개선) */}
      {logo && (
        <View style={rs.rankLogoBox}>
          <Image source={logo} style={rs.rankLogoImg} resizeMode="contain" />
        </View>
      )}
      <View style={{ flex: 1 }}>
        <Text style={rs.rankName} numberOfLines={1}>{entry.machineName}</Text>
        <Text style={rs.rankSub}>{entry.machineBrand}</Text>
      </View>
      {/* 2026-09-09: 우측 세트 수 숫자 + '세트' 텍스트 삭제 */}
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

export function GymRow({ entry, onPress }: { entry: GymRankingEntry; onPress: () => void }) {
  return (
    <TouchableOpacity style={rs.rankRow} onPress={onPress} activeOpacity={0.75}>
      <Text style={rs.medal}>{MEDAL[entry.rank] ?? `${entry.rank}`}</Text>
      <View style={{ flex: 1 }}>
        <Text style={rs.rankName} numberOfLines={1}>{entry.gymName}</Text>
        <Text style={rs.rankSub} numberOfLines={1}>{entry.location}</Text>
      </View>
      {/* 2026-09-09: 하트 이모티콘 + 즐겨찾기 수치 삭제 */}
      <Ionicons name="chevron-forward" size={14} color={C.textDim} />
    </TouchableOpacity>
  );
}

// ── Olympic Ranking Row ──────────────────────────────────────────────────────

const OLYMPIC_MUSCLE_COLORS: Record<string, string> = {
  Chest: '#5ba4ff', Back: '#cc5de8', Leg: '#ff922b',
  Shoulder: '#ffd166', Arms: '#3dd68c', Glutes: '#ff9ecd',
};

function OlympicRankingRow({ entry, onPress }: { entry: OlympicRankingEntry; onPress: () => void }) {
  const bpColor = OLYMPIC_MUSCLE_COLORS[entry.bodyPart] ?? C.accent;
  return (
    <TouchableOpacity style={rs.rankRow} onPress={onPress} activeOpacity={0.75}>
      <Text style={rs.medal}>{MEDAL[entry.rank] ?? `${entry.rank}`}</Text>
      <View style={{ flex: 1 }}>
        <Text style={rs.rankName} numberOfLines={1}>{entry.machineName}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
          <Text style={rs.rankSub}>{entry.machineBrand}</Text>
          <View style={{ backgroundColor: bpColor + '20', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 1 }}>
            <Text style={{ fontSize: 9, fontWeight: '700', color: bpColor }}>{entry.bodyPart}</Text>
          </View>
          {entry.category && entry.category !== '전체' && (
            <Text style={[rs.rankSub, { fontSize: 9 }]}>{entry.category}</Text>
          )}
        </View>
      </View>
      <View style={rs.rankScoreBox}>
        <Text style={[rs.rankScore, { color: bpColor }]}>{entry.winRate}%</Text>
        <Text style={rs.rankScoreLabel}>{entry.winCount}승 {entry.loseCount}패</Text>
      </View>
    </TouchableOpacity>
  );
}

// ── Section Card ─────────────────────────────────────────────────────────────

export function SectionCard({ children }: { children: React.ReactNode }) {
  return <View style={rs.sectionCard}>{children}</View>;
}

export function SectionHeader({ icon, title, sub }: { icon: any; title: string; sub?: string }) {
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
  data:            RankingTabData | null;
  loading:         boolean;
  olympicRankings: OlympicRankingEntry[];
  olympicLoading:  boolean;
  onPressMachine:  (machineId: string, machineName: string, machineBrand: string, targetMuscle: string) => void;
  onPressGym:      (gymId: string) => void;
}

export function RankingTab({ data, loading, olympicRankings, olympicLoading, onPressMachine, onPressGym }: RankingTabProps) {
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
              // 2026-09-09: entry.rank는 부위 구분 없는 전체 목록 기준이라 부위로
              // 거르면 순번이 어긋남 — 이 목록 안에서의 위치(i+1)로 다시 매김
              weeklyByMuscle.slice(0, 10).map((entry, i) => (
                <WeeklyRow
                  key={entry.machineId}
                  entry={{ ...entry, rank: i + 1 }}
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

      {/* ── 4. 머신 올림픽 랭킹 ── */}
      <SectionCard>
        <SectionHeader
          icon="trophy"
          title="머신 올림픽 랭킹"
          sub="유저 투표로 만들어진 머신 선호도 랭킹"
        />

        {olympicLoading ? (
          <View style={{ paddingVertical: 24, alignItems: 'center' }}>
            <ActivityIndicator size="small" color={C.accent} />
          </View>
        ) : olympicRankings.length === 0 ? (
          <RankingEmpty
            icon="trophy-outline"
            title="아직 투표 데이터가 없어요"
            sub="머신 올림픽에 참여하면 랭킹이 만들어져요 🏆"
          />
        ) : (
          olympicRankings.slice(0, 10).map(entry => (
            <OlympicRankingRow
              key={entry.machineId}
              entry={entry}
              onPress={() => onPressMachine(
                entry.machineId,
                entry.machineName,
                entry.machineBrand,
                entry.bodyPart,
              )}
            />
          ))
        )}
      </SectionCard>

      <View style={{ height: 32 }} />
    </ScrollView>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

export const rs = StyleSheet.create({
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
  // 2026-09-09부터 미사용 (로고를 인라인 배지 → rankLogoBox 방식으로 교체)
  rankNameRow:    { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 2 },
  rankNameLogo:   { width: 16, height: 16 },
  // 2026-09-09: '이번 주 인기 머신' 행 — 머신명+제조사명 두 줄 옆 브랜드 로고
  // (흰 배경 박스, 제조사명 라인까지 높이 확장 — 시인성 개선)
  rankLogoBox: {
    width: 34, height: 34,
    backgroundColor: '#ffffff',
    borderRadius: 6,
    borderWidth: 1, borderColor: C.border,
    alignItems: 'center', justifyContent: 'center',
  },
  rankLogoImg:    { width: 26, height: 26 },
  rankSub:        { fontSize: 11, color: C.textSub },
  rankScoreBox:   { alignItems: 'flex-end' },
  rankScore:      { fontSize: 16, fontWeight: '900', color: C.accent },
  rankScoreLabel: { fontSize: 10, color: C.textDim, marginTop: 1 },
});
