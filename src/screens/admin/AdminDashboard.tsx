import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  FlatList,
  SafeAreaView,
  StatusBar,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { C, R, T } from '../../theme';
import { PendingGym, PendingEdit, FlaggedItem, ReviewStatus, FlagType } from '../../data/types';
import { PENDING_GYMS, PENDING_EDITS, FLAGGED_ITEMS } from '../../data/mockAdmin';
import { MACHINES } from '../../data/machines';
import type { Machine } from '../../data/types';
import { Switch } from 'react-native';
import {
  getBrandCopyrightList,
  setBrandCopyrightStatus,
} from '../../data/brandCopyrightStore';
import {
  getAllGymsForAdmin,
  getAllEditRequests,
  updateGymStatus,
  updateEditRequestStatus,
  type RegistrationGym,
  type EditRequest as RegEditRequest,
  type GymRegStatus,
} from '../../data/gymRegistrationStore';
import {
  getAllGymInfoReports,
  markReportReviewed,
  deleteGymInfoReport,
  type GymInfoReport,
} from '../../data/gymReportStore';
import {
  getAllManagerApplications,
  updateApplicationStatus,
  type ManagerApplication,
} from '../../data/managerApplicationStore';
import {
  getAllAdminGyms,
  addAdminGym,
  updateAdminGym,
  type AdminRegisteredGym,
} from '../../data/adminGymStore';
import MachineCard from '../../components/MachineCard';
import {
  fetchGymRegistrationRequests,
  updateGymRequestStatus,
  type GymRegistrationRequest,
} from '../../lib/db/gymRegistrationRequests';

const SCREEN_W     = Dimensions.get('window').width;
const CAT_CARD_W   = Math.floor((SCREEN_W - 40 - 12) / 2);
const CAT_MUSCLES  = ['All', ...Array.from(new Set(MACHINES.map(m => m.targetMuscle))).sort()];
const CAT_BRANDS   = ['All', ...Array.from(new Set(MACHINES.map(m => m.brand))).sort()];

// --- Types

type AdminView = 'home' | 'pending-gyms' | 'gym-detail' | 'pending-edits' | 'flagged' | 'machine-catalog' | 'brand-copyright' | 'gym-reports' | 'manager-requests' | 'register-gym' | 'gym-registration-requests';

// --- Shared components

function Header({
  title, onBack, right,
}: { title: string; onBack: () => void; right?: React.ReactNode }) {
  return (
    <View style={styles.header}>
      <TouchableOpacity onPress={onBack} style={styles.backBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
        <Ionicons name="chevron-back" size={22} color={C.text} />
      </TouchableOpacity>
      <Text style={styles.headerTitle}>{title}</Text>
      {right ?? <View style={{ width: 40 }} />}
    </View>
  );
}

function ReviewButtons({
  onApprove, onReject,
}: { onApprove: () => void; onReject: () => void }) {
  return (
    <View style={styles.reviewBtns}>
      <TouchableOpacity style={styles.rejectBtn} onPress={onReject} activeOpacity={0.8}>
        <Ionicons name="close" size={14} color={C.danger} />
        <Text style={styles.rejectBtnText}>거절</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.approveBtn} onPress={onApprove} activeOpacity={0.85}>
        <Ionicons name="checkmark" size={14} color={C.bg} />
        <Text style={styles.approveBtnText}>승인</Text>
      </TouchableOpacity>
    </View>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value || '—'}</Text>
    </View>
  );
}

const FLAG_META: Record<FlagType, { label: string; color: string; icon: React.ComponentProps<typeof Ionicons>['name'] }> = {
  duplicate:      { label: '중복',     color: '#ffb547', icon: 'copy-outline' },
  incorrect_info: { label: '정보 오류', color: '#ff7c47', icon: 'alert-circle-outline' },
  closed:         { label: '폐업',     color: C.danger,  icon: 'lock-closed-outline' },
};

function EmptyQueue({ label }: { label: string }) {
  return (
    <View style={styles.emptyQueue}>
      <Ionicons name="checkmark-circle" size={44} color={C.accentDim} />
      <Text style={styles.emptyQueueText}>{label}</Text>
    </View>
  );
}

// --- Props interfaces

interface HomeViewProps {
  pendingGymCount: number;
  pendingEditCount: number;
  openFlagCount: number;
  gymReportCount: number;
  managerRequestCount: number;
  registeredGymCount: number;
  gymRequestCount: number;
  onPush: (v: AdminView) => void;
}

interface PendingGymsViewProps {
  pendingGyms: PendingGym[];
  gymList: RegistrationGym[];
  onSelectGym: (gym: PendingGym) => void;
  onApproveGym: (id: string) => void;
  onRejectGym:  (id: string) => void;
}

interface GymDetailViewProps {
  selectedGym: PendingGym;
  onReview: (gymId: string, action: ReviewStatus) => void;
  onBack: () => void;
}

interface PendingEditsViewProps {
  pendingEdits: PendingEdit[];
  editList: RegEditRequest[];
  onReviewEdit:  (edit: PendingEdit, action: ReviewStatus) => void;
  onApproveEdit: (id: string) => void;
  onRejectEdit:  (id: string) => void;
}

interface FlaggedViewProps {
  flaggedItems: FlaggedItem[];
  onResolveFlag: (item: FlaggedItem, resolution: 'resolved' | 'delete' | 'merge') => void;
}

interface MachineCatalogViewProps {
  catQuery: string;
  setCatQuery: (v: string) => void;
  catMuscle: string;
  setCatMuscle: (v: string) => void;
  catBrand: string;
  setCatBrand: (v: string) => void;
  catSelected: Set<string>;
  catApproved: Set<string>;
  onToggleSelect: (id: string) => void;
  onApproveSelected: () => void;
}

// --- Module-level view components

function GymRequestsView({
  requests,
  onUpdateStatus,
  onBack,
}: {
  requests:       GymRegistrationRequest[];
  onUpdateStatus: (id: string, status: 'reviewed' | 'resolved') => void;
  onBack:         () => void;
}) {
  // 유저 요청만 표시
  const userRequests = requests.filter(r => (r.requesterRole ?? 'user') === 'user');
  const pending  = userRequests.filter(r => r.status === 'pending');
  const reviewed = userRequests.filter(r => r.status !== 'pending');

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
      <TouchableOpacity onPress={onBack} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <Ionicons name="chevron-back" size={20} color={C.text} />
        <Text style={{ fontSize: 16, fontWeight: '800', color: C.text }}>헬스장 신규 등록 제안(유저)</Text>
      </TouchableOpacity>

      <Text style={{ fontSize: 12, fontWeight: '700', color: C.textDim, letterSpacing: 1 }}>검토 대기 ({pending.length})</Text>
      {pending.length === 0 && (
        <Text style={{ fontSize: 13, color: C.textDim, paddingVertical: 12 }}>검토 대기 중인 요청이 없어요.</Text>
      )}
      {pending.map(req => (
        <View key={req.id} style={{ backgroundColor: C.surface, borderRadius: R.card, padding: 16, gap: 8 }}>
          <Text style={{ fontSize: 15, fontWeight: '800', color: C.text }}>{req.gymName}</Text>
          <Text style={{ fontSize: 13, color: C.textSub }}>{req.location}</Text>
          {req.notes ? <Text style={{ fontSize: 12, color: C.textDim }}>{req.notes}</Text> : null}
          <Text style={{ fontSize: 11, color: C.textDim }}>{new Date(req.createdAt).toLocaleDateString('ko-KR')}</Text>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
            <TouchableOpacity
              style={{ flex: 1, padding: 10, borderRadius: R.btn, backgroundColor: C.accent, alignItems: 'center' }}
              onPress={() => onUpdateStatus(req.id, 'reviewed')}
            >
              <Text style={{ color: C.bg, fontWeight: '700', fontSize: 13 }}>검토 완료</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={{ flex: 1, padding: 10, borderRadius: R.btn, backgroundColor: C.surface, alignItems: 'center', borderWidth: 1, borderColor: C.border }}
              onPress={() => onUpdateStatus(req.id, 'resolved')}
            >
              <Text style={{ color: C.text, fontWeight: '700', fontSize: 13 }}>처리 완료</Text>
            </TouchableOpacity>
          </View>
        </View>
      ))}

      {reviewed.length > 0 && (
        <>
          <Text style={{ fontSize: 12, fontWeight: '700', color: C.textDim, letterSpacing: 1, marginTop: 8 }}>처리된 요청 ({reviewed.length})</Text>
          {reviewed.map(req => (
            <View key={req.id} style={{ backgroundColor: C.surface, borderRadius: R.card, padding: 16, gap: 4, opacity: 0.6 }}>
              <Text style={{ fontSize: 14, fontWeight: '700', color: C.text }}>{req.gymName}</Text>
              <Text style={{ fontSize: 12, color: C.textSub }}>{req.location}</Text>
              <Text style={{ fontSize: 11, color: C.accent, fontWeight: '600' }}>{req.status === 'reviewed' ? '검토 완료' : '처리 완료'}</Text>
            </View>
          ))}
        </>
      )}
    </ScrollView>
  );
}

function HomeView({ pendingGymCount, pendingEditCount, openFlagCount, gymReportCount, managerRequestCount, registeredGymCount, gymRequestCount, onPush }: HomeViewProps) {
  return (
    <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
      {/* Stats */}
      <Text style={styles.sectionTitle}>관리자 개요</Text>
      <View style={styles.statsRow}>
        {[
          { label: '전체 헬스장', value: '8',  icon: 'business' as const, color: C.accent },
          { label: '오늘 승인',   value: '2',  icon: 'checkmark-circle' as const, color: '#3dd68c' },
          { label: '전체 머신',   value: '23', icon: 'barbell' as const, color: '#5ba4ff' },
        ].map(s => (
          <View key={s.label} style={styles.statCard}>
            <Ionicons name={s.icon} size={20} color={s.color} />
            <Text style={[styles.statValue, { color: s.color }]}>{s.value}</Text>
            <Text style={styles.statLabel}>{s.label}</Text>
          </View>
        ))}
      </View>

      {/* Queues */}
      <Text style={[styles.sectionTitle, { marginTop: 8 }]}>검토 대기</Text>
      {[
        {
          icon: 'business-outline' as const,
          title: '헬스장 등록 심사 대기(매니저)',
          count: pendingGymCount,
          sub: `${pendingGymCount}개 검토 대기`,
          onPress: () => onPush('pending-gyms'),
          color: '#ffb547',
        },
        {
          icon: 'create-outline' as const,
          title: '정보 수정 요청 대기',
          count: pendingEditCount,
          sub: `${pendingEditCount}개 검토 대기`,
          onPress: () => onPush('pending-edits'),
          color: '#5ba4ff',
        },
        {
          icon: 'flag-outline' as const,
          title: '신고 접수',
          count: openFlagCount,
          sub: `${openFlagCount}개 신고 접수`,
          onPress: () => onPush('flagged'),
          color: C.danger,
        },
        {
          icon: 'barbell-outline' as const,
          title: '머신 카탈로그',
          count: 0,
          sub: `${MACHINES.length}개 머신 등록됨`,
          onPress: () => onPush('machine-catalog'),
          color: '#a78bfa',
        },
        {
          icon: 'shield-outline' as const,
          title: '브랜드 저작권',
          count: 0,
          sub: '브랜드별 이미지 사용 승인 관리',
          onPress: () => onPush('brand-copyright'),
          color: '#34d399',
        },
        {
          icon: 'flag-outline' as const,
          title: '정보 제보 관리',
          count: gymReportCount,
          sub: gymReportCount > 0 ? `${gymReportCount}개 처리 대기` : '접수된 제보 없음',
          onPress: () => onPush('gym-reports'),
          color: '#ff7eb3',
        },
        {
          icon: 'person-add-outline' as const,
          title: '매니저 신청 관리',
          count: managerRequestCount,
          sub: managerRequestCount > 0 ? `${managerRequestCount}개 심사 대기` : '신청 없음',
          onPress: () => onPush('manager-requests'),
          color: '#a78bfa',
        },
        {
          icon: 'add-circle-outline' as const,
          title: '헬스장 직접 등록',
          count: 0,
          sub: registeredGymCount > 0 ? `${registeredGymCount}개 등록됨` : '새 헬스장 등록',
          onPress: () => onPush('register-gym'),
          color: '#38bdf8',
        },
        {
          icon: 'business-outline' as const,
          title: '헬스장 신규 등록 제안(유저)',
          count: gymRequestCount,
          sub: gymRequestCount > 0 ? `${gymRequestCount}개 검토 대기` : '접수된 요청 없음',
          onPress: () => onPush('gym-registration-requests'),
          color: '#fb923c',
        },
      ].map(q => (
        <TouchableOpacity key={q.title} style={styles.queueCard} onPress={q.onPress} activeOpacity={0.85}>
          <View style={[styles.queueIcon, { backgroundColor: q.color + '18' }]}>
            <Ionicons name={q.icon} size={20} color={q.color} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.queueTitle}>{q.title}</Text>
            <Text style={styles.queueSub}>{q.sub}</Text>
          </View>
          {q.count > 0 && (
            <View style={[styles.queueBadge, { backgroundColor: q.color }]}>
              <Text style={styles.queueBadgeText}>{q.count}</Text>
            </View>
          )}
          <Ionicons name="chevron-forward" size={16} color={C.textDim} style={{ marginLeft: 4 }} />
        </TouchableOpacity>
      ))}

      {/* Recent activity */}
      <Text style={[styles.sectionTitle, { marginTop: 24 }]}>최근 활동</Text>
      <View style={styles.activityCard}>
        {[
          { icon: 'checkmark-circle' as const, color: '#3dd68c', text: 'IronHub Fitness approved',  time: '2h ago' },
          { icon: 'checkmark-circle' as const, color: '#3dd68c', text: 'PulseZone Gym approved',    time: '5h ago' },
          { icon: 'close-circle'     as const, color: C.danger,  text: 'Duplicate gym rejected',   time: 'Yesterday' },
          { icon: 'flag'             as const, color: '#ffb547', text: 'UrbanSweat Gym flagged',    time: '2 days ago' },
        ].map((a, i) => (
          <React.Fragment key={i}>
            <View style={styles.activityRow}>
              <Ionicons name={a.icon} size={16} color={a.color} />
              <Text style={styles.activityText}>{a.text}</Text>
              <Text style={styles.activityTime}>{a.time}</Text>
            </View>
            {i < 3 && <View style={styles.divider} />}
          </React.Fragment>
        ))}
      </View>
    </ScrollView>
  );
}

function PendingGymsView({ pendingGyms, gymList, onSelectGym, onApproveGym, onRejectGym }: PendingGymsViewProps) {
  const legacyPending  = pendingGyms.filter(g => g.status === 'pending');
  const legacyReviewed = pendingGyms.filter(g => g.status !== 'pending');
  const regPending     = gymList.filter(g => g.status === 'pending').length;
  return (
    <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

      {/* ── 신규 등록 신청 (gymRegistrationStore) ── */}
      <Text style={styles.sectionTitle}>신규 등록 신청</Text>
      <Text style={styles.sectionSub}>{regPending}개 검토 대기</Text>

      {gymList.length === 0 && <EmptyQueue label="신규 등록 신청이 없어요" />}

      {gymList.map(gym => {
        const isPending  = gym.status === 'pending';
        const isApproved = gym.status === 'approved';
        const badgeColor = isApproved ? C.accent : C.danger;
        const badgeBg    = isApproved ? C.accentBg : C.dangerBg;
        const badgeLabel = isApproved ? '승인됨' : '거절됨';
        return (
          <View key={gym.id} style={[styles.pendingCard, !isPending && { opacity: 0.65 }]}>
            <View style={styles.pendingCardTop}>
              <View style={{ flex: 1 }}>
                <Text style={styles.pendingName}>{gym.name}</Text>
                <View style={styles.locRow}>
                  <Ionicons name="location-outline" size={11} color={C.textSub} />
                  <Text style={styles.locText}>{gym.location}</Text>
                </View>
              </View>
              {!isPending && (
                <View style={[styles.reviewedBadge, { backgroundColor: badgeBg }]}>
                  <Text style={[styles.reviewedBadgeText, { color: badgeColor }]}>{badgeLabel}</Text>
                </View>
              )}
            </View>
            <View style={styles.submittedRow}>
              <Ionicons name="person-outline" size={11} color={C.textSub} />
              <Text style={styles.submittedText}>신청자: {gym.managerName} · {gym.submittedAt.slice(0, 10)}</Text>
            </View>
            {isPending && (
              <ReviewButtons
                onApprove={() => onApproveGym(gym.id)}
                onReject={() => onRejectGym(gym.id)}
              />
            )}
          </View>
        );
      })}

      {/* ── 기존 대기 목록 (mockAdmin) ── */}
      {(legacyPending.length > 0 || legacyReviewed.length > 0) && (
        <>
          <Text style={[styles.sectionTitle, { marginTop: 24 }]}>등록 대기 (기존)</Text>
          <Text style={styles.sectionSub}>{legacyPending.length}개 검토 대기</Text>

          {legacyPending.length === 0 && <EmptyQueue label="모든 등록이 검토되었어요" />}

          {legacyPending.map(gym => (
            <TouchableOpacity
              key={gym.id}
              style={styles.pendingCard}
              onPress={() => onSelectGym(gym)}
              activeOpacity={0.85}
            >
              <View style={styles.pendingCardTop}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.pendingName}>{gym.name}</Text>
                  <View style={styles.locRow}>
                    <Ionicons name="location-outline" size={11} color={C.textSub} />
                    <Text style={styles.locText}>{gym.location}</Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={16} color={C.textDim} />
              </View>
              <Text style={styles.pendingDesc} numberOfLines={2}>{gym.description}</Text>
              <View style={styles.submittedRow}>
                <Ionicons name="person-outline" size={11} color={C.textSub} />
                <Text style={styles.submittedText}>신청자: {gym.managerName} · {gym.submittedAt}</Text>
              </View>
            </TouchableOpacity>
          ))}

          {legacyReviewed.length > 0 && (
            <>
              <Text style={[styles.sectionTitle, { marginTop: 20, fontSize: 12, color: C.textDim }]}>처리 완료</Text>
              {legacyReviewed.map(gym => {
                const isApproved = gym.status === 'approved';
                const badgeColor = isApproved ? C.accent : C.danger;
                const badgeBg    = isApproved ? C.accentBg : C.dangerBg;
                const badgeLabel = isApproved ? '승인됨' : '거절됨';
                return (
                  <View key={gym.id} style={[styles.pendingCard, { opacity: 0.65 }]}>
                    <View style={styles.pendingCardTop}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.pendingName}>{gym.name}</Text>
                        <View style={styles.locRow}>
                          <Ionicons name="location-outline" size={11} color={C.textSub} />
                          <Text style={styles.locText}>{gym.location}</Text>
                        </View>
                      </View>
                      <View style={[styles.reviewedBadge, { backgroundColor: badgeBg }]}>
                        <Text style={[styles.reviewedBadgeText, { color: badgeColor }]}>{badgeLabel}</Text>
                      </View>
                    </View>
                    <View style={styles.submittedRow}>
                      <Ionicons name="person-outline" size={11} color={C.textSub} />
                      <Text style={styles.submittedText}>신청자: {gym.managerName} · {gym.submittedAt}</Text>
                    </View>
                  </View>
                );
              })}
            </>
          )}
        </>
      )}
    </ScrollView>
  );
}

function GymDetailView({ selectedGym, onReview, onBack }: GymDetailViewProps) {
  return (
    <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
      <Text style={styles.sectionTitle}>{selectedGym.name}</Text>
      <Text style={styles.sectionSub}>신청자: {selectedGym.managerName} · {selectedGym.submittedAt}</Text>

      <View style={styles.detailCard}>
        <DetailRow label="위치"   value={selectedGym.location} />
        <View style={styles.detailDivider} />
        <DetailRow label="전화번호" value={selectedGym.phone} />
        <View style={styles.detailDivider} />
        <DetailRow label="웹사이트" value={selectedGym.website} />
        <View style={styles.detailDivider} />
        <DetailRow label="운영시간" value={selectedGym.hours} />
        <View style={styles.detailDivider} />
        <DetailRow label="소개"    value={selectedGym.description} />
      </View>

      <View style={styles.detailNote}>
        <Ionicons name="person-circle-outline" size={14} color={C.textSub} />
        <Text style={styles.detailNoteText}>
          Manager ID: {selectedGym.managerId}  ·  {selectedGym.managerName}
        </Text>
      </View>

      {selectedGym.status === 'pending' ? (
        <ReviewButtons
          onApprove={() => onReview(selectedGym.id, 'approved')}
          onReject={() => onReview(selectedGym.id, 'rejected')}
        />
      ) : (
        <View>
          <View style={[
            styles.statusResultBadge,
            { backgroundColor: selectedGym.status === 'approved' ? '#1a3a1a' : '#3a1a1a' },
          ]}>
            <Text style={[
              styles.statusResultBadgeText,
              { color: selectedGym.status === 'approved' ? '#4caf50' : '#f44336' },
            ]}>
              {selectedGym.status === 'approved' ? '✓ 승인됨' : '✗ 거절됨'}
            </Text>
          </View>
          <TouchableOpacity style={styles.backToListBtn} onPress={onBack} activeOpacity={0.8}>
            <Text style={styles.backToListBtnText}>목록으로 돌아가기</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
}

function PendingEditsView({ pendingEdits, editList, onReviewEdit, onApproveEdit, onRejectEdit }: PendingEditsViewProps) {
  const pending  = pendingEdits.filter(e => e.status === 'pending');
  const reviewed = pendingEdits.filter(e => e.status !== 'pending');
  const regPending = editList.filter(e => e.status === 'pending').length;
  return (
    <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

      {/* ── 정보 수정 요청 (gymRegistrationStore) ── */}
      <Text style={styles.sectionTitle}>정보 수정 요청</Text>
      <Text style={styles.sectionSub}>{regPending}개 검토 대기</Text>

      {editList.length === 0 && <EmptyQueue label="수정 요청이 없어요" />}

      {editList.map(req => {
        const isPending  = req.status === 'pending';
        const isApproved = req.status === 'approved';
        return (
          <View key={req.id} style={[styles.editCard, !isPending && { opacity: 0.65 }]}>
            <View style={styles.editCardTop}>
              <Text style={styles.editGymName}>{req.gymName}</Text>
              <View style={styles.editFieldBadge}>
                <Text style={styles.editFieldBadgeText}>{req.field}</Text>
              </View>
              {!isPending && (
                <View style={[styles.reviewedBadge, { backgroundColor: isApproved ? C.accentBg : C.dangerBg }]}>
                  <Text style={[styles.reviewedBadgeText, { color: isApproved ? C.accent : C.danger }]}>
                    {isApproved ? '승인됨' : '거절됨'}
                  </Text>
                </View>
              )}
            </View>

            <View style={styles.diffBlock}>
              <View style={styles.diffRow}>
                <View style={styles.diffOldDot} />
                <Text style={styles.diffOldText} numberOfLines={2}>{req.oldValue}</Text>
              </View>
              <View style={styles.diffArrow}>
                <Ionicons name="arrow-down" size={12} color={C.textDim} />
              </View>
              <View style={styles.diffRow}>
                <View style={styles.diffNewDot} />
                <Text style={styles.diffNewText} numberOfLines={2}>{req.newValue}</Text>
              </View>
            </View>

            <View style={styles.submittedRow}>
              <Ionicons name="time-outline" size={11} color={C.textSub} />
              <Text style={styles.submittedText}>{req.submittedAt.slice(0, 10)}</Text>
            </View>

            {isPending && (
              <ReviewButtons
                onApprove={() => onApproveEdit(req.id)}
                onReject={() => onRejectEdit(req.id)}
              />
            )}
          </View>
        );
      })}

      {/* ── 수정 요청 (mockAdmin) ── */}
      {(pending.length > 0 || reviewed.length > 0) && (
        <>
          <Text style={[styles.sectionTitle, { marginTop: 24 }]}>수정 요청 (기존)</Text>
          <Text style={styles.sectionSub}>{pending.length}개 수정 요청 대기</Text>

          {pending.length === 0 && <EmptyQueue label="모든 수정 요청이 검토되었어요" />}

          {[...pending, ...reviewed].map(edit => {
            const isPending  = edit.status === 'pending';
            const isApproved = edit.status === 'approved';
            return (
              <View key={edit.id} style={[styles.editCard, !isPending && { opacity: 0.65 }]}>
                <View style={styles.editCardTop}>
                  <Text style={styles.editGymName}>{edit.gymName}</Text>
                  <View style={styles.editFieldBadge}>
                    <Text style={styles.editFieldBadgeText}>{edit.field}</Text>
                  </View>
                  {!isPending && (
                    <View style={[styles.reviewedBadge, { backgroundColor: isApproved ? C.accentBg : C.dangerBg }]}>
                      <Text style={[styles.reviewedBadgeText, { color: isApproved ? C.accent : C.danger }]}>
                        {isApproved ? '승인됨' : '거절됨'}
                      </Text>
                    </View>
                  )}
                </View>

                <View style={styles.diffBlock}>
                  <View style={styles.diffRow}>
                    <View style={styles.diffOldDot} />
                    <Text style={styles.diffOldText} numberOfLines={2}>{edit.oldValue}</Text>
                  </View>
                  <View style={styles.diffArrow}>
                    <Ionicons name="arrow-down" size={12} color={C.textDim} />
                  </View>
                  <View style={styles.diffRow}>
                    <View style={styles.diffNewDot} />
                    <Text style={styles.diffNewText} numberOfLines={2}>{edit.newValue}</Text>
                  </View>
                </View>

                <View style={styles.submittedRow}>
                  <Ionicons name="person-outline" size={11} color={C.textSub} />
                  <Text style={styles.submittedText}>{edit.managerName} · {edit.submittedAt}</Text>
                </View>

                {isPending && (
                  <ReviewButtons
                    onApprove={() => onReviewEdit(edit, 'approved')}
                    onReject={() => onReviewEdit(edit, 'rejected')}
                  />
                )}
              </View>
            );
          })}
        </>
      )}
    </ScrollView>
  );
}

function FlaggedView({ flaggedItems, onResolveFlag }: FlaggedViewProps) {
  const items = flaggedItems.filter(f => f.status === 'open');
  return (
    <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
      <Text style={styles.sectionTitle}>신고 접수</Text>
      <Text style={styles.sectionSub}>{items.length}개 신고 접수</Text>

      {items.length === 0 && <EmptyQueue label="신고된 항목이 없어요" />}

      {items.map(item => {
        const meta = FLAG_META[item.type];
        return (
          <View key={item.id} style={styles.flagCard}>
            <View style={styles.flagCardTop}>
              <View style={[styles.flagTypeIcon, { backgroundColor: meta.color + '18' }]}>
                <Ionicons name={meta.icon} size={16} color={meta.color} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.flagGymName}>{item.gymName}</Text>
                <View style={[styles.flagTypeBadge, { backgroundColor: meta.color + '18' }]}>
                  <Text style={[styles.flagTypeBadgeText, { color: meta.color }]}>{meta.label}</Text>
                </View>
              </View>
            </View>

            <Text style={styles.flagDesc}>{item.description}</Text>

            <View style={styles.submittedRow}>
              <Ionicons name="flag-outline" size={11} color={C.textSub} />
              <Text style={styles.submittedText}>신청자: {item.reportedBy} · {item.reportedAt}</Text>
            </View>

            {/* Context-aware actions */}
            <View style={styles.flagActions}>
              {item.type === 'duplicate' && (
                <TouchableOpacity style={styles.flagActionBtn} onPress={() => onResolveFlag(item, 'merge')} activeOpacity={0.8}>
                  <Ionicons name="git-merge-outline" size={13} color='#ffb547' />
                  <Text style={[styles.flagActionText, { color: '#ffb547' }]}>병합</Text>
                </TouchableOpacity>
              )}
              {item.type === 'closed' && (
                <TouchableOpacity style={styles.flagActionBtn} onPress={() => onResolveFlag(item, 'delete')} activeOpacity={0.8}>
                  <Ionicons name="trash-outline" size={13} color={C.danger} />
                  <Text style={[styles.flagActionText, { color: C.danger }]}>삭제</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={[styles.flagActionBtn, styles.flagResolveBtn]} onPress={() => onResolveFlag(item, 'resolved')} activeOpacity={0.8}>
                <Ionicons name="checkmark" size={13} color={C.bg} />
                <Text style={[styles.flagActionText, { color: C.bg }]}>처리 완료</Text>
              </TouchableOpacity>
            </View>
          </View>
        );
      })}
    </ScrollView>
  );
}

function MachineCatalogView({
  catQuery, setCatQuery, catMuscle, setCatMuscle, catBrand, setCatBrand,
  catSelected, catApproved, onToggleSelect, onApproveSelected,
}: MachineCatalogViewProps) {
  const MC: Record<string, { fg: string; bg: string }> = {
    Chest:       { fg: '#ff6b6b', bg: '#ff6b6b18' },
    Back:        { fg: '#5ba4ff', bg: '#5ba4ff18' },
    Legs:        { fg: '#3dd68c', bg: '#3dd68c18' },
    Shoulders:   { fg: '#ffb547', bg: '#ffb54718' },
    Arms:        { fg: '#ff7eb3', bg: '#ff7eb318' },
    'Full Body': { fg: '#a78bfa', bg: '#a78bfa18' },
    Core:        { fg: '#ffd166', bg: '#ffd16618' },
    Cardio:      { fg: '#06d6a0', bg: '#06d6a018' },
  };
  const mc = (muscle: string) => MC[muscle] ?? { fg: C.textSub, bg: C.border };

  const q = catQuery.toLowerCase().trim();
  const filtered = MACHINES.filter(m => {
    if (catMuscle !== 'All' && m.targetMuscle !== catMuscle) return false;
    if (catBrand  !== 'All' && m.brand          !== catBrand)  return false;
    if (q && !m.name.toLowerCase().includes(q) && !m.brand.toLowerCase().includes(q)) return false;
    return true;
  });

  const selCount = catSelected.size;

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: selCount > 0 ? 110 : 48 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Search */}
        <View style={styles.catSearchRow}>
          <Ionicons name="search" size={15} color={C.textDim} style={{ marginLeft: 12 }} />
          <TextInput
            value={catQuery}
            onChangeText={setCatQuery}
            placeholder="머신 또는 브랜드 검색..."
            placeholderTextColor={C.textDim}
            style={styles.catSearchInput}
            returnKeyType="search"
            autoCorrect={false}
            autoCapitalize="none"
            spellCheck={false}
          />
          {catQuery.length > 0 && (
            <TouchableOpacity onPress={() => setCatQuery('')} style={{ marginRight: 10 }}>
              <Ionicons name="close-circle" size={16} color={C.textDim} />
            </TouchableOpacity>
          )}
        </View>

        {/* Muscle filter */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catChipRow} contentContainerStyle={{ gap: 8, paddingHorizontal: 20 }}>
          {CAT_MUSCLES.map(m => (
            <TouchableOpacity
              key={m}
              style={[styles.catChip, catMuscle === m && styles.catChipActive]}
              onPress={() => setCatMuscle(m)}
              activeOpacity={0.8}
            >
              <Text style={[styles.catChipText, catMuscle === m && styles.catChipTextActive]}>{m}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Brand filter */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={[styles.catChipRow, { marginBottom: 14 }]} contentContainerStyle={{ gap: 8, paddingHorizontal: 20 }}>
          {CAT_BRANDS.map(b => (
            <TouchableOpacity
              key={b}
              style={[styles.catChip, catBrand === b && { backgroundColor: '#5ba4ff22', borderColor: '#5ba4ff' }]}
              onPress={() => setCatBrand(b)}
              activeOpacity={0.8}
            >
              <Text style={[styles.catChipText, catBrand === b && { color: '#5ba4ff' }]}>{b}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Count bar */}
        <View style={styles.catCountBar}>
          <Text style={styles.catCount}>{filtered.length}개 머신</Text>
          {selCount > 0 && <Text style={styles.catSelCount}>{selCount}개 선택</Text>}
        </View>

        {/* 2-col grid */}
        <View style={styles.catGrid}>
          {filtered.map((machine: Machine) => {
            const col        = mc(machine.targetMuscle);
            const isApproved = catApproved.has(machine.id);
            const isSelected = catSelected.has(machine.id);
            return (
              <TouchableOpacity
                key={machine.id}
                style={[
                  styles.catCard,
                  isSelected && styles.catCardSelected,
                  isApproved && { opacity: 0.55 },
                ]}
                activeOpacity={isApproved ? 1 : 0.8}
                onPress={() => onToggleSelect(machine.id)}
              >
                {/* 3:4 image area */}
                <View style={[styles.catCardImg, { backgroundColor: col.bg }]}>
                  <Ionicons name="barbell" size={CAT_CARD_W * 0.55} color={col.fg} style={{ opacity: 0.10 }} />
                  <View style={[styles.catCardIconBadge, { backgroundColor: col.fg + '28' }]}>
                    <Ionicons name="barbell-outline" size={26} color={col.fg} />
                  </View>
                  {/* Muscle tag — top right */}
                  <View style={[styles.catMuscleTag, { backgroundColor: col.fg + 'cc' }]}>
                    <Text style={styles.catMuscleTagText}>{machine.targetMuscle}</Text>
                  </View>
                  {/* Added badge — top left */}
                  {isApproved && (
                    <View style={styles.catAddedBadge}>
                      <Ionicons name="checkmark-circle" size={11} color={C.accent} />
                      <Text style={styles.catAddedBadgeText}>Added</Text>
                    </View>
                  )}
                  {/* Selection check — top left (when not added) */}
                  {isSelected && !isApproved && (
                    <View style={styles.catCheckWrap}>
                      <View style={styles.catCheckCircle}>
                        <Ionicons name="checkmark" size={14} color={C.bg} />
                      </View>
                    </View>
                  )}
                </View>
                {/* Info */}
                <View style={styles.catCardBody}>
                  <Text style={styles.catCardName} numberOfLines={2}>{machine.name}</Text>
                  <Text style={styles.catCardBrand}>{machine.brand}</Text>
                  {machine.category ? (
                    <View style={styles.catCategoryTag}>
                      <Text style={styles.catCategoryTagText}>{machine.category}</Text>
                    </View>
                  ) : null}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {filtered.length === 0 && (
          <View style={styles.emptyQueue}>
            <Ionicons name="barbell-outline" size={44} color={C.accentDim} />
            <Text style={styles.emptyQueueText}>필터에 맞는 머신이 없어요</Text>
          </View>
        )}
      </ScrollView>

      {/* Fixed bottom CTA */}
      {selCount > 0 && (
        <View style={styles.catCta}>
          <TouchableOpacity style={styles.catCtaBtn} onPress={onApproveSelected} activeOpacity={0.88}>
            <Ionicons name="add-circle" size={18} color={C.bg} />
            <Text style={styles.catCtaBtnText}>
              {selCount}개 머신 추가
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

function BrandCopyrightView() {
  const allBrands = Array.from(new Set(MACHINES.map(m => m.brand))).sort();
  const [entries, setEntries] = useState(() => getBrandCopyrightList(allBrands));

  function toggle(brand: string, value: boolean) {
    setBrandCopyrightStatus(brand, value);
    setEntries(getBrandCopyrightList(allBrands));
  }

  const approvedCount = entries.filter(e => e.copyrightApproved).length;

  return (
    <View style={{ flex: 1 }}>
      {/* Summary bar */}
      <View style={styles.bcSummary}>
        <Ionicons name="shield-checkmark-outline" size={16} color="#34d399" />
        <Text style={styles.bcSummaryText}>
          {approvedCount}/{entries.length}개 브랜드 승인됨
        </Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.bcList}>
        {entries.map(entry => (
          <View key={entry.brand} style={styles.bcRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.bcBrand}>{entry.brand}</Text>
              <Text style={[styles.bcStatus, { color: entry.copyrightApproved ? '#34d399' : C.danger }]}>
                {entry.copyrightApproved ? '승인됨 — 이미지 표시' : '미승인 — 이미지 블러 처리'}
              </Text>
            </View>
            <Switch
              value={entry.copyrightApproved}
              onValueChange={v => toggle(entry.brand, v)}
              trackColor={{ false: C.border, true: '#34d39950' }}
              thumbColor={entry.copyrightApproved ? '#34d399' : C.textDim}
            />
          </View>
        ))}
        <View style={{ height: 32 }} />
      </ScrollView>
    </View>
  );
}

// --- GymReportsView

interface GymReportsViewProps {
  reports: GymInfoReport[];
  onMarkReviewed: (id: string) => void;
  onDelete: (id: string) => void;
}

function GymReportsView({ reports, onMarkReviewed, onDelete }: GymReportsViewProps) {
  const pending  = reports.filter(r => r.status === 'pending');
  const reviewed = reports.filter(r => r.status !== 'pending');

  const REPORT_TYPE_LABELS: Record<string, string> = {
    wrong_hours:   '운영시간 오류',
    wrong_address: '주소 오류',
    wrong_phone:   '전화번호 오류',
    closed:        '폐업',
    other:         '기타',
  };

  return (
    <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
      <Text style={styles.sectionTitle}>정보 제보 관리</Text>
      <Text style={styles.sectionSub}>{pending.length}개 처리 대기</Text>

      {pending.length === 0 && <EmptyQueue label="처리 대기 중인 제보가 없어요" />}

      {pending.map(r => (
        <View key={r.id} style={styles.flagCard}>
          <View style={styles.flagCardTop}>
            <View style={[styles.flagTypeIcon, { backgroundColor: '#ff7eb318' }]}>
              <Ionicons name="flag-outline" size={16} color="#ff7eb3" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.flagGymName}>{r.gymName}</Text>
              <View style={[styles.flagTypeBadge, { backgroundColor: '#ff7eb318' }]}>
                <Text style={[styles.flagTypeBadgeText, { color: '#ff7eb3' }]}>
                  {REPORT_TYPE_LABELS[r.reportType] ?? r.reportType}
                </Text>
              </View>
            </View>
          </View>
          <Text style={styles.flagDesc}>{r.content}</Text>
          <View style={styles.submittedRow}>
            <Ionicons name="time-outline" size={11} color={C.textSub} />
            <Text style={styles.submittedText}>{r.createdAt.slice(0, 10)}</Text>
          </View>
          <View style={styles.flagActions}>
            <TouchableOpacity style={styles.flagActionBtn} onPress={() => onDelete(r.id)} activeOpacity={0.8}>
              <Ionicons name="trash-outline" size={13} color={C.danger} />
              <Text style={[styles.flagActionText, { color: C.danger }]}>삭제</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.flagActionBtn, styles.flagResolveBtn]} onPress={() => onMarkReviewed(r.id)} activeOpacity={0.8}>
              <Ionicons name="checkmark" size={13} color={C.bg} />
              <Text style={[styles.flagActionText, { color: C.bg }]}>확인 완료</Text>
            </TouchableOpacity>
          </View>
        </View>
      ))}

      {reviewed.length > 0 && (
        <>
          <Text style={[styles.sectionTitle, { marginTop: 20, fontSize: 12, color: C.textDim }]}>처리 완료</Text>
          {reviewed.map(r => (
            <View key={r.id} style={[styles.flagCard, { opacity: 0.6 }]}>
              <View style={styles.flagCardTop}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.flagGymName}>{r.gymName}</Text>
                  <Text style={styles.flagDesc} numberOfLines={1}>{r.content}</Text>
                </View>
                <View style={[styles.reviewedBadge, { backgroundColor: C.accentBg }]}>
                  <Text style={[styles.reviewedBadgeText, { color: C.accent }]}>완료</Text>
                </View>
              </View>
            </View>
          ))}
        </>
      )}
    </ScrollView>
  );
}

// --- ManagerRequestsAdminView

interface ManagerRequestsAdminViewProps {
  applications: ManagerApplication[];
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
}

function ManagerRequestsAdminView({ applications, onApprove, onReject }: ManagerRequestsAdminViewProps) {
  const pending  = applications.filter(a => a.status === 'pending');
  const reviewed = applications.filter(a => a.status !== 'pending');

  return (
    <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
      <Text style={styles.sectionTitle}>매니저 신청 관리</Text>
      <Text style={styles.sectionSub}>{pending.length}개 심사 대기</Text>

      {pending.length === 0 && <EmptyQueue label="대기 중인 매니저 신청이 없어요" />}

      {pending.map(a => (
        <View key={a.id} style={styles.pendingCard}>
          <View style={styles.pendingCardTop}>
            <View style={{ flex: 1 }}>
              <Text style={styles.pendingName}>{a.gymName}</Text>
              <View style={styles.locRow}>
                <Ionicons name="location-outline" size={11} color={C.textSub} />
                <Text style={styles.locText}>{a.location}</Text>
              </View>
            </View>
          </View>
          <View style={styles.submittedRow}>
            <Ionicons name="person-outline" size={11} color={C.textSub} />
            <Text style={styles.submittedText}>신청자: {a.applicantName} · {a.createdAt.slice(0, 10)}</Text>
          </View>
          {a.phone.length > 0 && (
            <View style={styles.submittedRow}>
              <Ionicons name="call-outline" size={11} color={C.textSub} />
              <Text style={styles.submittedText}>{a.phone}</Text>
            </View>
          )}
          {a.message.length > 0 && (
            <Text style={[styles.pendingDesc, { marginTop: 6 }]} numberOfLines={3}>{a.message}</Text>
          )}
          <ReviewButtons
            onApprove={() => onApprove(a.id)}
            onReject={() => onReject(a.id)}
          />
        </View>
      ))}

      {reviewed.length > 0 && (
        <>
          <Text style={[styles.sectionTitle, { marginTop: 20, fontSize: 12, color: C.textDim }]}>처리 완료</Text>
          {reviewed.map(a => {
            const isApproved = a.status === 'approved';
            return (
              <View key={a.id} style={[styles.pendingCard, { opacity: 0.65 }]}>
                <View style={styles.pendingCardTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.pendingName}>{a.gymName}</Text>
                    <Text style={styles.locText}>{a.applicantName}</Text>
                  </View>
                  <View style={[styles.reviewedBadge, { backgroundColor: isApproved ? C.accentBg : C.dangerBg }]}>
                    <Text style={[styles.reviewedBadgeText, { color: isApproved ? C.accent : C.danger }]}>
                      {isApproved ? '승인됨' : '거절됨'}
                    </Text>
                  </View>
                </View>
              </View>
            );
          })}
        </>
      )}
    </ScrollView>
  );
}

// --- RegisterGymAdminView

const ADMIN_GYM_MUSCLES = ['All', ...Array.from(new Set(MACHINES.map(m => m.targetMuscle))).sort()];
const ADMIN_GYM_BRANDS  = ['All', ...Array.from(new Set(MACHINES.map(m => m.brand))).sort()];
const ADMIN_FORM_PAD = 16;
const ADMIN_CARD_W   = Math.floor((Dimensions.get('window').width - ADMIN_FORM_PAD * 2 - 8) / 2);

const AdminMachineItem = React.memo(({ machine, isSelected, onToggle, cardWidth }: {
  machine: Machine;
  isSelected: boolean;
  onToggle: (id: string) => void;
  cardWidth: number;
}) => (
  <View style={{ width: cardWidth, position: 'relative' }}>
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={() => onToggle(machine.id)}
    >
      <MachineCard machine={machine} variant="grid" width={cardWidth} />
    </TouchableOpacity>
    {isSelected && (
      <View style={styles.catCheckWrap}>
        <View style={styles.catCheckCircle}>
          <Ionicons name="checkmark" size={14} color={C.bg} />
        </View>
      </View>
    )}
  </View>
));

interface RegisterGymAdminViewProps {
  registeredGyms: AdminRegisteredGym[];
  onSave: (name: string, location: string, phone: string, hours: string, machineIds: string[]) => void;
  onUpdate: (id: string, name: string, location: string, phone: string, hours: string, machineIds: string[]) => void;
}

function RegisterGymAdminView({ registeredGyms, onSave, onUpdate }: RegisterGymAdminViewProps) {
  const [showForm,         setShowForm]         = useState(false);
  const [editingGym,       setEditingGym]       = useState<AdminRegisteredGym | null>(null);
  const [gymName,          setGymName]          = useState('');
  const [gymLocation,      setGymLocation]      = useState('');
  const [gymPhone,         setGymPhone]         = useState('');
  const [gymHours,         setGymHours]         = useState('');
  const [selectedIds,      setSelectedIds]      = useState<Set<string>>(new Set());
  const [muscleFilter,     setMuscleFilter]     = useState('All');
  const [brandFilter,      setBrandFilter]      = useState('All');
  const [showSelectedOnly, setShowSelectedOnly] = useState(false);

  const filteredMachines = MACHINES.filter(m => {
    if (!m || !m.name || !m.brand || !m.targetMuscle) return false;
    const muscleOk   = muscleFilter === 'All' || m.targetMuscle === muscleFilter;
    const brandOk    = brandFilter  === 'All' || m.brand        === brandFilter;
    const selectedOk = !showSelectedOnly || selectedIds.has(m.id);
    return muscleOk && brandOk && selectedOk;
  });

  const selectedMuscleCount = new Set(MACHINES.filter(m => selectedIds.has(m.id)).map(m => m.targetMuscle)).size;
  const selectedBrandCount  = new Set(MACHINES.filter(m => selectedIds.has(m.id)).map(m => m.brand)).size;

  function resetForm() {
    setEditingGym(null);
    setGymName(''); setGymLocation(''); setGymPhone(''); setGymHours('');
    setSelectedIds(new Set()); setMuscleFilter('All'); setBrandFilter('All'); setShowSelectedOnly(false);
  }

  function openEdit(gym: AdminRegisteredGym) {
    setEditingGym(gym);
    setGymName(gym.name);
    setGymLocation(gym.location);
    setGymPhone(gym.phone);
    setGymHours(gym.hours);
    setSelectedIds(new Set(gym.machineIds));
    setMuscleFilter('All');
    setBrandFilter('All');
    setShowSelectedOnly(false);
    setShowForm(true);
  }

  function handleSave() {
    if (!gymName.trim() || !gymLocation.trim()) {
      Alert.alert('입력 오류', '헬스장 이름과 위치는 필수입니다.');
      return;
    }
    if (editingGym) {
      onUpdate(editingGym.id, gymName.trim(), gymLocation.trim(), gymPhone.trim(), gymHours.trim(), Array.from(selectedIds));
      setShowForm(false);
      resetForm();
      Alert.alert('수정 완료', '수정이 완료되었습니다.');
    } else {
      onSave(gymName.trim(), gymLocation.trim(), gymPhone.trim(), gymHours.trim(), Array.from(selectedIds));
      setShowForm(false);
      resetForm();
      Alert.alert('등록 완료', '헬스장이 등록되었습니다.');
    }
  }

  const toggleMachineId = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  if (showForm) {
    const formHeader = (
      <View style={{ paddingHorizontal: ADMIN_FORM_PAD }}>
        {/* ── 헬스장 정보 입력 ── */}
        <Text style={styles.sectionTitle}>{editingGym ? '헬스장 수정' : '헬스장 정보'}</Text>
        <View style={styles.detailCard}>
          <Text style={[styles.detailLabel, { marginBottom: 6 }]}>헬스장 이름 *</Text>
          <TextInput style={styles.adminInput} value={gymName} onChangeText={v => setGymName(v)} placeholder="예: PowerFit 강남점" placeholderTextColor={C.textDim} autoCorrect={false} autoCapitalize="none" spellCheck={false} />
          <View style={styles.detailDivider} />
          <Text style={[styles.detailLabel, { marginBottom: 6, marginTop: 12 }]}>위치 *</Text>
          <TextInput style={styles.adminInput} value={gymLocation} onChangeText={v => setGymLocation(v)} placeholder="예: 서울 강남구 테헤란로" placeholderTextColor={C.textDim} autoCorrect={false} autoCapitalize="none" spellCheck={false} />
          <View style={styles.detailDivider} />
          <Text style={[styles.detailLabel, { marginBottom: 6, marginTop: 12 }]}>전화번호</Text>
          <TextInput style={styles.adminInput} value={gymPhone} onChangeText={v => setGymPhone(v)} placeholder="예: 02-1234-5678" placeholderTextColor={C.textDim} keyboardType="phone-pad" spellCheck={false} />
          <View style={styles.detailDivider} />
          <Text style={[styles.detailLabel, { marginBottom: 6, marginTop: 12 }]}>운영시간</Text>
          <TextInput style={styles.adminInput} value={gymHours} onChangeText={v => setGymHours(v)} placeholder="예: 월~금 06:00~22:00, 주말 08:00~20:00" placeholderTextColor={C.textDim} autoCorrect={false} autoCapitalize="none" spellCheck={false} />
        </View>

        {/* ── 보유 머신 선택 ── */}
        <Text style={[styles.sectionTitle, { marginTop: 24 }]}>보유 머신 선택</Text>

        <View style={styles.regGymStatsRow}>
          {[
            { value: String(selectedIds.size),    label: '선택 머신' },
            { value: String(selectedMuscleCount), label: '운동 부위' },
            { value: String(selectedBrandCount),  label: '브랜드' },
          ].map(s => (
            <View key={s.label} style={styles.regGymStatCell}>
              <Text style={styles.regGymStatValue}>{s.value}</Text>
              <Text style={styles.regGymStatLabel}>{s.label}</Text>
            </View>
          ))}
        </View>

        <View style={styles.regGymToggleRow}>
          <TouchableOpacity style={[styles.regGymToggleChip, !showSelectedOnly && styles.regGymToggleChipActive]} onPress={() => setShowSelectedOnly(false)} activeOpacity={0.8}>
            <Text style={[styles.regGymToggleChipText, !showSelectedOnly && styles.regGymToggleChipTextActive]}>전체</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.regGymToggleChip, showSelectedOnly && styles.regGymToggleChipActive]} onPress={() => setShowSelectedOnly(true)} activeOpacity={0.8}>
            <Ionicons name="checkmark-circle" size={13} color={showSelectedOnly ? C.bg : C.textSub} />
            <Text style={[styles.regGymToggleChipText, showSelectedOnly && styles.regGymToggleChipTextActive]}>선택됨</Text>
          </TouchableOpacity>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catChipRow} contentContainerStyle={{ gap: 8, paddingHorizontal: 0 }}>
          {ADMIN_GYM_MUSCLES.map(m => (
            <TouchableOpacity key={m} style={[styles.catChip, muscleFilter === m && styles.catChipActive]} onPress={() => setMuscleFilter(m)} activeOpacity={0.8}>
              <Text style={[styles.catChipText, muscleFilter === m && styles.catChipTextActive]}>{m}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={[styles.catChipRow, { marginBottom: 12 }]} contentContainerStyle={{ gap: 8, paddingHorizontal: 0 }}>
          {ADMIN_GYM_BRANDS.map(b => (
            <TouchableOpacity key={b} style={[styles.catChip, brandFilter === b && styles.catChipActive]} onPress={() => setBrandFilter(b)} activeOpacity={0.8}>
              <Text style={[styles.catChipText, brandFilter === b && styles.catChipTextActive]}>{b}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View style={styles.catCountBar}>
          <Text style={styles.catCount}>{filteredMachines.length}개 머신</Text>
          {selectedIds.size > 0 && <Text style={styles.catSelCount}>{selectedIds.size}개 선택</Text>}
        </View>
      </View>
    );

    const formFooter = (
      <View style={{ paddingHorizontal: ADMIN_FORM_PAD, paddingTop: 16, paddingBottom: 40 }}>
        {filteredMachines.length === 0 && (
          <View style={styles.emptyQueue}>
            <Ionicons name="barbell-outline" size={44} color={C.accentDim} />
            <Text style={styles.emptyQueueText}>필터에 맞는 머신이 없어요</Text>
          </View>
        )}
        <TouchableOpacity
          style={[styles.rejectBtn, { justifyContent: 'center', paddingVertical: 14 }]}
          onPress={() => { setShowForm(false); resetForm(); }}
          activeOpacity={0.8}
        >
          <Text style={styles.rejectBtnText}>취소</Text>
        </TouchableOpacity>
      </View>
    );

    return (
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {/* Sticky top bar with save button */}
        <View style={styles.regGymFormBar}>
          <Text style={styles.regGymFormBarTitle}>{editingGym ? '헬스장 수정' : '헬스장 등록'}</Text>
          <TouchableOpacity
            style={[styles.headerSaveBtn, { opacity: (!gymName.trim() || !gymLocation.trim()) ? 0.5 : 1 }]}
            onPress={() => {
              if (!gymName.trim() || !gymLocation.trim()) {
                Alert.alert('입력 오류', '헬스장 이름과 위치를 입력해주세요.');
                return;
              }
              handleSave();
            }}
            activeOpacity={0.85}
          >
            <Text style={styles.headerSaveBtnText}>{editingGym ? '수정 완료' : '저장'}</Text>
          </TouchableOpacity>
        </View>
        <FlatList
          data={filteredMachines}
          keyExtractor={(item) => item.id}
          numColumns={2}
          initialNumToRender={12}
          maxToRenderPerBatch={12}
          windowSize={5}
          removeClippedSubviews={true}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={formHeader}
          ListFooterComponent={formFooter}
          columnWrapperStyle={{ gap: 8, paddingHorizontal: ADMIN_FORM_PAD }}
          contentContainerStyle={{ paddingBottom: 0, gap: 8 }}
          showsVerticalScrollIndicator={false}
          renderItem={({ item: machine }) => (
            <AdminMachineItem
              machine={machine}
              isSelected={selectedIds.has(machine.id)}
              onToggle={toggleMachineId}
              cardWidth={ADMIN_CARD_W}
            />
          )}
        />
      </KeyboardAvoidingView>
    );
  }

  // ── 등록된 헬스장 목록 ──
  return (
    <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <Text style={styles.sectionTitle}>등록된 헬스장</Text>
        <TouchableOpacity style={styles.approveBtn} onPress={() => setShowForm(true)} activeOpacity={0.85}>
          <Ionicons name="add" size={14} color={C.bg} />
          <Text style={styles.approveBtnText}>헬스장 등록</Text>
        </TouchableOpacity>
      </View>

      {registeredGyms.length === 0 ? (
        <EmptyQueue label="등록된 헬스장이 없어요" />
      ) : (
        registeredGyms.map(gym => (
          <View key={gym.id} style={styles.pendingCard}>
            <View style={styles.pendingCardTop}>
              <View style={{ flex: 1 }}>
                <Text style={styles.pendingName}>{gym.name}</Text>
                <View style={styles.locRow}>
                  <Ionicons name="location-outline" size={11} color={C.textSub} />
                  <Text style={styles.locText}>{gym.location}</Text>
                </View>
              </View>
              <TouchableOpacity style={[styles.approveBtn, { paddingHorizontal: 12, paddingVertical: 7 }]} onPress={() => openEdit(gym)} activeOpacity={0.85}>
                <Ionicons name="create-outline" size={13} color={C.bg} />
                <Text style={[styles.approveBtnText, { fontSize: 12 }]}>수정</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.submittedRow}>
              <Ionicons name="barbell-outline" size={11} color={C.textSub} />
              <Text style={styles.submittedText}>머신 {gym.machineIds.length}개 · {gym.createdAt.slice(0, 10)}</Text>
            </View>
          </View>
        ))
      )}
    </ScrollView>
  );
}

// --- Main component

export default function AdminDashboard({ onClose }: { onClose: () => void }) {
  // --- Navigation
  const [viewStack, setViewStack] = useState<AdminView[]>(['home']);
  const currentView = viewStack[viewStack.length - 1];
  const push = useCallback((v: AdminView) => setViewStack(p => [...p, v]), []);
  const pop  = useCallback(() => {
    if (viewStack.length <= 1) { onClose(); return; }
    setViewStack(p => p.slice(0, -1));
  }, [viewStack.length, onClose]);

  // --- State
  const [pendingGyms,   setPendingGyms]   = useState<PendingGym[]>(() => PENDING_GYMS.map(g => ({...g})));
  const [pendingEdits,  setPendingEdits]  = useState<PendingEdit[]>(PENDING_EDITS);
  const [flaggedItems,  setFlaggedItems]  = useState<FlaggedItem[]>(FLAGGED_ITEMS);
  const [selectedGym,  setSelectedGym]   = useState<PendingGym | null>(null);
  const [gymList,      setGymList]       = useState<RegistrationGym[]>(() => getAllGymsForAdmin());
  const [editList,     setEditList]      = useState<RegEditRequest[]>(() => getAllEditRequests());
  const [gymReports,   setGymReports]    = useState<GymInfoReport[]>(() => getAllGymInfoReports());
  const [managerApps,  setManagerApps]   = useState<ManagerApplication[]>(() => getAllManagerApplications());
  const [registeredGyms, setRegisteredGyms] = useState<AdminRegisteredGym[]>(() => getAllAdminGyms());
  const [gymRequests,    setGymRequests]    = useState<GymRegistrationRequest[]>([]);

  useEffect(() => {
    fetchGymRegistrationRequests().then(setGymRequests);
  }, []);

  // --- Machine catalog state
  const [catQuery,    setCatQuery]    = useState('');
  const [catMuscle,   setCatMuscle]   = useState('All');
  const [catBrand,    setCatBrand]    = useState('All');
  const [catSelected, setCatSelected] = useState<Set<string>>(new Set());
  const [catApproved, setCatApproved] = useState<Set<string>>(new Set());

  const toggleCatSelect = useCallback((id: string) => {
    setCatSelected(prev => {
      if (catApproved.has(id)) return prev;
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, [catApproved]);

  const approveSelected = useCallback(() => {
    setCatApproved(prev => new Set([...prev, ...catSelected]));
    setCatSelected(new Set());
  }, [catSelected]);

  // --- Counts
  const pendingGymCount     = pendingGyms.filter(g => g.status === 'pending').length
                            + gymList.filter(g => g.status === 'pending').length;
  const pendingEditCount    = pendingEdits.filter(e => e.status === 'pending').length
                            + editList.filter(e => e.status === 'pending').length;
  const openFlagCount       = flaggedItems.filter(f => f.status === 'open').length;
  const gymReportCount      = gymReports.filter(r => r.status === 'pending').length;
  const managerRequestCount = managerApps.filter(a => a.status === 'pending').length;
  const registeredGymCount  = registeredGyms.length;
  const gymRequestCount     = gymRequests.filter(r => r.status === 'pending' && (r.requesterRole ?? 'user') === 'user').length;

  // --- Actions

  const reviewGym = useCallback((gymId: string, action: ReviewStatus) => {
    updateGymStatus(gymId, action as any);
    setPendingGyms(prev => prev.map(g => g.id === gymId ? { ...g, status: action } : g));
    setSelectedGym(prev => prev?.id === gymId ? { ...prev!, status: action } : prev);
  }, []);

  const reviewEdit = useCallback((edit: PendingEdit, action: ReviewStatus) => {
    updateEditRequestStatus(edit.id, action as 'approved' | 'rejected');
    setPendingEdits(prev => prev.map(e => e.id === edit.id ? { ...e, status: action } : e));
  }, []);

  const resolveFlag = useCallback((item: FlaggedItem, resolution: 'resolved' | 'delete' | 'merge') => {
    setFlaggedItems(prev => prev.map(f => f.id === item.id ? { ...f, status: 'resolved' } : f));
  }, []);

  const handleApproveGym  = useCallback((id: string) => {
    updateGymStatus(id, 'approved');
    setGymList(prev => prev.map(g => g.id === id ? { ...g, status: 'approved' } : g));
  }, []);

  const handleRejectGym   = useCallback((id: string) => {
    updateGymStatus(id, 'rejected');
    setGymList(prev => prev.map(g => g.id === id ? { ...g, status: 'rejected' } : g));
  }, []);

  const handleApproveEdit = useCallback((id: string) => {
    updateEditRequestStatus(id, 'approved');
    setEditList(prev => prev.map(r => r.id === id ? { ...r, status: 'approved' } : r));
  }, []);

  const handleRejectEdit  = useCallback((id: string) => {
    updateEditRequestStatus(id, 'rejected');
    setEditList(prev => prev.map(r => r.id === id ? { ...r, status: 'rejected' } : r));
  }, []);

  const handleSelectGym = useCallback((gym: PendingGym) => {
    setSelectedGym(gym);
    push('gym-detail');
  }, [push]);

  const handleMarkReportReviewed = useCallback((id: string) => {
    markReportReviewed(id);
    setGymReports(getAllGymInfoReports());
  }, []);

  const handleDeleteReport = useCallback((id: string) => {
    deleteGymInfoReport(id);
    setGymReports(getAllGymInfoReports());
  }, []);

  const handleApproveApplication = useCallback((id: string) => {
    updateApplicationStatus(id, 'approved');
    setManagerApps(getAllManagerApplications());
  }, []);

  const handleRejectApplication = useCallback((id: string) => {
    updateApplicationStatus(id, 'rejected');
    setManagerApps(getAllManagerApplications());
  }, []);

  const handleRegisterGym = useCallback((name: string, location: string, phone: string, hours: string, machineIds: string[]) => {
    addAdminGym({ name, location, phone, hours, machineIds });
    setRegisteredGyms(getAllAdminGyms());
  }, []);

  const handleUpdateGym = useCallback((id: string, name: string, location: string, phone: string, hours: string, machineIds: string[]) => {
    updateAdminGym(id, { name, location, phone, hours, machineIds });
    setRegisteredGyms(getAllAdminGyms());
  }, []);

  // --- View titles

  const VIEW_TITLES: Record<AdminView, string> = {
    'home':              '관리자 대시보드',
    'pending-gyms':      '헬스장 승인 대기',
    'gym-detail':        selectedGym?.name ?? '헬스장 상세',
    'pending-edits':     '수정 요청 대기',
    'flagged':           '신고 접수',
    'machine-catalog':   '머신 카탈로그',
    'brand-copyright':   '브랜드 저작권',
    'gym-reports':       '정보 제보 관리',
    'manager-requests':  '매니저 신청 관리',
    'register-gym':               '헬스장 직접 등록',
    'gym-registration-requests':  '헬스장 신규 등록 제안(유저)',
  };

  // --- Render

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />

      <Header
        title={VIEW_TITLES[currentView]}
        onBack={pop}
        right={
          currentView === 'home' ? (
            <View style={styles.adminBadge}>
              <Ionicons name="shield-checkmark" size={11} color={C.danger} />
              <Text style={styles.adminBadgeText}>어드민</Text>
            </View>
          ) : undefined
        }
      />

      {currentView === 'home' && (
        <HomeView
          pendingGymCount={pendingGymCount}
          pendingEditCount={pendingEditCount}
          openFlagCount={openFlagCount}
          gymReportCount={gymReportCount}
          managerRequestCount={managerRequestCount}
          registeredGymCount={registeredGymCount}
          gymRequestCount={gymRequestCount}
          onPush={push}
        />
      )}
      {currentView === 'pending-gyms' && (
        <PendingGymsView
          pendingGyms={pendingGyms}
          gymList={gymList}
          onSelectGym={handleSelectGym}
          onApproveGym={handleApproveGym}
          onRejectGym={handleRejectGym}
        />
      )}
      {currentView === 'gym-detail' && selectedGym && (
        <GymDetailView
          selectedGym={selectedGym}
          onReview={reviewGym}
          onBack={pop}
        />
      )}
      {currentView === 'pending-edits' && (
        <PendingEditsView
          pendingEdits={pendingEdits}
          editList={editList}
          onReviewEdit={reviewEdit}
          onApproveEdit={handleApproveEdit}
          onRejectEdit={handleRejectEdit}
        />
      )}
      {currentView === 'flagged' && (
        <FlaggedView
          flaggedItems={flaggedItems}
          onResolveFlag={resolveFlag}
        />
      )}
      {currentView === 'machine-catalog' && (
        <MachineCatalogView
          catQuery={catQuery}
          setCatQuery={setCatQuery}
          catMuscle={catMuscle}
          setCatMuscle={setCatMuscle}
          catBrand={catBrand}
          setCatBrand={setCatBrand}
          catSelected={catSelected}
          catApproved={catApproved}
          onToggleSelect={toggleCatSelect}
          onApproveSelected={approveSelected}
        />
      )}
      {currentView === 'brand-copyright' && <BrandCopyrightView />}
      {currentView === 'gym-reports' && (
        <GymReportsView
          reports={gymReports}
          onMarkReviewed={handleMarkReportReviewed}
          onDelete={handleDeleteReport}
        />
      )}
      {currentView === 'manager-requests' && (
        <ManagerRequestsAdminView
          applications={managerApps}
          onApprove={handleApproveApplication}
          onReject={handleRejectApplication}
        />
      )}
      {currentView === 'register-gym' && (
        <RegisterGymAdminView
          registeredGyms={registeredGyms}
          onSave={handleRegisterGym}
          onUpdate={handleUpdateGym}
        />
      )}
      {currentView === 'gym-registration-requests' && (
        <GymRequestsView
          requests={gymRequests}
          onUpdateStatus={async (id, status) => {
            await updateGymRequestStatus(id, status);
            const updated = await fetchGymRegistrationRequests();
            setGymRequests(updated);
          }}
          onBack={pop}
        />
      )}
    </SafeAreaView>
  );
}

// --- Styles

const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: C.bg },
  scroll: { padding: 20, paddingBottom: 48 },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    backgroundColor: C.bg,
  },
  backBtn:     { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, ...T.section, color: C.text, textAlign: 'center' },
  adminBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: R.pill,
    backgroundColor: C.dangerBg,
    borderWidth: 1,
    borderColor: C.danger + '50',
  },
  adminBadgeText: { fontSize: 11, fontWeight: '700', color: C.danger },

  // Sections
  sectionTitle: { ...T.section, color: C.text, marginBottom: 4 },
  sectionSub:   { fontSize: 13, color: C.textSub, marginBottom: 16 },

  // Stats
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 24 },
  statCard: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: C.surface,
    borderRadius: R.card,
    padding: 14,
    borderWidth: 1,
    borderColor: C.border,
    gap: 6,
  },
  statValue: { fontSize: 22, fontWeight: '900', letterSpacing: -0.5 },
  statLabel: { fontSize: 10, fontWeight: '600', color: C.textSub, textAlign: 'center' },

  // Queue cards
  queueCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.surface,
    borderRadius: R.card,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: C.border,
    gap: 12,
  },
  queueIcon:  { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  queueTitle: { fontSize: 15, fontWeight: '700', color: C.text, marginBottom: 2 },
  queueSub:   { fontSize: 12, color: C.textSub },
  queueBadge: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  queueBadgeText: { fontSize: 11, fontWeight: '800', color: '#fff' },

  // Activity
  activityCard: {
    backgroundColor: C.surface,
    borderRadius: R.card,
    borderWidth: 1,
    borderColor: C.border,
    overflow: 'hidden',
  },
  activityRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14 },
  activityText:{ flex: 1, fontSize: 13, color: C.text },
  activityTime:{ fontSize: 11, color: C.textDim, fontWeight: '600' },
  divider:     { height: 1, backgroundColor: C.border, marginLeft: 44 },

  // Pending gym card
  pendingCard: {
    backgroundColor: C.surface,
    borderRadius: R.card,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: C.border,
  },
  pendingCardTop: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 },
  pendingName:    { fontSize: 15, fontWeight: '700', color: C.text, marginBottom: 4 },
  locRow:         { flexDirection: 'row', alignItems: 'center', gap: 3 },
  locText:        { fontSize: 12, color: C.textSub },
  pendingDesc:    { fontSize: 13, color: C.textSub, lineHeight: 18, marginBottom: 10 },
  submittedRow:   { flexDirection: 'row', alignItems: 'center', gap: 5 },
  submittedText:  { fontSize: 11, color: C.textDim, fontWeight: '600' },

  // Gym detail card
  detailCard: {
    backgroundColor: C.surface,
    borderRadius: R.card,
    borderWidth: 1,
    borderColor: C.border,
    overflow: 'hidden',
    marginBottom: 12,
  },
  detailRow:     { paddingHorizontal: 16, paddingVertical: 12 },
  detailLabel:   { fontSize: 10, fontWeight: '700', color: C.textSub, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 4 },
  detailValue:   { fontSize: 14, color: C.text },
  detailDivider: { height: 1, backgroundColor: C.border },
  detailNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: C.surface,
    borderRadius: R.inner,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: C.border,
  },
  detailNoteText: { fontSize: 12, color: C.textSub },

  // Status result badge (approved/rejected)
  statusResultBadge: { borderRadius: R.pill, padding: 8, alignItems: 'center', marginBottom: 0 },
  statusResultBadgeText: { fontWeight: '700', fontSize: 15 },
  backToListBtn: { backgroundColor: C.surface, borderRadius: R.btn, padding: 14, marginTop: 12 },
  backToListBtnText: { color: C.text, textAlign: 'center', fontWeight: '600', fontSize: 14 },

  // Review buttons
  reviewBtns:   { flexDirection: 'row', gap: 10, marginTop: 4 },
  rejectBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 13,
    borderRadius: R.btn,
    borderWidth: 1.5,
    borderColor: C.danger + '60',
  },
  rejectBtnText:  { fontSize: 14, fontWeight: '700', color: C.danger },
  approveBtn: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 13,
    borderRadius: R.btn,
    backgroundColor: C.accent,
  },
  approveBtnText: { fontSize: 14, fontWeight: '800', color: C.bg },

  // Edit card (pending edits)
  editCard: {
    backgroundColor: C.surface,
    borderRadius: R.card,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: C.border,
  },
  editCardTop:      { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 10 },
  editGymName:      { flex: 1, fontSize: 15, fontWeight: '700', color: C.text },
  editFieldBadge:   { paddingHorizontal: 10, paddingVertical: 4, borderRadius: R.pill, backgroundColor: '#5ba4ff18' },
  editFieldBadgeText:{ fontSize: 11, fontWeight: '700', color: '#5ba4ff' },

  diffBlock:   { backgroundColor: C.surfaceHigh, borderRadius: R.inner, padding: 12, marginBottom: 12, gap: 6 },
  diffRow:     { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  diffOldDot:  { width: 8, height: 8, borderRadius: 4, backgroundColor: C.danger, marginTop: 4 },
  diffNewDot:  { width: 8, height: 8, borderRadius: 4, backgroundColor: C.accent, marginTop: 4 },
  diffOldText: { flex: 1, fontSize: 13, color: C.textSub, lineHeight: 18, textDecorationLine: 'line-through' },
  diffNewText: { flex: 1, fontSize: 13, color: C.text, lineHeight: 18 },
  diffArrow:   { paddingLeft: 8 },

  // Flagged card
  flagCard: {
    backgroundColor: C.surface,
    borderRadius: R.card,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: C.border,
  },
  flagCardTop:      { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 10 },
  flagTypeIcon:     { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  flagGymName:      { fontSize: 15, fontWeight: '700', color: C.text, marginBottom: 5 },
  flagTypeBadge:    { alignSelf: 'flex-start', paddingHorizontal: 9, paddingVertical: 3, borderRadius: R.pill },
  flagTypeBadgeText:{ fontSize: 10, fontWeight: '700' },
  flagDesc:         { fontSize: 13, color: C.textSub, lineHeight: 18, marginBottom: 10 },
  flagActions:      { flexDirection: 'row', gap: 8, marginTop: 4, flexWrap: 'wrap' },
  flagActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: R.pill,
    borderWidth: 1.5,
    borderColor: C.border,
  },
  flagResolveBtn: { backgroundColor: C.accent, borderColor: C.accent },
  flagActionText: { fontSize: 12, fontWeight: '700' },

  // Reviewed badge
  reviewedBadge:     { paddingHorizontal: 10, paddingVertical: 4, borderRadius: R.pill },
  reviewedBadgeText: { fontSize: 11, fontWeight: '700' },

  // Empty queue
  emptyQueue:     { alignItems: 'center', gap: 10, paddingVertical: 48 },
  emptyQueueText: { fontSize: 14, fontWeight: '600', color: C.textSub },

  // Machine catalog
  catSearchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.surface,
    borderRadius: R.inner,
    borderWidth: 1,
    borderColor: C.border,
    marginBottom: 12,
    height: 44,
  },
  catSearchInput: {
    flex: 1,
    fontSize: 14,
    color: C.text,
    paddingHorizontal: 10,
    height: '100%',
  },
  catChipRow: { marginBottom: 8, marginHorizontal: -20 },
  catChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: R.pill,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
  },
  catChipActive: { backgroundColor: C.accentBg, borderColor: C.accent },
  catChipText: { fontSize: 12, fontWeight: '600', color: C.textSub },
  catChipTextActive: { color: C.accent },
  catCountBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  catCount:    { fontSize: 12, fontWeight: '600', color: C.textDim },
  catSelCount: { fontSize: 12, fontWeight: '800', color: C.accent },

  catGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },

  catCard: {
    width: CAT_CARD_W,
    backgroundColor: C.surface,
    borderRadius: R.card,
    borderWidth: 1.5,
    borderColor: C.border,
    overflow: 'hidden',
  },
  catCardSelected: { borderColor: C.accent },

  catCardImg: {
    width: '100%',
    height: CAT_CARD_W * (4 / 3),
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  catCardIconBadge: {
    width: 60, height: 60, borderRadius: 30,
    alignItems: 'center', justifyContent: 'center',
    position: 'absolute',
  },

  catMuscleTag: {
    position: 'absolute', top: 10, right: 10,
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: R.pill,
  },
  catMuscleTagText: { fontSize: 9, fontWeight: '800', color: '#fff', letterSpacing: 0.3 },

  catAddedBadge: {
    position: 'absolute', top: 10, left: 10,
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: R.pill,
    backgroundColor: C.accentBg,
    borderWidth: 1, borderColor: C.accent + '50',
  },
  catAddedBadgeText: { fontSize: 9, fontWeight: '800', color: C.accent, letterSpacing: 0.3 },

  catCheckWrap:   { position: 'absolute', top: 10, left: 10 },
  catCheckCircle: { width: 28, height: 28, borderRadius: 14, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center' },

  catCardBody:  { padding: 10, gap: 3 },
  catCardName:  { fontSize: 12, fontWeight: '700', color: C.text, lineHeight: 17 },
  catCardBrand: { fontSize: 10, color: C.textSub },
  catCategoryTag: {
    alignSelf: 'flex-start',
    marginTop: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: R.pill,
    backgroundColor: C.surfaceHigh,
  },
  catCategoryTagText: { fontSize: 9, fontWeight: '700', color: C.textDim, letterSpacing: 0.3 },

  // Fixed bottom CTA
  catCta:       { padding: 16, borderTopWidth: 1, borderTopColor: C.border, backgroundColor: C.bg },
  catCtaBtn:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: C.accent, borderRadius: R.btn, paddingVertical: 16 },
  catCtaBtnText:{ fontSize: 15, fontWeight: '800', color: C.bg },

  // Brand copyright view
  bcSummary: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 16, marginTop: 12, marginBottom: 4,
    backgroundColor: '#34d39915', borderRadius: R.inner,
    paddingHorizontal: 14, paddingVertical: 10,
  },
  bcSummaryText: { fontSize: 13, fontWeight: '600', color: '#34d399' },
  bcList:  { paddingHorizontal: 16, paddingTop: 8 },
  bcRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: C.surface, borderRadius: R.inner,
    paddingHorizontal: 16, paddingVertical: 14,
    marginBottom: 8,
  },
  bcBrand:  { fontSize: 14, fontWeight: '700', color: C.text, marginBottom: 2 },
  bcStatus: { fontSize: 11, fontWeight: '600' },

  // Register gym form
  adminInput: {
    backgroundColor: C.surfaceHigh,
    borderRadius: R.inner,
    borderWidth: 1,
    borderColor: C.border,
    color: C.text,
    fontSize: 14,
    paddingHorizontal: 12,
    paddingVertical: 11,
    marginBottom: 4,
  },

  // RegisterGymAdminView machine section (matches MachinesView style)
  regGymStatsRow: {
    flexDirection: 'row',
    backgroundColor: C.surface,
    borderRadius: R.card,
    borderWidth: 1,
    borderColor: C.border,
    marginBottom: 14,
    overflow: 'hidden',
  },
  regGymStatCell:  { flex: 1, alignItems: 'center', paddingVertical: 14 },
  regGymStatValue: { fontSize: 20, fontWeight: '900', color: C.text, letterSpacing: -0.5 },
  regGymStatLabel: { fontSize: 10, fontWeight: '600', color: C.textSub, marginTop: 2 },

  regGymToggleRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  regGymToggleChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: R.pill,
    backgroundColor: C.surface,
    borderWidth: 1, borderColor: C.border,
  },
  regGymToggleChipActive: { backgroundColor: C.accent, borderColor: C.accent },
  regGymToggleChipText:       { fontSize: 12, fontWeight: '600', color: C.textSub },
  regGymToggleChipTextActive: { color: C.bg, fontWeight: '700' },

  regGymFormBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: C.border,
    backgroundColor: C.bg,
  },
  regGymFormBarTitle: { fontSize: 16, fontWeight: '800', color: C.text },
  headerSaveBtn:      { paddingHorizontal: 14, paddingVertical: 7, backgroundColor: C.accent, borderRadius: R.pill },
  headerSaveBtnText:  { fontSize: 13, fontWeight: '700', color: C.bg },
});
