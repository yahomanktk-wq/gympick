import React, { useState, useEffect } from 'react';
import { View, Text, StyleProp, TextStyle } from 'react-native';
import { C, R } from '../../theme';
import { fetchMyMachinePR, MachinePR } from '../../lib/db/machinePR';
import { kstDateKey } from '../../lib/kstDate';

// 2026-10-19 (F3-1): 머신 상세의 '내 PR' 섹션 — Epley 추정 1RM 최고 기록, 그 세트, 달성일, 헬스장.
// 로딩 중에는 같은 높이의 빈 카드를 보여 레이아웃이 튀지 않게 한다.

const CARD_MIN_H = 118;

interface Props {
  userId: string;
  machineId: string;
  titleStyle?: StyleProp<TextStyle>;
}

function PRContent({ pr }: { pr: MachinePR }) {
  const dateText = kstDateKey(pr.date).replace(/-/g, '.');
  return (
    <>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 6 }}>
        <Text style={{ fontSize: 28, fontWeight: '900', color: C.accent }}>{pr.oneRepMax} kg</Text>
        <Text style={{ fontSize: 11, color: C.textSub, marginBottom: 5 }}>추정 1RM</Text>
      </View>
      <Text style={{ fontSize: 14, color: C.text, marginTop: 4 }}>
        {pr.weight} kg × {pr.reps} reps
      </Text>
      <Text style={{ fontSize: 12, color: C.textSub, marginTop: 2 }}>
        {pr.gymName ? `${dateText} · ${pr.gymName}` : dateText}
      </Text>
    </>
  );
}

export default function MachinePRSection({ userId, machineId, titleStyle }: Props) {
  const [pr,      setPr]      = useState<MachinePR | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setPr(null);
    fetchMyMachinePR(userId, machineId).then(result => {
      if (!alive) return;
      setPr(result);
      setLoading(false);
    });
    return () => { alive = false; };
  }, [userId, machineId]);

  return (
    <>
      <Text style={titleStyle}>내 PR</Text>
      <View style={{
        backgroundColor: C.surface, borderRadius: R.card,
        borderWidth: 1, borderColor: C.border,
        padding: 16, marginBottom: 20,
        minHeight: CARD_MIN_H,
        justifyContent: 'center',
      }}>
        {loading ? null : pr ? (
          <PRContent pr={pr} />
        ) : (
          <Text style={{ fontSize: 13, color: C.textSub }}>아직 이 머신 기록이 없어요</Text>
        )}
        {!loading && (
          <Text style={{ fontSize: 11, color: C.textDim, marginTop: 8 }}>
            추정 1RM = 무게 × (1 + 횟수 ÷ 30)
          </Text>
        )}
      </View>
    </>
  );
}
