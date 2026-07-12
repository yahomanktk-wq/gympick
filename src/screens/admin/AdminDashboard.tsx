import React, { useState, useCallback, useEffect, useMemo } from 'react';
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
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { C, R, T } from '../../theme';
import { PendingGym, ReviewStatus } from '../../data/types';
import type { Machine, MachineWithGyms } from '../../data/types';
import { Switch } from 'react-native';
import { fetchMachineRequests, updateMachineRequestStatus, type MachineRequest } from '../../lib/db/machineRequests';
import { fetchMachines, getMachinesCacheSync } from '../../lib/db';
import { parseMuscles } from '../../lib/splitUtils';
import {
  getBrandCopyrightList,
  setBrandCopyrightStatus,
} from '../../data/brandCopyrightStore';
import {
  fetchGymInfoReports,
  markReportReviewed,
  deleteGymInfoReport,
  type GymInfoReport,
} from '../../lib/db/gymInfoReports';
import {
  fetchAdminGyms,
  insertAdminGym,
  updateAdminGymFull,
  searchProfilesByEmailOrNickname,
  setGymManager,
  deleteGym,
  type AdminGym,
  type ProfileSearchResult,
} from '../../lib/db/adminGyms';
import MachineCard from '../../components/MachineCard';
import {
  fetchGymRegistrationRequests,
  updateGymRequestStatus,
  type GymRegistrationRequest,
} from '../../lib/db/gymRegistrationRequests';
import { geocodeAddress } from '../../lib/geocoding';
import {
  OperatingHoursEditor,
  serializeHours,
  parseHours,
  applyNoticeToggle,
  DEFAULT_HOURS,
  type OperatingHours,
} from '../../components/OperatingHoursEditor';
import {
  fetchGymOfficialBrands,
  addGymOfficialBrand,
  removeGymOfficialBrand,
} from '../../lib/db/gymOfficialBrands';
import { brandLogos } from '../../constants/brandLogos';
import {
  fetchManagerRequests,
  updateManagerRequestStatus,
  deleteManagerRequest,
  deleteManagerRequestsByUserId,
  type ManagerRequest,
} from '../../lib/db/managerRequests';
import { sendNotification } from '../../lib/db/notifications';
import {
  fetchAllUserInquiries,
  answerUserInquiry,
  type UserInquiry,
} from '../../lib/db/userInquiries';

const SCREEN_W     = Dimensions.get('window').width;
const CAT_CARD_W   = Math.floor((SCREEN_W - 40 - 12) / 2);

// --- Types

type AdminView = 'home' | 'pending-gyms' | 'gym-detail' | 'machine-catalog' | 'brand-copyright' | 'gym-reports' | 'manager-requests' | 'register-gym' | 'gym-registration-requests' | 'gym-official-brands' | 'all-gyms-official' | 'machine-requests' | 'user-inquiries' | 'gym-manager-link';

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
  machines: MachineWithGyms[];
  pendingGymCount: number;
  gymReportCount: number;
  managerRequestCount: number;
  registeredGymCount: number;
  gymRequestCount: number;
  machineRequestCount: number;
  userInquiryCount: number;
  onPush: (v: AdminView) => void;
}

interface PendingGymsViewProps {
  pendingGyms: PendingGym[];
  onSelectGym: (gym: PendingGym) => void;
  onApproveGym: (id: string) => void;
  onRejectGym:  (id: string) => void;
}

interface GymDetailViewProps {
  selectedGym: PendingGym;
  onReview: (gymId: string, action: ReviewStatus) => void;
  onBack: () => void;
}

interface MachineCatalogViewProps {
  machines: MachineWithGyms[];
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

function MachineRequestsView({
  requests,
  onUpdateStatus,
  onBack,
}: {
  requests:       MachineRequest[];
  onUpdateStatus: (id: string, status: 'reviewed' | 'resolved') => void;
  onBack:         () => void;
}) {
  const pending  = requests.filter(r => r.status === 'pending');
  const reviewed = requests.filter(r => r.status !== 'pending');

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
      <TouchableOpacity onPress={onBack} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <Ionicons name="chevron-back" size={20} color={C.text} />
        <Text style={{ fontSize: 16, fontWeight: '800', color: C.text }}>머신 등록 신청(매니저)</Text>
      </TouchableOpacity>

      <Text style={{ fontSize: 12, fontWeight: '700', color: C.textDim, letterSpacing: 1 }}>검토 대기 ({pending.length})</Text>
      {pending.length === 0 && (
        <Text style={{ fontSize: 13, color: C.textDim, paddingVertical: 12 }}>검토 대기 중인 신청이 없어요.</Text>
      )}
      {pending.map(req => (
        <View key={req.id} style={{ backgroundColor: C.surface, borderRadius: R.card, padding: 16, gap: 8 }}>
          {req.photoUrl ? (
            <Image
              source={{ uri: req.photoUrl }}
              style={{ width: '100%', height: 180, borderRadius: R.inner, backgroundColor: C.bg }}
              resizeMode="cover"
            />
          ) : null}
          <Text style={{ fontSize: 15, fontWeight: '800', color: C.text }}>{req.machineName}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {req.brand ? (
              <View style={{ backgroundColor: C.bg, borderRadius: R.pill, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: C.border }}>
                <Text style={{ fontSize: 11, color: C.textSub, fontWeight: '600' }}>{req.brand}</Text>
              </View>
            ) : null}
            {req.targetMuscle ? (
              <View style={{ backgroundColor: C.accentBg, borderRadius: R.pill, paddingHorizontal: 8, paddingVertical: 3 }}>
                <Text style={{ fontSize: 11, color: C.accent, fontWeight: '700' }}>{req.targetMuscle}</Text>
              </View>
            ) : null}
          </View>
          <Text style={{ fontSize: 13, color: C.textSub }}>헬스장: {req.gymName}</Text>
          <Text style={{ fontSize: 13, color: C.textSub, fontWeight: '600' }}>신청자: {req.requesterNickname || req.requesterName || req.requesterId}</Text>
          {req.requesterEmail ? (
            <Text style={{ fontSize: 11, color: C.textDim }}>{req.requesterEmail}</Text>
          ) : null}
          <Text style={{ fontSize: 11, color: C.textDim }}>{new Date(req.createdAt).toLocaleDateString('ko-KR')}</Text>
          <TouchableOpacity
            style={{ padding: 12, borderRadius: R.btn, backgroundColor: C.accent, alignItems: 'center', marginTop: 4 }}
            onPress={() => onUpdateStatus(req.id, 'resolved')}
          >
            <Text style={{ color: C.bg, fontWeight: '800', fontSize: 13 }}>확인 완료</Text>
          </TouchableOpacity>
        </View>
      ))}

      {reviewed.length > 0 && (
        <>
          <Text style={{ fontSize: 12, fontWeight: '700', color: C.textDim, letterSpacing: 1, marginTop: 8 }}>처리된 신청 ({reviewed.length})</Text>
          {reviewed.map(req => (
            <View key={req.id} style={{ backgroundColor: C.surface, borderRadius: R.card, padding: 16, gap: 4, opacity: 0.6 }}>
              <Text style={{ fontSize: 14, fontWeight: '700', color: C.text }}>{req.machineName}</Text>
              <Text style={{ fontSize: 12, color: C.textSub }}>{req.gymName}{req.brand ? ` · ${req.brand}` : ''}</Text>
              <Text style={{ fontSize: 11, color: C.accent, fontWeight: '600' }}>확인 완료</Text>
            </View>
          ))}
        </>
      )}
    </ScrollView>
  );
}

function HomeView({ machines, pendingGymCount, gymReportCount, managerRequestCount, registeredGymCount, gymRequestCount, machineRequestCount, userInquiryCount, onPush }: HomeViewProps) {
  return (
    <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
      {/* Stats */}
      <Text style={styles.sectionTitle}>처리 대기 현황</Text>
      <View style={styles.statsRow}>
        {[
          { label: '매니저 신청', value: String(managerRequestCount), icon: 'person-add' as const, color: '#a78bfa' },
          { label: '헬스장 심사', value: String(pendingGymCount),     icon: 'business' as const,   color: '#ffb547' },
          { label: '정보 제보',   value: String(gymReportCount),      icon: 'flag' as const,       color: '#ff7eb3' },
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
          icon: 'barbell-outline' as const,
          title: '머신 카탈로그',
          count: 0,
          sub: `${machines.length}개 머신 등록됨`,
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
          title: '헬스장 관리',
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
        {
          icon: 'barbell-outline' as const,
          title: '머신 등록 신청(매니저)',
          count: machineRequestCount,
          sub: machineRequestCount > 0 ? `${machineRequestCount}개 검토 대기` : '접수된 신청 없음',
          onPress: () => onPush('machine-requests'),
          color: '#22d3ee',
        },
        {
          icon: 'shield-checkmark-outline' as const,
          title: '헬스장 오피셜 관리',
          count: 0,
          sub: '헬스장별 오피셜 브랜드 설정',
          onPress: () => onPush('all-gyms-official'),
          color: '#5ba4ff',
        },
        {
          icon: 'chatbubble-outline' as const,
          title: '유저 문의 관리',
          count: userInquiryCount,
          sub: userInquiryCount > 0 ? `${userInquiryCount}개 답변 대기` : '접수된 문의 없음',
          onPress: () => onPush('user-inquiries'),
          color: '#facc15',
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

    </ScrollView>
  );
}

function PendingGymsView({ pendingGyms, onSelectGym, onApproveGym, onRejectGym }: PendingGymsViewProps) {
  // 모든 신청 건을 하나로 통합 (pendingGyms + managerGymRequests)
  const allPending  = pendingGyms.filter(g => g.status === 'pending');
  const allReviewed = pendingGyms.filter(g => g.status !== 'pending');

  return (
    <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

      {/* ── 신규 등록 신청 (전체) ── */}
      <Text style={styles.sectionTitle}>신규 등록 신청</Text>
      <Text style={styles.sectionSub}>{allPending.length}개 검토 대기</Text>

      {allPending.length === 0 && <EmptyQueue label="신규 등록 신청이 없어요" />}

      {allPending.map(gym => (
        <View
          key={gym.id}
          style={styles.pendingCard}
        >
          <TouchableOpacity
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
            {gym.description ? (
              <Text style={styles.pendingDesc} numberOfLines={2}>{gym.description}</Text>
            ) : null}
            <View style={styles.submittedRow}>
              <Ionicons name="person-outline" size={11} color={C.textSub} />
              <Text style={styles.submittedText}>신청자: {gym.managerName} · {gym.submittedAt.slice(0, 10)}</Text>
            </View>
          </TouchableOpacity>
          <ReviewButtons
            onApprove={() => onApproveGym(gym.id)}
            onReject={() => onRejectGym(gym.id)}
          />
        </View>
      ))}

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

function MachineCatalogView({
  machines,
  catQuery, setCatQuery, catMuscle, setCatMuscle, catBrand, setCatBrand,
  catSelected, catApproved, onToggleSelect, onApproveSelected,
}: MachineCatalogViewProps) {
  const CAT_MUSCLES = useMemo(() => ['All', ...Array.from(new Set(machines.flatMap(m => parseMuscles(m.targetMuscle)))).sort()], [machines]);
  const CAT_BRANDS  = useMemo(() => ['All', ...Array.from(new Set(machines.map(m => m.brand))).sort()], [machines]);
  const MC: Record<string, { fg: string; bg: string }> = {
    Chest:       { fg: '#ff6b6b', bg: '#ff6b6b18' },
    Back:        { fg: '#5ba4ff', bg: '#5ba4ff18' },
    Leg:        { fg: '#3dd68c', bg: '#3dd68c18' },
    Shoulder:   { fg: '#ffb547', bg: '#ffb54718' },
    Arms:        { fg: '#ff7eb3', bg: '#ff7eb318' },
    'Full Body': { fg: '#a78bfa', bg: '#a78bfa18' },
    Core:        { fg: '#ffd166', bg: '#ffd16618' },
    Cardio:      { fg: '#06d6a0', bg: '#06d6a018' },
  };
  const mc = (muscle: string) => MC[muscle] ?? { fg: C.textSub, bg: C.border };

  const q = catQuery.toLowerCase().trim();
  const filtered = machines.filter(m => {
    if (catMuscle !== 'All' && !parseMuscles(m.targetMuscle).includes(catMuscle)) return false;
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

function BrandCopyrightView({ machines }: { machines: MachineWithGyms[] }) {
  const allBrands = useMemo(() => Array.from(new Set(machines.map(m => m.brand))).sort(), [machines]);
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

// --- UserInquiriesView

interface UserInquiriesViewProps {
  inquiries: UserInquiry[];
  onAnswer: (id: string, answer: string) => void;
}

function UserInquiriesView({ inquiries, onAnswer }: UserInquiriesViewProps) {
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const pending  = inquiries.filter(i => i.status === 'pending');
  const answered = inquiries.filter(i => i.status !== 'pending');

  function submitAnswer(id: string) {
    const answer = (drafts[id] ?? '').trim();
    if (!answer) return;
    onAnswer(id, answer);
    setDrafts(prev => ({ ...prev, [id]: '' }));
  }

  return (
    <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
      <Text style={styles.sectionTitle}>유저 문의 관리</Text>
      <Text style={styles.sectionSub}>{pending.length}개 답변 대기</Text>

      {pending.length === 0 && <EmptyQueue label="답변 대기 중인 문의가 없어요" />}

      {pending.map(i => (
        <View key={i.id} style={styles.flagCard}>
          <View style={styles.flagCardTop}>
            <View style={[styles.flagTypeIcon, { backgroundColor: '#facc1518' }]}>
              <Ionicons name="chatbubble-outline" size={16} color="#facc15" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.flagGymName}>{i.title}</Text>
              <View style={styles.submittedRow}>
                <Ionicons name="time-outline" size={11} color={C.textSub} />
                <Text style={styles.submittedText}>{i.createdAt.slice(0, 10)}</Text>
              </View>
            </View>
          </View>
          <Text style={styles.flagDesc}>{i.content}</Text>
          <TextInput
            style={styles.adminInput}
            value={drafts[i.id] ?? ''}
            onChangeText={v => setDrafts(prev => ({ ...prev, [i.id]: v }))}
            placeholder="답변을 입력해주세요"
            placeholderTextColor={C.textDim}
            multiline
          />
          <View style={styles.flagActions}>
            <TouchableOpacity
              style={[styles.flagActionBtn, styles.flagResolveBtn, { opacity: (drafts[i.id] ?? '').trim() ? 1 : 0.5 }]}
              onPress={() => submitAnswer(i.id)}
              activeOpacity={0.8}
              disabled={!(drafts[i.id] ?? '').trim()}
            >
              <Ionicons name="checkmark" size={13} color={C.bg} />
              <Text style={[styles.flagActionText, { color: C.bg }]}>답변 등록</Text>
            </TouchableOpacity>
          </View>
        </View>
      ))}

      {answered.length > 0 && (
        <>
          <Text style={[styles.sectionTitle, { marginTop: 20, fontSize: 12, color: C.textDim }]}>처리 완료</Text>
          {answered.map(i => (
            <View key={i.id} style={[styles.flagCard, { opacity: 0.6 }]}>
              <View style={styles.flagCardTop}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.flagGymName}>{i.title}</Text>
                  <Text style={styles.flagDesc} numberOfLines={1}>{i.answer}</Text>
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

// --- RegisterGymAdminView

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
  machines: MachineWithGyms[];
  registeredGyms: AdminGym[];
  onSave: (name: string, location: string, phone: string, hours: string, hoursNote: string, machineIds: string[]) => void | Promise<void>;
  onUpdate: (id: string, name: string, location: string, phone: string, hours: string, hoursNote: string, machineIds: string[]) => void | Promise<void>;
  onOfficialBrands: (gymId: string, gymName: string) => void;
  onManagerLink: (gymId: string, gymName: string) => void;
  onUnlinkManager: (gymId: string) => void | Promise<void>;
  onDeleteGym: (gymId: string, gymName: string) => void;
}

function RegisterGymAdminView({ machines, registeredGyms, onSave, onUpdate, onOfficialBrands, onManagerLink, onUnlinkManager, onDeleteGym }: RegisterGymAdminViewProps) {
  const [showForm,         setShowForm]         = useState(false);
  const [editingGym,       setEditingGym]       = useState<AdminGym | null>(null);
  const [gymName,          setGymName]          = useState('');
  const [gymLocation,      setGymLocation]      = useState('');
  const [gymPhone,         setGymPhone]         = useState('');
  const [gymHours2,        setGymHours2]        = useState<OperatingHours>(DEFAULT_HOURS);
  const [gymNotices,       setGymNotices]       = useState<string[]>([]);
  const [gymHoursNote,     setGymHoursNote]     = useState('');
  const [selectedIds,      setSelectedIds]      = useState<Set<string>>(new Set());
  const [muscleFilter,     setMuscleFilter]     = useState('All');
  const [brandFilter,      setBrandFilter]      = useState('All');
  const [showSelectedOnly, setShowSelectedOnly] = useState(false);
  const [gymSearchQuery,   setGymSearchQuery]   = useState('');

  const ADMIN_GYM_MUSCLES = useMemo(() => ['All', ...Array.from(new Set(machines.flatMap(m => parseMuscles(m.targetMuscle)))).sort()], [machines]);
  const ADMIN_GYM_BRANDS  = useMemo(() => ['All', ...Array.from(new Set(machines.map(m => m.brand))).sort()], [machines]);

  const updateGymDay = useCallback((day: keyof OperatingHours, field: any, value: any) => {
    setGymHours2(prev => ({ ...prev, [day]: { ...prev[day], [field]: value } }));
  }, []);
  const toggleGymNotice = useCallback((chip: string) => {
    setGymNotices(prev => applyNoticeToggle(chip, prev, setGymHours2));
  }, []);

  const filteredMachines = machines.filter(m => {
    if (!m || !m.name || !m.brand || !m.targetMuscle) return false;
    const muscleOk   = muscleFilter === 'All' || parseMuscles(m.targetMuscle).includes(muscleFilter);
    const brandOk    = brandFilter  === 'All' || m.brand        === brandFilter;
    const selectedOk = !showSelectedOnly || selectedIds.has(m.id);
    return muscleOk && brandOk && selectedOk;
  });

  const selectedMuscleCount = new Set(machines.filter(m => selectedIds.has(m.id)).map(m => m.targetMuscle)).size;
  const selectedBrandCount  = new Set(machines.filter(m => selectedIds.has(m.id)).map(m => m.brand)).size;

  function resetForm() {
    setEditingGym(null);
    setGymName(''); setGymLocation(''); setGymPhone('');
    setGymHours2(DEFAULT_HOURS); setGymNotices([]); setGymHoursNote('');
    setSelectedIds(new Set()); setMuscleFilter('All'); setBrandFilter('All'); setShowSelectedOnly(false);
  }

  function openEdit(gym: AdminGym) {
    setEditingGym(gym);
    setGymName(gym.name);
    setGymLocation(gym.location);
    setGymPhone(gym.phone);
    setGymHours2(parseHours(gym.hours));
    setGymNotices([]);
    setGymHoursNote(gym.hoursNote ?? '');
    setSelectedIds(new Set(gym.machineIds));
    setMuscleFilter('All');
    setBrandFilter('All');
    setShowSelectedOnly(false);
    setShowForm(true);
  }

  async function handleSave() {
    if (!gymName.trim() || !gymLocation.trim()) {
      Alert.alert('입력 오류', '헬스장 이름과 위치는 필수입니다.');
      return;
    }
    if (editingGym) {
      await onUpdate(editingGym.id, gymName.trim(), gymLocation.trim(), gymPhone.trim(), serializeHours(gymHours2), gymHoursNote.trim(), Array.from(selectedIds));
      setShowForm(false);
      resetForm();
      Alert.alert('수정 완료', '수정이 완료되었습니다.');
    } else {
      await onSave(gymName.trim(), gymLocation.trim(), gymPhone.trim(), serializeHours(gymHours2), gymHoursNote.trim(), Array.from(selectedIds));
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
          <View style={{ marginTop: 12 }}>
            <OperatingHoursEditor
              hours={gymHours2}
              updateDay={updateGymDay}
              notices={gymNotices}
              toggleNotice={toggleGymNotice}
              hoursNote={gymHoursNote}
              setHoursNote={setGymHoursNote}
            />
          </View>
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
  const q = gymSearchQuery.trim().toLowerCase();
  const visibleGyms = q
    ? registeredGyms.filter(g =>
        g.name.toLowerCase().includes(q) || g.location.toLowerCase().includes(q))
    : registeredGyms;
  return (
    <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <Text style={styles.sectionTitle}>등록된 헬스장</Text>
        <TouchableOpacity style={styles.approveBtn} onPress={() => setShowForm(true)} activeOpacity={0.85}>
          <Ionicons name="add" size={14} color={C.bg} />
          <Text style={styles.approveBtnText}>헬스장 등록</Text>
        </TouchableOpacity>
      </View>

      {/* 검색창 */}
      <View style={styles.catSearchRow}>
        <Ionicons name="search" size={15} color={C.textDim} style={{ marginLeft: 12 }} />
        <TextInput
          value={gymSearchQuery}
          onChangeText={setGymSearchQuery}
          placeholder="헬스장 이름 또는 위치 검색..."
          placeholderTextColor={C.textDim}
          style={styles.catSearchInput}
          autoCorrect={false}
          autoCapitalize="none"
          spellCheck={false}
        />
        {gymSearchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setGymSearchQuery('')} style={{ marginRight: 10 }}>
            <Ionicons name="close-circle" size={16} color={C.textDim} />
          </TouchableOpacity>
        )}
      </View>

      {visibleGyms.length === 0 ? (
        <EmptyQueue label={q ? '검색 결과가 없어요' : '등록된 헬스장이 없어요'} />
      ) : (
        visibleGyms.map(gym => {
          return (
          <View key={gym.id} style={styles.pendingCard}>
            <View style={styles.pendingCardTop}>
              <View style={{ flex: 1 }}>
                <Text style={styles.pendingName}>{gym.name}</Text>
                <View style={styles.locRow}>
                  <Ionicons name="location-outline" size={11} color={C.textSub} />
                  <Text style={styles.locText}>{gym.location}</Text>
                </View>
              </View>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TouchableOpacity style={[styles.approveBtn, { flex: 0, paddingHorizontal: 12, paddingVertical: 7, backgroundColor: '#5ba4ff' }]} onPress={() => onOfficialBrands(gym.id, gym.name)} activeOpacity={0.85}>
                  <Ionicons name="shield-checkmark-outline" size={13} color={C.bg} />
                  <Text style={[styles.approveBtnText, { fontSize: 12 }]}>오피셜</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.approveBtn, { flex: 0, paddingHorizontal: 12, paddingVertical: 7 }]} onPress={() => openEdit(gym)} activeOpacity={0.85}>
                  <Ionicons name="create-outline" size={13} color={C.bg} />
                  <Text style={[styles.approveBtnText, { fontSize: 12 }]}>수정</Text>
                </TouchableOpacity>
              </View>
            </View>
            <View style={styles.submittedRow}>
              <Ionicons name="barbell-outline" size={11} color={C.textSub} />
              <Text style={styles.submittedText}>머신 {gym.machineIds.length}개 · {gym.createdAt.slice(0, 10)}</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, flex: 1 }}>
                <Ionicons name="person-circle-outline" size={13} color={C.textSub} />
                <Text style={styles.submittedText} numberOfLines={1}>
                  {gym.managerNickname || gym.managerEmail ? `매니저: ${gym.managerNickname ?? gym.managerEmail}` : '매니저 미배정'}
                </Text>
              </View>
              <View style={{ flexDirection: 'row', gap: 14 }}>
                {gym.managerId && (
                  <TouchableOpacity onPress={() => onUnlinkManager(gym.id)} activeOpacity={0.7}>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: C.textSub }}>연결 해제</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity onPress={() => onManagerLink(gym.id, gym.name)} activeOpacity={0.7}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: '#5ba4ff' }}>{gym.managerId ? '변경' : '매니저 연결'}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => onDeleteGym(gym.id, gym.name)} activeOpacity={0.7}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: C.danger }}>삭제</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
          );
        })
      )}
    </ScrollView>
  );
}

// --- Main component

function ManagerRequestsSupabaseView({
  requests,
  loading,
  onApprove,
  onReject,
}: {
  requests:  ManagerRequest[];
  loading:   boolean;
  onApprove: (id: string) => void;
  onReject:  (id: string) => void;
}) {
  const pending = requests.filter(r => r.status === 'pending');

  if (loading) {
    return (
      <View style={styles.emptyQueue}>
        <Text style={styles.emptyQueueText}>신청 목록 로딩 중...</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
      <Text style={styles.sectionTitle}>매니저 신청 관리</Text>
      <Text style={styles.sectionSub}>{pending.length}개 심사 대기</Text>

      {pending.length === 0 && <EmptyQueue label="대기 중인 매니저 신청이 없어요" />}

      {pending.map(r => (
        <View key={r.id} style={styles.pendingCard}>
          <View style={styles.pendingCardTop}>
            <View style={{ flex: 1 }}>
              <Text style={styles.pendingName}>{r.gymName}</Text>
              <View style={styles.locRow}>
                <Ionicons name="location-outline" size={11} color={C.textSub} />
                <Text style={styles.locText}>{r.location}</Text>
              </View>
            </View>
          </View>
          <View style={styles.submittedRow}>
            <Ionicons name="person-outline" size={11} color={C.textSub} />
            <Text style={styles.submittedText}>신청자 ID: {r.userId.slice(0, 8)}... · {r.createdAt.slice(0, 10)}</Text>
          </View>
          {r.phone.length > 0 && (
            <View style={styles.submittedRow}>
              <Ionicons name="call-outline" size={11} color={C.textSub} />
              <Text style={styles.submittedText}>{r.phone}</Text>
            </View>
          )}
          {r.message.length > 0 && (
            <Text style={[styles.pendingDesc, { marginTop: 6 }]} numberOfLines={3}>{r.message}</Text>
          )}
          <ReviewButtons
            onApprove={() => onApprove(r.id)}
            onReject={() => onReject(r.id)}
          />
        </View>
      ))}

    </ScrollView>
  );
}

function AllGymsOfficialView({
  onSelectGym,
  onBack,
}: {
  onSelectGym: (gymId: string, gymName: string) => void;
  onBack: () => void;
}) {
  const [gyms, setGyms] = useState<{ id: string; name: string; location: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const { supabase } = await import('../../lib/supabase');
        const { data } = await supabase
          .from('gyms')
          .select('id, name, location')
          .order('name');
        setGyms(data ?? []);
      } catch {}
      setLoading(false);
    }
    load();
  }, []);

  const filtered = gyms.filter(g =>
    g.name.toLowerCase().includes(search.toLowerCase()) ||
    g.location.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        contentContainerStyle={{ padding: 16, gap: 10 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <TouchableOpacity onPress={onBack} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <Ionicons name="chevron-back" size={20} color={C.text} />
          <Text style={{ fontSize: 16, fontWeight: '800', color: C.text }}>헬스장 오피셜 관리</Text>
        </TouchableOpacity>

        {/* 검색 */}
        <View style={styles.catSearchRow}>
          <Ionicons name="search" size={15} color={C.textDim} style={{ marginLeft: 12 }} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="헬스장 이름 또는 위치 검색..."
            placeholderTextColor={C.textDim}
            style={styles.catSearchInput}
            autoCorrect={false}
            autoCapitalize="none"
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')} style={{ marginRight: 10 }}>
              <Ionicons name="close-circle" size={16} color={C.textDim} />
            </TouchableOpacity>
          )}
        </View>

        <Text style={{ fontSize: 12, fontWeight: '700', color: C.textDim, letterSpacing: 1 }}>
          전체 헬스장 ({filtered.length}개)
        </Text>

        {loading ? (
          <Text style={{ fontSize: 13, color: C.textDim, paddingVertical: 20, textAlign: 'center' }}>로딩 중...</Text>
        ) : filtered.length === 0 ? (
          <Text style={{ fontSize: 13, color: C.textDim, paddingVertical: 20, textAlign: 'center' }}>검색 결과가 없어요</Text>
        ) : (
          filtered.map(gym => (
            <TouchableOpacity
              key={gym.id}
              style={{
                backgroundColor: C.surface,
                borderRadius: R.card,
                borderWidth: 1,
                borderColor: C.border,
                padding: 14,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
              }}
              onPress={() => onSelectGym(gym.id, gym.name)}
              activeOpacity={0.8}
            >
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontWeight: '700', color: C.text }}>{gym.name}</Text>
                <Text style={{ fontSize: 12, color: C.textSub, marginTop: 2 }}>{gym.location}</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="shield-checkmark-outline" size={16} color="#5ba4ff" />
                <Ionicons name="chevron-forward" size={16} color={C.textDim} />
              </View>
            </TouchableOpacity>
          ))
        )}

        <View style={{ height: 32 }} />
      </ScrollView>
    </View>
  );
}

function GymOfficialBrandsView({
  gymName,
  officialBrands,
  loading,
  onToggle,
  onBack,
}: {
  gymName: string;
  officialBrands: string[];
  loading: boolean;
  onToggle: (brand: string) => void;
  onBack: () => void;
}) {
  const allBrands = Object.keys(brandLogos).map(key =>
    key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
  );

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }} showsVerticalScrollIndicator={false}>
      <TouchableOpacity onPress={onBack} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <Ionicons name="chevron-back" size={20} color={C.text} />
        <Text style={{ fontSize: 16, fontWeight: '800', color: C.text }}>{gymName}</Text>
      </TouchableOpacity>

      <Text style={{ fontSize: 12, fontWeight: '700', color: C.textDim, letterSpacing: 1 }}>
        오피셜 브랜드 ({officialBrands.length}개 선택됨)
      </Text>

      {loading ? (
        <Text style={{ fontSize: 13, color: C.textDim, paddingVertical: 20, textAlign: 'center' }}>로딩 중...</Text>
      ) : (
        allBrands.map(brand => {
          const key = brand.toUpperCase().replace(/\s+/g, '_');
          const logoSrc = brandLogos[key];
          const isActive = officialBrands.includes(brand);
          return (
            <TouchableOpacity
              key={brand}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: C.surface,
                borderRadius: R.card,
                borderWidth: 1.5,
                borderColor: isActive ? '#5ba4ff' : C.border,
                padding: 14,
                gap: 14,
              }}
              onPress={() => onToggle(brand)}
              activeOpacity={0.8}
            >
              {logoSrc ? (
                <Image source={logoSrc} style={{ width: 48, height: 24 }} resizeMode="contain" />
              ) : (
                <View style={{ width: 48, height: 24, backgroundColor: C.surfaceHigh, borderRadius: 4 }} />
              )}
              <Text style={{ flex: 1, fontSize: 14, fontWeight: '700', color: C.text }}>{brand}</Text>
              {isActive ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#5ba4ff18', borderRadius: R.pill, paddingHorizontal: 10, paddingVertical: 4 }}>
                  <Ionicons name="shield-checkmark" size={13} color="#5ba4ff" />
                  <Text style={{ fontSize: 11, fontWeight: '700', color: '#5ba4ff' }}>오피셜</Text>
                </View>
              ) : (
                <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: C.border }} />
              )}
            </TouchableOpacity>
          );
        })
      )}
      <View style={{ height: 32 }} />
    </ScrollView>
  );
}

function GymManagerLinkView({
  gymName,
  query,
  results,
  loading,
  onSearch,
  onSelect,
  onBack,
}: {
  gymName: string;
  query: string;
  results: ProfileSearchResult[];
  loading: boolean;
  onSearch: (query: string) => void;
  onSelect: (profile: ProfileSearchResult) => void;
  onBack: () => void;
}) {
  const [draft, setDraft] = useState(query);

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      <TouchableOpacity onPress={onBack} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <Ionicons name="chevron-back" size={20} color={C.text} />
        <Text style={{ fontSize: 16, fontWeight: '800', color: C.text }}>{gymName}</Text>
      </TouchableOpacity>

      <Text style={{ fontSize: 12, fontWeight: '700', color: C.textDim, letterSpacing: 1 }}>
        이메일 또는 닉네임으로 검색
      </Text>

      <View style={styles.catSearchRow}>
        <Ionicons name="search" size={15} color={C.textDim} style={{ marginLeft: 12 }} />
        <TextInput
          value={draft}
          onChangeText={setDraft}
          onSubmitEditing={() => onSearch(draft)}
          placeholder="이메일 또는 닉네임 입력..."
          placeholderTextColor={C.textDim}
          style={styles.catSearchInput}
          autoCorrect={false}
          autoCapitalize="none"
          spellCheck={false}
          returnKeyType="search"
        />
      </View>
      <TouchableOpacity style={styles.approveBtn} onPress={() => onSearch(draft)} activeOpacity={0.85}>
        <Ionicons name="search" size={14} color={C.bg} />
        <Text style={styles.approveBtnText}>검색</Text>
      </TouchableOpacity>

      {loading ? (
        <Text style={{ fontSize: 13, color: C.textDim, paddingVertical: 20, textAlign: 'center' }}>검색 중...</Text>
      ) : results.length === 0 ? (
        query.trim().length > 0 && (
          <Text style={{ fontSize: 13, color: C.textDim, paddingVertical: 20, textAlign: 'center' }}>검색 결과가 없어요</Text>
        )
      ) : (
        results.map(profile => (
          <TouchableOpacity
            key={profile.id}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: C.surface,
              borderRadius: R.card,
              borderWidth: 1,
              borderColor: C.border,
              padding: 14,
              gap: 12,
            }}
            onPress={() => onSelect(profile)}
            activeOpacity={0.8}
          >
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 14, fontWeight: '700', color: C.text }}>{profile.nickname ?? '(닉네임 없음)'}</Text>
              <Text style={{ fontSize: 12, color: C.textSub, marginTop: 2 }}>{profile.email ?? ''}</Text>
            </View>
            <Ionicons name="link-outline" size={18} color={C.textSub} />
          </TouchableOpacity>
        ))
      )}
      <View style={{ height: 32 }} />
    </ScrollView>
  );
}

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
  const [pendingGyms,   setPendingGyms]   = useState<PendingGym[]>([]);
  const [selectedGym,  setSelectedGym]   = useState<PendingGym | null>(null);
  const [gymReports,   setGymReports]    = useState<GymInfoReport[]>([]);

  const [registeredGyms, setRegisteredGyms] = useState<AdminGym[]>([]);

  // 직접등록 헬스장 목록 로드 함수
  const loadRegisteredGyms = useCallback(async () => {
    const gyms = await fetchAdminGyms();
    setRegisteredGyms(gyms);
  }, []);
  const [gymRequests,    setGymRequests]    = useState<GymRegistrationRequest[]>([]);
  const [machineRequests, setMachineRequests] = useState<MachineRequest[]>([]);
  const [machines, setMachines] = useState<MachineWithGyms[]>(() => getMachinesCacheSync());
  const [userInquiries, setUserInquiries] = useState<UserInquiry[]>([]);

  const refreshQueues = useCallback(async () => {
    try {
      const [requests, reports, apps, gyms, mReqs, inquiries] = await Promise.all([
        fetchGymRegistrationRequests(),
        fetchGymInfoReports(),
        fetchManagerRequests(),
        fetchAdminGyms(),
        fetchMachineRequests(),
        fetchAllUserInquiries(),
      ]);
      setGymRequests(requests);
      setGymReports(reports);
      setManagerRequests(apps);
      setRegisteredGyms(gyms);
      setMachineRequests(mReqs);
      setUserInquiries(inquiries);
    } catch (e: any) {
      if (__DEV__) console.warn('[AdminDashboard] 큐 새로고침 오류:', e);
    }
  }, []);

  useEffect(() => {
    refreshQueues();
  }, [refreshQueues]);

  useEffect(() => {
    if (currentView === 'home') {
      refreshQueues();
    }
    // intentionally NOT depending on refreshQueues to avoid re-running on every
    // render; refreshQueues is stable (useCallback with empty deps)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentView]);

  useEffect(() => {
    let cancelled = false;
    fetchMachines().then(data => { if (!cancelled) setMachines(data); }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (currentView === 'register-gym') {
      loadRegisteredGyms();
    }
  }, [currentView, loadRegisteredGyms]);

  const loadGymReports = useCallback(async () => {
    const data = await fetchGymInfoReports();
    setGymReports(data);
  }, []);

  useEffect(() => {
    loadGymReports();
  }, [loadGymReports]);

  const [managerRequests,        setManagerRequests]        = useState<ManagerRequest[]>([]);
  const [managerRequestsLoading, setManagerRequestsLoading] = useState(false);

  const loadManagerRequests = useCallback(async () => {
    setManagerRequestsLoading(true);
    const data = await fetchManagerRequests();
    setManagerRequests(data);
    setManagerRequestsLoading(false);
  }, []);

  useEffect(() => {
    if (currentView === 'manager-requests') {
      loadManagerRequests();
    }
  }, [currentView, loadManagerRequests]);

  const [officialGymId,   setOfficialGymId]   = useState<string | null>(null);
  const [officialGymName, setOfficialGymName] = useState<string>('');
  const [officialBrands,  setOfficialBrands]  = useState<string[]>([]);
  const [officialLoading, setOfficialLoading] = useState(false);

  const [linkGymId,       setLinkGymId]       = useState<string | null>(null);
  const [linkGymName,     setLinkGymName]     = useState<string>('');
  const [linkQuery,       setLinkQuery]       = useState('');
  const [linkResults,     setLinkResults]     = useState<ProfileSearchResult[]>([]);
  const [linkLoading,     setLinkLoading]     = useState(false);

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

  // --- 매니저 요청을 PendingGym 형태로 변환
  const managerGymRequests: PendingGym[] = gymRequests
    .filter(r => (r.requesterRole ?? 'user') === 'manager')
    .map(r => ({
      id:          r.id,
      name:        r.gymName,
      location:    r.location + (r.addressDetail ? ' ' + r.addressDetail : ''),
      description: r.notes ?? '',
      phone:       '',
      website:     '',
      hours:       r.hours ?? '',
      managerId:   r.userId,
      managerName: r.userId,
      submittedAt: r.createdAt,
      status:      (r.status === 'pending' ? 'pending' : 'approved') as ReviewStatus,
    }));

  // --- Counts
  const pendingGymCount     = pendingGyms.filter(g => g.status === 'pending').length
                            + managerGymRequests.filter(g => g.status === 'pending').length;
  const gymReportCount      = gymReports.filter(r => r.status === 'pending').length;
  const managerRequestCount = managerRequests.filter(r => r.status === 'pending').length;
  const registeredGymCount  = registeredGyms.length;
  const gymRequestCount     = gymRequests.filter(r => r.status === 'pending' && (r.requesterRole ?? 'user') === 'user').length;
  const machineRequestCount = machineRequests.filter(r => r.status === 'pending').length;
  const userInquiryCount    = userInquiries.filter(i => i.status === 'pending').length;

  // --- Actions

  const reviewGym = useCallback((gymId: string, action: ReviewStatus) => {
    setPendingGyms(prev => prev.map(g => g.id === gymId ? { ...g, status: action } : g));
    setSelectedGym(prev => prev?.id === gymId ? { ...prev!, status: action } : prev);
  }, []);

  const handleApproveGym  = useCallback(async (id: string) => {
    // 로컬 상태 업데이트
    setPendingGyms(prev => prev.map(g => g.id === id ? { ...g, status: 'approved' as ReviewStatus } : g));

    // 승인된 헬스장 찾기 (pendingGyms + gymRequests 매니저 요청에서)
    const managerReqs: PendingGym[] = gymRequests
      .filter(r => (r.requesterRole ?? 'user') === 'manager')
      .map(r => ({
        id:          r.id,
        name:        r.gymName,
        location:    r.location + (r.addressDetail ? ' ' + r.addressDetail : ''),
        description: r.notes ?? '',
        phone:       '',
        website:     '',
        hours:       r.hours ?? '',
        managerId:   r.userId,
        managerName: r.userId,
        submittedAt: r.createdAt,
        status:      'pending' as ReviewStatus,
      }));
    const allGyms = [...pendingGyms, ...managerReqs];
    const gym = allGyms.find(g => g.id === id);
    if (!gym) return;

    try {
      const { supabase } = await import('../../lib/supabase');
      const newGymId = `g_${Date.now()}`;
      const gymRequest = gymRequests.find(r => r.id === id);
      const baseLocation  = gymRequest?.location ?? gym.location;
      const addressDetail = gymRequest?.addressDetail ?? null;
      const coords = await geocodeAddress(gym.location);
      const { error } = await supabase.from('gyms').insert({
        id:             newGymId,
        name:           gym.name,
        location:       baseLocation,
        address_detail: addressDetail,
        description:    gym.description ?? '',
        hours:          gym.hours || null,
        manager_id:     gym.managerId ?? null,
        latitude:       coords?.latitude  ?? null,
        longitude:      coords?.longitude ?? null,
      });
      if (error) {
        Alert.alert('등록 오류', '승인은 완료되었으나 헬스장 DB 등록에 실패했습니다. ' + error.message);
        return;
      }

      // gym_registration_requests 상태도 업데이트
      const { updateGymRequestStatus } = await import('../../lib/db/gymRegistrationRequests');
      await updateGymRequestStatus(id, 'reviewed');
      setGymRequests(prev => prev.map(r => r.id === id ? { ...r, status: 'reviewed' } : r));

      // 신청자 role을 manager로 업데이트
      if (gym.managerId) {
        console.log('[AdminDashboard] role 업데이트 시도 - managerId:', gym.managerId);
        const { data: updateData, error: updateError } = await supabase
          .from('profiles')
          .update({ role: 'manager' })
          .eq('id', gym.managerId)
          .select();
        console.log('[AdminDashboard] role 업데이트 결과:', updateData, updateError?.message);

        if (updateError) {
          console.warn('[AdminDashboard] role 업데이트 실패:', updateError.message);
        }
      }

      Alert.alert('승인 완료', `${gym.name}이(가) 승인되어 등록되었습니다.`);
    } catch (e: any) {
      if (__DEV__) console.warn('[AdminDashboard] 헬스장 등록 오류:', e);
    }
  }, [pendingGyms, gymRequests]);

  const handleRejectGym = useCallback(async (id: string) => {
    // 로컬 mock pendingGyms 상태 업데이트 (해당되는 경우)
    setPendingGyms(prev => prev.map(g => g.id === id ? { ...g, status: 'rejected' as ReviewStatus } : g));

    // 실제 매니저 신청(Supabase gym_registration_requests)인 경우 처리
    const isManagerRequest = gymRequests.some(r => r.id === id && (r.requesterRole ?? 'user') === 'manager');
    if (isManagerRequest) {
      try {
        await updateGymRequestStatus(id, 'resolved');
        setGymRequests(prev => prev.map(r => r.id === id ? { ...r, status: 'resolved' } : r));
      } catch (e: any) {
        if (__DEV__) console.warn('[AdminDashboard] 헬스장 거절 처리 오류:', e);
        Alert.alert('처리 오류', '거절 처리 중 문제가 발생했습니다.');
      }
    }
  }, [gymRequests]);

  const handleSelectGym = useCallback((gym: PendingGym) => {
    setSelectedGym(gym);
    push('gym-detail');
  }, [push]);

  const handleMarkReportReviewed = useCallback(async (id: string) => {
    await markReportReviewed(id);
    await loadGymReports();
  }, [loadGymReports]);

  const handleDeleteReport = useCallback(async (id: string) => {
    await deleteGymInfoReport(id);
    await loadGymReports();
  }, [loadGymReports]);

  const handleAnswerInquiry = useCallback(async (id: string, answer: string) => {
    // 낙관적 로컬 업데이트 — 답변완료 섹션으로 즉시 이동
    setUserInquiries(prev => prev.map(i =>
      i.id === id ? { ...i, status: 'answered' as const, answer, answeredAt: new Date().toISOString() } : i
    ));
    try {
      await answerUserInquiry(id, answer);
    } catch (e: any) {
      if (__DEV__) console.warn('[AdminDashboard] 문의 답변 등록 오류:', e);
      Alert.alert('처리 오류', '답변 등록 중 문제가 발생했습니다.');
    }
    // 정합성을 위한 백그라운드 재조회
    fetchAllUserInquiries().then(setUserInquiries).catch(() => {});
  }, []);

  const handleApproveApplication = useCallback(async (id: string) => {
    try {
      const { supabase } = await import('../../lib/supabase');

      // manager_requests 테이블에서 신청 정보 조회
      const { data: reqData, error: reqError } = await supabase
        .from('manager_requests')
        .select('user_id, gym_name')
        .eq('id', id)
        .single();

      if (reqError || !reqData) {
        if (__DEV__) console.warn('[AdminDashboard] 매니저 신청 정보를 찾을 수 없음:', id);
        Alert.alert('오류', '신청 정보를 불러올 수 없어요. 다시 시도해주세요.');
        return;
      }

      const { user_id, gym_name } = reqData;

      // 3. profiles.role = 'manager' 업데이트
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ role: 'manager' })
        .eq('id', user_id);

      if (profileError) {
        if (__DEV__) console.warn('[AdminDashboard] profiles role 업데이트 실패:', profileError.message);
      }

      // 4. manager_requests.status = 'approved' 업데이트
      await supabase
        .from('manager_requests')
        .update({ status: 'approved' })
        .eq('id', id);

      Alert.alert(
        '승인 완료',
        `${gym_name} 헬스장 매니저 신청이 승인됐어요.\n매니저 대시보드에서 헬스장을 직접 등록할 수 있어요.`,
      );

    } catch (e: any) {
      if (__DEV__) console.warn('[AdminDashboard] 매니저 승인 처리 오류:', e.message);
      Alert.alert('승인은 완료됐어요', 'DB 연결 중 일부 오류가 발생했어요. 수동으로 확인해주세요.');
    }
  }, []);

  const handleRegisterGym = useCallback(async (name: string, location: string, phone: string, hours: string, hoursNote: string, machineIds: string[]) => {
    const { error } = await insertAdminGym(name, location, phone, hours, hoursNote, machineIds);
    if (error) {
      Alert.alert('등록 오류', '헬스장 등록에 실패했습니다. ' + error);
      return;
    }
    await loadRegisteredGyms();
  }, [loadRegisteredGyms]);

  const openOfficialBrands = useCallback(async (gymId: string, gymName: string) => {
    setOfficialGymId(gymId);
    setOfficialGymName(gymName);
    setOfficialLoading(true);
    const brands = await fetchGymOfficialBrands(gymId);
    setOfficialBrands(brands);
    setOfficialLoading(false);
    push('gym-official-brands');
  }, [push]);

  const handleToggleOfficialBrand = useCallback(async (brand: string) => {
    if (!officialGymId) return;
    const isActive = officialBrands.includes(brand);
    if (isActive) {
      await removeGymOfficialBrand(officialGymId, brand);
      setOfficialBrands(prev => prev.filter(b => b !== brand));
    } else {
      await addGymOfficialBrand(officialGymId, brand);
      setOfficialBrands(prev => [...prev, brand]);
    }
  }, [officialGymId, officialBrands]);

  const handleUpdateGym = useCallback(async (id: string, name: string, location: string, phone: string, hours: string, hoursNote: string, machineIds: string[]) => {
    const { error } = await updateAdminGymFull(id, name, location, phone, hours, hoursNote, machineIds);
    if (error) {
      Alert.alert('수정 오류', '헬스장 수정에 실패했습니다. ' + error);
      return;
    }
    await loadRegisteredGyms();
  }, [loadRegisteredGyms]);

  const openManagerLink = useCallback((gymId: string, gymName: string) => {
    setLinkGymId(gymId);
    setLinkGymName(gymName);
    setLinkQuery('');
    setLinkResults([]);
    push('gym-manager-link');
  }, [push]);

  const handleSearchProfiles = useCallback(async (query: string) => {
    setLinkQuery(query);
    setLinkLoading(true);
    const results = await searchProfilesByEmailOrNickname(query);
    setLinkResults(results);
    setLinkLoading(false);
  }, []);

  const handleLinkManager = useCallback(async (profile: ProfileSearchResult) => {
    if (!linkGymId) return;
    const { error } = await setGymManager(linkGymId, profile.id);
    if (error) {
      Alert.alert('연결 오류', '매니저 연결에 실패했습니다. ' + error);
      return;
    }
    await loadRegisteredGyms();
    pop();
    Alert.alert('연결 완료', `${profile.nickname ?? profile.email ?? '매니저'}님이 연결되었습니다.`);
  }, [linkGymId, loadRegisteredGyms, pop]);

  const handleUnlinkManager = useCallback(async (gymId: string) => {
    const { error } = await setGymManager(gymId, null);
    if (error) {
      Alert.alert('해제 오류', '매니저 연결 해제에 실패했습니다. ' + error);
      return;
    }
    await loadRegisteredGyms();
  }, [loadRegisteredGyms]);

  const handleDeleteGym = useCallback((gymId: string, gymName: string) => {
    Alert.alert(
      '헬스장 삭제',
      `"${gymName}"을(를) 정말 삭제하시겠어요? 되돌릴 수 없습니다.`,
      [
        { text: '취소', style: 'cancel' },
        {
          text: '삭제', style: 'destructive', onPress: async () => {
            try {
              const { error } = await deleteGym(gymId);
              if (error) {
                Alert.alert('삭제 실패', error);
                return;
              }
              await loadRegisteredGyms();
              Alert.alert('삭제 완료', '헬스장이 삭제되었습니다.');
            } catch (e: any) {
              Alert.alert('삭제 실패', e?.message ?? '알 수 없는 오류가 발생했습니다.');
            }
          },
        },
      ],
    );
  }, [loadRegisteredGyms]);

  // --- View titles

  const VIEW_TITLES: Record<AdminView, string> = {
    'home':              '관리자 대시보드',
    'pending-gyms':      '헬스장 승인 대기',
    'gym-detail':        selectedGym?.name ?? '헬스장 상세',
    'machine-catalog':   '머신 카탈로그',
    'brand-copyright':   '브랜드 저작권',
    'gym-reports':       '정보 제보 관리',
    'manager-requests':  '매니저 신청 관리',
    'register-gym':               '헬스장 관리',
    'gym-registration-requests':  '헬스장 신규 등록 제안(유저)',
    'machine-requests':           '머신 등록 신청(매니저)',
    'gym-official-brands':        `${officialGymName} 오피셜 브랜드`,
    'all-gyms-official':          '헬스장 오피셜 관리',
    'user-inquiries':             '유저 문의 관리',
    'gym-manager-link':           `${linkGymName} 매니저 연결`,
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
          machines={machines}
          pendingGymCount={pendingGymCount}
          gymReportCount={gymReportCount}
          managerRequestCount={managerRequestCount}
          registeredGymCount={registeredGymCount}
          gymRequestCount={gymRequestCount}
          machineRequestCount={machineRequestCount}
          userInquiryCount={userInquiryCount}
          onPush={push}
        />
      )}
      {currentView === 'pending-gyms' && (
        <PendingGymsView
          pendingGyms={[...pendingGyms, ...managerGymRequests]}
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
      {currentView === 'machine-catalog' && (
        <MachineCatalogView
          machines={machines}
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
      {currentView === 'brand-copyright' && <BrandCopyrightView machines={machines} />}
      {currentView === 'gym-reports' && (
        <GymReportsView
          reports={gymReports}
          onMarkReviewed={handleMarkReportReviewed}
          onDelete={handleDeleteReport}
        />
      )}
      {currentView === 'manager-requests' && (
        <ManagerRequestsSupabaseView
          requests={managerRequests}
          loading={managerRequestsLoading}
          onApprove={async (id) => {
            const req = managerRequests.find(r => r.id === id);
            // 1. 매니저 승인 처리 (profiles.role 변경 + gyms 연결)
            await handleApproveApplication(id);
            // 2. 알림 발송
            if (req?.userId) {
              await sendNotification(
                req.userId,
                'manager_approved',
                '매니저 신청이 승인됐어요! 🎉',
                `${req.gymName} 헬스장의 매니저로 승인됐어요. 앱을 재시작하면 헬스장 관리 기능이 활성화돼요.`,
                req.id,
              );
              // 3. 해당 유저의 모든 신청 내역 삭제 (중복 신청 포함)
              await deleteManagerRequestsByUserId(req.userId);
            } else {
              await deleteManagerRequest(id);
            }
            await loadManagerRequests();
          }}
          onReject={async (id) => {
            const req = managerRequests.find(r => r.id === id);
            // 1. 알림 발송
            if (req?.userId) {
              await sendNotification(
                req.userId,
                'manager_rejected',
                '매니저 신청 결과 안내',
                `${req.gymName} 헬스장 매니저 신청이 반려됐어요. 자세한 문의는 고객센터를 이용해주세요.`,
                req.id,
              );
            }
            // 2. 해당 신청 내역만 삭제
            await deleteManagerRequest(id);
            await loadManagerRequests();
          }}
        />
      )}
      {currentView === 'register-gym' && (
        <RegisterGymAdminView
          machines={machines}
          registeredGyms={registeredGyms}
          onSave={handleRegisterGym}
          onUpdate={handleUpdateGym}
          onOfficialBrands={openOfficialBrands}
          onManagerLink={openManagerLink}
          onUnlinkManager={handleUnlinkManager}
          onDeleteGym={handleDeleteGym}
        />
      )}
      {currentView === 'gym-manager-link' && (
        <GymManagerLinkView
          gymName={linkGymName}
          query={linkQuery}
          results={linkResults}
          loading={linkLoading}
          onSearch={handleSearchProfiles}
          onSelect={handleLinkManager}
          onBack={pop}
        />
      )}
      {currentView === 'all-gyms-official' && (
        <AllGymsOfficialView
          onSelectGym={(gymId, gymName) => openOfficialBrands(gymId, gymName)}
          onBack={pop}
        />
      )}
      {currentView === 'gym-official-brands' && (
        <GymOfficialBrandsView
          gymName={officialGymName}
          officialBrands={officialBrands}
          loading={officialLoading}
          onToggle={handleToggleOfficialBrand}
          onBack={pop}
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
      {currentView === 'machine-requests' && (
        <MachineRequestsView
          requests={machineRequests}
          onUpdateStatus={async (id, status) => {
            await updateMachineRequestStatus(id, status);
            const updated = await fetchMachineRequests();
            setMachineRequests(updated);
          }}
          onBack={pop}
        />
      )}
      {currentView === 'user-inquiries' && (
        <UserInquiriesView
          inquiries={userInquiries}
          onAnswer={handleAnswerInquiry}
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
