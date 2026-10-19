import { supabase } from '../supabase';

export type NotificationType =
  | 'manager_approved' | 'manager_rejected'
  | 'gym_request_reviewed' | 'gym_request_resolved'
  | 'gym_report_reviewed'
  | 'gym_manager_link_approved' | 'gym_manager_link_rejected'
  | 'inquiry_answered'
  | 'announcement' | 'general';

export interface AppNotification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  read: boolean;
  relatedId?: string;
  createdAt: string;
}

// ── Mock fallback ──────────────────────────────────────────

let mockNotifications: AppNotification[] = [
  {
    id: 'n1',
    userId: 'u1',
    type: 'general',
    title: 'GymPick에 오신 걸 환영해요!',
    body: '운동을 기록하고, 헬스장을 탐색하고, 개인 기록을 추적해보세요.',
    read: false,
    createdAt: '2026-03-01T09:00:00Z',
  },
  {
    id: 'n2',
    userId: 'u1',
    type: 'announcement',
    title: '새 기능: 루틴 템플릿',
    body: '이제 운동 루틴을 템플릿으로 저장하고 재사용할 수 있어요.',
    read: true,
    createdAt: '2026-03-10T12:00:00Z',
  },
  {
    id: 'n3',
    userId: 'u1',
    type: 'general',
    title: '이번 주 운동 목표를 달성했어요!',
    body: '지난 7일간 3회 이상 운동을 기록했어요. 잘 하고 있어요!',
    read: false,
    createdAt: '2026-03-20T08:00:00Z',
  },
];

function rowToNotif(r: any): AppNotification {
  return {
    id:        r.id,
    userId:    r.user_id,
    type:      r.type,
    title:     r.title,
    body:      r.body ?? '',
    read:      r.read ?? false,
    relatedId: r.related_id ?? undefined,
    createdAt: r.created_at,
  };
}

// ── Queries ────────────────────────────────────────────────

export async function getNotifications(userId: string): Promise<AppNotification[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) return mockNotifications.filter(n => n.userId === userId);
  return (data ?? []).map(rowToNotif);
}

export async function markNotificationRead(id: string): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .update({ read: true })
    .eq('id', id);
  if (error) {
    const n = mockNotifications.find(x => x.id === id);
    if (n) n.read = true;
  }
}

export async function markAllNotificationsRead(userId: string): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .update({ read: true })
    .eq('user_id', userId)
    .eq('read', false);
  if (error) {
    mockNotifications
      .filter(n => n.userId === userId)
      .forEach(n => { n.read = true; });
  }
}

export function getUnreadCount(notifications: AppNotification[]): number {
  return notifications.filter(n => !n.read).length;
}

export async function fetchNotifications(userId: string): Promise<AppNotification[]> {
  try {
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50);
    return (data ?? []).map((r: any) => ({
      id:        r.id,
      userId:    r.user_id,
      type:      r.type,
      title:     r.title,
      body:      r.body,
      read:      r.read ?? false,
      relatedId: r.related_id ?? null,
      createdAt: r.created_at,
    }));
  } catch {
    return mockNotifications.filter(n => n.userId === userId);
  }
}

export async function sendNotification(
  userId: string,
  type: string,
  title: string,
  body: string,
  relatedId?: string,
): Promise<void> {
  try {
    await supabase.from('notifications').insert({
      user_id:    userId,
      type,
      title,
      body,
      read:       false,
      related_id: relatedId ?? null,
    });
  } catch (e: any) {
    console.warn('[notifications] sendNotification 오류:', e.message);
  }
}

export async function fetchUnreadCount(userId: string): Promise<number> {
  try {
    const { count } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('read', false);
    return count ?? 0;
  } catch {
    return 0;
  }
}
