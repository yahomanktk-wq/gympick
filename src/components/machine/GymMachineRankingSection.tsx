import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, StyleProp, TextStyle, TouchableOpacity, Alert } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { C, R } from '../../theme';
import { fetchGymMachineRanking, GymMachineRanking, RankingRow } from '../../lib/db/machineRanking';
import { fetchHideFromRankings, setHideFromRankings } from '../../lib/db/userProfiles';
import { useAuth } from '../../context/AuthContext';

// 2026-10-19 (F3-3): 헬스장 상세에서 연 머신 상세의 '이 헬스장 랭킹' 섹션.
// 추정 1RM 상위 10명 + 내 순위(10위 밖이면 구분선 아래). 3명 미만이면 잠금.
// 로딩 중에는 고정 높이의 빈 카드, 오류(null)면 섹션 자체를 숨긴다.

const LOADING_MIN_H = 118;
const TOP_N = 10;

interface Props {
  gymId: string;
  machineId: string;
  titleStyle?: StyleProp<TextStyle>;
}

const cardStyle = {
  backgroundColor: C.surface, borderRadius: R.card,
  borderWidth: 1, borderColor: C.border,
  padding: 16, marginBottom: 20,
} as const;

function RankRow({ row, showDivider }: { row: RankingRow; showDivider: boolean }) {
  return (
    <View style={[
      {
        flexDirection: 'row', alignItems: 'center', gap: 8,
        paddingVertical: 10, paddingHorizontal: 8,
      },
      showDivider && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.border },
      row.isMe && { backgroundColor: C.accentBg, borderRadius: R.inner },
    ]}>
      <Text style={{ width: 28, fontWeight: '800', fontSize: 14, color: row.rank <= 3 ? C.accent : C.textSub }}>
        {row.rank}
      </Text>
      <Text style={{ flex: 1, fontSize: 14, color: C.text }} numberOfLines={1}>
        {row.isMe ? `${row.nickname} (나)` : row.nickname}
      </Text>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={{ fontSize: 14, fontWeight: '700', color: C.text }}>{row.oneRepMax} kg</Text>
        <Text style={{ fontSize: 11, color: C.textDim }}>{row.weight}×{row.reps}</Text>
      </View>
    </View>
  );
}

function LockedContent({ userCount }: { userCount: number }) {
  return (
    <>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Ionicons name="lock-closed-outline" size={18} color={C.textSub} />
        <Text style={{ fontSize: 14, color: C.text }}>3명 이상 기록하면 랭킹이 열려요</Text>
      </View>
      <Text style={{ fontSize: 12, color: C.textSub, marginTop: 6 }}>
        지금까지 {userCount}명이 기록했어요
      </Text>
    </>
  );
}

function RankingList({ ranking }: { ranking: Extract<GymMachineRanking, { locked: false }> }) {
  const top = ranking.top.slice(0, TOP_N);
  const me  = ranking.me;
  return (
    <>
      {top.map((row, i) => (
        <RankRow key={`${row.rank}-${i}`} row={row} showDivider={i > 0} />
      ))}
      {me && me.rank > TOP_N && (
        <>
          <Text style={{ color: C.textDim, textAlign: 'center', paddingVertical: 4 }}>···</Text>
          <RankRow row={{ ...me, isMe: true }} showDivider={false} />
        </>
      )}
      <Text style={{ fontSize: 11, color: C.textDim, marginTop: 8 }}>
        추정 1RM 기준 · 비정상적으로 높은 기록은 제외돼요
      </Text>
    </>
  );
}

// 2026-10-19 (F3-4): 랭킹 카드 하단 '내 기록 숨기기 / 다시 보이기' (모든 헬스장·머신 공통 설정)
function RankingOptOutRow({ hidden, onToggle }: { hidden: boolean; onToggle: () => void }) {
  if (!hidden) {
    return (
      <TouchableOpacity onPress={onToggle} hitSlop={8} activeOpacity={0.7} style={{ marginTop: 10, alignSelf: 'flex-start' }}>
        <Text style={{ fontSize: 12, color: C.textSub, textDecorationLine: 'underline' }}>랭킹에서 내 기록 숨기기</Text>
      </TouchableOpacity>
    );
  }
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 }}>
      <Text style={{ fontSize: 12, color: C.textSub }}>내 기록은 랭킹에서 숨겨져 있어요</Text>
      <TouchableOpacity onPress={onToggle} hitSlop={8} activeOpacity={0.7}>
        <Text style={{ fontSize: 12, color: C.accent, fontWeight: '600' }}>다시 보이기</Text>
      </TouchableOpacity>
    </View>
  );
}

export default function GymMachineRankingSection({ gymId, machineId, titleStyle }: Props) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [ranking, setRanking] = useState<GymMachineRanking | null>(null);
  const [loading, setLoading] = useState(true);
  const [hidden,  setHidden]  = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const lastIdsRef = useRef<string | null>(null);

  useEffect(() => {
    let alive = true;
    // 숨기기/다시 보이기 후 재조회(reloadKey)는 기존 카드를 유지한 채 갱신 — 빈 카드로 깜빡이지 않게.
    // 헬스장/머신이 바뀐 경우에만 로딩 상태로 되돌린다.
    const idsKey = `${gymId}|${machineId}`;
    if (lastIdsRef.current !== idsKey) {
      lastIdsRef.current = idsKey;
      setLoading(true);
      setRanking(null);
    }
    Promise.all([
      fetchGymMachineRanking(gymId, machineId),
      userId ? fetchHideFromRankings(userId) : Promise.resolve(false),
    ]).then(([result, hide]) => {
      if (!alive) return;
      setRanking(result);
      setHidden(hide);
      setLoading(false);
    });
    return () => { alive = false; };
  }, [gymId, machineId, userId, reloadKey]);

  async function applyHidden(next: boolean) {
    if (!userId) return;
    try {
      await setHideFromRankings(userId, next);
      setHidden(next);
      setReloadKey(k => k + 1);   // 랭킹 다시 불러오기
    } catch {
      Alert.alert('오류', '설정 변경에 실패했어요.');
    }
  }

  function handleToggleHidden() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (hidden) {
      applyHidden(false);
      return;
    }
    Alert.alert(
      '랭킹에서 숨길까요?',
      '모든 헬스장·머신 랭킹에서 내 닉네임과 기록이 보이지 않게 돼요.',
      [
        { text: '취소', style: 'cancel' },
        { text: '숨기기', style: 'destructive', onPress: () => applyHidden(true) },
      ],
    );
  }

  if (loading) {
    return (
      <>
        <Text style={titleStyle}>이 헬스장 랭킹</Text>
        <View style={[cardStyle, { minHeight: LOADING_MIN_H }]} />
      </>
    );
  }
  if (!ranking) return null;

  return (
    <>
      <Text style={titleStyle}>이 헬스장 랭킹</Text>
      <View style={cardStyle}>
        {ranking.locked
          ? <LockedContent userCount={ranking.userCount} />
          : <RankingList ranking={ranking} />}
        {userId && <RankingOptOutRow hidden={hidden} onToggle={handleToggleHidden} />}
      </View>
    </>
  );
}
