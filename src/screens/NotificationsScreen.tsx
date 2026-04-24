import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { C, R, T } from '../theme';
import {
  AppNotification,
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from '../lib/db/notifications';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

const TYPE_META: Record<AppNotification['type'], { icon: IoniconName; color: string }> = {
  manager_approved: { icon: 'checkmark-circle', color: C.accent },
  manager_rejected: { icon: 'close-circle',     color: '#ff4d6d'  },
  announcement:     { icon: 'megaphone',         color: '#ffb547'  },
  general:          { icon: 'notifications',     color: '#5ba4ff'  },
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

interface Props {
  userId: string;
  onClose: () => void;
}

export default function NotificationsScreen({ userId, onClose }: Props) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const data = await getNotifications(userId);
    setNotifications(data);
    setLoading(false);
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  async function handleMarkRead(id: string) {
    await markNotificationRead(id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  }

  async function handleMarkAllRead() {
    await markAllNotificationsRead(userId);
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  }

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />

      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity style={s.headerBtn} onPress={onClose} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={20} color={C.text} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>알림</Text>
        {unreadCount > 0 ? (
          <TouchableOpacity style={s.headerBtn} onPress={handleMarkAllRead} activeOpacity={0.7}>
            <Text style={s.markAllText}>모두 읽음</Text>
          </TouchableOpacity>
        ) : (
          <View style={s.headerBtn} />
        )}
      </View>

      {loading ? (
        <View style={s.emptyWrap}>
          <Text style={s.emptyText}>불러오는 중...</Text>
        </View>
      ) : notifications.length === 0 ? (
        <View style={s.emptyWrap}>
          <Ionicons name="notifications-off-outline" size={48} color={C.textDim} />
          <Text style={s.emptyTitle}>알림이 없어요</Text>
          <Text style={s.emptyText}>새 알림이 오면 여기에 표시됩니다.</Text>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false}>
          {notifications.map((notif, i) => {
            const meta = TYPE_META[notif.type] ?? TYPE_META.general;
            return (
              <TouchableOpacity
                key={notif.id}
                style={[s.row, !notif.read && s.rowUnread, i > 0 && s.rowBorder]}
                activeOpacity={0.75}
                onPress={() => { if (!notif.read) handleMarkRead(notif.id); }}
              >
                {/* Unread dot */}
                {!notif.read && <View style={s.unreadDot} />}

                {/* Icon */}
                <View style={[s.iconWrap, { backgroundColor: meta.color + '18' }]}>
                  <Ionicons name={meta.icon} size={20} color={meta.color} />
                </View>

                {/* Text */}
                <View style={s.textWrap}>
                  <Text style={[s.title, !notif.read && s.titleUnread]} numberOfLines={1}>
                    {notif.title}
                  </Text>
                  {notif.body.length > 0 && (
                    <Text style={s.body} numberOfLines={2}>{notif.body}</Text>
                  )}
                  <Text style={s.time}>{formatDate(notif.createdAt)}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
          <View style={{ height: 32 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 8, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  headerBtn:    { width: 60, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle:  { flex: 1, textAlign: 'center', ...T.section, color: C.text },
  markAllText:  { fontSize: 12, fontWeight: '700', color: C.accent },

  emptyWrap: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 32, gap: 12,
  },
  emptyTitle: { ...T.section, color: C.text },
  emptyText:  { fontSize: 13, color: C.textDim, textAlign: 'center' },

  row: {
    flexDirection: 'row', alignItems: 'flex-start',
    paddingHorizontal: 20, paddingVertical: 16,
    position: 'relative',
  },
  rowUnread:  { backgroundColor: C.surfaceHigh },
  rowBorder:  { borderTopWidth: 1, borderTopColor: C.border },

  unreadDot: {
    position: 'absolute', left: 8, top: 22,
    width: 6, height: 6, borderRadius: 3,
    backgroundColor: C.accent,
  },

  iconWrap: {
    width: 40, height: 40,
    borderRadius: R.inner,
    alignItems: 'center', justifyContent: 'center',
    marginRight: 14, flexShrink: 0,
  },

  textWrap:    { flex: 1 },
  title:       { fontSize: 14, fontWeight: '600', color: C.textSub, marginBottom: 3 },
  titleUnread: { color: C.text, fontWeight: '700' },
  body:        { fontSize: 13, color: C.textDim, lineHeight: 18, marginBottom: 4 },
  time:        { fontSize: 11, color: C.textDim },
});
