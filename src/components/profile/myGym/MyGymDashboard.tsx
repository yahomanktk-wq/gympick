import React, { useCallback, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { C, R } from '../../../theme';
import { fetchMyGyms, type MyGym } from '../../../lib/db/gymMembers';
import GymDetailModal from '../../../screens/flow/GymDetailModal';
import GymNewsSection from './GymNewsSection';
import GymTrainerPtSection from './GymTrainerPtSection';
import MemberRequestsSection from '../../gym/membership/MemberRequestsSection';

// 2026-11-09: 프로필 '내 헬스장' 대시보드 — 회원·트레이너로 가입한 헬스장이 있을 때만 보인다.
// 헬스장 카드(탭 → 헬스장 상세) / 헬스장 소식(Q&A) / 트레이너 · PT 상담
// 여러 곳에 가입했으면 위 칩으로 헬스장을 바꾼다. 프로필 탭에 돌아올 때마다 다시 불러온다.

interface Props {
  userId:            string | null | undefined;
  horizontalPadding: number;
}

function fmtDate(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}

export default function MyGymDashboard({ userId, horizontalPadding }: Props) {
  const [gyms,      setGyms]      = useState<MyGym[]>([]);
  const [selected,  setSelected]  = useState<string | null>(null);
  const [version,   setVersion]   = useState(0);
  const [detailId,  setDetailId]  = useState<string | null>(null);

  useFocusEffect(useCallback(() => {
    let alive = true;
    fetchMyGyms(userId).then(list => {
      if (!alive) return;
      setGyms(list);
      setSelected(prev => (prev && list.some(g => g.gymId === prev) ? prev : list[0]?.gymId ?? null));
      setVersion(v => v + 1);
    });
    return () => { alive = false; };
  }, [userId]));

  const gym = gyms.find(g => g.gymId === selected);
  if (!userId || !gym) return null;

  return (
    <View style={{ marginBottom: 24 }}>
      <Text style={[s.sectionLabel, { marginHorizontal: horizontalPadding }]}>내 헬스장</Text>

      {gyms.length > 1 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: horizontalPadding, marginBottom: 10 }}>
          {gyms.map(g => (
            <TouchableOpacity key={g.gymId} onPress={() => setSelected(g.gymId)} style={[s.chip, g.gymId === selected && s.chipActive]} activeOpacity={0.8}>
              <Text style={[s.chipText, g.gymId === selected && s.chipTextActive]} numberOfLines={1}>{g.gymName}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      <View style={{ paddingHorizontal: horizontalPadding, gap: 10 }}>
        <TouchableOpacity style={s.gymCard} onPress={() => setDetailId(gym.gymId)} activeOpacity={0.85}>
          <View style={s.gymIcon}><Ionicons name="barbell" size={18} color={C.bg} /></View>
          <View style={{ flex: 1 }}>
            <Text style={s.gymName} numberOfLines={1}>{gym.gymName}</Text>
            <Text style={s.gymMeta}>
              {gym.role === 'trainer' ? '트레이너' : '회원'} · {fmtDate(gym.joinedAt)}{gym.role === 'trainer' ? ' 승인' : ' 가입'}
            </Text>
          </View>
          <Text style={s.gymLink}>헬스장 보기</Text>
          <Ionicons name="chevron-forward" size={15} color={C.textDim} />
        </TouchableOpacity>

        {/* 트레이너: 소속 헬스장 회원 가입 신청 승인 (2026-11-09) */}
        {gym.role === 'trainer' && <MemberRequestsSection gymId={gym.gymId} version={version} />}
        <GymNewsSection gymId={gym.gymId} userId={userId} version={version} role={gym.role} />
        <GymTrainerPtSection gymId={gym.gymId} version={version} />
      </View>

      <GymDetailModal
        visible={!!detailId}
        gymId={detailId}
        onClose={() => { setDetailId(null); setVersion(v => v + 1); }}
      />
    </View>
  );
}

const s = StyleSheet.create({
  sectionLabel:   { fontSize: 11, fontWeight: '700', color: C.textDim, letterSpacing: 1.2, marginBottom: 8, marginTop: 4 },
  chip:           { paddingHorizontal: 14, paddingVertical: 8, borderRadius: R.pill, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, maxWidth: 200 },
  chipActive:     { backgroundColor: C.accent, borderColor: C.accent },
  chipText:       { color: C.textSub, fontSize: 13, fontWeight: '700' },
  chipTextActive: { color: C.bg },
  gymCard:        { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.surface, borderRadius: R.card, borderWidth: 1, borderColor: C.accent + '50', padding: 14 },
  gymIcon:        { width: 36, height: 36, borderRadius: 18, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center' },
  gymName:        { color: C.text, fontSize: 16, fontWeight: '800' },
  gymMeta:        { color: C.textSub, fontSize: 12, marginTop: 2 },
  gymLink:        { color: C.textSub, fontSize: 12 },
});
