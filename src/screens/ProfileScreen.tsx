import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Switch,
  Modal,
  TextInput,
  Alert,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image as ExpoImage } from 'expo-image';
import { pickAndUploadProfileImage, saveProfileImageUrl, loadProfileImageUrl } from '../lib/profileImageStorage';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { C, R, T } from '../theme';
import { screenPad, cardPadH, cardPadV } from '../theme/responsive';
import { UserRole, ManagedGym } from '../data/types';
import { useAuth } from '../context/AuthContext';
import ManagerDashboard from './manager/ManagerDashboard';
import AdminDashboard from './admin/AdminDashboard';
import FavoritesScreen from './FavoritesScreen';

import PrivacyPolicyScreen from './PrivacyPolicyScreen';
import AuthFlow from './auth/AuthFlow';
import NotificationsScreen from './NotificationsScreen';
import ManagerRequestModal from './flow/ManagerRequestModal';
import ManagerManualScreen from './manager/ManagerManualScreen';
import { fetchUnreadCount } from '../lib/db/notifications';
import { fetchGymRegistrationRequests } from '../lib/db/gymRegistrationRequests';
import { fetchGymInfoReports } from '../lib/db/gymInfoReports';
import { fetchManagerRequests } from '../lib/db/managerRequests';
import { submitUserInquiry, fetchUserInquiries, type UserInquiry } from '../lib/db/userInquiries';
import { setWorkoutGuideSeen } from '../lib/db/onboarding';
import { supabase } from '../lib/supabase';
import { getUserBadges } from '../data/badgeStore';
import WorkoutBadgeComponent from '../components/WorkoutBadge';
import WorkoutSplitSetupScreen from './flow/WorkoutSplitSetupScreen';
import TermsConsentScreen from './auth/TermsConsentScreen';
import * as Haptics from 'expo-haptics';

// --- Types

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

// --- Static mock data

const ACHIEVEMENTS = [
  { id: '1', icon: 'flame',   label: '10일 연속', earned: true  },
  { id: '2', icon: 'barbell', label: '첫 PR',      earned: true  },
  { id: '3', icon: 'trophy',  label: '50회 운동',   earned: false },
  { id: '4', icon: 'flash',   label: '스피드 리프터',  earned: false },
  { id: '5', icon: 'fitness', label: '철의 의지',     earned: true  },
  { id: '6', icon: 'medal',   label: '센추리 클럽',  earned: false },
];

const SETTINGS_LIST: { icon: IoniconName; label: string; toggle?: boolean; danger?: boolean; privacy?: boolean; splitSetup?: boolean; deleteAccount?: boolean; inquiry?: boolean }[] = [
  { icon: 'barbell-outline',        label: '단위 (kg / lbs)'                     },
  { icon: 'git-branch-outline',     label: '운동 분할 설정',   splitSetup: true  },
  { icon: 'document-text-outline',  label: '개인정보처리방침', privacy: true     },
  { icon: 'help-circle-outline',    label: '도움말 및 피드백'                     },
  { icon: 'chatbox-ellipses-outline', label: '관리자에게 문의하기', inquiry: true },
  { icon: 'log-out-outline',        label: '로그아웃',          danger: true     },
];

// --- Role palette

const ROLE_META: Record<UserRole, { label: string; color: string; bg: string; icon: IoniconName }> = {
  user:    { label: 'Member',  color: C.textSub, bg: C.surfaceHigh, icon: 'person-outline'           },
  manager: { label: 'Manager', color: C.accent,  bg: C.accentBg,   icon: 'business-outline'          },
  admin:   { label: 'Admin',   color: C.danger,  bg: C.dangerBg,   icon: 'shield-checkmark-outline'  },
};

// --- Small re-usable pieces

function SectionLabel({ text }: { text: string }) {
  return <Text style={styles.sectionLabel}>{text}</Text>;
}

function Divider() {
  return <View style={styles.divider} />;
}

function CardDivider() {
  return <View style={styles.cardDivider} />;
}

function SettingRow({
  icon, label, toggle, danger, deleteAccount, onPress,
}: { icon: IoniconName; label: string; toggle?: boolean; danger?: boolean; privacy?: boolean; splitSetup?: boolean; deleteAccount?: boolean; inquiry?: boolean; onPress?: () => void }) {
  const [on, setOn] = useState(false);
  return (
    <TouchableOpacity
      style={styles.settingRow}
      activeOpacity={0.7}
      onPress={() => {
        if (deleteAccount) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        } else if (danger) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        } else {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
        onPress?.();
      }}
    >
      <View style={[styles.settingIcon, danger && { backgroundColor: C.dangerBg }]}>
        <Ionicons name={icon} size={16} color={danger ? C.danger : C.textSub} />
      </View>
      <Text style={[styles.settingLabel, danger && { color: C.danger }]}>{label}</Text>
      {toggle
        ? <Switch
            value={on}
            onValueChange={setOn}
            thumbColor={on ? C.accent : C.textDim}
            trackColor={{ false: C.border, true: C.accentBg }}
          />
        : <Ionicons name="chevron-forward" size={15} color={C.textDim} />
      }
    </TouchableOpacity>
  );
}

function AchievementBadge({ icon, label, earned }: { icon: string; label: string; earned: boolean }) {
  return (
    <View style={[styles.badge, !earned && { opacity: 0.4 }]}>
      <View style={[styles.badgeIcon, earned && { backgroundColor: C.accent }]}>
        <Ionicons name={icon as IoniconName} size={18} color={earned ? C.bg : C.textDim} />
      </View>
      {!earned && (
        <View style={styles.badgeLock}>
          <Ionicons name="lock-closed" size={9} color={C.textDim} />
        </View>
      )}
      <Text style={[styles.badgeLabel, !earned && { color: C.textDim }]} numberOfLines={2}>
        {label}
      </Text>
    </View>
  );
}

// --- Badge collection section

function BadgeCollectionSection() {
  const badges = getUserBadges();

  return (
    <>
      <View style={styles.sectionRow}>
        <Text style={styles.sectionLabel}>획득한 뱃지</Text>
        <Text style={styles.sectionSub}>{badges.length}개</Text>
      </View>
      {badges.length === 0 ? (
        <View style={styles.badgeEmptyCard}>
          <Text style={styles.badgeEmptyText}>
            아직 획득한 뱃지가 없어요. 운동을 기록해보세요!
          </Text>
        </View>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.workoutBadgeRow}
        >
          {badges.map(badge => (
            <View key={badge.id} style={styles.workoutBadgeItem}>
              <WorkoutBadgeComponent badge={badge} size="large" />
            </View>
          ))}
        </ScrollView>
      )}
    </>
  );
}

// --- Manager section

function ManagerSection({ onOpen, gyms }: { onOpen: () => void; gyms: ManagedGym[] }) {
  const approvedGyms = gyms.filter(g => g.status === 'approved');
  const pendingGyms  = gyms.filter(g => g.status === 'pending');
  const isEmpty      = gyms.length === 0;

  return (
    <View style={styles.roleSection}>
      {/* Section header */}
      <View style={styles.roleSectionHeader}>
        <View style={styles.roleSectionHeaderLeft}>
          <View style={[styles.roleSectionIcon, { backgroundColor: C.accentBg }]}>
            <Ionicons name="business" size={18} color={C.accent} />
          </View>
          <View>
            <Text style={styles.roleSectionTitle}>헬스장 관리</Text>
            {!isEmpty && (
              <Text style={styles.roleSectionSub}>
                {gyms.length} 헬스장 등록됨
              </Text>
            )}
          </View>
        </View>
        <TouchableOpacity style={styles.openPanelBtn} onPress={onOpen} activeOpacity={0.85}>
          <Text style={styles.openPanelBtnText}>열기</Text>
          <Ionicons name="chevron-forward" size={13} color={C.bg} />
        </TouchableOpacity>
      </View>

      {isEmpty ? (
        <Text style={styles.managerEmptyText}>아직 등록한 헬스장이 없어요</Text>
      ) : (
        <>
          {/* Gym quick-status rows */}
          {gyms.map((gym, i) => (
            <React.Fragment key={gym.id}>
              {i > 0 && <CardDivider />}
              <TouchableOpacity style={styles.gymSummaryRow} onPress={onOpen} activeOpacity={0.75}>
                <View style={[
                  styles.gymSummaryDot,
                  { backgroundColor: gym.status === 'approved' ? C.accent : gym.status === 'pending' ? '#ffb547' : C.danger },
                ]} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.gymSummaryName}>{gym.name}</Text>
                  <Text style={styles.gymSummaryLoc}>{gym.location}</Text>
                </View>
                <View style={styles.gymSummaryMeta}>
                  <Text style={styles.gymSummaryMetaText}>머신 {gym.machineIds.length}개</Text>
                </View>
              </TouchableOpacity>
            </React.Fragment>
          ))}

          {/* Status summary chips */}
          <View style={styles.roleSummaryChips}>
            <View style={styles.summaryChip}>
              <View style={[styles.summaryChipDot, { backgroundColor: C.accent }]} />
              <Text style={styles.summaryChipText}>{approvedGyms.length} 운영 중</Text>
            </View>
            {pendingGyms.length > 0 && (
              <View style={styles.summaryChip}>
                <View style={[styles.summaryChipDot, { backgroundColor: '#ffb547' }]} />
                <Text style={styles.summaryChipText}>{pendingGyms.length} 검토 중</Text>
              </View>
            )}
          </View>
        </>
      )}
    </View>
  );
}

// --- Admin section

function AdminSection({ onOpen, pendingGyms, openFlags, managerRequestCount }: { onOpen: () => void; pendingGyms: number; openFlags: number; managerRequestCount: number }) {
  const queues = [
    { label: '매니저 신청 관리', count: managerRequestCount, color: '#a78bfa' },
    { label: '헬스장 등록 신청', count: pendingGyms,          color: '#ffb547' },
    { label: '정보 제보 관리',   count: openFlags,            color: C.danger  },
  ];

  return (
    <View style={[styles.roleSection, { borderColor: C.danger + '40' }]}>
      {/* Header */}
      <View style={styles.roleSectionHeader}>
        <View style={styles.roleSectionHeaderLeft}>
          <View style={[styles.roleSectionIcon, { backgroundColor: C.dangerBg }]}>
            <Ionicons name="shield-checkmark" size={18} color={C.danger} />
          </View>
          <View>
            <Text style={styles.roleSectionTitle}>관리자 패널</Text>
            <Text style={styles.roleSectionSub}>검토 큐 · 데이터 관리</Text>
          </View>
        </View>
        <TouchableOpacity style={[styles.openPanelBtn, { backgroundColor: C.danger }]} onPress={onOpen} activeOpacity={0.85}>
          <Text style={styles.openPanelBtnText}>열기</Text>
          <Ionicons name="chevron-forward" size={13} color={C.bg} />
        </TouchableOpacity>
      </View>

      <CardDivider />

      {/* Queue counts */}
      <View style={styles.adminQueues}>
        {queues.map(q => (
          <TouchableOpacity key={q.label} style={styles.adminQueueCell} onPress={onOpen} activeOpacity={0.75}>
            <Text style={[styles.adminQueueCount, { color: q.color }]}>{q.count}</Text>
            <Text style={styles.adminQueueLabel}>{q.label}</Text>
            {q.count > 0 && <View style={[styles.adminQueueDot, { backgroundColor: q.color }]} />}
          </TouchableOpacity>
        ))}
      </View>

      {/* Alert if anything pending */}
      {(managerRequestCount + pendingGyms + openFlags) > 0 && (
        <>
          <CardDivider />
          <TouchableOpacity style={styles.adminAlertRow} onPress={onOpen} activeOpacity={0.75}>
            <Ionicons name="alert-circle" size={14} color='#ffb547' />
            <Text style={styles.adminAlertText}>
              {managerRequestCount + pendingGyms + openFlags}개 항목을 확인해주세요
            </Text>
            <Ionicons name="chevron-forward" size={13} color={C.textDim} />
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}

// --- Contact-admin inquiry modal

function InquiryModal({ visible, onClose, userId }: { visible: boolean; onClose: () => void; userId: string | undefined }) {
  const [view,        setView]        = useState<'list' | 'form'>('list');
  const [inquiries,   setInquiries]   = useState<UserInquiry[]>([]);
  const [loading,      setLoading]     = useState(false);
  const [expandedId,  setExpandedId]  = useState<string | null>(null);
  const [title,       setTitle]       = useState('');
  const [content,     setContent]     = useState('');
  const [submitting,  setSubmitting]  = useState(false);

  const loadInquiries = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const data = await fetchUserInquiries(userId);
      setInquiries(data);
    } catch (e: any) {
      if (__DEV__) console.warn('[InquiryModal] 문의 내역 로딩 오류:', e);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (visible) {
      setView('list');
      setExpandedId(null);
      loadInquiries();
    }
  }, [visible, loadInquiries]);

  async function handleSubmit() {
    const t = title.trim();
    const c = content.trim();
    if (!t || !c) {
      Alert.alert('입력 오류', '제목과 내용을 모두 입력해주세요.');
      return;
    }
    if (!userId) return;
    setSubmitting(true);
    try {
      await submitUserInquiry(userId, t, c);
      setTitle('');
      setContent('');
      Alert.alert('문의 완료', '문의가 접수되었어요. 답변까지 시간이 걸릴 수 있어요.');
      setView('list');
      await loadInquiries();
    } catch (e: any) {
      Alert.alert('오류', '문의 접수 중 문제가 발생했어요. 잠시 후 다시 시도해주세요.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
        {/* 헤더 */}
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: C.border }}>
          {view === 'form' ? (
            <TouchableOpacity onPress={() => setView('list')} style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="chevron-back" size={22} color={C.text} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity onPress={onClose} style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="chevron-down" size={22} color={C.text} />
            </TouchableOpacity>
          )}
          <Text style={{ flex: 1, fontSize: 16, fontWeight: '800', color: C.text, textAlign: 'center' }}>
            {view === 'form' ? '새 문의 작성' : '관리자에게 문의하기'}
          </Text>
          {view === 'list' ? (
            <TouchableOpacity onPress={() => setView('form')} style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="add" size={24} color={C.accent} />
            </TouchableOpacity>
          ) : (
            <View style={{ width: 40 }} />
          )}
        </View>

        {view === 'list' ? (
          <ScrollView contentContainerStyle={{ padding: 20, gap: 12 }}>
            {loading && inquiries.length === 0 ? (
              <ActivityIndicator color={C.accent} style={{ marginTop: 40 }} />
            ) : inquiries.length === 0 ? (
              <View style={{ alignItems: 'center', paddingVertical: 60, gap: 10 }}>
                <Ionicons name="chatbox-ellipses-outline" size={36} color={C.textDim} />
                <Text style={{ fontSize: 14, fontWeight: '600', color: C.textSub }}>아직 문의한 내역이 없어요</Text>
              </View>
            ) : (
              inquiries.map(inq => {
                const expanded = expandedId === inq.id;
                const answered = inq.status === 'answered';
                return (
                  <TouchableOpacity
                    key={inq.id}
                    style={{ backgroundColor: C.surface, borderRadius: R.card, borderWidth: 1, borderColor: C.border, padding: 16, gap: 8 }}
                    onPress={() => setExpandedId(expanded ? null : inq.id)}
                    activeOpacity={0.8}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Text style={{ flex: 1, fontSize: 14, fontWeight: '700', color: C.text }} numberOfLines={expanded ? undefined : 1}>
                        {inq.title}
                      </Text>
                      <View style={{
                        paddingHorizontal: 8, paddingVertical: 3, borderRadius: R.pill,
                        backgroundColor: answered ? C.accentBg : C.tagMuscle.bg,
                      }}>
                        <Text style={{ fontSize: 10, fontWeight: '700', color: answered ? C.accent : C.tagMuscle.fg }}>
                          {answered ? '답변완료' : '대기중'}
                        </Text>
                      </View>
                    </View>
                    <Text style={{ fontSize: 11, color: C.textDim }}>{inq.createdAt.slice(0, 10)}</Text>

                    {expanded && (
                      <View style={{ marginTop: 4, gap: 10 }}>
                        <View style={{ height: 1, backgroundColor: C.border }} />
                        <Text style={{ fontSize: 13, color: C.textSub, lineHeight: 18 }}>{inq.content}</Text>
                        <View style={{ backgroundColor: C.surfaceHigh, borderRadius: R.inner, padding: 12, gap: 4 }}>
                          <Text style={{ fontSize: 11, fontWeight: '700', color: C.textDim }}>관리자 답변</Text>
                          {answered ? (
                            <Text style={{ fontSize: 13, color: C.text, lineHeight: 18 }}>{inq.answer}</Text>
                          ) : (
                            <Text style={{ fontSize: 13, color: C.textDim }}>아직 답변이 등록되지 않았어요</Text>
                          )}
                        </View>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })
            )}
            <View style={{ height: 24 }} />
          </ScrollView>
        ) : (
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
            <ScrollView contentContainerStyle={{ padding: 20, gap: 14 }} keyboardShouldPersistTaps="handled">
              <View>
                <Text style={{ fontSize: 12, fontWeight: '700', color: C.textDim, marginBottom: 6 }}>제목</Text>
                <TextInput
                  value={title}
                  onChangeText={setTitle}
                  placeholder="문의 제목을 입력해주세요"
                  placeholderTextColor={C.textDim}
                  style={{ backgroundColor: C.surface, borderRadius: R.inner, borderWidth: 1, borderColor: C.border, color: C.text, fontSize: 14, paddingHorizontal: 12, paddingVertical: 11 }}
                />
              </View>
              <View>
                <Text style={{ fontSize: 12, fontWeight: '700', color: C.textDim, marginBottom: 6 }}>내용</Text>
                <TextInput
                  value={content}
                  onChangeText={setContent}
                  placeholder="문의하실 내용을 자세히 적어주세요"
                  placeholderTextColor={C.textDim}
                  multiline
                  textAlignVertical="top"
                  style={{ backgroundColor: C.surface, borderRadius: R.inner, borderWidth: 1, borderColor: C.border, color: C.text, fontSize: 14, paddingHorizontal: 12, paddingVertical: 11, minHeight: 140 }}
                />
              </View>
              <TouchableOpacity
                style={{ backgroundColor: C.accent, borderRadius: R.btn, paddingVertical: 14, alignItems: 'center', opacity: submitting ? 0.6 : 1 }}
                onPress={handleSubmit}
                disabled={submitting}
                activeOpacity={0.85}
              >
                <Text style={{ fontSize: 14, fontWeight: '800', color: C.bg }}>
                  {submitting ? '접수 중...' : '문의 제출'}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </KeyboardAvoidingView>
        )}
      </SafeAreaView>
    </Modal>
  );
}

// --- Main screen

export default function ProfileScreen() {
  const nav = useNavigation<any>();
  const { user, signOut, updateNickname, updateProfileImage, updateWeightUnit, signInGoogle, signInApple } = useAuth();

  function handleSettingPress(label: string) {
    if (label === '단위 (kg / lbs)') {
      const current = user?.weightUnit ?? 'kg';
      const next = current === 'kg' ? 'lbs' : 'kg';
      Alert.alert(
        '단위 설정',
        `현재: ${current}\n${next}로 변경하시겠어요?`,
        [
          { text: '취소', style: 'cancel' },
          { text: '변경', onPress: () => updateWeightUnit(next) },
        ]
      );
      return;
    }
  }
  async function handleGuestGoogleSignIn() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const { error } = await signInGoogle();
    if (error) Alert.alert('로그인 실패', error);
  }

  async function handleGuestAppleSignIn() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const { error } = await signInApple();
    if (error && error !== 'Apple 로그인이 취소되었습니다.') {
      Alert.alert('로그인 실패', error);
    }
  }

  const [showHelpModal,     setShowHelpModal]     = useState(false);
  const [showInquiryModal,  setShowInquiryModal]  = useState(false);
  const [showManagerManual, setShowManagerManual] = useState(false);
  const [resetLoading,      setResetLoading]      = useState<'app' | 'workout' | null>(null);
  const [showFeedbackSheet, setShowFeedbackSheet] = useState(false);
  const [feedbackText,      setFeedbackText]      = useState('');
  const [feedbackLoading,   setFeedbackLoading]   = useState(false);
  const [showManager,       setShowManager]       = useState(false);
  const [showAdmin,         setShowAdmin]         = useState(false);
  const [showFavorites,     setShowFavorites]     = useState(false);
  const [showPrivacy,       setShowPrivacy]       = useState(false);
  const [showSplitSetup,    setShowSplitSetup]    = useState(false);
  const [showTermsConsent,  setShowTermsConsent]  = useState(false);
  const [showingAuth,       setShowingAuth]       = useState(false);
  const [authPage,          setAuthPage]          = useState<'signin' | 'signup'>('signin');
  const [showNotifications, setShowNotifications] = useState(false);
  const [showManagerReq,    setShowManagerReq]    = useState(false);
  const [profileStats,      setProfileStats]      = useState({ workoutCount: 0, prCount: 0, streak: 0, volume: 0 });
  const [splitConfig,       setSplitConfig]       = useState<any>(null);
  const [splitConfigLoaded, setSplitConfigLoaded] = useState(false);
  const [showNicknameEdit,  setShowNicknameEdit]  = useState(false);
  const [nicknameInput,     setNicknameInput]     = useState('');
  const [unreadCount,       setUnreadCount]       = useState(0);
  const [uploading,         setUploading]         = useState(false);
  const [managerGyms,       setManagerGyms]       = useState<ManagedGym[]>([]);
  const [adminGymCount,     setAdminGymCount]     = useState(0);
  const [adminFlagCount,    setAdminFlagCount]    = useState(0);
  const [adminManagerReqCount, setAdminManagerReqCount] = useState(0);

  // 매니저 헬스장 목록 로딩 (Supabase + Mock 합치기)
  useEffect(() => {
    if (!user?.id || user.role !== 'manager') return;

    async function loadGyms() {
      try {
        const { supabase } = await import('../lib/supabase');
        const { data, error } = await supabase
          .from('gyms')
          .select('*, gym_machines(machine_id)')
          .eq('manager_id', user!.id);

        if (error || !data || data.length === 0) {
          setManagerGyms([]);
          return;
        }

        const supabaseGyms: ManagedGym[] = data.map((g: any) => ({
          id:          g.id,
          name:        g.name,
          location:    g.location,
          description: g.description ?? '',
          phone:       g.phone ?? '',
          website:     g.website ?? '',
          hours:       g.hours ?? '',
          managerId:   g.manager_id,
          machineIds:  (g.gym_machines ?? []).map((gm: any) => gm.machine_id),
          status:      'approved' as const,
          submittedAt: g.created_at?.slice(0, 10) ?? '',
          photoCount:  0,
        }));

        setManagerGyms(supabaseGyms);
      } catch (e: any) {
        console.warn('[ProfileScreen] 헬스장 로딩 오류:', e.message);
        setManagerGyms([]);
      }
    }

    loadGyms();
  }, [user?.id, user?.role]);

  const loadUnreadCount = useCallback(async () => {
    if (!user?.id) return;
    const count = await fetchUnreadCount(user.id);
    setUnreadCount(count);
  }, [user?.id]);

  useEffect(() => { loadUnreadCount(); }, [loadUnreadCount]);

  // 관리자 패널 큐 카운트 — AdminDashboard.tsx와 동일한 실데이터/필터 기준 사용
  const loadAdminCounts = useCallback(async () => {
    if (user?.role !== 'admin') return;
    try {
      const [requests, reports, managerRequests] = await Promise.all([
        fetchGymRegistrationRequests(),
        fetchGymInfoReports(),
        fetchManagerRequests(),
      ]);
      setAdminGymCount(
        requests.filter(r => r.status === 'pending' && (r.requesterRole ?? 'user') === 'manager').length
      );
      setAdminFlagCount(reports.filter(r => r.status === 'pending').length);
      setAdminManagerReqCount(managerRequests.filter(r => r.status === 'pending').length);
    } catch (e: any) {
      if (__DEV__) console.warn('[ProfileScreen] 관리자 패널 카운트 로딩 오류:', e);
    }
  }, [user?.role]);

  useFocusEffect(useCallback(() => { loadAdminCounts(); }, [loadAdminCounts]));

  useEffect(() => {
    if (!user?.id) return;
    const loadStats = async () => {
      try {
        const { fetchWorkoutLogs } = await import('../lib/db');
        const logs = await fetchWorkoutLogs(user.id);
        if (!logs?.length) return;
        const workoutCount = logs.length;
        const volume = logs.reduce((acc, log) => {
          return acc + log.machines.reduce((a, m) => a + (m.weight ?? 0) * (m.reps ?? 0) * (m.sets ?? 1), 0);
        }, 0) / 1000;
        // 최장 연속 기록 (전체 히스토리 중 가장 긴 연속 일수)
        const uniqueDates = [...new Set(logs.map(l => l.date.slice(0, 10)))]
          .sort(); // 오래된 날짜부터 오름차순
        let maxStreak     = uniqueDates.length > 0 ? 1 : 0;
        let currentStreak = uniqueDates.length > 0 ? 1 : 0;
        for (let i = 1; i < uniqueDates.length; i++) {
          const prev = new Date(uniqueDates[i - 1]);
          prev.setDate(prev.getDate() + 1);
          if (uniqueDates[i] === prev.toISOString().slice(0, 10)) {
            currentStreak++;
            if (currentStreak > maxStreak) maxStreak = currentStreak;
          } else {
            currentStreak = 1;
          }
        }
        const streak = maxStreak;
        // PR 횟수: 이전 기록이 있는 상태에서 최고 중량 갱신 시만 카운트 (처음 사용 제외)
        const machineMaxMap: Record<string, number> = {};
        let prCount = 0;
        const sortedLogs = [...logs].sort((a, b) =>
          new Date(a.date).getTime() - new Date(b.date).getTime()
        );
        sortedLogs.forEach(log => {
          log.machines.forEach(m => {
            const key  = m.machineId ?? m.machineName;
            const prev = machineMaxMap[key];
            const cur  = m.weight ?? 0;
            if (cur > 0) {
              if (prev !== undefined && cur > prev) {
                prCount++;
              }
              if (prev === undefined || cur > prev) {
                machineMaxMap[key] = cur;
              }
            }
          });
        });
        setProfileStats({ workoutCount, prCount, streak, volume: Math.round(volume * 10) / 10 });
      } catch (e) {
        if (__DEV__) console.warn('[ProfileScreen] stats load error:', e);
      }
    };
    loadStats();
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    const loadSplit = async () => {
      try {
        const { fetchSplitConfig } = await import('../lib/db/splitRoutine');
        const config = await fetchSplitConfig(user.id);
        setSplitConfig(config);
      } catch (e) {
        setSplitConfig(null);
      } finally {
        setSplitConfigLoaded(true);
      }
    };
    loadSplit();
  }, [user?.id]);

  useEffect(() => {
    if (!user) return;
    loadProfileImageUrl(user.id).then(url => {
      if (url && url !== user.profileImageUrl) {
        updateProfileImage(url);
      }
    });
  }, [user?.id]);

  async function handlePickProfileImage() {
    if (!user || uploading) return;
    setUploading(true);
    try {
      const url = await pickAndUploadProfileImage(user.id);
      if (url) {
        await saveProfileImageUrl(user.id, url);
        updateProfileImage(url);
      }
    } finally {
      setUploading(false);
    }
  }

  async function handleDeleteAccount() {
    Alert.alert(
      '계정 삭제',
      '계정을 삭제하면 운동 기록, 오운완 사진, 머신 리뷰, 즐겨찾기 등 모든 데이터가 영구적으로 삭제되며 복구할 수 없어요. 정말 삭제하시겠어요?',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '삭제',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              '마지막 확인',
              '모든 데이터가 완전히 삭제됩니다. 이 작업은 절대 되돌릴 수 없어요.',
              [
                { text: '취소', style: 'cancel' },
                {
                  text: '영구 삭제',
                  style: 'destructive',
                  onPress: async () => {
                    try {
                      const { deleteAccount } = await import('../lib/supabase');
                      const { error } = await deleteAccount();
                      if (error) {
                        Alert.alert('오류', error);
                      }
                      // 성공 시 deleteAccount() 내부에서 signOut 처리됨
                    } catch (e) {
                      Alert.alert('오류', '계정 삭제 중 문제가 발생했어요. 잠시 후 다시 시도해주세요.');
                    }
                  },
                },
              ]
            );
          },
        },
      ]
    );
  }

  async function handleResetAppOnboarding() {
    setResetLoading('app');
    try {
      const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
      await AsyncStorage.removeItem('onboarding_completed');
      Alert.alert('초기화 완료', '앱 온보딩이 초기화됐어요.\n앱을 재시작하면 다시 볼 수 있어요.');
    } catch {
      Alert.alert('오류', '초기화에 실패했어요. 다시 시도해주세요.');
    }
    setResetLoading(null);
  }

  async function handleResetWorkoutGuide() {
    if (!user) return;
    setResetLoading('workout');
    try {
      await setWorkoutGuideSeen(user.id, false);
      Alert.alert('초기화 완료', '운동일지 가이드가 초기화됐어요.\n다음 운동일지 작성 시 다시 볼 수 있어요.');
    } catch {
      Alert.alert('오류', '초기화에 실패했어요. 다시 시도해주세요.');
    }
    setResetLoading(null);
  }

  async function handleSubmitFeedback() {
    const trimmed = feedbackText.trim();
    if (!trimmed) {
      Alert.alert('내용을 입력해주세요', '의견을 작성한 후 제출해주세요.');
      return;
    }
    if (trimmed.length < 5) {
      Alert.alert('내용이 너무 짧아요', '조금 더 자세히 작성해주세요.');
      return;
    }
    setFeedbackLoading(true);
    try {
      const { error } = await supabase.from('feedbacks').insert({
        user_id: user?.id ?? null,
        content: trimmed,
      });
      if (error) throw error;
      setFeedbackText('');
      setShowFeedbackSheet(false);
      Alert.alert('감사해요! 🙏', '소중한 의견이 전달됐어요.\n더 나은 짐픽을 만드는 데 활용할게요.');
    } catch {
      Alert.alert('오류', '제출에 실패했어요. 잠시 후 다시 시도해주세요.');
    }
    setFeedbackLoading(false);
  }

  // Guest profile view — keep showing AuthFlow until onComplete is called
  if (showingAuth) {
    return (
      <AuthFlow
        initialPage={authPage}
        onComplete={() => setShowingAuth(false)}
      />
    );
  }

  if (!user) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar barStyle="light-content" backgroundColor={C.bg} />
        <View style={styles.guestContainer}>
          <View style={styles.guestIconRing}>
            <Ionicons name="barbell" size={36} color={C.accent} />
          </View>
          <Text style={styles.guestTitle}>GymPick에 오신 걸 환영해요</Text>
          <Text style={styles.guestDesc}>
            로그인하고 운동을 기록하고, 개인 기록을 추적하고, 즐겨찾기를 저장하세요.
          </Text>
          <TouchableOpacity
            style={styles.guestSignInBtn}
            activeOpacity={0.85}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setAuthPage('signin'); setShowingAuth(true); }}
          >
            <Text style={styles.guestSignInTxt}>이메일로 로그인</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.guestCreateBtn}
            activeOpacity={0.85}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setAuthPage('signup'); setShowingAuth(true); }}
          >
            <Text style={styles.guestCreateTxt}>회원가입</Text>
          </TouchableOpacity>

          {/* 구분선 */}
          <View style={styles.guestDividerRow}>
            <View style={styles.guestDividerLine} />
            <Text style={styles.guestDividerText}>또는</Text>
            <View style={styles.guestDividerLine} />
          </View>

          {/* 구글 로그인 */}
          <TouchableOpacity
            style={styles.guestSocialBtn}
            activeOpacity={0.85}
            onPress={handleGuestGoogleSignIn}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
              <Text style={{ fontSize: 16, fontWeight: '900', color: '#4285F4' }}>G</Text>
              <Text style={{ fontSize: 15, fontWeight: '700', color: C.text }}>Google로 계속하기</Text>
            </View>
          </TouchableOpacity>

          {/* 애플 로그인 (iOS만) */}
          {Platform.OS === 'ios' && (
            <AppleAuthentication.AppleAuthenticationButton
              buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
              buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
              cornerRadius={12}
              style={styles.guestAppleBtn}
              onPress={handleGuestAppleSignIn}
            />
          )}

          <Text style={styles.guestFooter}>
            로그인 없이 헬스장과 머신을 탐색하세요.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const roleMeta = ROLE_META[user.role];

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        {/* ── Hero ── */}
        <View style={styles.hero}>
          {/* Notification bell — top right of hero */}
          <TouchableOpacity
            style={styles.bellBtn}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setShowNotifications(true); }}
            activeOpacity={0.7}
          >
            <Ionicons name="notifications-outline" size={22} color={C.textSub} />
            {unreadCount > 0 && (
              <View style={styles.bellBadge}>
                <Text style={styles.bellBadgeText}>
                  {unreadCount > 9 ? '9+' : String(unreadCount)}
                </Text>
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.avatarWrap}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); handlePickProfileImage(); }}
            activeOpacity={0.8}
            disabled={uploading}
          >
            {user.profileImageUrl ? (
              <ExpoImage
                source={{ uri: user.profileImageUrl }}
                style={styles.avatarImage}
                contentFit="cover"
              />
            ) : (
              <View style={styles.avatarEmpty} />
            )}
            <View style={styles.avatarEditBadge}>
              {uploading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Ionicons name="camera" size={12} color="#FFFFFF" />
              )}
            </View>
          </TouchableOpacity>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <View style={[styles.rolePip, { backgroundColor: roleMeta.bg, borderColor: roleMeta.color + '80' }]}>
              <Ionicons name={roleMeta.icon} size={9} color={roleMeta.color} />
              <Text style={[styles.rolePipText, { color: roleMeta.color }]}>{roleMeta.label}</Text>
            </View>
            <Text style={styles.userName}>{user.nickname ?? user.name}</Text>
            <TouchableOpacity
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setNicknameInput(user.nickname ?? user.name ?? ''); setShowNicknameEdit(true); }}
              activeOpacity={0.7}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="pencil-outline" size={16} color={C.textSub} />
            </TouchableOpacity>
          </View>
          <Text style={styles.userEmail}>{user.email}</Text>
        </View>

        {/* ── Role-specific panel (manager / admin) ── */}
        {user.role === 'manager' && (
          <>
            <SectionLabel text="헬스장 관리" />
            <ManagerSection onOpen={() => setShowManager(true)} gyms={managerGyms} />
            <View style={{ height: 28 }} />
          </>
        )}

        {user.role === 'admin' && (
          <>
            <SectionLabel text="관리자" />
            <AdminSection onOpen={() => setShowAdmin(true)} pendingGyms={adminGymCount} openFlags={adminFlagCount} managerRequestCount={adminManagerReqCount} />
            <View style={{ height: 28 }} />
          </>
        )}

        {/* ── Split setup banner (미설정 유저) ── */}
        {splitConfigLoaded && (
          !splitConfig ||
          (Array.isArray(splitConfig?.workoutSplit) && splitConfig.workoutSplit.length === 0)
        ) && (
          <TouchableOpacity
            style={styles.splitSetupBanner}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setShowSplitSetup(true); }}
            activeOpacity={0.85}
          >
            <Ionicons name="git-branch-outline" size={20} color={C.accent} />
            <View style={{ flex: 1 }}>
              <Text style={styles.splitSetupBannerTitle}>운동 분할을 설정해볼까요?</Text>
              <Text style={styles.splitSetupBannerSub}>오늘 운동 부위를 자동으로 추천해드려요</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={C.textDim} />
          </TouchableOpacity>
        )}

        {/* ── Personal stats ── */}
        <SectionLabel text="내 통계" />
        <View style={styles.statsGrid}>
          {[
            { label: '운동 횟수', value: String(profileStats.workoutCount) },
            { label: 'PR 횟수',  value: String(profileStats.prCount)      },
            { label: '연속 기록', value: `${profileStats.streak}d`         },
            { label: '볼륨',     value: `${profileStats.volume}t`          },
          ].map((s, i, arr) => (
            <React.Fragment key={s.label}>
              <View style={styles.statCell}>
                <Text style={styles.statValue}>{s.value}</Text>
                <Text style={styles.statLabel}>{s.label}</Text>
              </View>
              {i < arr.length - 1 && <View style={styles.statDivider} />}
            </React.Fragment>
          ))}
        </View>

        {/* ── My Library ── */}
        <SectionLabel text="내 라이브러리" />
        <View style={styles.card}>
          <TouchableOpacity style={styles.navRow} activeOpacity={0.75} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setShowFavorites(true); }}>
            <View style={styles.settingIcon}>
              <Ionicons name="bookmark-outline" size={16} color={C.textSub} />
            </View>
            <Text style={styles.settingLabel}>즐겨찾기</Text>
            <Ionicons name="chevron-forward" size={15} color={C.textDim} />
          </TouchableOpacity>
        </View>

        {/* ── Settings ── */}
        <SectionLabel text="설정" />
        <View style={styles.card}>
          {SETTINGS_LIST.map((s, i) => (
            <React.Fragment key={s.label}>
              <SettingRow
                {...s}
                label={
                  s.label === '단위 (kg / lbs)'
                    ? `단위 (${user?.weightUnit ?? 'kg'})`
                    : s.label
                }
                onPress={
                  s.label === '로그아웃' ? signOut
                  : s.privacy ? () => setShowPrivacy(true)
                  : s.deleteAccount ? () => handleDeleteAccount()
                  : s.splitSetup ? async () => {
                    // Supabase DB로 약관 동의 여부 확인 (AsyncStorage 대신)
                    const { supabase } = await import('../lib/supabase');
                    const { data: profile } = await supabase
                      .from('profiles')
                      .select('terms_agreed_at')
                      .eq('id', user.id)
                      .single();

                    if (!profile?.terms_agreed_at) {
                      // 약관 미동의 → TermsConsentScreen 직접 표시
                      setShowTermsConsent(true);
                      return;
                    }
                    // 약관 동의 완료 → 운동 분할 설정 화면
                    setShowSplitSetup(true);
                  }
                  : s.label === '단위 (kg / lbs)' ? () => handleSettingPress(s.label)
                  : s.label === '도움말 및 피드백' ? () => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setShowHelpModal(true); }
                  : s.inquiry ? () => setShowInquiryModal(true)
                  : undefined
                }
              />
              {i < SETTINGS_LIST.length - 1 && <Divider />}
            </React.Fragment>
          ))}
        </View>

        {/* ── Manager request CTA (user role only) — 하단 이동 ── */}
        {user.role === 'user' && (
          <>
            <SectionLabel text="헬스장 운영자이신가요?" />
            <TouchableOpacity
              style={styles.managerRequestCard}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setShowManagerReq(true); }}
              activeOpacity={0.85}
            >
              <View style={styles.managerRequestIcon}>
                <Ionicons name="business-outline" size={20} color={C.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.managerRequestTitle}>헬스장 매니저 신청</Text>
                <Text style={styles.managerRequestSub}>헬스장을 GymPick에 등록하고 관리하세요</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={C.textDim} />
            </TouchableOpacity>
            <View style={{ height: 28 }} />
          </>
        )}

        <Text style={styles.version}>GymPick v1.0.0</Text>
      </ScrollView>

      {/* ── Modals ── */}
      <Modal visible={showFavorites} animationType="slide" onRequestClose={() => setShowFavorites(false)}>
        <FavoritesScreen onClose={() => setShowFavorites(false)} />
      </Modal>
      <Modal visible={showManager} animationType="slide" onRequestClose={() => setShowManager(false)}>
        <ManagerDashboard onClose={() => setShowManager(false)} />
      </Modal>
      <Modal visible={showAdmin} animationType="slide" onRequestClose={() => setShowAdmin(false)}>
        <AdminDashboard onClose={() => setShowAdmin(false)} />
      </Modal>
      <Modal visible={showManagerManual} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowManagerManual(false)}>
        <ManagerManualScreen onClose={() => setShowManagerManual(false)} />
      </Modal>
      <Modal visible={showPrivacy} animationType="slide" onRequestClose={() => setShowPrivacy(false)}>
        <PrivacyPolicyScreen onClose={() => setShowPrivacy(false)} />
      </Modal>
      <Modal
        visible={showNotifications}
        animationType="slide"
        onRequestClose={() => { setShowNotifications(false); loadUnreadCount(); }}
      >
        <NotificationsScreen
          onClose={() => { setShowNotifications(false); loadUnreadCount(); }}
        />
      </Modal>
      <ManagerRequestModal
        visible={showManagerReq}
        userId={user.id}
        onClose={() => setShowManagerReq(false)}
      />

      {/* 운동 분할 설정 모달 */}
      <Modal
        visible={showSplitSetup}
        animationType="slide"
        onRequestClose={() => setShowSplitSetup(false)}
      >
        <WorkoutSplitSetupScreen
          userId={user.id}
          onComplete={() => setShowSplitSetup(false)}
        />
      </Modal>

      {/* 약관 동의 모달 (분할 설정 진입 전) */}
      <Modal
        visible={showTermsConsent}
        animationType="slide"
        onRequestClose={() => setShowTermsConsent(false)}
      >
        <TermsConsentScreen
          onComplete={async (marketingAgreed) => {
            const { supabase } = await import('../lib/supabase');
            await supabase.from('profiles').update({
              terms_agreed_at:  new Date().toISOString(),
              location_agreed:  true,
              marketing_agreed: marketingAgreed,
            }).eq('id', user.id);
            setShowTermsConsent(false);
            setShowSplitSetup(true);
          }}
        />
      </Modal>

      {/* ── 도움말 및 피드백 모달 ── */}
      <Modal visible={showHelpModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowHelpModal(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
          {/* 헤더 */}
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: C.border }}>
            <TouchableOpacity onPress={() => setShowHelpModal(false)} style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="chevron-down" size={22} color={C.text} />
            </TouchableOpacity>
            <Text style={{ flex: 1, fontSize: 16, fontWeight: '800', color: C.text, textAlign: 'center' }}>도움말 및 피드백</Text>
            <View style={{ width: 40 }} />
          </View>

          <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>

            {/* 가이드 다시 보기 섹션 */}
            <Text style={{ fontSize: 12, fontWeight: '700', color: C.textDim, letterSpacing: 1, marginBottom: 4 }}>가이드 다시 보기</Text>

            {/* 앱 온보딩 */}
            <View style={{ backgroundColor: C.surface, borderRadius: R.card, borderWidth: 1, borderColor: C.border, padding: 16, gap: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={{ width: 38, height: 38, borderRadius: 10, backgroundColor: C.accentBg, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="phone-portrait-outline" size={18} color={C.accent} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: C.text }}>앱 소개 온보딩</Text>
                  <Text style={{ fontSize: 12, color: C.textSub, marginTop: 2 }}>짐픽 앱 소개 슬라이드를 다시 볼 수 있어요</Text>
                </View>
              </View>
              <TouchableOpacity
                style={{ backgroundColor: C.accent, borderRadius: R.btn, paddingVertical: 12, alignItems: 'center', opacity: resetLoading === 'app' ? 0.6 : 1 }}
                onPress={handleResetAppOnboarding}
                disabled={resetLoading !== null}
                activeOpacity={0.85}
              >
                <Text style={{ fontSize: 14, fontWeight: '800', color: C.bg }}>
                  {resetLoading === 'app' ? '초기화 중...' : '앱 재시작 시 다시 보기'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* 운동일지 가이드 */}
            {user && (
              <View style={{ backgroundColor: C.surface, borderRadius: R.card, borderWidth: 1, borderColor: C.border, padding: 16, gap: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <View style={{ width: 38, height: 38, borderRadius: 10, backgroundColor: '#5ba4ff18', alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="barbell-outline" size={18} color="#5ba4ff" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: C.text }}>운동일지 작성 가이드</Text>
                    <Text style={{ fontSize: 12, color: C.textSub, marginTop: 2 }}>운동일지 작성 단계별 툴팁을 다시 볼 수 있어요</Text>
                  </View>
                </View>
                <TouchableOpacity
                  style={{ backgroundColor: '#5ba4ff', borderRadius: R.btn, paddingVertical: 12, alignItems: 'center', opacity: resetLoading === 'workout' ? 0.6 : 1 }}
                  onPress={handleResetWorkoutGuide}
                  disabled={resetLoading !== null}
                  activeOpacity={0.85}
                >
                  <Text style={{ fontSize: 14, fontWeight: '800', color: '#fff' }}>
                    {resetLoading === 'workout' ? '초기화 중...' : '다음 운동일지 작성 시 다시 보기'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {/* 매니저 운영 가이드 (매니저만) */}
            {user?.role === 'manager' && (
              <View style={{ backgroundColor: C.surface, borderRadius: R.card, borderWidth: 1, borderColor: C.border, padding: 16, gap: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <View style={{ width: 38, height: 38, borderRadius: 10, backgroundColor: C.accentBg, alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="business-outline" size={18} color={C.accent} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: C.text }}>헬스장 운영 가이드</Text>
                    <Text style={{ fontSize: 12, color: C.textSub, marginTop: 2 }}>헬스장 등록·머신 관리 매뉴얼을 다시 볼 수 있어요</Text>
                  </View>
                </View>
                <TouchableOpacity
                  style={{ backgroundColor: C.accent, borderRadius: R.btn, paddingVertical: 12, alignItems: 'center' }}
                  onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setShowManagerManual(true); }}
                  activeOpacity={0.85}
                >
                  <Text style={{ fontSize: 14, fontWeight: '800', color: C.bg }}>가이드 보기</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* 피드백 섹션 */}
            <Text style={{ fontSize: 12, fontWeight: '700', color: C.textDim, letterSpacing: 1, marginTop: 8, marginBottom: 4 }}>피드백</Text>
            <View style={{ backgroundColor: C.surface, borderRadius: R.card, borderWidth: 1, borderColor: C.border, overflow: 'hidden' }}>
              <TouchableOpacity
                style={{ flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 }}
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setShowFeedbackSheet(true); }}
                activeOpacity={0.8}
              >
                <Ionicons name="chatbubble-outline" size={18} color={C.textSub} />
                <Text style={{ flex: 1, fontSize: 14, fontWeight: '600', color: C.text }}>의견 보내기</Text>
                <Ionicons name="chevron-forward" size={16} color={C.textDim} />
              </TouchableOpacity>
            </View>

            {/* 계정 섹션 */}
            {user && (
              <>
                <Text style={{ fontSize: 12, fontWeight: '700', color: C.textDim, letterSpacing: 1, marginTop: 20, marginBottom: 4 }}>계정</Text>
                <View style={{ backgroundColor: C.surface, borderRadius: R.card, borderWidth: 1, borderColor: C.border, overflow: 'hidden' }}>
                  <TouchableOpacity
                    style={{ flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 }}
                    onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy); handleDeleteAccount(); }}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="trash-outline" size={18} color="#ff5a5a" />
                    <Text style={{ flex: 1, fontSize: 14, fontWeight: '600', color: '#ff5a5a' }}>계정 삭제</Text>
                    <Ionicons name="chevron-forward" size={16} color={C.textDim} />
                  </TouchableOpacity>
                </View>
              </>
            )}

            <View style={{ height: 32 }} />
          </ScrollView>

          {/* ── 의견 보내기 시트 (도움말 모달 내부) ── */}
          <Modal
            visible={showFeedbackSheet}
            animationType="slide"
            presentationStyle="pageSheet"
            onRequestClose={() => { setShowFeedbackSheet(false); setFeedbackText(''); }}
          >
            <KeyboardAvoidingView
              style={{ flex: 1, backgroundColor: C.bg }}
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            >
              <SafeAreaView style={{ flex: 1 }}>
                {/* 헤더 */}
                <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: C.border }}>
                  <TouchableOpacity
                    onPress={() => { setShowFeedbackSheet(false); setFeedbackText(''); }}
                    style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}
                  >
                    <Ionicons name="chevron-down" size={22} color={C.text} />
                  </TouchableOpacity>
                  <Text style={{ flex: 1, fontSize: 16, fontWeight: '800', color: C.text, textAlign: 'center' }}>의견 보내기</Text>
                  <View style={{ width: 40 }} />
                </View>

                <ScrollView
                  contentContainerStyle={{ padding: 20, gap: 16 }}
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator={false}
                >
                  {/* 안내 */}
                  <View style={{ backgroundColor: C.accentBg, borderRadius: R.inner, padding: 14, flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
                    <Ionicons name="sparkles" size={16} color={C.accent} style={{ marginTop: 1 }} />
                    <Text style={{ flex: 1, fontSize: 13, color: C.accent, lineHeight: 20 }}>
                      짐픽을 더 좋게 만들 수 있는 의견을 자유롭게 남겨주세요. 버그 제보, 기능 제안, 불편한 점 모두 환영해요!
                    </Text>
                  </View>

                  {/* 입력칸 */}
                  <View style={{ backgroundColor: C.surface, borderRadius: R.card, borderWidth: 1, borderColor: C.border, padding: 14 }}>
                    <TextInput
                      value={feedbackText}
                      onChangeText={setFeedbackText}
                      placeholder="의견을 자유롭게 작성해주세요..."
                      placeholderTextColor={C.textDim}
                      multiline
                      numberOfLines={8}
                      maxLength={500}
                      style={{ fontSize: 14, color: C.text, lineHeight: 22, minHeight: 160, textAlignVertical: 'top' }}
                      autoFocus
                    />
                    <Text style={{ fontSize: 11, color: C.textDim, textAlign: 'right', marginTop: 8 }}>
                      {feedbackText.length} / 500
                    </Text>
                  </View>

                  {/* 제출 버튼 */}
                  <TouchableOpacity
                    style={{
                      backgroundColor: feedbackText.trim().length >= 5 ? C.accent : C.border,
                      borderRadius: R.btn,
                      paddingVertical: 16,
                      alignItems: 'center',
                      opacity: feedbackLoading ? 0.6 : 1,
                    }}
                    onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); handleSubmitFeedback(); }}
                    disabled={feedbackLoading || feedbackText.trim().length < 5}
                    activeOpacity={0.85}
                  >
                    <Text style={{ fontSize: 15, fontWeight: '800', color: feedbackText.trim().length >= 5 ? C.bg : C.textDim }}>
                      {feedbackLoading ? '제출 중...' : '의견 보내기'}
                    </Text>
                  </TouchableOpacity>

                  <View style={{ height: 32 }} />
                </ScrollView>
              </SafeAreaView>
            </KeyboardAvoidingView>
          </Modal>

        </SafeAreaView>
      </Modal>

      {/* ── 관리자에게 문의하기 모달 ── */}
      <InquiryModal visible={showInquiryModal} onClose={() => setShowInquiryModal(false)} userId={user?.id} />

      {/* ── 닉네임 수정 모달 ── */}
      <Modal
        visible={showNicknameEdit}
        transparent
        animationType="fade"
        onRequestClose={() => setShowNicknameEdit(false)}
      >
        <View style={styles.nicknameModalOverlay}>
          <View style={styles.nicknameModalCard}>
            <Text style={styles.nicknameModalTitle}>닉네임 수정</Text>
            <TextInput
              style={styles.nicknameInput}
              value={nicknameInput}
              onChangeText={setNicknameInput}
              placeholder="닉네임 입력"
              placeholderTextColor={C.textDim}
              maxLength={20}
              autoFocus
            />
            <View style={styles.nicknameModalBtns}>
              <TouchableOpacity
                style={styles.nicknameCancelBtn}
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setShowNicknameEdit(false); }}
                activeOpacity={0.8}
              >
                <Text style={styles.nicknameCancelTxt}>취소</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.nicknameSaveBtn}
                activeOpacity={0.8}
                onPress={async () => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  const { error } = await updateNickname(nicknameInput);
                  if (error) {
                    Alert.alert('오류', error);
                    return;
                  }
                  setShowNicknameEdit(false);
                }}
              >
                <Text style={styles.nicknameSaveTxt}>저장</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// --- Styles

const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: C.bg },
  scroll: { paddingBottom: 48 },

  // Bell
  bellBtn: {
    position: 'absolute', top: 12, right: 16,
    width: 40, height: 40,
    alignItems: 'center', justifyContent: 'center',
    zIndex: 10,
  },
  bellBadge: {
    position: 'absolute', top: 6, right: 6,
    minWidth: 16, height: 16, borderRadius: 8,
    backgroundColor: '#ff4d6d',
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 3,
  },
  bellBadgeText: { fontSize: 9, fontWeight: '800', color: '#fff' },

  // Manager request card
  managerRequestCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: C.surface,
    borderRadius: R.card,
    padding: 16,
    marginHorizontal: 20,
    gap: 12,
    borderWidth: 1,
    borderColor: C.accent + '30',
  },
  managerRequestIcon: {
    width: 40, height: 40, borderRadius: R.inner,
    backgroundColor: C.accentBg,
    alignItems: 'center', justifyContent: 'center',
  },
  managerRequestTitle: { fontSize: 14, fontWeight: '700', color: C.text, marginBottom: 2 },
  managerRequestSub:   { fontSize: 12, color: C.textDim },

  // --- Guest
  guestContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  guestIconRing: {
    width:           80,
    height:          80,
    borderRadius:    40,
    backgroundColor: C.accentBg,
    alignItems:      'center',
    justifyContent:  'center',
    marginBottom:    24,
  },
  guestTitle:     { fontSize: 26, fontWeight: '900', color: C.text, letterSpacing: -0.5, marginBottom: 12, textAlign: 'center' },
  guestDesc:      { fontSize: 14, color: C.textSub, textAlign: 'center', lineHeight: 21, marginBottom: 32 },
  guestSignInBtn: {
    alignSelf: 'stretch',
    backgroundColor: C.accent,
    borderRadius: R.btn,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  guestSignInTxt: { fontSize: 15, fontWeight: '800', color: C.bg },
  guestCreateBtn: {
    alignSelf: 'stretch',
    borderRadius: R.btn,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: C.border,
    marginBottom: 24,
  },
  guestCreateTxt: { fontSize: 15, fontWeight: '700', color: C.text },
  guestFooter:    { fontSize: 12, color: C.textDim, textAlign: 'center' },
  guestDividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    marginVertical: 20,
    gap: 12,
  },
  guestDividerLine: { flex: 1, height: 1, backgroundColor: C.border },
  guestDividerText: { fontSize: 12, color: C.textDim, fontWeight: '600' },
  guestSocialBtn: {
    alignSelf: 'stretch',
    backgroundColor: C.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    paddingVertical: 14,
    marginBottom: 12,
  },
  guestAppleBtn: { alignSelf: 'stretch', height: 50, marginBottom: 12 },

  // --- Hero
  hero: {
    alignItems: 'center',
    paddingTop: 32,
    paddingBottom: 24,
    paddingHorizontal: 16,
    position: 'relative',
  },
  avatarWrap: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: C.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    overflow: 'visible',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 999,
  },
  avatarEmpty: {
    width: '100%',
    height: '100%',
    borderRadius: 999,
    backgroundColor: C.accent,
  },
  avatarEditBadge: {
    position:        'absolute',
    bottom:          2,
    right:           2,
    width:           24,
    height:          24,
    borderRadius:    12,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems:      'center',
    justifyContent:  'center',
  },
  rolePip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: R.pill,
    borderWidth: 1,
    borderColor: C.border,
  },
  rolePipText: { fontSize: 9, fontWeight: '800', letterSpacing: 0.3 },
  userName:    { ...T.title, color: C.text },
  userEmail:   { fontSize: 13, color: C.textSub },
  managerRoleBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: R.pill, backgroundColor: C.accent + '25' },
  managerRoleBadgeText: { fontSize: 11, fontWeight: '800', color: C.accent },
  adminRoleBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: R.pill, backgroundColor: C.danger + '25' },
  adminRoleBadgeText: { fontSize: 11, fontWeight: '800', color: C.danger },

  // --- Section labels
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: C.textDim,
    letterSpacing: 1.2,
    marginHorizontal: screenPad,
    marginBottom: 8,
    marginTop: 4,
  },
  sectionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: screenPad,
    marginBottom: 8,
  },
  sectionSub: { fontSize: 12, color: C.textSub },
  seeAll:     { fontSize: 12, fontWeight: '600', color: C.accent },

  // --- Role section card
  roleSection: {
    marginHorizontal: screenPad,
    backgroundColor: C.surface,
    borderRadius: R.card,
    overflow: 'hidden',
  },
  roleSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
  },
  roleSectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  roleSectionIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleSectionTitle: { fontSize: 15, fontWeight: '700', color: C.text },
  roleSectionSub:   { fontSize: 12, color: C.textSub, marginTop: 2 },
  managerEmptyText: { fontSize: 13, color: C.textSub, textAlign: 'center', paddingVertical: 18 },
  openPanelBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: C.accent,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: R.pill,
  },
  openPanelBtnText: { fontSize: 12, fontWeight: '800', color: C.bg },

  // Gym summary rows inside manager section
  gymSummaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 11,
    gap: 12,
  },
  gymSummaryDot:     { width: 8, height: 8, borderRadius: 4 },
  gymSummaryName:    { fontSize: 13, fontWeight: '600', color: C.text },
  gymSummaryLoc:     { fontSize: 11, color: C.textSub, marginTop: 1 },
  gymSummaryMeta:    { alignItems: 'flex-end' },
  gymSummaryMetaText:{ fontSize: 11, color: C.textDim, fontWeight: '600' },

  // Status summary chips
  roleSummaryChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 14,
    paddingBottom: 14,
  },
  summaryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: C.surfaceHigh,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: R.pill,
  },
  summaryChipDot:  { width: 6, height: 6, borderRadius: 3 },
  summaryChipText: { fontSize: 11, fontWeight: '600', color: C.textSub },
  registerGymChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: C.accentBg,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: R.pill,
    borderWidth: 1,
    borderColor: C.accent + '50',
  },
  registerGymChipText: { fontSize: 11, fontWeight: '700', color: C.accent },

  // Admin queue cells
  adminQueues: {
    flexDirection: 'row',
    paddingHorizontal: 8,
    paddingVertical: 12,
  },
  adminQueueCell: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
  },
  adminQueueCount: { fontSize: 28, fontWeight: '900', letterSpacing: -1 },
  adminQueueLabel: { fontSize: 10, fontWeight: '600', color: C.textSub, letterSpacing: 0.3 },
  adminQueueDot:   { width: 6, height: 6, borderRadius: 3, marginTop: 2 },
  adminAlertRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  adminAlertText: { flex: 1, fontSize: 13, color: C.textSub },

  // --- Stats grid
  statsGrid: {
    flexDirection: 'row',
    marginHorizontal: screenPad,
    marginBottom: 24,
    backgroundColor: C.surface,
    borderRadius: R.card,
    overflow: 'hidden',
  },
  statCell:    { flex: 1, alignItems: 'center', paddingVertical: 18 },
  statValue:   { fontSize: 22, fontWeight: '800', color: C.text, letterSpacing: -0.5 },
  statLabel:   { fontSize: 10, color: C.textSub, marginTop: 3, fontWeight: '600' },
  statDivider: { width: 1, backgroundColor: C.border, marginVertical: 12 },

  // --- Achievements
  badgeRow: { paddingHorizontal: screenPad, gap: 10, paddingBottom: 4, marginBottom: 24 },
  badge: {
    width: 84,
    alignItems: 'center',
    backgroundColor: C.surface,
    borderRadius: R.card,
    padding: 12,
    gap: 6,
  },
  badgeIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: C.surfaceHigh,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeLock:  { position: 'absolute', top: 8, right: 8 },
  badgeLabel: { fontSize: 10, fontWeight: '700', color: C.text, textAlign: 'center', lineHeight: 14 },

  // --- Card
  card: {
    backgroundColor: C.surface,
    borderRadius: R.card,
    marginHorizontal: screenPad,
    marginBottom: 24,
    overflow: 'hidden',
  },
  divider:     { height: 1, backgroundColor: C.border, marginLeft: 54 },
  cardDivider: { height: 1, backgroundColor: C.border },

  // --- Personal Records
  prPlaceholderCard: {
    marginHorizontal: screenPad, marginBottom: 24,
    backgroundColor: C.surface, borderRadius: R.card,
    padding: cardPadH, flexDirection: 'row', alignItems: 'center', gap: 14,
  },
  prPlaceholderText: { flex: 1, fontSize: 13, color: C.textSub, lineHeight: 20 },
  prRow:      { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 },
  prExercise: { fontSize: 14, fontWeight: '700', color: C.text },
  prValue:    { fontSize: 12, color: C.accent, fontWeight: '600', marginTop: 2 },
  prDate:     { fontSize: 11, color: C.textDim, fontWeight: '600' },

  splitSetupBanner: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             12,
    backgroundColor: C.accentBg,
    borderRadius:    R.card,
    borderWidth:     1,
    borderColor:     C.accent + '40',
    padding:         14,
    marginHorizontal: screenPad,
    marginBottom:    16,
  },
  splitSetupBannerTitle: { fontSize: 14, fontWeight: '700', color: C.text, marginBottom: 2 },
  splitSetupBannerSub:   { fontSize: 12, color: C.textSub },

  // --- Settings / Nav rows
  navRow:      { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  settingRow:  { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  settingIcon: { width: 34, height: 34, borderRadius: 9, backgroundColor: C.surfaceHigh, alignItems: 'center', justifyContent: 'center' },
  settingLabel:{ flex: 1, fontSize: 15, color: C.text, fontWeight: '500' },

  // --- Dev role switcher
  devWrap: {
    marginHorizontal: screenPad,
    marginTop: 8,
    marginBottom: 8,
    backgroundColor: C.surface,
    borderRadius: R.card,
    overflow: 'hidden',
  },
  devToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 10,
  },
  devBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: C.surfaceHigh,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 5,
  },
  devBadgeText:   { fontSize: 9, fontWeight: '800', color: C.textDim, letterSpacing: 0.8 },
  devToggleText:  { flex: 1, fontSize: 13, fontWeight: '600', color: C.textDim },
  devBtnRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 14,
    paddingBottom: 14,
  },
  devRoleBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 9,
    borderRadius: R.inner,
    borderWidth: 1.5,
    borderColor: C.border,
  },
  devRoleBtnText: { fontSize: 12, fontWeight: '700' },

  version: { textAlign: 'center', fontSize: 11, color: C.textDim, marginTop: 16, marginBottom: 4, fontWeight: '500' },
  devResetBtn: { alignSelf: 'center', marginTop: 8, marginBottom: 4, paddingVertical: 8, paddingHorizontal: 16, borderRadius: 8, backgroundColor: '#1a1a2e', borderWidth: 1, borderColor: '#333' },
  devResetTxt: { fontSize: 11, color: '#ff6b6b', fontWeight: '600' },

  // Workout badge collection (task_3)
  workoutBadgeRow: {
    paddingHorizontal: screenPad,
    gap:               12,
    paddingBottom:     4,
    marginBottom:      24,
  },
  workoutBadgeItem: {
    alignItems: 'center',
    gap:        6,
  },
  badgeEmptyCard: {
    marginHorizontal: screenPad,
    marginBottom:     24,
    backgroundColor:  C.surface,
    borderRadius:     R.card,
    padding:          20,
    alignItems:       'center',
  },
  badgeEmptyText: {
    fontSize:   13,
    color:      C.textSub,
    textAlign:  'center',
    lineHeight: 20,
  },
  // Nickname edit modal
  nicknameModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  nicknameModalCard: {
    backgroundColor: C.surface,
    borderRadius: R.card,
    padding: 24,
    width: '100%',
    gap: 16,
  },
  nicknameModalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: C.text,
    textAlign: 'center',
  },
  nicknameInput: {
    backgroundColor: C.surfaceHigh,
    borderRadius: R.inner,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: C.text,
    borderWidth: 1,
    borderColor: C.border,
  },
  nicknameModalBtns: {
    flexDirection: 'row',
    gap: 12,
  },
  nicknameCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: R.btn,
    backgroundColor: C.surfaceHigh,
    alignItems: 'center',
  },
  nicknameCancelTxt: {
    fontSize: 14,
    fontWeight: '700',
    color: C.textSub,
  },
  nicknameSaveBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: R.btn,
    backgroundColor: C.accent,
    alignItems: 'center',
  },
  nicknameSaveTxt: {
    fontSize: 14,
    fontWeight: '800',
    color: C.bg,
  },
});
