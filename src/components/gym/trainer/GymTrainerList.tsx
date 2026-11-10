import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, type TextStyle, type ViewStyle, type StyleProp } from 'react-native';
import { C, R } from '../../../theme';
import { fetchGymTrainers, type PublicTrainer } from '../../../lib/db/gymTrainers';
import TrainerBadge from './TrainerBadge';
import PtConsultButton from '../../pt/PtConsultButton';

// 2026-11-09: 헬스장 트레이너 목록 — 배지 · 이름(실명) · 자기소개 + 'PT 상담 신청'
// 헬스장 상세 정보 탭과 프로필 '내 헬스장' 대시보드에서 쓴다. 트레이너가 없으면 그리지 않는다.

interface Props {
  gymId:       string;
  titleStyle?: StyleProp<TextStyle>;
  /** 제목 없이 목록만 (대시보드처럼 바깥에서 제목을 그릴 때) */
  hideTitle?:  boolean;
  /** 다시 불러오기용 (소개 수정 후 등) */
  version?:    number;
  /** 트레이너가 0명일 때 보여줄 문구 (없으면 아무것도 안 그림) */
  emptyText?:  string;
  /** 목록 카드 바깥 여백 */
  style?:      StyleProp<ViewStyle>;
  /** 그 헬스장 관장님 id (관장님에게는 PT 상담 버튼 숨김) */
  managerId?:  string | null;
}

export default function GymTrainerList({ gymId, titleStyle, hideTitle, version = 0, emptyText, style, managerId }: Props) {
  const [items,  setItems]  = useState<PublicTrainer[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    fetchGymTrainers(gymId).then(r => { if (alive) { setItems(r); setLoaded(true); } });
    return () => { alive = false; };
  }, [gymId, version]);

  if (items.length === 0) {
    return loaded && emptyText ? <Text style={s.empty}>{emptyText}</Text> : null;
  }

  return (
    <>
      {!hideTitle && <Text style={titleStyle}>트레이너</Text>}
      <View style={[s.card, style]}>
        {items.map((t, i) => (
          <View key={t.userId} style={[s.row, i > 0 && s.border]}>
            <View style={{ flex: 1, gap: 4 }}>
              <View style={s.nameRow}>
                <TrainerBadge kind="trainer" />
                <Text style={s.name} numberOfLines={1}>{t.realName}</Text>
              </View>
              {t.intro ? <Text style={s.intro} numberOfLines={2}>{t.intro}</Text> : null}
            </View>
            <PtConsultButton gymId={gymId} trainerId={t.userId} trainerNickname={t.realName} compact managerId={managerId} />
          </View>
        ))}
      </View>
    </>
  );
}

const s = StyleSheet.create({
  card:    { backgroundColor: C.surface, borderRadius: R.card, borderWidth: 1, borderColor: C.border, overflow: 'hidden' },
  row:     { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 12 },
  border:  { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.border },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name:    { flexShrink: 1, color: C.text, fontSize: 15, fontWeight: '800' },
  intro:   { color: C.textSub, fontSize: 13, lineHeight: 18 },
  empty:   { color: C.textSub, fontSize: 13, paddingVertical: 8 },
});
