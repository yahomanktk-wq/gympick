import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  Modal,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { C, R } from '../theme';
import { fetchMyGymRegistrationRequests, type GymRegistrationRequest } from '../lib/db/gymRegistrationRequests';
import { fetchMyGymInfoReports, type GymInfoReport } from '../lib/db/gymInfoReports';
import { getManagerRequests, type ManagerRequest } from '../lib/db/managerRequests';
import { getManagerDocSignedUrl } from '../lib/managerDocStorage';

interface Props {
  visible: boolean;
  onClose: () => void;
  userId: string | undefined;
}

type MergedItem =
  | { kind: 'gym_registration'; data: GymRegistrationRequest }
  | { kind: 'gym_info_report';  data: GymInfoReport }
  | { kind: 'manager_request';  data: ManagerRequest };

const KIND_META: Record<MergedItem['kind'], { label: string; fg: string; bg: string; icon: React.ComponentProps<typeof Ionicons>['name'] }> = {
  gym_registration: { label: '헬스장 등록 제안', fg: C.tagCategory.fg, bg: C.tagCategory.bg, icon: 'business-outline' },
  gym_info_report:  { label: '정보 제보',        fg: C.tagMuscle.fg,   bg: C.tagMuscle.bg,   icon: 'flag-outline' },
  manager_request:  { label: '매니저 신청',      fg: C.tagBrand.fg,    bg: C.tagBrand.bg,    icon: 'person-add-outline' },
};

function isPending(item: MergedItem): boolean {
  return item.data.status === 'pending';
}

function titleFor(item: MergedItem): string {
  if (item.kind === 'gym_info_report') {
    return `${item.data.gymName || '헬스장'} · ${item.data.reportType}`;
  }
  return item.data.gymName;
}

function statusLabel(item: MergedItem): string {
  const status = item.data.status;
  switch (item.kind) {
    case 'gym_registration':
      return status === 'pending' ? '검토 대기' : status === 'reviewed' ? '등록완료' : '등록불가';
    case 'gym_info_report':
      return status === 'pending' ? '검토 대기' : '검토 완료';
    case 'manager_request':
      return status === 'pending' ? '심사 대기' : status === 'approved' ? '승인됨' : '반려됨';
  }
}

function MyRequestCard({ item, expanded, onToggle }: { item: MergedItem; expanded: boolean; onToggle: () => void }) {
  const meta = KIND_META[item.kind];
  const pending = isPending(item);
  const [docUrl, setDocUrl] = useState<string | null>(null);

  useEffect(() => {
    if (item.kind === 'manager_request' && item.data.documentPhotoUrl && expanded && !docUrl) {
      getManagerDocSignedUrl(item.data.documentPhotoUrl).then(url => { if (url) setDocUrl(url); });
    }
  }, [item, expanded, docUrl]);

  return (
    <TouchableOpacity
      style={{ backgroundColor: C.surface, borderRadius: R.card, borderWidth: 1, borderColor: C.border, padding: 16, gap: 8 }}
      onPress={onToggle}
      activeOpacity={0.8}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: R.pill, backgroundColor: meta.bg }}>
          <Text style={{ fontSize: 10, fontWeight: '700', color: meta.fg }}>{meta.label}</Text>
        </View>
        <Text style={{ flex: 1, fontSize: 14, fontWeight: '700', color: C.text }} numberOfLines={expanded ? undefined : 1}>
          {titleFor(item)}
        </Text>
        <View style={{
          paddingHorizontal: 8, paddingVertical: 3, borderRadius: R.pill,
          backgroundColor: pending ? C.tagMuscle.bg : C.accentBg,
        }}>
          <Text style={{ fontSize: 10, fontWeight: '700', color: pending ? C.tagMuscle.fg : C.accent }}>
            {pending ? '대기중' : '완료'}
          </Text>
        </View>
      </View>
      <Text style={{ fontSize: 11, color: C.textDim }}>{item.data.createdAt.slice(0, 10)}</Text>

      {expanded && (
        <View style={{ marginTop: 4, gap: 10 }}>
          <View style={{ height: 1, backgroundColor: C.border }} />

          {item.kind === 'gym_registration' && (
            <View style={{ gap: 4 }}>
              <Text style={{ fontSize: 13, color: C.textSub, lineHeight: 18 }}>위치: {item.data.location}{item.data.addressDetail ? ` ${item.data.addressDetail}` : ''}</Text>
              {item.data.hours ? <Text style={{ fontSize: 13, color: C.textSub, lineHeight: 18 }}>운영시간: {item.data.hours}</Text> : null}
              {item.data.notes ? <Text style={{ fontSize: 13, color: C.textSub, lineHeight: 18 }}>메모: {item.data.notes}</Text> : null}
            </View>
          )}

          {item.kind === 'gym_info_report' && (
            <View style={{ gap: 4 }}>
              <Text style={{ fontSize: 13, color: C.textSub, lineHeight: 18 }}>{item.data.content}</Text>
            </View>
          )}

          {item.kind === 'manager_request' && (
            <View style={{ gap: 4 }}>
              <Text style={{ fontSize: 13, color: C.textSub, lineHeight: 18 }}>위치: {item.data.location}</Text>
              {item.data.phone ? <Text style={{ fontSize: 13, color: C.textSub, lineHeight: 18 }}>전화번호: {item.data.phone}</Text> : null}
              {item.data.message ? <Text style={{ fontSize: 13, color: C.textSub, lineHeight: 18 }}>메모: {item.data.message}</Text> : null}
              {item.data.documentPhotoUrl ? (
                docUrl ? (
                  <Image source={{ uri: docUrl }} style={{ width: '100%', height: 160, borderRadius: R.inner, backgroundColor: C.bg, marginTop: 4 }} resizeMode="cover" />
                ) : (
                  <Text style={{ fontSize: 11, color: C.textDim }}>첨부 서류 불러오는 중...</Text>
                )
              ) : null}
            </View>
          )}

          <Text style={{ fontSize: 11, fontWeight: '700', color: C.textDim }}>상태: {statusLabel(item)}</Text>

          <View style={{ backgroundColor: C.surfaceHigh, borderRadius: R.inner, padding: 12, gap: 4 }}>
            <Text style={{ fontSize: 11, fontWeight: '700', color: C.textDim }}>관리자 답변</Text>
            {item.data.adminComment ? (
              <Text style={{ fontSize: 13, color: C.text, lineHeight: 18 }}>{item.data.adminComment}</Text>
            ) : pending ? (
              <Text style={{ fontSize: 13, color: C.textDim }}>아직 답변이 없어요</Text>
            ) : (
              <Text style={{ fontSize: 13, color: C.textDim }}>코멘트 없이 처리되었어요</Text>
            )}
          </View>
        </View>
      )}
    </TouchableOpacity>
  );
}

export default function MyRequestsModal({ visible, onClose, userId }: Props) {
  const [items, setItems] = useState<MergedItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const [gymRegs, gymReports, managerReqs] = await Promise.all([
        fetchMyGymRegistrationRequests(userId),
        fetchMyGymInfoReports(userId),
        getManagerRequests(userId),
      ]);
      const merged: MergedItem[] = [
        ...gymRegs.map(data => ({ kind: 'gym_registration' as const, data })),
        ...gymReports.map(data => ({ kind: 'gym_info_report' as const, data })),
        ...managerReqs.map(data => ({ kind: 'manager_request' as const, data })),
      ].sort((a, b) => b.data.createdAt.localeCompare(a.data.createdAt));
      setItems(merged);
    } catch (e: any) {
      if (__DEV__) console.warn('[MyRequestsModal] 요청 내역 로딩 오류:', e);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (visible) {
      setExpandedId(null);
      load();
    }
  }, [visible, load]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
        {/* 헤더 */}
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: C.border }}>
          <TouchableOpacity onPress={onClose} style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="chevron-down" size={22} color={C.text} />
          </TouchableOpacity>
          <Text style={{ flex: 1, fontSize: 16, fontWeight: '800', color: C.text, textAlign: 'center' }}>
            내 요청 내역
          </Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView contentContainerStyle={{ padding: 20, gap: 12 }}>
          {loading && items.length === 0 ? (
            <ActivityIndicator color={C.accent} style={{ marginTop: 40 }} />
          ) : items.length === 0 ? (
            <View style={{ alignItems: 'center', paddingVertical: 60, gap: 10 }}>
              <Ionicons name="document-text-outline" size={36} color={C.textDim} />
              <Text style={{ fontSize: 14, fontWeight: '600', color: C.textSub }}>아직 제출한 요청이 없어요</Text>
            </View>
          ) : (
            items.map(item => (
              <MyRequestCard
                key={`${item.kind}-${item.data.id}`}
                item={item}
                expanded={expandedId === item.data.id}
                onToggle={() => setExpandedId(prev => (prev === item.data.id ? null : item.data.id))}
              />
            ))
          )}
          <View style={{ height: 24 }} />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
