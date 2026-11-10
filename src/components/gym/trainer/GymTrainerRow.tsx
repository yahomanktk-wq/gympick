import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { C } from '../../../theme';
import {
  fetchMyTrainerStatus, cancelMyTrainerApplication, removeGymTrainer, fetchMyTrainerIntro, updateMyTrainerIntro,
  TRAINER_INTRO_MAX, type TrainerStatus,
} from '../../../lib/db/gymTrainers';
import TextComposeModal from '../reviews/TextComposeModal';
import MemberRequestsSection from '../membership/MemberRequestsSection';
import TrainerApplyModal from './TrainerApplyModal';
import TrainerBadge from './TrainerBadge';

// 2026-11-09: 헬스장 상세 > 정보 탭, 회원 카드 아래의 작은 트레이너 줄
// - 관장님이 있는 헬스장에서만, 로그인했을 때만, 관장님 본인에게는 숨김
// - 트레이너: '트레이너로 활동 중' + 그만두기 / 신청 대기: 신청 취소 / 그 외: '트레이너 신청'

interface Props {
  gymId:     string;
  gymName:   string;
  managerId: string | null | undefined;
  userId:    string | null | undefined;
  /** 트레이너 상태·소개가 바뀌었을 때 (트레이너 목록 다시 불러오기용) */
  onChanged?: () => void;
}

export default function GymTrainerRow({ gymId, gymName, managerId, userId, onChanged }: Props) {
  const hidden = !managerId || !userId || managerId === userId;
  const [status,    setStatus]    = useState<TrainerStatus>('none');
  const [loaded,    setLoaded]    = useState(false);
  const [applyOpen, setApplyOpen] = useState(false);
  // 2026-11-09: 트레이너 본인 자기소개 수정
  const [introOpen, setIntroOpen] = useState(false);
  const [intro,     setIntro]     = useState('');

  const reload = useCallback(async () => {
    if (hidden) return;
    setStatus(await fetchMyTrainerStatus(gymId, userId));
    setLoaded(true);
  }, [hidden, gymId, userId]);
  useEffect(() => { reload(); }, [reload]);

  if (hidden || !loaded) return null;

  function onCancel() {
    Alert.alert('트레이너 신청을 취소할까요?', undefined, [
      { text: '아니요', style: 'cancel' },
      {
        text: '신청 취소', style: 'destructive', onPress: async () => {
          try { await cancelMyTrainerApplication(gymId, userId!); setStatus('none'); }
          catch { Alert.alert('취소하지 못했어요'); }
        },
      },
    ]);
  }

  function onQuit() {
    Alert.alert('트레이너를 그만둘까요?', '이미 단 댓글의 트레이너 배지는 그대로 남아요. 다시 하려면 새로 신청해야 해요.', [
      { text: '취소', style: 'cancel' },
      {
        text: '그만두기', style: 'destructive', onPress: async () => {
          try { await removeGymTrainer(gymId, userId!); setStatus('none'); onChanged?.(); }
          catch { Alert.alert('처리하지 못했어요'); }
        },
      },
    ]);
  }

  return (
    <>
      <View style={s.row}>
        {status === 'trainer' && (
          <>
            <TrainerBadge kind="trainer" />
            <Text style={[s.text, { flex: 1 }]}>이 헬스장 트레이너로 활동 중</Text>
            <TouchableOpacity
              onPress={async () => { setIntro((await fetchMyTrainerIntro(gymId, userId!)) ?? ''); setIntroOpen(true); }}
              hitSlop={8}
            >
              <Text style={s.link}>소개 수정</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onQuit} hitSlop={8}><Text style={s.dim}>그만두기</Text></TouchableOpacity>
          </>
        )}
        {status === 'pending' && (
          <>
            <Ionicons name="time-outline" size={14} color={C.textSub} />
            <Text style={[s.text, { flex: 1 }]}>트레이너 신청 중 · 관장님 승인 대기</Text>
            <TouchableOpacity onPress={onCancel} hitSlop={8}><Text style={s.dim}>취소</Text></TouchableOpacity>
          </>
        )}
        {status === 'none' && (
          <TouchableOpacity style={s.applyBtn} onPress={() => setApplyOpen(true)} hitSlop={8} activeOpacity={0.7}>
            <Text style={s.dim}>이 헬스장 트레이너이신가요?</Text>
            <Text style={s.link}>트레이너 신청</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* 트레이너: 회원 가입 신청이 있으면 여기서 바로 승인 (2026-11-09) */}
      {status === 'trainer' && (
        <View style={{ marginTop: 10 }}>
          <MemberRequestsSection gymId={gymId} hideWhenEmpty />
        </View>
      )}

      <TextComposeModal
        visible={introOpen}
        title="트레이너 소개 수정"
        placeholder="예: 평일 오후 PT 담당 · 체형 교정"
        maxLength={TRAINER_INTRO_MAX}
        initialText={intro}
        submitLabel="저장"
        guide="헬스장 상세의 트레이너 목록에 이름과 함께 보여요."
        onClose={() => setIntroOpen(false)}
        onSubmit={async (text) => {
          try { await updateMyTrainerIntro(gymId, text); onChanged?.(); return true; }
          catch { Alert.alert('저장하지 못했어요'); return false; }
        }}
      />

      <TrainerApplyModal
        visible={applyOpen}
        gymId={gymId}
        gymName={gymName}
        onClose={() => setApplyOpen(false)}
        onApplied={() => { reload(); onChanged?.(); }}
      />
    </>
  );
}

const s = StyleSheet.create({
  row:      { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 4, paddingTop: 10 },
  text:     { color: C.text, fontSize: 13, fontWeight: '600' },
  dim:      { color: C.textSub, fontSize: 13 },
  link:     { color: C.accent, fontSize: 13, fontWeight: '700' },
  applyBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
});
