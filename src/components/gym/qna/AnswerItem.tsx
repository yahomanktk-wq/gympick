import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { C } from '../../../theme';
import { timeAgo } from '../../../lib/timeAgo';
import type { GymAnswer } from '../../../lib/db/gymQna';
import ContentMenuButton from '../../moderation/ContentMenuButton';
import TrainerBadge from '../trainer/TrainerBadge';
import PtConsultButton from '../../pt/PtConsultButton';

// 2026-11-09: Q&A 답변 한 줄. 트레이너·관장님 답변은 배지 + 강조, 트레이너 답변엔 'PT 상담 신청'

interface Props {
  answer:    GymAnswer;
  gymId:     string;
  canDelete: boolean;
  onDelete:  (id: string) => Promise<void>;
  onBlocked: (userId: string) => void;
}

export default function AnswerItem({ answer, gymId, canDelete, onDelete, onBlocked }: Props) {
  return (
    <View style={[s.row, answer.authorBadge && s.staffRow]}>
      <View style={{ flex: 1 }}>
        <View style={s.head}>
          {answer.authorBadge && <TrainerBadge kind={answer.authorBadge} />}
          <Text style={s.nick} numberOfLines={1}>{answer.nickname}</Text>
          <Text style={s.time}>{timeAgo(answer.createdAt)}</Text>
        </View>
        <Text style={s.body}>{answer.content}</Text>
        {answer.authorBadge === 'trainer' && (
          <View style={{ marginTop: 8 }}>
            <PtConsultButton gymId={gymId} trainerId={answer.userId} trainerNickname={answer.nickname} compact />
          </View>
        )}
      </View>
      <ContentMenuButton
        targetType="qna_answer"
        targetId={answer.id}
        authorId={answer.userId}
        authorNickname={answer.nickname}
        canDelete={canDelete}
        onDelete={() => onDelete(answer.id)}
        onBlocked={onBlocked}
        size={16}
      />
    </View>
  );
}

const s = StyleSheet.create({
  row:      { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border },
  staffRow: { backgroundColor: C.accentBg },
  head:     { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 3 },
  nick:     { fontSize: 13, fontWeight: '800', color: C.text, flexShrink: 1 },
  time:     { fontSize: 11, color: C.textSub },
  body:     { fontSize: 14, lineHeight: 20, color: C.text },
});
