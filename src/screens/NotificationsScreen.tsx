import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList,
  TouchableOpacity, SafeAreaView, StatusBar, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { C, R, T } from '../theme';
import { useAuth } from '../context/AuthContext';
import {
  fetchNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  type AppNotification,
} from '../lib/db/notifications';
import GymDetailModal from './flow/GymDetailModal';
import GymQuestionModal from '../components/gym/qna/GymQuestionModal';
import PtRequestsModal from '../components/pt/PtRequestsModal';
import FeedDetailModal from '../components/feed/FeedDetailModal';
import { fetchFeedPostById } from '../lib/db/feedPosts';
import type { WorkoutFeedPost } from '../data/types';

interface Props {
  onClose: () => void;
}

const TYPE_META: Record<string, { icon: React.ComponentProps<typeof Ionicons>['name']; color: string }> = {
  manager_approved:     { icon: 'checkmark-circle',  color: '#3dd68c' },
  manager_rejected:     { icon: 'close-circle',       color: C.danger  },
  gym_request_reviewed: { icon: 'checkmark-circle',  color: '#3dd68c' },
  gym_request_resolved: { icon: 'close-circle',       color: C.danger  },
  gym_report_reviewed:  { icon: 'flag',                color: '#ff7eb3' },
  inquiry_answered:     { icon: 'chatbox-ellipses',     color: '#5ba4ff' },
  new_machine:          { icon: 'barbell',             color: C.accent  },
  ounwan_comment:       { icon: 'chatbubble-ellipses', color: C.accent  },
  gym_review_reply:     { icon: 'chatbox-ellipses',    color: '#3dd68c' },
  member_request:       { icon: 'person-add',          color: C.accent  },
  member_approved:      { icon: 'people',              color: '#3dd68c' },
  member_rejected:      { icon: 'close-circle',        color: C.danger  },
  trainer_application:  { icon: 'fitness',             color: C.accent  },
  trainer_approved:     { icon: 'fitness',             color: '#3dd68c' },
  trainer_rejected:     { icon: 'close-circle',        color: C.danger  },
  ounwan_like:          { icon: 'heart',               color: C.danger  },
  qna_question:         { icon: 'help-circle',         color: C.accent  },
  qna_answer:           { icon: 'chatbubbles',         color: '#3dd68c' },
  pt_request:           { icon: 'fitness',             color: C.accent  },
  pt_message:           { icon: 'chatbubbles',         color: '#5ba4ff' },
  announcement:         { icon: 'megaphone',           color: '#ffb547' },
  general:              { icon: 'notifications',       color: '#5ba4ff' },
  default:              { icon: 'notifications',       color: C.accent  },
};

const DETAIL_TYPES = new Set<string>(['qna_question', 'qna_answer', 'pt_request', 'pt_message']);

const GYM_LINK_TYPES = new Set<string>([
  'member_request', 'member_approved', 'member_rejected',
  'trainer_application', 'trainer_approved', 'trainer_rejected',
]);

function formatDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 60)  return `${diffMin}분 전`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}시간 전`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 7)  return `${diffD}일 전`;
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export default function NotificationsScreen({ onClose }: Props) {
  const { user, refreshUser } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  // '새 머신 입고' 알림 탭 시 열 헬스장 상세 (F4-3)
  const [gymDetailId, setGymDetailId] = useState<string | null>(null);
  // 2026-11-04: '새 댓글' 알림 탭 시 열 오운완 상세
  const [feedPost, setFeedPost] = useState<WorkoutFeedPost | null>(null);
  // 2026-11-09: Q&A 알림 → 질문 상세 / PT 알림 → 그 상담 대화방
  const [questionId, setQuestionId] = useState<string | null>(null);
  const [ptRequestId, setPtRequestId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    const data = await fetchNotifications(user.id);
    setNotifications(data);
    setLoading(false);
  }, [user?.id]);

  useEffect(() => { load(); }, [load]);

  async function handleRead(n: AppNotification) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (!n.read) {
      await markNotificationRead(n.id);
      setNotifications(prev => prev.map(item => item.id === n.id ? { ...item, read: true } : item));
    }
    if (n.type === 'manager_approved') {
      await refreshUser();
    }
    // 새 머신 입고 → 해당 헬스장 상세(정보 탭)를 연다. 펼침/접힘은 하지 않음.
    if (n.type === 'new_machine' && n.relatedId) {
      setGymDetailId(n.relatedId);
      return;
    }
    // 2026-11-04: 헬스장 후기 답글 → 그 헬스장 상세
    // 2026-11-09: 헬스장 회원·트레이너 신청(관장님) / 승인 / 거절 → 그 헬스장 상세 (관장님은 회원 카드에서 승인)
    if (GYM_LINK_TYPES.has(n.type) && n.relatedId) {
      setGymDetailId(n.relatedId);
      return;
    }
    if (n.type === 'gym_review_reply' && n.relatedId) {
      setGymDetailId(n.relatedId);
      return;
    }
    // 2026-11-04: 오운완 새 댓글 → 그 오운완 상세 (댓글 포함)
    if ((n.type === 'qna_question' || n.type === 'qna_answer') && n.relatedId) {
      setQuestionId(n.relatedId);
      return;
    }
    if ((n.type === 'pt_request' || n.type === 'pt_message') && n.relatedId) {
      setPtRequestId(n.relatedId);
      return;
    }
    // 2026-11-09: 하트 알림도 그 오운완 상세로
    if ((n.type === 'ounwan_comment' || n.type === 'ounwan_like') && n.relatedId) {
      const post = await fetchFeedPostById(n.relatedId);
      if (post) setFeedPost(post);
      else Alert.alert('볼 수 없는 오운완이에요', '삭제됐거나 비공개로 바뀐 오운완이에요.');
      return;
    }
    // 본문이 2줄 넘게 잘리는 경우가 많아(관리자 코멘트가 뒤에 붙는 경우 등) 탭하면
    // 전체 텍스트를 펼쳐서 보여준다 — 다시 탭하면 접힘.
    setExpandedId(prev => (prev === n.id ? null : n.id));
  }

  async function handleMarkAllRead() {
    if (!user?.id) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await markAllNotificationsRead(user.id);
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  }

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />

      {/* 헤더 */}
      <View style={s.header}>
        <TouchableOpacity onPress={onClose} style={s.headerBtn}>
          <Ionicons name="chevron-down" size={22} color={C.text} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>알림</Text>
        {unreadCount > 0 ? (
          <TouchableOpacity onPress={handleMarkAllRead} style={s.headerBtn}>
            <Text style={{ fontSize: 12, fontWeight: '700', color: C.accent }}>모두 읽음</Text>
          </TouchableOpacity>
        ) : (
          <View style={s.headerBtn} />
        )}
      </View>

      {loading ? (
        <View style={s.empty}>
          <Text style={s.emptyText}>알림을 불러오는 중...</Text>
        </View>
      ) : notifications.length === 0 ? (
        <View style={s.empty}>
          <Ionicons name="notifications-outline" size={48} color={C.textDim} />
          <Text style={s.emptyText}>아직 알림이 없어요</Text>
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={item => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingVertical: 8 }}
          renderItem={({ item, index }) => {
            const meta = TYPE_META[item.type] ?? TYPE_META.default;
            const isExpanded = expandedId === item.id;
            return (
              <TouchableOpacity
                style={[s.item, !item.read && s.itemUnread, index > 0 && s.itemBorder]}
                onPress={() => handleRead(item)}
                activeOpacity={0.8}
              >
                <View style={[s.iconWrap, { backgroundColor: meta.color + '18' }]}>
                  <Ionicons name={meta.icon} size={22} color={meta.color} />
                </View>
                <View style={{ flex: 1, gap: 3 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={[s.itemTitle, !item.read && s.itemTitleUnread, { flex: 1 }]}>{item.title}</Text>
                    {(item.type === 'new_machine' || item.type === 'ounwan_comment' || item.type === 'ounwan_like' || DETAIL_TYPES.has(item.type) || item.type === 'gym_review_reply' || GYM_LINK_TYPES.has(item.type)) && item.relatedId ? (
                      <Ionicons name="chevron-forward" size={14} color={C.textDim} />
                    ) : item.body.length > 0 && (
                      <Ionicons name={isExpanded ? 'chevron-up' : 'chevron-down'} size={14} color={C.textDim} />
                    )}
                  </View>
                  {item.body.length > 0 && (
                    <Text style={s.itemBody} numberOfLines={isExpanded ? undefined : 2}>{item.body}</Text>
                  )}
                  <Text style={s.itemTime}>{formatDate(item.createdAt)}</Text>
                </View>
                {!item.read && <View style={s.unreadDot} />}
              </TouchableOpacity>
            );
          }}
          ListFooterComponent={<View style={{ height: 32 }} />}
        />
      )}

      <GymDetailModal
        visible={!!gymDetailId}
        gymId={gymDetailId}
        onClose={() => setGymDetailId(null)}
      />

      {feedPost && (
        <FeedDetailModal
          post={feedPost}
          onClose={() => setFeedPost(null)}
          onPressGym={(gymId) => {
            setFeedPost(null);
            setTimeout(() => setGymDetailId(gymId), 350);
          }}
          onPressMachine={() => setFeedPost(null)}
        />
      )}
      {questionId && <GymQuestionModal questionId={questionId} onClose={() => setQuestionId(null)} />}
      <PtRequestsModal visible={!!ptRequestId} initialRequestId={ptRequestId} onClose={() => setPtRequestId(null)} />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: C.bg },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 8, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  headerBtn:   { width: 80, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '800', color: C.text },

  empty:     { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  emptyText: { fontSize: 14, color: C.textDim, fontWeight: '600' },

  item: {
    flexDirection: 'row', alignItems: 'flex-start',
    gap: 12, paddingHorizontal: 16, paddingVertical: 14,
  },
  itemUnread:      { backgroundColor: C.surface },
  itemBorder:      { borderTopWidth: 1, borderTopColor: C.border },
  iconWrap:        { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  itemTitle:       { fontSize: 14, fontWeight: '600', color: C.textSub },
  itemTitleUnread: { color: C.text, fontWeight: '700' },
  itemBody:        { fontSize: 13, color: C.textDim, lineHeight: 18 },
  itemTime:        { fontSize: 11, color: C.textDim, marginTop: 2 },
  unreadDot:       { width: 8, height: 8, borderRadius: 4, backgroundColor: C.accent, marginTop: 4, flexShrink: 0 },
});
