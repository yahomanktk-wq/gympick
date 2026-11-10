import React, { useState } from 'react';
import { TouchableOpacity, Text, StyleSheet, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { C, R } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import PtRequestModal from './PtRequestModal';
import PtRequestsModal from './PtRequestsModal';

// 2026-11-09: 'PT 상담 신청' 작은 버튼 (트레이너 댓글·답변 옆, 헬스장 트레이너 목록)
// 로그인하지 않았거나 그 트레이너 본인이면 숨긴다.

interface Props {
  gymId:           string;
  trainerId:       string;
  trainerNickname: string;
  compact?:        boolean;
  /** 그 헬스장 관장님 id — 관장님 본인에게는 버튼을 숨긴다 */
  managerId?:      string | null;
}

export default function PtConsultButton({ gymId, trainerId, trainerNickname, compact, managerId }: Props) {
  const { user } = useAuth();
  const [formOpen,   setFormOpen]   = useState(false);
  const [threadId,   setThreadId]   = useState<string | null>(null);

  // 2026-11-09: 관장님은 자기 헬스장 트레이너에게 PT 상담을 신청하지 않으므로 숨김
  const isOwnGymManager = (!!managerId && managerId === user?.id) || !!user?.managedGymIds?.includes(gymId);
  if (!user?.id || user.id === trainerId || isOwnGymManager) return null;

  return (
    <>
      <TouchableOpacity style={[s.btn, compact && s.btnCompact]} onPress={() => setFormOpen(true)} activeOpacity={0.8} hitSlop={6}>
        <Ionicons name="chatbubbles-outline" size={compact ? 12 : 14} color={C.accent} />
        <Text style={[s.text, compact && { fontSize: 11 }]}>PT 상담 신청</Text>
      </TouchableOpacity>
      <PtRequestModal
        visible={formOpen}
        gymId={gymId}
        trainerId={trainerId}
        trainerNickname={trainerNickname}
        onClose={() => setFormOpen(false)}
        onCreated={(id) => {
          setTimeout(() => {
            Alert.alert('신청했어요', '답장이 오면 알림으로 알려드려요. 프로필 › PT 상담에서도 볼 수 있어요.', [
              { text: '확인', style: 'cancel' },
              { text: '대화 보기', onPress: () => setThreadId(id) },
            ]);
          }, 350);
        }}
      />
      {threadId && <PtRequestsModal visible onClose={() => setThreadId(null)} initialRequestId={threadId} />}
    </>
  );
}

const s = StyleSheet.create({
  btn:        { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 6, borderRadius: R.pill, borderWidth: 1, borderColor: C.accent + '60', backgroundColor: C.accentBg },
  btnCompact: { paddingHorizontal: 8, paddingVertical: 4 },
  text:       { color: C.accent, fontSize: 12, fontWeight: '800' },
});
