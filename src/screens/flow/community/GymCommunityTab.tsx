/**
 * GymCommunityTab
 * GymDetailModal의 Community 탭 컨텐츠 (10단계에서 연결).
 * - Announcements: 헬스장 공지사항
 * - Send Request: 익명 요청 전송
 *
 * 8단계(AnnouncementsSection) · 9단계(SendRequestSection)에서
 * 각 섹션을 별도 파일로 추출 예정.
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { C, R, T } from '../../../theme';
import { useAuth } from '../../../context/AuthContext';
import AnnouncementsSection from './AnnouncementsSection';
import SendRequestSection from './SendRequestSection';
import GymOunwanGrid from '../../../components/gym/GymOunwanGrid';

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────

interface Props {
  gymId: string;
  gymName: string;
  onPressMachine?: (machineId: string) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export default function GymCommunityTab({ gymId, gymName, onPressMachine }: Props) {
  const { user } = useAuth();
  const [requestKey, setRequestKey] = useState(0);

  const handleRequestSent = useCallback(() => {
    // 전송 후 폼 초기화 (key 변경으로 리마운트)
    setRequestKey((k) => k + 1);
  }, []);

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={s.scroll}
    >
      {/* ── Section header ── */}
      <View style={s.tabHeader}>
        <Text style={s.tabHeaderText}>Community</Text>
        <Text style={s.tabHeaderSub}>{gymName}</Text>
      </View>

      {/* ── 오운완 그리드 (0건이면 렌더 안 함) ── */}
      <GymOunwanGrid gymId={gymId} onPressMachine={onPressMachine} />

      {/* ── Announcements ── */}
      <AnnouncementsSection gymId={gymId} />

      {/* ── Send Request ── */}
      <SendRequestSection
        key={requestKey}
        gymId={gymId}
        gymName={gymName}
        onSent={handleRequestSent}
        user={user}
      />

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  scroll: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },

  tabHeader: {
    marginBottom: 20,
    gap: 4,
  },
  tabHeaderText: {
    ...T.title,
    color: C.text,
  },
  tabHeaderSub: {
    ...T.label,
    color: C.textSub,
  },
});
