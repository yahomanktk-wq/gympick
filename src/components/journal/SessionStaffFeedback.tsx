import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { C, R } from '../../theme';
import { fetchStaffFeedback, type OunwanComment } from '../../lib/db/ounwanComments';
import { timeAgo } from '../../lib/timeAgo';
import TrainerBadge from '../gym/trainer/TrainerBadge';

// 2026-11-09: 운동일지 상세에서 그날 오운완에 달린 트레이너·관장님 피드백을 보여준다.
// 피드백이 없으면 아무것도 그리지 않는다.

export default function SessionStaffFeedback({ postId }: { postId: string | null | undefined }) {
  const [items, setItems] = useState<OunwanComment[]>([]);

  useEffect(() => {
    let alive = true;
    setItems([]);
    if (postId) fetchStaffFeedback(postId).then(r => { if (alive) setItems(r); });
    return () => { alive = false; };
  }, [postId]);

  if (items.length === 0) return null;

  return (
    <View style={s.wrap}>
      <Text style={s.title}>트레이너 피드백</Text>
      {items.map(c => (
        <View key={c.id} style={s.item}>
          <View style={s.head}>
            {c.authorBadge && <TrainerBadge kind={c.authorBadge} />}
            <Text style={s.nick} numberOfLines={1}>{c.nickname}</Text>
            <Text style={s.time}>{timeAgo(c.createdAt)}</Text>
          </View>
          <Text style={s.body}>{c.content}</Text>
        </View>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  wrap:  { marginTop: 16, gap: 8 },
  title: { fontSize: 15, fontWeight: '800', color: C.text, marginBottom: 2 },
  item:  { backgroundColor: C.accentBg, borderRadius: R.inner, borderWidth: 1, borderColor: C.accent + '40', padding: 12 },
  head:  { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  nick:  { fontSize: 13, fontWeight: '800', color: C.text, flexShrink: 1 },
  time:  { fontSize: 11, color: C.textSub },
  body:  { fontSize: 14, lineHeight: 20, color: C.text },
});
