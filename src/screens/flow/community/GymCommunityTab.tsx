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
  TouchableOpacity,
} from 'react-native';
import { C, R, T } from '../../../theme';
import { useAuth } from '../../../context/AuthContext';
import AnnouncementsSection from './AnnouncementsSection';
import SendRequestSection from './SendRequestSection';
import GymOunwanGrid from '../../../components/gym/GymOunwanGrid';
import GymReviewBoard from '../../../components/gym/reviews/GymReviewBoard';
import GymQnaBoard from '../../../components/gym/qna/GymQnaBoard';

// 2026-11-09: 커뮤니티 안의 작은 탭 (오운완 / Q&A / 후기)
type CommunitySub = '오운완' | 'Q&A' | '후기';
const SUB_TABS: CommunitySub[] = ['오운완', 'Q&A', '후기'];

function SubTabBar({ value, onChange }: { value: CommunitySub; onChange: (v: CommunitySub) => void }) {
  return (
    <View style={s.subBar}>
      {SUB_TABS.map(t => (
        <TouchableOpacity key={t} style={[s.subBtn, value === t && s.subBtnActive]} onPress={() => onChange(t)} activeOpacity={0.8}>
          <Text style={[s.subText, value === t && s.subTextActive]}>{t}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────

interface Props {
  gymId: string;
  gymName: string;
  onPressMachine?: (machineId: string) => void;
  /** 2026-11-04: 후기 게시판 갱신 번호 / 후기가 바뀌었을 때 (정보 탭 미리보기 갱신용) */
  reviewsVersion?: number;
  onReviewsChanged?: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export default function GymCommunityTab({ gymId, gymName, onPressMachine, reviewsVersion, onReviewsChanged }: Props) {
  const { user } = useAuth();
  const [requestKey, setRequestKey] = useState(0);
  const [sub, setSub] = useState<CommunitySub>('오운완');

  const handleRequestSent = useCallback(() => {
    // 전송 후 폼 초기화 (key 변경으로 리마운트)
    setRequestKey((k) => k + 1);
  }, []);

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={s.scroll}
    >
      {/* 2026-11-09: 'Community' 제목·헬스장 이름 삭제 (상단 헤더와 중복) */}

      {/* ── 공지사항: 맨 위 (작은 탭 위) — 2026-11-09 ── */}
      <AnnouncementsSection gymId={gymId} />

      <SubTabBar value={sub} onChange={setSub} />

      {/* ── 오운완 그리드 (0건이면 안내) ── */}
      {sub === '오운완' && (
        <>
          <GymOunwanGrid gymId={gymId} onPressMachine={onPressMachine} />
          <Text style={s.subHint}>이 헬스장에서 올린 오운완이 여기에 모여요.</Text>
        </>
      )}

      {/* ── Q&A (2026-11-09) ── */}
      {sub === 'Q&A' && <GymQnaBoard gymId={gymId} />}

      {/* ── 후기 게시판 (2026-11-04) ── */}
      {sub === '후기' && <GymReviewBoard gymId={gymId} version={reviewsVersion} onChanged={onReviewsChanged} />}

      {/* ── 요청사항 ── */}
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

  subBar:        { flexDirection: 'row', gap: 6, backgroundColor: C.surface, borderRadius: R.pill, padding: 4, marginBottom: 16, borderWidth: 1, borderColor: C.border },
  subBtn:        { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: R.pill },
  subBtnActive:  { backgroundColor: C.accent },
  subText:       { color: C.textSub, fontSize: 14, fontWeight: '700' },
  subTextActive: { color: C.bg, fontWeight: '800' },
  subHint:       { color: C.textDim, fontSize: 12, textAlign: 'center', marginBottom: 24 },
});
