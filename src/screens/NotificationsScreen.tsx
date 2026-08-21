import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList,
  TouchableOpacity, SafeAreaView, StatusBar,
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

interface Props {
  onClose: () => void;
}

const TYPE_META: Record<string, { icon: React.ComponentProps<typeof Ionicons>['name']; color: string }> = {
  manager_approved:     { icon: 'checkmark-circle',  color: '#3dd68c' },
  manager_rejected:     { icon: 'close-circle',       color: C.danger  },
  gym_request_reviewed: { icon: 'checkmark-circle',  color: '#3dd68c' },
  gym_request_resolved: { icon: 'close-circle',       color: C.danger  },
  gym_report_reviewed:  { icon: 'flag',                color: '#ff7eb3' },
  announcement:         { icon: 'megaphone',           color: '#ffb547' },
  general:              { icon: 'notifications',       color: '#5ba4ff' },
  default:              { icon: 'notifications',       color: C.accent  },
};

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
                    {item.body.length > 0 && (
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
