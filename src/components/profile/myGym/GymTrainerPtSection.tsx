import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { C, R } from '../../../theme';
import { fetchMyPtRequests } from '../../../lib/db/ptRequests';
import PtRequestsModal from '../../pt/PtRequestsModal';

// 2026-11-09: 프로필 '내 헬스장' > PT 상담
// 이 헬스장 PT 상담 내역 바로가기만 (트레이너 목록·신청 버튼은 헬스장 상세에서)

export default function GymTrainerPtSection({ gymId, version }: { gymId: string; version: number }) {
  const [openCount, setOpenCount] = useState(0);
  const [total,     setTotal]     = useState(0);
  const [listOpen,  setListOpen]  = useState(false);

  const load = useCallback(async () => {
    const list = (await fetchMyPtRequests()).filter(r => r.gymId === gymId);
    setTotal(list.length);
    setOpenCount(list.filter(r => r.status === 'open').length);
  }, [gymId]);
  useEffect(() => { load(); }, [load, version]);

  return (
    <View style={s.card}>
      <TouchableOpacity style={s.ptRow} onPress={() => setListOpen(true)} activeOpacity={0.8}>
        <Ionicons name="chatbubbles-outline" size={16} color={C.accent} />
        <Text style={s.ptText}>내 PT 상담</Text>
        <Text style={s.ptCount}>
          {total === 0 ? '없음' : openCount > 0 ? `진행 중 ${openCount}건` : `${total}건`}
        </Text>
        <Ionicons name="chevron-forward" size={14} color={C.textDim} />
      </TouchableOpacity>
      <PtRequestsModal visible={listOpen} onClose={() => { setListOpen(false); load(); }} />
    </View>
  );
}

const s = StyleSheet.create({
  card:      { backgroundColor: C.surface, borderRadius: R.card, borderWidth: 1, borderColor: C.border, padding: 14, gap: 10 },
  headTitle: { color: C.text, fontSize: 15, fontWeight: '800' },
  ptRow:     { flexDirection: 'row', alignItems: 'center', gap: 8 },
  ptText:    { flex: 1, color: C.text, fontSize: 14, fontWeight: '700' },
  ptCount:   { color: C.textSub, fontSize: 13 },
});
