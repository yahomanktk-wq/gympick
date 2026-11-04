import React, { useState } from 'react';
import { TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { C } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import { blockUser, ReportTargetType } from '../../lib/db/moderation';
import { invalidateActiveFeedPostsCache } from '../../data/feedPostsCache';
import ActionSheet, { ActionSheetOption } from './ActionSheet';
import ReportSheet, { ReportTarget } from './ReportSheet';

// 2026-11-04: 오운완 / 댓글 / 후기의 '…' 메뉴 (신고 · 차단 · 삭제).
// - 남의 글: 신고하기, 차단하기
// - 삭제 권한이 있으면(내 글, 내 오운완에 달린 댓글 등): 삭제
// - 선택지가 하나도 없으면 버튼을 그리지 않는다 (비로그인 등)

interface Props {
  targetType:     ReportTargetType;
  targetId:       string;
  authorId:       string;
  authorNickname: string;
  /** 삭제 메뉴를 보여줄지 */
  canDelete?:     boolean;
  /** 삭제 확인 후 호출 */
  onDelete?:      () => Promise<void> | void;
  /** 차단이 끝난 뒤 호출 (목록에서 빼기 등) */
  onBlocked?:     (userId: string) => void;
  size?:          number;
  color?:         string;
}

const SHEET_GAP_MS = 350; // 시트가 닫힌 뒤 다음 모달·알림을 띄운다 (iOS 모달 겹침 방지)

const DELETE_TITLE: Record<ReportTargetType, string> = {
  ounwan:     '오운완을 삭제할까요?',
  comment:    '댓글을 삭제할까요?',
  gym_review: '후기를 삭제할까요?',
};

export default function ContentMenuButton({
  targetType, targetId, authorId, authorNickname,
  canDelete, onDelete, onBlocked, size = 18, color = C.textSub,
}: Props) {
  const { user } = useAuth();
  const [sheetOpen,    setSheetOpen]    = useState(false);
  const [reportTarget, setReportTarget] = useState<ReportTarget | null>(null);

  const isMine   = !!user?.id && user.id === authorId;
  const loggedIn = !!user?.id;

  function confirmDelete() {
    Alert.alert(DELETE_TITLE[targetType], '삭제하면 되돌릴 수 없어요.', [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제', style: 'destructive',
        onPress: async () => {
          try { await onDelete?.(); }
          catch { Alert.alert('오류', '삭제하지 못했어요. 잠시 후 다시 시도해주세요.'); }
        },
      },
    ]);
  }

  function confirmBlock() {
    Alert.alert(
      `${authorNickname}님을 차단할까요?`,
      '차단하면 이 사람의 오운완·댓글·후기가 보이지 않고, 내 오운완에 댓글을 달 수 없어요. 프로필 > 차단한 사용자에서 해제할 수 있어요.',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '차단', style: 'destructive',
          onPress: async () => {
            try {
              await blockUser(authorId);
              invalidateActiveFeedPostsCache();
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              onBlocked?.(authorId);
            } catch {
              Alert.alert('오류', '차단하지 못했어요. 잠시 후 다시 시도해주세요.');
            }
          },
        },
      ],
    );
  }

  const options: ActionSheetOption[] = [];
  if (loggedIn && !isMine) {
    options.push({
      label: '신고하기',
      onPress: () => setTimeout(() => setReportTarget({ type: targetType, id: targetId, userId: authorId }), SHEET_GAP_MS),
    });
    options.push({
      label: '차단하기', destructive: true,
      onPress: () => setTimeout(confirmBlock, SHEET_GAP_MS),
    });
  }
  if (canDelete && onDelete) {
    options.push({ label: '삭제', destructive: true, onPress: () => setTimeout(confirmDelete, SHEET_GAP_MS) });
  }

  if (options.length === 0) return null;

  return (
    <>
      <TouchableOpacity
        onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setSheetOpen(true); }}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        activeOpacity={0.6}
        accessibilityRole="button"
        accessibilityLabel="더보기"
      >
        <Ionicons name="ellipsis-horizontal" size={size} color={color} />
      </TouchableOpacity>
      <ActionSheet
        visible={sheetOpen}
        title={authorNickname}
        options={options}
        onClose={() => setSheetOpen(false)}
      />
      <ReportSheet target={reportTarget} onClose={() => setReportTarget(null)} />
    </>
  );
}
