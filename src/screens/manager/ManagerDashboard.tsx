import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  FlatList,
  TextInput,
  Modal,
  SafeAreaView,
  StatusBar,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
  Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { C, R, T } from '../../theme';
import { ManagedGym, Machine, GymStatus, MachineWithGyms } from '../../data/types';
import { fetchMachines, getMachinesCacheSync } from '../../lib/db';
import { parseMuscles } from '../../lib/splitUtils';
import { useAuth } from '../../context/AuthContext';
import MachineCard from '../../components/MachineCard';
import {
  getAnnouncements,
  addAnnouncement,
  deleteAnnouncement,
} from '../../data/gymAnnouncementStore';
import type { GymAnnouncement } from '../../data/gymAnnouncementStore';
import { getRequestsByGymId, markRequestAsRead } from '../../data/gymRequestStore';
import type { GymRequest } from '../../data/gymRequestStore';
import { getGymMachineIds, updateGymMachines } from '../../data/managedGymStore';
import { FREE_WEIGHTS } from '../../data/freeWeights';
import { registerGymImmediately } from '../../lib/db/gymRegistrationRequests';
import { submitGymManagerLinkRequest } from '../../lib/db/gymManagerLinkRequests';
import { fetchGymMachineIds, saveGymMachineIds } from '../../lib/db/gymMachines';
import { invalidateGymsCache, fetchGyms } from '../../lib/db/gyms';
import { getManagerRequests } from '../../lib/db/managerRequests';
import { geocodeAddress } from '../../lib/geocoding';
import { containsBannedWord } from '../../lib/bannedWords';
import GymStatsView from './GymStatsView';
import * as ImagePicker from 'expo-image-picker';
import { submitMachineRequest } from '../../lib/db/machineRequests';
import { Image as ExpoImage } from 'expo-image';
import { fetchGymPhotoUrlsByUser } from '../../lib/db/gymPhotos';
import { fetchWeeklyVisitors } from '../../lib/db/gymStats';
import { fetchGymFavoriteCount } from '../../lib/db/gymFavorites';

// ─── Types ──────────────────────────────────────────────────────────────────

type ManagerView = 'home' | 'register' | 'edit' | 'machines' | 'manage' | 'stats';
type ManagerTab  = 'routine' | 'notice' | 'request';

interface GymForm {
  name: string; location: string; addressDetail: string; description: string;
  phone: string; website: string; hoursNote: string;
}
const EMPTY_GYM_FORM: GymForm = { name: '', location: '', addressDetail: '', description: '', phone: '', website: '', hoursNote: '' };

// 즉시 등록 전 최소한의 중복 방지 체크 — 이름/위치 문자열 비교 수준
function normalizeStr(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, '');
}
function isSameGymName(a: string, b: string): boolean {
  const na = normalizeStr(a);
  const nb = normalizeStr(b);
  return !!na && !!nb && na === nb;
}
function isSimilarGymLocation(a: string, b: string): boolean {
  const na = normalizeStr(a);
  const nb = normalizeStr(b);
  if (!na || !nb) return false;
  return na === nb || na.includes(nb) || nb.includes(na);
}

type DayHours = { enabled: boolean; open: string; close: string };
type OperatingHours = {
  mon: DayHours; tue: DayHours; wed: DayHours; thu: DayHours;
  fri: DayHours; sat: DayHours; sun: DayHours;
};
const DEFAULT_HOURS: OperatingHours = {
  mon: { enabled: true,  open: '09:00', close: '22:00' },
  tue: { enabled: true,  open: '09:00', close: '22:00' },
  wed: { enabled: true,  open: '09:00', close: '22:00' },
  thu: { enabled: true,  open: '09:00', close: '22:00' },
  fri: { enabled: true,  open: '09:00', close: '22:00' },
  sat: { enabled: true,  open: '10:00', close: '20:00' },
  sun: { enabled: false, open: '10:00', close: '18:00' },
};
const DAY_KEYS: (keyof OperatingHours)[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const DAY_LABELS: Record<keyof OperatingHours, string> = {
  mon: '월', tue: '화', wed: '수', thu: '목', fri: '금', sat: '토', sun: '일',
};
const NOTICE_CHIPS = ['24시간 오픈', '연중무휴', '시설 공사 중', '임시 휴무'];

interface ManagerGymRoutine {
  id: string; gymId: string; name: string; bodyPart: string;
  machines: { id: string; name: string; brand: string; targetMuscle: string; category: string }[];
  createdAt: string;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const { width: SCREEN_W } = Dimensions.get('window');
const MACHINE_CARD_W    = Math.floor((SCREEN_W - 32 - 8) / 2);
const ROUTINE_MODAL_PAD = 20;
const ROUTINE_CARD_W    = Math.floor((SCREEN_W - ROUTINE_MODAL_PAD * 2 - 8) / 2);
const PHOTO_SIZE     = Math.floor((SCREEN_W - 40 - 16) / 3);

const STATUS_META: Record<GymStatus, { label: string; color: string; bg: string }> = {
  approved: { label: '운영 중', color: C.accent,  bg: C.accentBg  },
  pending:  { label: '대기 중', color: '#ffb547', bg: '#ffb54718' },
  rejected: { label: '거절됨', color: C.danger,  bg: C.dangerBg  },
  flagged:  { label: '신고됨', color: '#ff7c47', bg: '#ff7c4718' },
};

const MUSCLE_COLORS: Record<string, { fg: string; bg: string }> = {
  Back:        C.tagMachine,
  Chest:       C.tagMuscle,
  Leg:        C.tagCategory,
  Core:        C.tagBrand,
  Glutes:      C.tagMuscle,
  Shoulder:   C.tagBrand,
  'Full Body': C.tagCategory,
  Arms:        C.tagCategory,
};
function muscleColor(muscle: string) {
  return MUSCLE_COLORS[muscle] ?? { fg: C.textSub, bg: C.surfaceHigh };
}

function uid() { return Math.random().toString(36).slice(2, 9); }

const BODY_PARTS = ['전체', 'Chest', 'Back', 'Leg', 'Shoulder', 'Arms', 'Glutes', 'Other'];

// Seed routine mock data
function makeMockRoutines(gymId: string, machines: MachineWithGyms[]): ManagerGymRoutine[] {
  const toEntry = (m: Machine) => ({ id: m.id, name: m.name, brand: m.brand, targetMuscle: m.targetMuscle, category: m.category });
  const chestMs = machines.filter(m => m.targetMuscle === 'Chest').slice(0, 3).map(toEntry);
  const backMs  = machines.filter(m => m.targetMuscle === 'Back').slice(0, 3).map(toEntry);
  return gymId === 'g01' ? [
    { id: 'r1', gymId, name: '파워 가슴 루틴', bodyPart: 'Chest', machines: chestMs, createdAt: '2026-03-01T09:00:00Z' },
    { id: 'r2', gymId, name: '등 집중 루틴',   bodyPart: 'Back',  machines: backMs,  createdAt: '2026-03-05T10:00:00Z' },
  ] : [];
}

// ─── Shared atoms ────────────────────────────────────────────────────────────

function Header({ title, subtitle, onBack, right }: {
  title: string; subtitle?: string; onBack: () => void; right?: React.ReactNode;
}) {
  return (
    <View style={styles.header}>
      <TouchableOpacity onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onBack(); }} style={styles.backBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
        <Ionicons name="chevron-back" size={22} color={C.text} />
      </TouchableOpacity>
      <View style={styles.headerCenter}>
        <Text style={styles.headerTitle}>{title}</Text>
        {subtitle ? <Text style={styles.headerSub}>{subtitle}</Text> : null}
      </View>
      {right ?? <View style={{ width: 40 }} />}
    </View>
  );
}

function StatusBadge({ status }: { status: GymStatus }) {
  const m = STATUS_META[status];
  return (
    <View style={[styles.statusBadge, { backgroundColor: m.bg }]}>
      <View style={[styles.statusDot, { backgroundColor: m.color }]} />
      <Text style={[styles.statusBadgeText, { color: m.color }]}>{m.label}</Text>
    </View>
  );
}

function SectionCard({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <View style={styles.sectionCard}>
      {title && <Text style={styles.sectionCardTitle}>{title}</Text>}
      {children}
    </View>
  );
}

function Field({ label, value, onChangeText, placeholder, multiline = false, hint, keyboardType }: {
  label: string; value: string; onChangeText: (t: string) => void;
  placeholder?: string; multiline?: boolean; hint?: string;
  keyboardType?: 'default' | 'numbers-and-punctuation' | 'numeric';
}) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={[
          styles.fieldInput,
          multiline && { height: 80, textAlignVertical: 'top', paddingTop: 12 },
          focused && { borderColor: C.accent },
        ]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={C.textDim}
        selectionColor={C.accent}
        multiline={multiline}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        autoCorrect={false}
        autoCapitalize="none"
        spellCheck={false}
        keyboardType={keyboardType ?? 'default'}
      />
      {hint && <Text style={styles.fieldHint}>{hint}</Text>}
    </View>
  );
}

function StepBar({ current, labels }: { current: number; labels: string[] }) {
  return (
    <View style={styles.stepBar}>
      {labels.map((label, i) => {
        const done   = i < current - 1;
        const active = i === current - 1;
        return (
          <React.Fragment key={i}>
            <View style={styles.stepItem}>
              <View style={[styles.stepCircle, done && styles.stepCircleDone, active && styles.stepCircleActive]}>
                {done
                  ? <Ionicons name="checkmark" size={11} color={C.bg} />
                  : <Text style={[styles.stepNum, active && { color: C.bg }]}>{i + 1}</Text>
                }
              </View>
              <Text style={[styles.stepLabel, active && { color: C.text }]}>{label}</Text>
            </View>
            {i < labels.length - 1 && (
              <View style={[styles.stepConnector, done && { backgroundColor: C.accent }]} />
            )}
          </React.Fragment>
        );
      })}
    </View>
  );
}

// ─── OperatingHours UI ───────────────────────────────────────────────────────

function OperatingHoursEditor({ hours, updateDay, notices, toggleNotice, hoursNote, setHoursNote }: {
  hours: OperatingHours;
  updateDay: (day: keyof OperatingHours, field: keyof DayHours, value: any) => void;
  notices: string[];
  toggleNotice: (chip: string) => void;
  hoursNote: string;
  setHoursNote: (v: string) => void;
}) {
  return (
    <View>
      <Text style={styles.fieldLabel}>운영시간</Text>
      <View style={styles.hoursCard}>
        {DAY_KEYS.map((day) => {
          const dh = hours[day];
          return (
            <View key={day} style={styles.dayRow}>
              <Switch
                value={dh.enabled}
                onValueChange={(v) => updateDay(day, 'enabled', v)}
                thumbColor={dh.enabled ? C.accent : C.textDim}
                trackColor={{ false: C.surfaceHigh, true: C.accentBg }}
              />
              <Text style={[styles.dayLabel, !dh.enabled && { color: C.textDim }]}>
                {DAY_LABELS[day]}
              </Text>
              {dh.enabled ? (
                <View style={styles.timeRow}>
                  <TextInput
                    style={styles.timeInput}
                    value={dh.open}
                    onChangeText={(t) => updateDay(day, 'open', t)}
                    placeholder="09:00"
                    placeholderTextColor={C.textDim}
                    selectionColor={C.accent}
                    keyboardType="numbers-and-punctuation"
                    maxLength={5}
                    autoCorrect={false}
                    autoCapitalize="none"
                    spellCheck={false}
                  />
                  <Text style={styles.timeSep}>~</Text>
                  <TextInput
                    style={styles.timeInput}
                    value={dh.close}
                    onChangeText={(t) => updateDay(day, 'close', t)}
                    placeholder="22:00"
                    placeholderTextColor={C.textDim}
                    selectionColor={C.accent}
                    keyboardType="numbers-and-punctuation"
                    maxLength={5}
                    autoCorrect={false}
                    autoCapitalize="none"
                    spellCheck={false}
                  />
                </View>
              ) : (
                <Text style={styles.closedLabel}>휴무</Text>
              )}
            </View>
          );
        })}
      </View>
      <Text style={[styles.fieldLabel, { marginTop: 14 }]}>추가 안내</Text>
      <View style={styles.noticeChipsRow}>
        {NOTICE_CHIPS.map((chip) => {
          const active = notices.includes(chip);
          return (
            <TouchableOpacity key={chip} style={[styles.noticeChip, active && styles.noticeChipActive]} onPress={() => toggleNotice(chip)} activeOpacity={0.8}>
              <Text style={[styles.noticeChipText, active && styles.noticeChipTextActive]}>{chip}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <View style={{ marginTop: 14 }}>
        <Text style={styles.fieldLabel}>운영시간 메모 (선택)</Text>
        <TextInput
          style={styles.hoursNoteInput}
          value={hoursNote}
          onChangeText={setHoursNote}
          placeholder="예: 매월 2·4번째 일요일 휴무, 설·추석 당일 휴무"
          placeholderTextColor={C.textDim}
          multiline
          maxLength={200}
          autoCorrect={false}
          spellCheck={false}
        />
      </View>
    </View>
  );
}

// ─── Props interfaces for module-level view components ────────────────────────

interface HomeViewProps {
  gyms: ManagedGym[];
  weeklyVisitors: number | null;
  gymFavCount: number | null;
  machineCount: number;
  onOpenEdit: (gym: ManagedGym) => void;
  onOpenMachines: (gym: ManagedGym) => void;
  onOpenManage: (gym: ManagedGym, tab?: ManagerTab) => void;
  onOpenStats: (gym: ManagedGym) => void;
  onRegister: () => void;
}

interface RegisterViewProps {
  step: number;
  setStep: React.Dispatch<React.SetStateAction<number>>;
  regForm: GymForm;
  onChangeField: (key: keyof GymForm, value: string) => void;
  regHours: OperatingHours;
  updateRegDay: (day: keyof OperatingHours, field: keyof DayHours, value: any) => void;
  regNotices: string[];
  toggleRegNotice: (chip: string) => void;
  submitting: boolean;
  serializeHours: (h: OperatingHours) => string;
  onSubmit: () => void;
  onNextStep: () => void;
  onBack: () => void;
  resultMode: 'registered' | 'link-requested';
}

interface EditViewProps {
  editForm: GymForm;
  onChangeEditField: (key: keyof GymForm, value: string) => void;
  editHours: OperatingHours;
  updateEditDay: (day: keyof OperatingHours, field: keyof DayHours, value: any) => void;
  editNotices: string[];
  toggleEditNotice: (chip: string) => void;
  photos: string[];
  setPhotos: React.Dispatch<React.SetStateAction<string[]>>;
  onSave: () => void;
  onAddPhoto: () => void;
}

interface MachinesViewProps {
  machines: MachineWithGyms[];
  gymMachineIds: string[];
  machineMusclFilter: string;
  setMachineMusclFilter: (v: string) => void;
  machineBrandFilter: string;
  setMachineBrandFilter: (v: string) => void;
  showOwnedOnly: boolean;
  setShowOwnedOnly: (v: boolean) => void;
  onToggleMachine: (id: string) => void;
  onRequestMachine: () => void;
}

interface RoutineTabProps {
  machines: MachineWithGyms[];
  gymRoutines: ManagerGymRoutine[];
  gymMachineIds: string[];
  routineBodyPart: string;
  routineModalVisible: boolean;
  setRoutineModalVisible: (v: boolean) => void;
  routineName: string;
  setRoutineName: (v: string) => void;
  setRoutineBodyPart: (v: string) => void;
  routineSelectedIds: Set<string>;
  setRoutineSelectedIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  editingRoutineId: string | null;
  onOpenAdd: () => void;
  onOpenEdit: (r: ManagerGymRoutine) => void;
  onDelete: (id: string) => void;
  onSave: () => void;
}

interface NoticeTabProps {
  announcements: GymAnnouncement[];
  annModalVisible: boolean;
  setAnnModalVisible: (v: boolean) => void;
  onSubmit: (title: string, content: string) => void;
  onDelete: (id: string) => void;
}

interface RequestTabProps {
  requests: GymRequest[];
  readIds: Set<string>;
  onMarkRead: (id: string) => void;
}

interface ManageViewProps {
  activeManagerTab: ManagerTab;
  setActiveManagerTab: (t: ManagerTab) => void;
  routineTabProps: RoutineTabProps;
  noticeTabProps: NoticeTabProps;
  requestTabProps: RequestTabProps;
}

// ─── Module-level view components ────────────────────────────────────────────

const STEP_LABELS = ['기본 정보', '연락처 정보', '검토'];

function HomeView({ gyms, weeklyVisitors, gymFavCount, machineCount, onOpenEdit, onOpenMachines, onOpenManage, onOpenStats, onRegister }: HomeViewProps) {
  return (
    <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
      <View style={styles.homeSummary}>
        {[
          { value: weeklyVisitors == null ? '–' : String(weeklyVisitors), label: '주간 방문' },
          { value: String(machineCount),                                    label: '머신' },
          { value: gymFavCount    == null ? '–' : String(gymFavCount),     label: '즐겨찾기' },
        ].map(s => (
          <View key={s.label} style={styles.summaryCell}>
            <Text style={styles.summaryCellValue}>{s.value}</Text>
            <Text style={styles.summaryCellLabel}>{s.label}</Text>
          </View>
        ))}
      </View>

      <Text style={styles.groupLabel}>내 헬스장</Text>
      {gyms.map(gym => (
        <View key={gym.id} style={[styles.gymCard, { borderLeftColor: STATUS_META[gym.status].color }]}>
          <View style={styles.gymCardHead}>
            <View style={{ flex: 1 }}>
              <Text style={styles.gymCardName}>{gym.name}</Text>
              <View style={styles.gymCardLocRow}>
                <Ionicons name="location-outline" size={11} color={C.textSub} />
                <Text style={styles.gymCardLoc}>{gym.location}</Text>
              </View>
            </View>
            <StatusBadge status={gym.status} />
          </View>
          <View style={styles.gymCardMeta}>
            <View style={styles.metaChip}><Ionicons name="barbell-outline" size={11} color={C.textSub} /><Text style={styles.metaChipText}>{gym.machineIds.length}개 머신</Text></View>
            <View style={styles.metaChip}><Ionicons name="image-outline" size={11} color={C.textSub} /><Text style={styles.metaChipText}>{gym.photoCount}장 사진</Text></View>
            <View style={styles.metaChip}><Ionicons name="time-outline" size={11} color={C.textSub} /><Text style={styles.metaChipText}>{gym.submittedAt}</Text></View>
          </View>
          <View style={styles.gymCardActions}>
            <TouchableOpacity style={styles.gymActionBtn} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onOpenEdit(gym); }} activeOpacity={0.8}>
              <Ionicons name="create-outline" size={14} color={C.accent} />
              <Text style={styles.gymActionBtnText}>정보 수정</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.gymActionBtn} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onOpenMachines(gym); }} activeOpacity={0.8}>
              <Ionicons name="barbell-outline" size={14} color={C.accent} />
              <Text style={styles.gymActionBtnText}>머신 관리</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={[styles.gymActionBtn, { marginTop: 8 }]} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onOpenManage(gym); }} activeOpacity={0.8}>
            <Ionicons name="grid-outline" size={14} color={C.accent} />
            <Text style={styles.gymActionBtnText}>관리 센터 (루틴·공지·요청)</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.gymActionBtn, { marginTop: 8, backgroundColor: C.accentBg, borderColor: C.accent + '40' }]}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onOpenStats(gym); }}
            activeOpacity={0.8}
          >
            <Ionicons name="bar-chart-outline" size={14} color={C.accent} />
            <Text style={[styles.gymActionBtnText, { color: C.accent }]}>이용 통계</Text>
          </TouchableOpacity>
        </View>
      ))}

      {gyms.length === 0 && (
        <TouchableOpacity
          style={styles.registerBtn}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); onRegister(); }}
          activeOpacity={0.88}
        >
          <Ionicons name="add-circle-outline" size={18} color={C.bg} />
          <Text style={styles.registerBtnText}>헬스장 등록 신청</Text>
        </TouchableOpacity>
      )}

      <View style={styles.infoNote}>
        <Ionicons name="information-circle-outline" size={15} color={C.textSub} style={{ marginTop: 1 }} />
        <Text style={styles.infoNoteText}>
          새 헬스장 등록은 승인된 매니저에게 즉시 반영돼요. 등록 후에도 정보는 언제든 수정할 수 있어요.
        </Text>
      </View>
    </ScrollView>
  );
}

function DuplicateGymModal({
  visible, gymName, onCancel, onConfirm,
}: {
  visible:   boolean;
  gymName:   string;
  onCancel:  () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={dupStyles.overlay}>
        <View style={dupStyles.card}>
          <View style={dupStyles.iconCircle}>
            <Ionicons name="business-outline" size={26} color={C.accent} />
          </View>

          <Text style={dupStyles.title}>이미 등록된 헬스장이 있어요</Text>

          <Text style={dupStyles.mainText}>
            "<Text style={dupStyles.gymNameHighlight}>{gymName}</Text>"와 이름/위치가 비슷한 헬스장이 이미 등록되어 있어요. 연결해드릴까요?
          </Text>

          <Text style={dupStyles.subText}>연결 후 정보 및 보유 머신을 수정할 수 있어요.</Text>

          <View style={dupStyles.divider} />

          <Text style={dupStyles.footerText}>동일한 헬스장이 없다면 운영자에게 문의해주세요.</Text>

          <View style={dupStyles.btnRow}>
            <TouchableOpacity style={dupStyles.cancelBtn} onPress={onCancel} activeOpacity={0.8}>
              <Text style={dupStyles.cancelBtnText}>취소</Text>
            </TouchableOpacity>
            <TouchableOpacity style={dupStyles.confirmBtn} onPress={onConfirm} activeOpacity={0.85}>
              <Text style={dupStyles.confirmBtnText}>연결해주세요</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const dupStyles = StyleSheet.create({
  overlay: {
    flex:            1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent:  'center',
    alignItems:      'center',
    padding:         24,
  },
  card: {
    width:            '100%',
    maxWidth:         340,
    backgroundColor:  C.surface,
    borderRadius:     R.card,
    borderWidth:      1,
    borderColor:      C.border,
    padding:          20,
    alignItems:       'center',
  },
  iconCircle: {
    width:            52,
    height:           52,
    borderRadius:     26,
    backgroundColor:  C.accentBg,
    alignItems:       'center',
    justifyContent:   'center',
    marginBottom:     14,
  },
  title: {
    ...T.section,
    color:      C.text,
    textAlign:  'center',
    marginBottom: 12,
  },
  mainText: {
    fontSize:   14,
    color:      C.text,
    lineHeight: 21,
    textAlign:  'center',
  },
  gymNameHighlight: {
    fontWeight: '800',
    color:      C.accent,
  },
  subText: {
    fontSize:   12,
    color:      C.textDim,
    lineHeight: 18,
    textAlign:  'center',
    marginTop:  8,
  },
  divider: {
    height:           1,
    backgroundColor:  C.border,
    alignSelf:        'stretch',
    marginVertical:   14,
  },
  footerText: {
    fontSize:   12,
    color:      C.textSub,
    lineHeight: 18,
    textAlign:  'center',
  },
  btnRow: {
    flexDirection: 'row',
    gap:           10,
    marginTop:     18,
    alignSelf:     'stretch',
  },
  cancelBtn: {
    paddingVertical:   14,
    paddingHorizontal: 20,
    borderRadius:      R.btn,
    borderWidth:       1,
    borderColor:       C.border,
    alignItems:        'center',
  },
  cancelBtnText: {
    fontSize:   15,
    fontWeight: '700',
    color:      C.textSub,
  },
  confirmBtn: {
    flex:            1,
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'center',
    gap:             8,
    backgroundColor: C.accent,
    paddingVertical: 15,
    borderRadius:    R.btn,
  },
  confirmBtnText: {
    fontSize:   15,
    fontWeight: '800',
    color:      C.bg,
  },
});

function RegisterView({
  step, setStep, regForm, onChangeField, regHours, updateRegDay,
  regNotices, toggleRegNotice, submitting, serializeHours, onSubmit, onNextStep, onBack, resultMode,
}: RegisterViewProps) {
  if (step === 4) {
    const isLinkRequested = resultMode === 'link-requested';
    return (
      <View style={styles.completionScreen}>
        <View style={styles.completionIconWrap}>
          <Ionicons name="checkmark-circle" size={64} color={C.accent} />
        </View>
        {isLinkRequested ? (
          <>
            <Text style={styles.completionTitle}>연결 요청이 접수됐어요!</Text>
            <Text style={styles.completionMsg}>운영자 승인 후 이 헬스장의 매니저로 연결돼요.</Text>
            <Text style={styles.completionSub}>승인 결과는 알림으로 안내드릴게요.</Text>
          </>
        ) : (
          <>
            <Text style={styles.completionTitle}>헬스장이 바로 등록되었어요!</Text>
            <Text style={styles.completionMsg}>승인 절차 없이 즉시 등록이 완료됐어요.</Text>
            <Text style={styles.completionSub}>이제 머신 등록을 진행할 수 있어요.</Text>
          </>
        )}
        <TouchableOpacity
          style={[styles.registerBtn, { marginTop: 32, width: '100%' }]}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setStep(1); onBack(); }}
          activeOpacity={0.88}
        >
          <Text style={styles.registerBtnText}>확인</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <StepBar current={step} labels={STEP_LABELS} />
        {step === 1 && (
          <SectionCard title="헬스장을 소개해 주세요">
            <Field label="헬스장 이름 *"   value={regForm.name}          onChangeText={t => onChangeField('name', t)}          placeholder="예) 아이언헙 피트니스" />
            <Field label="위치 *"          value={regForm.location}      onChangeText={t => onChangeField('location', t)}      placeholder="예) 서울 강남구" />
            <Field label="세부주소"         value={regForm.addressDetail} onChangeText={t => onChangeField('addressDetail', t)} placeholder="예) 3층 301호" hint="건물명, 층수, 호수 등" />
            <Field label="헬스장 소개 *"   value={regForm.description}   onChangeText={t => onChangeField('description', t)}   placeholder="헬스장만의 특징을 알려주세요" multiline hint="공개 프로필에 표시됩니다" />
          </SectionCard>
        )}
        {step === 2 && (
          <SectionCard title="회원들이 연락할 수 있도록 정보를 입력해 주세요">
            <Field label="전화번호" value={regForm.phone}   onChangeText={t => onChangeField('phone', t)}   placeholder="예) 02-1234-5678" />
            <Field label="웹사이트" value={regForm.website} onChangeText={t => onChangeField('website', t)} placeholder="예) mygym.kr" />
            <OperatingHoursEditor hours={regHours} updateDay={updateRegDay} notices={regNotices} toggleNotice={toggleRegNotice} hoursNote="" setHoursNote={() => {}} />
          </SectionCard>
        )}
        {step === 3 && (
          <View>
            <SectionCard title="등록 내용을 확인해 주세요">
              {([
                ['헬스장 이름', regForm.name],
                ['위치',        regForm.location],
                ['세부주소',    regForm.addressDetail || '—'],
                ['헬스장 소개', regForm.description],
                ['전화번호',    regForm.phone   || '—'],
                ['웹사이트',    regForm.website || '—'],
                ['운영시간',    serializeHours(regHours) || '—'],
              ] as [string, string][]).map(([label, value], i, arr) => (
                <React.Fragment key={label}>
                  <View style={styles.reviewRow}>
                    <Text style={styles.reviewLabel}>{label}</Text>
                    <Text style={styles.reviewValue}>{value}</Text>
                  </View>
                  {i < arr.length - 1 && <View style={styles.reviewDivider} />}
                </React.Fragment>
              ))}
            </SectionCard>
            <View style={styles.reviewNote}>
              <Ionicons name="information-circle-outline" size={14} color={C.textSub} />
              <Text style={styles.reviewNoteText}>
                제출하시면 바로 등록돼요. 등록 후 보유 머신을 추가할 수 있어요.
              </Text>
            </View>
          </View>
        )}
        <View style={styles.stepNav}>
          {step > 1 && (
            <TouchableOpacity style={styles.stepBack} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setStep(s => s - 1); }} activeOpacity={0.8}>
              <Text style={styles.stepBackText}>이전</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.stepNext, step > 1 && { flex: 1 }, submitting && step === 3 && { opacity: 0.5 }]}
            onPress={step < 3 ? (step === 1 ? () => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); onNextStep(); } : () => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setStep(s => s + 1); }) : () => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); onSubmit(); }}
            activeOpacity={0.88}
            disabled={submitting && step === 3}
          >
            <Text style={styles.stepNextText}>
              {step < 3 ? '다음' : (submitting ? '요청 중...' : '등록하기')}
            </Text>
            {step < 3 && <Ionicons name="arrow-forward" size={15} color={C.bg} />}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function EditView({
  editForm, onChangeEditField, editHours, updateEditDay,
  editNotices, toggleEditNotice, photos, setPhotos, onSave, onAddPhoto,
}: EditViewProps) {
  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <SectionCard title="기본 정보">
          <Field label="헬스장 이름" value={editForm.name}        onChangeText={t => onChangeEditField('name', t)} />
          <Field label="위치"        value={editForm.location}    onChangeText={t => onChangeEditField('location', t)} />
          <Field label="헬스장 소개" value={editForm.description} onChangeText={t => onChangeEditField('description', t)} multiline />
        </SectionCard>
        <SectionCard title="연락처 및 운영시간">
          <Field label="전화번호" value={editForm.phone}   onChangeText={t => onChangeEditField('phone', t)} />
          <Field label="웹사이트" value={editForm.website} onChangeText={t => onChangeEditField('website', t)} />
          <OperatingHoursEditor hours={editHours} updateDay={updateEditDay} notices={editNotices} toggleNotice={toggleEditNotice} hoursNote={editForm.hoursNote} setHoursNote={(v) => onChangeEditField('hoursNote', v)} />
        </SectionCard>
        <View style={styles.sectionCard}>
          <View style={styles.photoSectionHeader}>
            <Text style={styles.sectionCardTitle}>사진</Text>
            <Text style={styles.photoCount}>{photos.length}장 업로드됨</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8, paddingVertical: 8 }}>
            {photos.map((url, idx) => (
              <View key={idx} style={{ position: 'relative' }}>
                <ExpoImage
                  source={{ uri: url }}
                  style={{ width: 100, height: 100, borderRadius: R.card }}
                  contentFit="cover"
                />
                <TouchableOpacity
                  style={{
                    position: 'absolute', top: 4, right: 4,
                    backgroundColor: 'rgba(0,0,0,0.6)',
                    borderRadius: 10, padding: 2,
                  }}
                  onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy); setPhotos(prev => prev.filter((_, i) => i !== idx)); }}
                  activeOpacity={0.8}
                >
                  <Ionicons name="close" size={14} color="#fff" />
                </TouchableOpacity>
              </View>
            ))}
            <TouchableOpacity
              style={{
                width: 100, height: 100, borderRadius: R.card,
                backgroundColor: C.surface, borderWidth: 1.5,
                borderColor: C.border, borderStyle: 'dashed',
                alignItems: 'center', justifyContent: 'center', gap: 4,
              }}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onAddPhoto(); }}
              activeOpacity={0.8}
            >
              <Ionicons name="add" size={24} color={C.textDim} />
              <Text style={{ fontSize: 11, color: C.textDim }}>사진 추가</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
        <TouchableOpacity style={styles.saveBtn} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); onSave(); }} activeOpacity={0.88}>
          <Text style={styles.saveBtnText}>수정 내용 제출</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const MachineItem = React.memo(({ machine, isAdded, onToggle, cardWidth }: {
  machine: Machine;
  isAdded: boolean;
  onToggle: (id: string) => void;
  cardWidth: number;
}) => (
  <View style={{ width: cardWidth, position: 'relative' }}>
    <TouchableOpacity onPress={() => { Haptics.impactAsync(isAdded ? Haptics.ImpactFeedbackStyle.Heavy : Haptics.ImpactFeedbackStyle.Medium); onToggle(machine.id); }} activeOpacity={0.8}>
      <MachineCard machine={machine} variant="grid" width={cardWidth} />
    </TouchableOpacity>
    {isAdded && (
      <View style={styles.checkmarkOverlay}>
        <Ionicons name="checkmark" size={16} color="#000000" />
      </View>
    )}
  </View>
));

function MachinesView({
  machines,
  gymMachineIds, machineMusclFilter, setMachineMusclFilter,
  machineBrandFilter, setMachineBrandFilter,
  showOwnedOnly, setShowOwnedOnly,
  onToggleMachine, onRequestMachine,
}: MachinesViewProps) {
  const CATALOG_MUSCLES = useMemo(() => [...new Set(machines.flatMap(m => parseMuscles(m.targetMuscle)))].sort(), [machines]);
  // NONE(노브랜드 카탈로그)는 항상 맨 뒤로 — 실제 브랜드들이 먼저 보이게
  const CATALOG_BRANDS  = useMemo(() => [...new Set(machines.map(m => m.brand))].sort((a, b) => {
    if (a === 'NONE') return 1;
    if (b === 'NONE') return -1;
    return a.localeCompare(b);
  }), [machines]);

  const filteredMachines = machines.filter(m => {
    if (!m || !m.name || !m.brand || !m.targetMuscle) return false;
    const muscleOk = machineMusclFilter === '전체' || parseMuscles(m.targetMuscle).some(t => t.toLowerCase() === machineMusclFilter.toLowerCase());
    const brandOk  = machineBrandFilter === '전체' || m.brand.toLowerCase() === machineBrandFilter.toLowerCase();
    const ownedOk  = !showOwnedOnly || gymMachineIds.includes(m.id);
    return muscleOk && brandOk && ownedOk;
  });

  const listHeader = (
    <View style={{ paddingHorizontal: 16 }}>
      <View style={styles.machinesHeader}>
        {[
          { value: String(gymMachineIds.length), label: '등록 머신' },
          { value: String([...new Set(gymMachineIds.map(id => machines.find(m => m.id === id)?.targetMuscle).filter(Boolean))].length), label: '운동 부위' },
          { value: String([...new Set(gymMachineIds.map(id => machines.find(m => m.id === id)?.brand).filter(Boolean))].length), label: '브랜드' },
        ].map(s => (
          <View key={s.label} style={styles.machinesStat}>
            <Text style={styles.machinesStatValue}>{s.value}</Text>
            <Text style={styles.machinesStatLabel}>{s.label}</Text>
          </View>
        ))}
      </View>

      <View style={styles.ownershipFilterRow}>
        <TouchableOpacity
          style={[styles.ownershipChip, !showOwnedOnly && styles.ownershipChipActive]}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setShowOwnedOnly(false); }}
          activeOpacity={0.8}
        >
          <Text style={[styles.ownershipChipText, !showOwnedOnly && styles.ownershipChipTextActive]}>전체</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.ownershipChip, showOwnedOnly && styles.ownershipChipActive]}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setShowOwnedOnly(true); }}
          activeOpacity={0.8}
        >
          <Ionicons name="checkmark-circle" size={13} color={showOwnedOnly ? '#000000' : C.textSub} />
          <Text style={[styles.ownershipChipText, showOwnedOnly && styles.ownershipChipTextActive]}>보유 중</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={mrStyles.requestBtn}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onRequestMachine(); }}
          activeOpacity={0.7}
        >
          <Ionicons name="add-circle-outline" size={14} color={C.accent} />
          <Text style={mrStyles.requestBtnText}>찾는 머신이 없나요?</Text>
        </TouchableOpacity>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow} contentContainerStyle={styles.filterRowContent}>
        {['전체', ...CATALOG_MUSCLES].map(m => (
          <TouchableOpacity key={m} style={[styles.filterChip, machineMusclFilter === m && styles.filterChipActive]} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setMachineMusclFilter(machineMusclFilter === m && m !== '전체' ? '전체' : m); }}>
            <Text style={[styles.filterChipText, machineMusclFilter === m && styles.filterChipTextActive]}>{m}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={[styles.filterRow, { marginTop: 0, marginBottom: 12 }]} contentContainerStyle={styles.filterRowContent}>
        {['전체', ...CATALOG_BRANDS].map(b => (
          <TouchableOpacity key={b} style={[styles.filterChip, machineBrandFilter === b && styles.filterChipActive]} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setMachineBrandFilter(machineBrandFilter === b && b !== '전체' ? '전체' : b); }}>
            <Text style={[styles.filterChipText, machineBrandFilter === b && styles.filterChipTextActive]}>{b}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <Text style={[styles.countText, { paddingHorizontal: 0, marginBottom: 8 }]}>{filteredMachines.length}개 머신 · {gymMachineIds.length}개 선택됨</Text>
    </View>
  );

  return (
    <FlatList
      data={filteredMachines}
      keyExtractor={(item) => item.id}
      numColumns={2}
      initialNumToRender={12}
      maxToRenderPerBatch={12}
      windowSize={5}
      removeClippedSubviews={true}
      ListHeaderComponent={listHeader}
      columnWrapperStyle={{ gap: 8, paddingHorizontal: 16 }}
      contentContainerStyle={{ paddingBottom: 52, gap: 8 }}
      showsVerticalScrollIndicator={false}
      renderItem={({ item: machine }) => (
        <MachineItem
          machine={machine}
          isAdded={gymMachineIds.includes(machine.id)}
          onToggle={onToggleMachine}
          cardWidth={MACHINE_CARD_W}
        />
      )}
    />
  );
}

function RoutineTab({
  machines,
  gymRoutines, gymMachineIds, routineBodyPart, routineModalVisible, setRoutineModalVisible,
  routineName, setRoutineName, setRoutineBodyPart, routineSelectedIds,
  setRoutineSelectedIds, editingRoutineId, onOpenAdd, onOpenEdit, onDelete, onSave,
}: RoutineTabProps) {
  // Gym machines filtered by body part
  const gymMachines = machines.filter(m => gymMachineIds.includes(m.id));
  const isAll = routineBodyPart === '전체';
  const filteredGymMachines = isAll
    ? gymMachines
    : gymMachines.filter(m => parseMuscles(m.targetMuscle).some(t => t.toLowerCase() === routineBodyPart.toLowerCase()));
  // Free weights filtered by body part
  const filteredFreeWeights = isAll
    ? FREE_WEIGHTS
    : FREE_WEIGHTS.filter(fw => parseMuscles(fw.targetMuscle).some(t => t.toLowerCase() === routineBodyPart.toLowerCase()));
  // Combined list: gym machines first, then free weights (cast as Machine for MachineCard)
  const routineFilteredMachines: Machine[] = [
    ...filteredGymMachines,
    ...filteredFreeWeights.map(fw => ({ id: fw.id, name: fw.name, brand: fw.brand, targetMuscle: fw.targetMuscle, category: 'Free Weight' } as Machine)),
  ];

  return (
    <ScrollView contentContainerStyle={styles.tabScroll} showsVerticalScrollIndicator={false}>
      <View style={styles.tabSectionHeader}>
        <Text style={styles.tabSectionTitle}>헬스장 추천 루틴</Text>
        <TouchableOpacity style={styles.tabAddBtn} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); onOpenAdd(); }} activeOpacity={0.8}>
          <Ionicons name="add" size={14} color={C.bg} />
          <Text style={styles.tabAddBtnText}>루틴 추가</Text>
        </TouchableOpacity>
      </View>

      {gymRoutines.length === 0 && (
        <View style={styles.emptyState}>
          <Ionicons name="list-outline" size={44} color={C.textDim} />
          <Text style={styles.emptyStateText}>등록된 추천 루틴이 없어요</Text>
          <Text style={styles.emptyStateSub}>"루틴 추가" 버튼을 눌러 루틴을 만들어보세요</Text>
        </View>
      )}
      {gymRoutines.map(r => {
        const col = muscleColor(r.bodyPart);
        return (
          <TouchableOpacity key={r.id} style={styles.routineCard} activeOpacity={0.8} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onOpenEdit(r); }}>
            <View style={styles.routineCardHead}>
              <View style={{ flex: 1 }}>
                <Text style={styles.routineCardName}>{r.name}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
                  <View style={[styles.musclePill, { backgroundColor: col.bg }]}>
                    <Text style={[styles.musclePillText, { color: col.fg }]}>{r.bodyPart}</Text>
                  </View>
                  <Text style={styles.routineCardMeta}>머신 {r.machines.length}개</Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy); onDelete(r.id); }} style={styles.iconBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="trash-outline" size={16} color={C.danger} />
              </TouchableOpacity>
            </View>
            {r.machines.length > 0 && (
              <Text style={styles.routineCardMachines} numberOfLines={2}>
                {r.machines.map(m => m.name).join(' · ')}
              </Text>
            )}
          </TouchableOpacity>
        );
      })}

      {/* Add/Edit Routine Modal */}
      <Modal visible={routineModalVisible} animationType="slide" presentationStyle="fullScreen" onRequestClose={() => setRoutineModalVisible(false)}>
        <SafeAreaView style={styles.safe}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setRoutineModalVisible(false); }} style={styles.backBtn}>
              <Ionicons name="close" size={22} color={C.text} />
            </TouchableOpacity>
            <View style={styles.headerCenter}>
              <Text style={styles.headerTitle}>{editingRoutineId ? '루틴 수정' : '추천 루틴 추가'}</Text>
            </View>
            <View style={{ width: 40 }} />
          </View>
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            {/* 프리웨이트 129개(GIF) + 헬스장 머신이 한 번에 그리드로 나올 수 있어, 일반
                ScrollView+View.map 대신 운동일지 작성화면(PostWorkoutLogModal)과 동일하게
                FlatList 가상화를 쓴다 — 화면 밖 카드는 마운트 해제돼 GIF가 한꺼번에
                재생되며 버벅이거나 스크롤 후 멈추는 문제를 막는다. 루틴 이름/타겟부위
                입력 폼은 ListHeaderComponent로 넣어 FlatList 하나로 스크롤을 통합한다
                (중첩 VirtualizedList 경고 방지). "루틴 저장" 버튼은 리스트 안이 아니라
                아래 고정 바(routineSaveBar)에 별도로 둬서 끝까지 스크롤하지 않아도 항상
                화면 하단에 보이게 한다. */}
            <FlatList
              data={routineFilteredMachines}
              keyExtractor={machine => machine.id}
              numColumns={2}
              columnWrapperStyle={styles.routineGridRow}
              contentContainerStyle={styles.scroll}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              removeClippedSubviews
              initialNumToRender={8}
              maxToRenderPerBatch={6}
              updateCellsBatchingPeriod={50}
              windowSize={7}
              ListHeaderComponent={
                <>
                  <SectionCard title="루틴 정보">
                    <Field label="루틴 이름" value={routineName} onChangeText={t => setRoutineName(t)} placeholder="루틴 이름을 입력하세요" />
                    <Text style={styles.fieldLabel}>타겟 부위</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow} contentContainerStyle={styles.filterRowContent}>
                      {BODY_PARTS.map(bp => (
                        <TouchableOpacity key={bp} style={[styles.filterChip, routineBodyPart === bp && styles.filterChipActive]} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setRoutineBodyPart(bp); }}>
                          <Text style={[styles.filterChipText, routineBodyPart === bp && styles.filterChipTextActive]}>{bp}</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </SectionCard>

                  <View style={styles.tabSectionHeader}>
                    <Text style={styles.groupLabel}>머신 선택</Text>
                    <Text style={styles.countText}>{routineSelectedIds.size}개 선택됨</Text>
                  </View>
                </>
              }
              ListEmptyComponent={
                <View style={styles.emptyState}>
                  <Ionicons name="barbell-outline" size={36} color={C.textDim} />
                  <Text style={styles.emptyStateText}>등록된 머신이 없습니다</Text>
                  <Text style={styles.emptyStateSub}>머신 관리에서 먼저 머신을 추가하세요</Text>
                </View>
              }
              renderItem={({ item: machine }) => {
                const selected = routineSelectedIds.has(machine.id);
                return (
                  <View style={{ width: ROUTINE_CARD_W, position: 'relative' }}>
                    <TouchableOpacity
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setRoutineSelectedIds(prev => {
                          const next = new Set(prev);
                          next.has(machine.id) ? next.delete(machine.id) : next.add(machine.id);
                          return next;
                        });
                      }}
                      activeOpacity={0.8}
                    >
                      <MachineCard machine={machine} variant="grid" width={ROUTINE_CARD_W} />
                    </TouchableOpacity>
                    {selected && (
                      <View style={styles.checkmarkOverlay}>
                        <Ionicons name="checkmark" size={16} color="#000000" />
                      </View>
                    )}
                  </View>
                );
              }}
            />
            <View style={styles.routineSaveBar}>
              <TouchableOpacity
                style={[styles.saveBtn, (!routineName.trim() || routineSelectedIds.size === 0) && { opacity: 0.5 }]}
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); onSave(); }}
                disabled={!routineName.trim() || routineSelectedIds.size === 0}
                activeOpacity={0.88}
              >
                <Text style={styles.saveBtnText}>루틴 저장</Text>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>

    </ScrollView>
  );
}

function NoticeTab({
  announcements, annModalVisible, setAnnModalVisible, onSubmit, onDelete,
}: NoticeTabProps) {
  const [annTitle, setAnnTitle]     = useState('');
  const [annContent, setAnnContent] = useState('');

  function handleOpenModal() {
    setAnnTitle('');
    setAnnContent('');
    setAnnModalVisible(true);
  }

  return (
    <ScrollView contentContainerStyle={styles.tabScroll} showsVerticalScrollIndicator={false}>
      <View style={styles.tabSectionHeader}>
        <Text style={styles.tabSectionTitle}>공지사항</Text>
        <TouchableOpacity style={styles.tabAddBtn} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); handleOpenModal(); }} activeOpacity={0.8}>
          <Ionicons name="add" size={14} color={C.bg} />
          <Text style={styles.tabAddBtnText}>공지 작성</Text>
        </TouchableOpacity>
      </View>

      {announcements.length === 0 && (
        <View style={styles.emptyState}>
          <Ionicons name="megaphone-outline" size={44} color={C.textDim} />
          <Text style={styles.emptyStateText}>등록된 공지사항이 없어요</Text>
        </View>
      )}
      {announcements.map((a, i) => (
        <React.Fragment key={a.id}>
          <View style={styles.noticeRow}>
            <View style={{ flex: 1 }}>
              <View style={styles.noticeRowHead}>
                <Text style={styles.noticeRowTitle} numberOfLines={1}>{a.title}</Text>
                <Text style={styles.noticeRowDate}>{a.createdAt.split('T')[0]}</Text>
              </View>
              <Text style={styles.noticeRowContent} numberOfLines={2}>{a.content}</Text>
            </View>
            <TouchableOpacity onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy); onDelete(a.id); }} style={styles.iconBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="trash-outline" size={15} color={C.danger} />
            </TouchableOpacity>
          </View>
          {i < announcements.length - 1 && <View style={styles.listDivider} />}
        </React.Fragment>
      ))}

      <Modal visible={annModalVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setAnnModalVisible(false)}>
        <SafeAreaView style={styles.safe}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setAnnModalVisible(false); }} style={styles.backBtn}><Ionicons name="close" size={22} color={C.text} /></TouchableOpacity>
            <View style={styles.headerCenter}><Text style={styles.headerTitle}>공지 작성</Text></View>
            <View style={{ width: 40 }} />
          </View>
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <SectionCard>
                <Field label="제목" value={annTitle} onChangeText={t => setAnnTitle(t)} placeholder="공지 제목" />
                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>내용</Text>
                  <TextInput
                    style={[styles.fieldInput, { height: 120, textAlignVertical: 'top', paddingTop: 12 }]}
                    value={annContent} onChangeText={t => setAnnContent(t)}
                    placeholder="공지 내용을 입력하세요" placeholderTextColor={C.textDim}
                    selectionColor={C.accent} multiline autoCorrect={false} autoCapitalize="none" spellCheck={false}
                  />
                </View>
              </SectionCard>
              <TouchableOpacity style={styles.saveBtn} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); onSubmit(annTitle, annContent); }} activeOpacity={0.88}>
                <Text style={styles.saveBtnText}>공지 등록</Text>
              </TouchableOpacity>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </ScrollView>
  );
}

function RequestTab({ requests, readIds, onMarkRead }: RequestTabProps) {
  const unread = requests.filter(r => !readIds.has(r.id));
  const read   = requests.filter(r => readIds.has(r.id));
  return (
    <ScrollView contentContainerStyle={styles.tabScroll} showsVerticalScrollIndicator={false}>
      <Text style={styles.requestsSubtitle}>회원들이 익명으로 보낸 요청입니다</Text>
      {requests.length === 0 && (
        <View style={styles.emptyState}>
          <Ionicons name="mail-outline" size={44} color={C.textDim} />
          <Text style={styles.emptyStateText}>아직 접수된 요청사항이 없어요</Text>
        </View>
      )}
      {unread.map(r => (
        <View key={r.id} style={styles.requestCard}>
          <View style={{ flex: 1 }}>
            <Text style={styles.requestMsg}>{r.message}</Text>
            <Text style={styles.requestDate}>{r.createdAt.split('T')[0]}</Text>
          </View>
          <TouchableOpacity
            style={styles.readBtn}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onMarkRead(r.id); }}
            activeOpacity={0.8}
          >
            <Text style={styles.readBtnText}>확인 완료</Text>
          </TouchableOpacity>
        </View>
      ))}
      {read.length > 0 && <Text style={[styles.groupLabel, { marginTop: 12 }]}>확인 완료</Text>}
      {read.map(r => (
        <View key={r.id} style={[styles.requestCard, { opacity: 0.5 }]}>
          <View style={{ flex: 1 }}>
            <Text style={styles.requestMsg}>{r.message}</Text>
            <Text style={styles.requestDate}>{r.createdAt.split('T')[0]}</Text>
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

function ManageView({
  activeManagerTab, setActiveManagerTab,
  routineTabProps, noticeTabProps, requestTabProps,
}: ManageViewProps) {
  return (
    <View style={{ flex: 1 }}>
      {/* Tab bar */}
      <View style={styles.tabBar}>
        {([
          { key: 'routine' as ManagerTab, label: '추천 루틴' },
          { key: 'notice'  as ManagerTab, label: '공지사항' },
          { key: 'request' as ManagerTab, label: '요청사항' },
        ]).map(tab => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tabBtn, activeManagerTab === tab.key && styles.tabBtnActive]}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setActiveManagerTab(tab.key); }}
          >
            <Text style={[styles.tabBtnText, activeManagerTab === tab.key && styles.tabBtnTextActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      {activeManagerTab === 'routine'  && <RoutineTab {...routineTabProps} />}
      {activeManagerTab === 'notice'   && <NoticeTab {...noticeTabProps} />}
      {activeManagerTab === 'request'  && <RequestTab {...requestTabProps} />}
    </View>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

export default function ManagerDashboard({ onClose, initialView }: { onClose: () => void; initialView?: ManagerView }) {
  const { user } = useAuth();

  // Navigation
  const [viewStack, setViewStack] = useState<ManagerView[]>(initialView ? ['home', initialView] : ['home']);
  const currentView = viewStack[viewStack.length - 1];
  const push = useCallback((v: ManagerView) => setViewStack(p => [...p, v]), []);
  const pop  = useCallback(() => {
    if (viewStack.length <= 1) { onClose(); return; }
    setViewStack(p => p.slice(0, -1));
  }, [viewStack.length, onClose]);

  const [gyms, setGyms]               = useState<ManagedGym[]>([]);
  const [machines, setMachines] = useState<MachineWithGyms[]>(() => getMachinesCacheSync());

  useEffect(() => {
    let cancelled = false;
    fetchMachines().then(data => { if (!cancelled) setMachines(data); }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  // Supabase에서 승인된 헬스장 로딩
  useEffect(() => {
    if (!user?.id) return;
    async function loadApprovedGyms() {
      try {
        const { supabase } = await import('../../lib/supabase');
        const { data, error } = await supabase
          .from('gyms')
          .select('*, gym_machines(machine_id)')
          .eq('manager_id', user!.id);

        if (error || !data || data.length === 0) return;

        const approvedGyms: ManagedGym[] = data.map((g: any) => ({
          id:          g.id,
          name:        g.name,
          location:    g.location,
          address:     g.location,
          phone:       g.phone ?? '',
          website:     g.website ?? '',
          hours:       g.hours ?? '',
          description: g.description ?? '',
          managerId:   g.manager_id,
          machineIds:  (g.gym_machines ?? []).map((gm: any) => gm.machine_id),
          status:      'approved' as const,
          submittedAt: g.created_at?.slice(0, 10) ?? '',
          photoCount:  0,
        }));

        setGyms(prev => {
          const existingIds = new Set(prev.map(g => g.id));
          const newGyms = approvedGyms.filter(g => !existingIds.has(g.id));
          return [...newGyms, ...prev];
        });
      } catch (e: any) {
        console.warn('[ManagerDashboard] 헬스장 로딩 오류:', e.message);
      }
    }
    loadApprovedGyms();
  }, [user?.id]);
  const [selectedGym, setSelectedGym] = useState<ManagedGym | null>(null);
  const [machineReqVisible, setMachineReqVisible] = useState(false);

  const [weeklyVisitors, setWeeklyVisitors] = useState<number | null>(null);
  const [gymFavCount,    setGymFavCount]    = useState<number | null>(null);

  // 대표 헬스장: 승인된 것 우선, 없으면 첫번째
  const primaryGym = gyms.find(g => g.status === 'approved') ?? gyms[0] ?? null;

  useEffect(() => {
    if (!primaryGym) { setWeeklyVisitors(null); setGymFavCount(null); return; }
    let alive = true;

    // 이번 주 월요일~일요일 (로컬 기준)
    const now = new Date();
    const day = now.getDay();               // 0(일)~6(토)
    const diffToMon = (day === 0 ? -6 : 1 - day);
    const monday = new Date(now); monday.setDate(now.getDate() + diffToMon);
    const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6);
    const fmt = (d: Date) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${dd}`;
    };

    (async () => {
      const [visitors, fav] = await Promise.all([
        fetchWeeklyVisitors(primaryGym.id, fmt(monday), fmt(sunday)).catch(() => 0),
        fetchGymFavoriteCount(primaryGym.id).catch(() => 0),
      ]);
      if (!alive) return;
      setWeeklyVisitors(visitors);
      setGymFavCount(fav);
    })();

    return () => { alive = false; };
  }, [primaryGym?.id]);

  // Register form
  const [step, setStep]               = useState(1);
  const [regForm, setRegForm]         = useState<GymForm>(EMPTY_GYM_FORM);
  const [regHours, setRegHours]       = useState<OperatingHours>(DEFAULT_HOURS);
  const [regNotices, setRegNotices]   = useState<string[]>([]);
  const [submitting, setSubmitting]   = useState(false);
  const [registerResultMode, setRegisterResultMode] = useState<'registered' | 'link-requested'>('registered');
  const [duplicateModalVisible, setDuplicateModalVisible] = useState(false);
  const [pendingDuplicateGym, setPendingDuplicateGym] = useState<{ id: string; name: string } | null>(null);

  const onChangeRegField = useCallback((key: keyof GymForm, value: string) => {
    setRegForm(f => ({ ...f, [key]: value }));
  }, []);

  // Edit form
  const [editForm, setEditForm]       = useState<GymForm>(EMPTY_GYM_FORM);
  const [editHours, setEditHours]     = useState<OperatingHours>(DEFAULT_HOURS);
  const [editNotices, setEditNotices] = useState<string[]>([]);
  const [photos, setPhotos]           = useState<string[]>([]);

  const onChangeEditField = useCallback((key: keyof GymForm, value: string) => {
    setEditForm(f => ({ ...f, [key]: value }));
  }, []);

  // Machines view
  const [gymMachineIds, setGymMachineIds]           = useState<string[]>([]);
  const originalMachineIds                          = useRef<string[]>([]);
  const [showSaveConfirm, setShowSaveConfirm]       = useState(false);
  const [machineMusclFilter, setMachineMusclFilter] = useState('전체');
  const [machineBrandFilter, setMachineBrandFilter] = useState('전체');
  const [showOwnedOnly, setShowOwnedOnly]           = useState(false);

  // Manage view tabs
  const [activeManagerTab, setActiveManagerTab] = useState<ManagerTab>('routine');

  // Routine tab state
  const [gymRoutines, setGymRoutines]             = useState<ManagerGymRoutine[]>([]);
  const [routineModalVisible, setRoutineModalVisible] = useState(false);
  const [routineName, setRoutineName]             = useState('');
  const [routineBodyPart, setRoutineBodyPart]     = useState('전체');
  const [routineSelectedIds, setRoutineSelectedIds] = useState<Set<string>>(new Set());
  const [editingRoutineId, setEditingRoutineId]   = useState<string | null>(null);

  // Announcement tab state
  const [announcements, setAnnouncements]       = useState<GymAnnouncement[]>([]);
  const [annModalVisible, setAnnModalVisible]   = useState(false);

  // Request tab state
  const [requests, setRequests]   = useState<GymRequest[]>([]);
  const [readIds, setReadIds]     = useState<Set<string>>(new Set());

  // ─── Helpers ─────────────────────────────────────────────────────────────

  const updateRegDay = useCallback((day: keyof OperatingHours, field: keyof DayHours, value: any) =>
    setRegHours(prev => ({ ...prev, [day]: { ...prev[day], [field]: value } })), []);

  const updateEditDay = useCallback((day: keyof OperatingHours, field: keyof DayHours, value: any) =>
    setEditHours(prev => ({ ...prev, [day]: { ...prev[day], [field]: value } })), []);

  const makeToggleNotice = (
    setNotices: React.Dispatch<React.SetStateAction<string[]>>,
    setH: React.Dispatch<React.SetStateAction<OperatingHours>>,
  ) => (chip: string) => {
    setNotices(prev => {
      const active = prev.includes(chip);
      if (!active && chip === '24시간 오픈') {
        setH(h => { const u = { ...h }; DAY_KEYS.forEach(d => { u[d] = { ...u[d], open: '00:00', close: '24:00' }; }); return u; });
      }
      if (!active && chip === '연중무휴') {
        setH(h => { const u = { ...h }; DAY_KEYS.forEach(d => { u[d] = { ...u[d], enabled: true }; }); return u; });
      }
      return active ? prev.filter(c => c !== chip) : [...prev, chip];
    });
  };

  const toggleRegNotice  = useCallback(makeToggleNotice(setRegNotices, setRegHours),  []);
  const toggleEditNotice = useCallback(makeToggleNotice(setEditNotices, setEditHours), []);

  const serializeHours = useCallback((h: OperatingHours): string =>
    DAY_KEYS.filter(d => h[d].enabled).map(d => `${DAY_LABELS[d]} ${h[d].open}~${h[d].close}`).join(', '), []);

  // "월 09:00~22:00, 화 09:00~22:00, 토 10:00~20:00" → OperatingHours 로 역직렬화.
  // 문자열에 없는 요일은 휴무(enabled:false)로 둔다. 파싱 실패 시 DEFAULT_HOURS 폴백.
  const parseHours = useCallback((raw?: string | null): OperatingHours => {
    if (!raw || !raw.trim()) return DEFAULT_HOURS;
    try {
      // 라벨('월')→key('mon') 역매핑
      const labelToKey: Record<string, keyof OperatingHours> = {} as any;
      (Object.keys(DAY_LABELS) as (keyof OperatingHours)[]).forEach(k => {
        labelToKey[DAY_LABELS[k]] = k;
      });

      // 모든 요일을 일단 휴무로 초기화 (시간 기본값은 DEFAULT_HOURS에서 가져옴)
      const result = {} as OperatingHours;
      (Object.keys(DEFAULT_HOURS) as (keyof OperatingHours)[]).forEach(k => {
        result[k] = { ...DEFAULT_HOURS[k], enabled: false };
      });

      let matched = 0;
      raw.split(',').forEach(part => {
        const seg = part.trim();
        if (!seg) return;
        // "월 09:00~22:00" → ["월", "09:00~22:00"]
        const sp = seg.indexOf(' ');
        if (sp < 0) return;
        const label = seg.slice(0, sp).trim();
        const time  = seg.slice(sp + 1).trim();
        const key = labelToKey[label];
        if (!key) return;
        const [open, close] = time.split('~').map(t => t.trim());
        if (!open || !close) return;
        result[key] = { enabled: true, open, close };
        matched += 1;
      });

      // 하나도 못 읽었으면 형식이 깨진 것 → 폴백
      return matched > 0 ? result : DEFAULT_HOURS;
    } catch {
      return DEFAULT_HOURS;
    }
  }, []);

  const openEdit = useCallback(async (gym: ManagedGym) => {
    setSelectedGym(gym);
    setEditForm({ name: gym.name, location: gym.location, addressDetail: '', description: gym.description, phone: gym.phone, website: gym.website, hoursNote: gym.hoursNote ?? '' });
    setEditHours(parseHours(gym.hours)); setEditNotices([]);
    setPhotos([]);
    push('edit');

    if (user?.id) {
      const urls = await fetchGymPhotoUrlsByUser(gym.id, user.id);
      setPhotos(urls);
    }
  }, [push, user?.id, parseHours]);

  const openMachines = useCallback(async (gym: ManagedGym) => {
    if (!gym) return;
    setSelectedGym(gym);
    setGymMachineIds([]);
    originalMachineIds.current = [];
    setShowSaveConfirm(false);
    setMachineMusclFilter('전체');
    setMachineBrandFilter('전체');
    setShowOwnedOnly(false);
    push('machines');

    // Supabase에서 머신 ID 로딩 (push 후 비동기)
    const supabaseIds = await fetchGymMachineIds(gym.id);
    const localIds = getGymMachineIds(gym.id);
    const ids = supabaseIds.length > 0
      ? supabaseIds
      : localIds.length > 0
        ? localIds
        : [...(gym.machineIds ?? [])];
    setGymMachineIds([...ids]);
    originalMachineIds.current = [...ids];
  }, [push]);

  const openStats = useCallback((gym: ManagedGym) => {
    setSelectedGym(gym);
    push('stats');
  }, [push]);

  async function loadRoutines(gymId: string) {
    const { supabase } = await import('../../lib/supabase');
    const { data, error } = await supabase
      .from('gym_routines')
      .select('id, gym_id, name, body_part, machine_ids, created_at')
      .eq('gym_id', gymId)
      .order('created_at', { ascending: true });

    if (error || !data) {
      setGymRoutines(makeMockRoutines(gymId, machines));
      return;
    }

    setGymRoutines(data.map(r => {
      const machineIds: string[] = r.machine_ids ?? [];
      return {
        id:        r.id,
        gymId:     r.gym_id,
        name:      r.name,
        bodyPart:  r.body_part,
        machines:  machineIds.map(id => {
          const m = machines.find(x => x.id === id);
          return m ? { id: m.id, name: m.name, brand: m.brand, targetMuscle: m.targetMuscle, category: m.category } : { id, name: id, brand: '', targetMuscle: '', category: '' };
        }),
        createdAt: r.created_at,
      };
    }));
  }

  const openManage = useCallback((gym: ManagedGym, tab: ManagerTab = 'routine') => {
    setSelectedGym(gym);
    setActiveManagerTab(tab);
    loadRoutines(gym.id);
    setAnnouncements(getAnnouncements(gym.id));
    const reqs = getRequestsByGymId(gym.id);
    setRequests(reqs);
    setReadIds(new Set(reqs.filter(r => r.read).map(r => r.id)));
    // Load gym's machine IDs for routine tab filtering
    const savedIds = getGymMachineIds(gym.id);
    const ids = savedIds.length > 0 ? savedIds : [...(gym.machineIds ?? [])];
    setGymMachineIds(ids);
    push('manage');
  }, [push]);

  const toggleMachine = useCallback((id: string) =>
    setGymMachineIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]), []);

  const handleMachinesBack = useCallback(() => {
    if (viewStack.length <= 1) { onClose(); return; }
    const orig = originalMachineIds.current;
    const hasChanges =
      gymMachineIds.length !== orig.length ||
      gymMachineIds.some(id => !orig.includes(id)) ||
      orig.some(id => !gymMachineIds.includes(id));
    if (!hasChanges) {
      pop();
      return;
    }
    setShowSaveConfirm(true);
  }, [gymMachineIds, pop, viewStack.length, onClose]);

  // 등록 폼 초기화 + 이전 매니저 신청 정보 자동 승계 — onRegister와 initialView 진입 경로에서 공유
  const resetRegisterForm = useCallback(() => {
    setStep(1); setRegForm(EMPTY_GYM_FORM); setRegHours(DEFAULT_HOURS); setRegNotices([]);
    setRegisterResultMode('registered');

    // 이전에 제출했던 매니저 신청 정보(gymName/location)가 있으면 폼에 미리 채워준다 —
    // 조회 실패/결과 없음이면 빈 폼 그대로 유지, 채워져도 그대로 수정 가능
    if (user?.id) {
      getManagerRequests(user.id)
        .then(reqs => {
          const latest = reqs[0];
          if (!latest) return;
          setRegForm(f => ({
            ...f,
            name:     f.name || latest.gymName,
            location: f.location || latest.location,
          }));
        })
        .catch(() => {});
    }
  }, [user?.id]);

  const onRegister = useCallback(() => {
    if (gyms.length > 0) {
      Alert.alert(
        '이미 헬스장을 관리 중이에요',
        '매니저는 하나의 헬스장만 관리할 수 있어요.',
      );
      return;
    }
    resetRegisterForm();
    push('register');
  }, [gyms, push, resetRegisterForm]);

  // initialView='register'로 시작된 경우 — viewStack 초기값에 이미 'register'가 쌓여 있으므로
  // push는 다시 하지 않고, onRegister와 동일한 폼 초기화/자동승계만 1회 실행한다.
  useEffect(() => {
    if (initialView === 'register') {
      resetRegisterForm();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Register helpers ─────────────────────────────────────────────────────

  // step 1 → 2 이동 시 주소 검증
  const handleNextStep = useCallback(async () => {
    if (!regForm.name.trim() || !regForm.location.trim()) {
      Alert.alert('입력 오류', '헬스장 이름과 위치는 필수 항목입니다.');
      return;
    }
    setSubmitting(true);
    const coords = await geocodeAddress(regForm.location.trim());
    setSubmitting(false);
    if (!coords) {
      Alert.alert(
        '주소를 확인해주세요',
        `"${regForm.location.trim()}" 주소를 찾을 수 없어요.\n\n도로명 주소나 지번 주소를 정확하게 입력해주세요.\n예) 서울 강남구 테헤란로 152`,
        [{ text: '확인', style: 'default' }],
      );
      return;
    }
    setStep(s => s + 1);
  }, [regForm, setStep]);

  const submitRegistration = useCallback(async () => {
    if (submitting) return;
    if (!regForm.name.trim() || !regForm.location.trim()) {
      Alert.alert('입력 오류', '헬스장 이름과 위치는 필수 항목입니다.');
      return;
    }
    if (regForm.description) {
      const banned = await containsBannedWord(regForm.description);
      if (banned) {
        Alert.alert('사용 불가', '사용할 수 없는 단어가 포함되어 있어요.');
        return;
      }
    }
    const alreadyPending = gyms.some(g => g.status === 'pending');
    if (alreadyPending) {
      Alert.alert('이미 등록 요청 중', '현재 검토 중인 헬스장 등록 요청이 있습니다.');
      return;
    }

    // 최소한의 중복 방지 안전장치 — 이름/위치가 비슷한 헬스장이 있으면 확인 후 진행
    const existingGyms = await fetchGyms().catch(() => []);
    const similarGym = existingGyms.find(g =>
      isSameGymName(g.name, regForm.name) || isSimilarGymLocation(g.location, regForm.location)
    );
    if (similarGym) {
      setPendingDuplicateGym({ id: similarGym.id, name: similarGym.name });
      setDuplicateModalVisible(true);
      return;
    }

    setSubmitting(true);

    const notes = [
      regForm.phone       ? `전화: ${regForm.phone}` : '',
      regForm.description ? regForm.description      : '',
    ].filter(Boolean).join('\n');

    const { success, error } = await registerGymImmediately(
      user?.id ?? '',
      regForm.name.trim(),
      regForm.location.trim(),
      regForm.addressDetail.trim(),
      notes,
      serializeHours(regHours),
    );

    if (!success) {
      Alert.alert('오류', '헬스장 등록 중 오류가 발생했습니다.\n' + (error ?? ''));
      setSubmitting(false);
      return;
    }

    invalidateGymsCache();

    const fullLocation = regForm.location.trim() +
      (regForm.addressDetail.trim() ? ' ' + regForm.addressDetail.trim() : '');

    const newGym: ManagedGym = {
      id: uid(), ...regForm, location: fullLocation,
      hours: serializeHours(regHours),
      machineIds: [], managerId: user?.id ?? 'u2',
      status: 'approved',
      submittedAt: new Date().toISOString().split('T')[0],
      photoCount: 0,
    };
    setGyms(prev => [...prev, newGym]);
    setSubmitting(false);
    setStep(4);
  }, [submitting, regForm, gyms, serializeHours, regHours, user]);

  const handleCancelDuplicateGym = useCallback(() => {
    setDuplicateModalVisible(false);
    setPendingDuplicateGym(null);
  }, []);

  const handleConfirmDuplicateGym = useCallback(async () => {
    const gym = pendingDuplicateGym;
    setDuplicateModalVisible(false);
    if (!gym) return;

    setSubmitting(true);
    const linkResult = await submitGymManagerLinkRequest(user?.id ?? '', gym.id, gym.name);
    setSubmitting(false);
    if (!linkResult.success) {
      Alert.alert('요청 실패', linkResult.error ?? '잠시 후 다시 시도해주세요.');
      return;
    }
    setRegisterResultMode('link-requested');
    setStep(4);
  }, [pendingDuplicateGym, user]);

  // ─── Routine tab helpers ──────────────────────────────────────────────────

  const openAddRoutine = useCallback(() => {
    setEditingRoutineId(null); setRoutineName(''); setRoutineBodyPart('전체'); setRoutineSelectedIds(new Set());
    setRoutineModalVisible(true);
  }, []);

  const openEditRoutine = useCallback((r: ManagerGymRoutine) => {
    setEditingRoutineId(r.id); setRoutineName(r.name); setRoutineBodyPart(r.bodyPart);
    setRoutineSelectedIds(new Set(r.machines.map(m => m.id)));
    setRoutineModalVisible(true);
  }, []);

  const saveRoutine = useCallback(async () => {
    if (!routineName.trim()) { Alert.alert('입력 오류', '루틴 이름을 입력해 주세요.'); return; }
    const banned = await containsBannedWord(routineName);
    if (banned) {
      Alert.alert('사용 불가', '사용할 수 없는 단어가 포함되어 있어요.');
      return;
    }
    if (routineSelectedIds.size === 0 || !selectedGym) return;

    const machineIds = [...routineSelectedIds];
    const machineEntries = machineIds.map(id => {
      const m = machines.find(x => x.id === id);
      return m ? { id: m.id, name: m.name, brand: m.brand, targetMuscle: m.targetMuscle, category: m.category } : { id, name: id, brand: '', targetMuscle: '', category: '' };
    });

    const { supabase } = await import('../../lib/supabase');

    if (editingRoutineId) {
      const { error } = await supabase
        .from('gym_routines')
        .update({
          name:        routineName.trim(),
          body_part:   routineBodyPart,
          machine_ids: machineIds,
          updated_at:  new Date().toISOString(),
        })
        .eq('id', editingRoutineId);

      if (error) { Alert.alert('오류', '루틴 수정에 실패했습니다: ' + error.message); return; }
      setGymRoutines(prev =>
        prev.map(r => r.id === editingRoutineId
          ? { ...r, name: routineName.trim(), bodyPart: routineBodyPart, machines: machineEntries }
          : r
        )
      );
    } else {
      const newId = uid();
      const { error } = await supabase
        .from('gym_routines')
        .insert({
          id:          newId,
          gym_id:      selectedGym.id,
          name:        routineName.trim(),
          body_part:   routineBodyPart,
          machine_ids: machineIds,
          created_at:  new Date().toISOString(),
        });

      if (error) { Alert.alert('오류', '루틴 저장에 실패했습니다: ' + error.message); return; }
      setGymRoutines(prev => [
        { id: newId, gymId: selectedGym.id, name: routineName.trim(), bodyPart: routineBodyPart, machines: machineEntries, createdAt: new Date().toISOString() },
        ...prev,
      ]);
    }

    setRoutineModalVisible(false);
    setRoutineName(''); setRoutineBodyPart('전체'); setRoutineSelectedIds(new Set()); setEditingRoutineId(null);
  }, [routineName, routineSelectedIds, editingRoutineId, routineBodyPart, selectedGym, machines]);

  const deleteRoutine = useCallback((id: string) =>
    Alert.alert('루틴 삭제', '이 루틴을 삭제할까요?', [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제', style: 'destructive', onPress: async () => {
          const { supabase } = await import('../../lib/supabase');
          await supabase.from('gym_routines').delete().eq('id', id);
          setGymRoutines(prev => prev.filter(r => r.id !== id));
        },
      },
    ]), []);

  // ─── Announcement tab helpers ─────────────────────────────────────────────

  const submitAnnouncement = useCallback(async (title: string, content: string) => {
    if (!title.trim() || !content.trim()) { Alert.alert('입력 오류', '제목과 내용을 모두 입력해 주세요.'); return; }
    const banned = await containsBannedWord(title);
    if (banned) {
      Alert.alert('사용 불가', '사용할 수 없는 단어가 포함되어 있어요.');
      return;
    }
    if (!selectedGym) return;
    addAnnouncement(selectedGym.id, title.trim(), content.trim());
    setAnnouncements(getAnnouncements(selectedGym.id));
    setAnnModalVisible(false);
  }, [selectedGym]);

  const handleDeleteAnn = useCallback((id: string) =>
    Alert.alert('공지 삭제', '이 공지사항을 삭제할까요?', [
      { text: '취소', style: 'cancel' },
      { text: '삭제', style: 'destructive', onPress: () => { deleteAnnouncement(id); setAnnouncements(prev => prev.filter(a => a.id !== id)); } },
    ]), []);

  const handleMarkRead = useCallback((id: string) => {
    markRequestAsRead(id);
    setReadIds(prev => new Set([...prev, id]));
  }, []);

  // ─── Photo upload ─────────────────────────────────────────────────────────

  const handleAddPhoto = useCallback(async () => {
    async function upload(uri: string) {
      if (!user || !selectedGym) return;
      try {
        const photoId  = `gym_photo_${Date.now()}`;
        const fileName = `${user.id}/gym-${selectedGym.id}-${photoId}.jpg`;

        // FormData 방식으로 업로드 (Expo Go 환경 호환)
        const formData = new FormData();
        formData.append('file', {
          uri,
          name: fileName,
          type: 'image/jpeg',
        } as any);

        const { supabase } = await import('../../lib/supabase');
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          Alert.alert('업로드 실패', '로그인이 필요합니다.');
          return;
        }

        const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
        const uploadUrl    = `${SUPABASE_URL}/storage/v1/object/gym-photos/${fileName}`;

        const response = await fetch(uploadUrl, {
          method:  'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'x-upsert':      'true',
          },
          body: formData,
        });

        if (!response.ok) {
          const errText = await response.text();
          if (__DEV__) console.warn('[handleAddPhoto] 업로드 실패:', errText);
          Alert.alert('업로드 실패', '사진 업로드에 실패했습니다.');
          return;
        }

        const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/gym-photos/${fileName}`;
        setPhotos(prev => [...prev, publicUrl]);
        Alert.alert('업로드 완료', '사진이 업로드되었습니다.');
      } catch (e) {
        if (__DEV__) console.warn('[handleAddPhoto] 오류:', e);
        Alert.alert('업로드 실패', '사진 업로드 중 오류가 발생했습니다.');
      }
    }

    Alert.alert('사진 추가', '사진을 선택하세요', [
      {
        text: '카메라로 찍기',
        onPress: async () => {
          const { status } = await ImagePicker.requestCameraPermissionsAsync();
          if (status !== 'granted') { Alert.alert('권한 필요', '카메라 접근 권한이 필요합니다.'); return; }
          const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], allowsEditing: true, quality: 0.85 });
          if (!result.canceled && result.assets[0]) await upload(result.assets[0].uri);
        },
      },
      {
        text: '앨범에서 선택',
        onPress: async () => {
          let result: ImagePicker.ImagePickerResult;
          try {
            result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, quality: 0.85 });
          } catch (e) {
            console.warn('[GymPick] 사진 라이브러리 접근 실패:', e);
            Alert.alert('권한 필요', '사진 라이브러리 접근 권한이 필요합니다.');
            return;
          }
          if (!result.canceled && result.assets[0]) await upload(result.assets[0].uri);
        },
      },
      { text: '취소', style: 'cancel' },
    ]);
  }, [user, selectedGym]);

  // ─── Save edits ───────────────────────────────────────────────────────────

  const saveEdits = useCallback(async () => {
    if (!selectedGym) return;
    const updatedHours = serializeHours(editHours);
    const { supabase }  = await import('../../lib/supabase');

    const updatePayload = {
      name:        (editForm.name        ?? '').trim(),
      location:    (editForm.location    ?? '').trim(),
      description: (editForm.description ?? '').trim(),
      phone:       (editForm.phone       ?? '').trim(),
      website:     (editForm.website     ?? '').trim(),
      hours:       updatedHours || null,
      hours_note:  (editForm.hoursNote ?? '').trim() || null,
    };

    if (__DEV__) console.log('[saveEdits] payload:', updatePayload, 'gymId:', selectedGym.id);

    const { data, error } = await supabase
      .from('gyms')
      .update(updatePayload)
      .eq('id', selectedGym.id)
      .select();

    if (__DEV__) console.log('[saveEdits] result:', data, error);

    if (error) {
      Alert.alert('저장 실패', `정보 수정에 실패했습니다.\n${error.message}\n코드: ${error.code}`);
      return;
    }

    setGyms(prev => prev.map(g =>
      g.id === selectedGym.id ? { ...g, ...editForm, hours: updatedHours, hoursNote: (editForm.hoursNote ?? '').trim() || null } : g
    ));
    Alert.alert('수정 완료', '헬스장 정보가 수정되었습니다.', [{
      text: '확인',
      onPress: () => { invalidateGymsCache(); pop(); },
    }]);
  }, [selectedGym, editForm, editHours, serializeHours, pop]);

  // ─── View meta ────────────────────────────────────────────────────────────

  const VIEW_META: Record<ManagerView, { title: string; subtitle?: string }> = {
    home:     { title: '내 헬스장',        subtitle: `${gyms.length}개 등록됨` },
    register: { title: '헬스장 등록 신청', subtitle: step < 4 ? `${step}단계 / 3단계` : undefined },
    edit:     { title: selectedGym?.name ?? '정보 수정', subtitle: '프로필 수정' },
    machines: { title: selectedGym?.name ?? '머신 관리', subtitle: `${gymMachineIds.length}개 선택됨` },
    manage:   { title: selectedGym?.name ?? '관리 센터', subtitle: '루틴 · 공지 · 요청' },
    stats:    { title: selectedGym?.name ?? '이용 통계', subtitle: '머신별 통계' },
  };

  const meta = VIEW_META[currentView] ?? { title: '매니저', subtitle: undefined };

  // Determine back handler for machines view (uses unsaved-changes prompt)
  const handleBack = currentView === 'machines' ? handleMachinesBack : pop;

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />
      <Header
        title={meta.title}
        subtitle={meta.subtitle}
        onBack={handleBack}
        right={
          currentView === 'home' ? (
            <View style={styles.managerBadge}>
              <Text style={styles.managerBadgeText}>매니저</Text>
            </View>
          ) : currentView === 'machines' ? (
            <TouchableOpacity
              onPress={async () => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                if (!selectedGym) return;
                updateGymMachines(selectedGym.id, gymMachineIds);
                const { error } = await saveGymMachineIds(selectedGym.id, gymMachineIds);
                if (error) {
                  Alert.alert('저장 실패', 'Supabase 저장 중 오류가 발생했습니다.\n' + error);
                  return;
                }
                originalMachineIds.current = [...gymMachineIds];
                setShowSaveConfirm(false);
                Alert.alert('저장 완료', '머신 목록이 저장되었습니다.');
              }}
              style={styles.headerSaveBtn}
              activeOpacity={0.8}
            >
              <Text style={styles.headerSaveBtnText}>저장</Text>
            </TouchableOpacity>
          ) : undefined
        }
      />
      {currentView === 'home' && (
        <HomeView
          gyms={gyms}
          weeklyVisitors={weeklyVisitors}
          gymFavCount={gymFavCount}
          machineCount={primaryGym ? primaryGym.machineIds.length : 0}
          onOpenEdit={openEdit}
          onOpenMachines={openMachines}
          onOpenManage={openManage}
          onOpenStats={openStats}
          onRegister={onRegister}
        />
      )}
      {currentView === 'register' && (
        <RegisterView
          step={step}
          setStep={setStep}
          regForm={regForm}
          onChangeField={onChangeRegField}
          regHours={regHours}
          updateRegDay={updateRegDay}
          regNotices={regNotices}
          toggleRegNotice={toggleRegNotice}
          submitting={submitting}
          serializeHours={serializeHours}
          onSubmit={submitRegistration}
          onNextStep={handleNextStep}
          onBack={pop}
          resultMode={registerResultMode}
        />
      )}
      <DuplicateGymModal
        visible={duplicateModalVisible}
        gymName={pendingDuplicateGym?.name ?? ''}
        onCancel={handleCancelDuplicateGym}
        onConfirm={handleConfirmDuplicateGym}
      />
      {currentView === 'edit' && (
        <EditView
          editForm={editForm}
          onChangeEditField={onChangeEditField}
          editHours={editHours}
          updateEditDay={updateEditDay}
          editNotices={editNotices}
          toggleEditNotice={toggleEditNotice}
          photos={photos}
          setPhotos={setPhotos}
          onSave={saveEdits}
          onAddPhoto={handleAddPhoto}
        />
      )}
      {currentView === 'machines' && (
        <View style={{ flex: 1 }}>
          <MachinesView
            machines={machines}
            gymMachineIds={gymMachineIds}
            machineMusclFilter={machineMusclFilter}
            setMachineMusclFilter={setMachineMusclFilter}
            machineBrandFilter={machineBrandFilter}
            setMachineBrandFilter={setMachineBrandFilter}
            showOwnedOnly={showOwnedOnly}
            setShowOwnedOnly={setShowOwnedOnly}
            onToggleMachine={toggleMachine}
            onRequestMachine={() => setMachineReqVisible(true)}
          />
          <MachineRequestModal
            visible={machineReqVisible}
            onClose={() => setMachineReqVisible(false)}
            gymName={selectedGym?.name ?? ''}
            gymId={selectedGym?.id ?? null}
            requesterId={user?.id ?? ''}
          />
          {showSaveConfirm && (
            <View style={styles.saveConfirmOverlay}>
              <View style={styles.saveConfirmCard}>
                <Text style={styles.saveConfirmTitle}>변경사항을 저장할까요?</Text>
                <Text style={styles.saveConfirmSub}>선택한 머신 목록이 저장됩니다.</Text>
                <View style={styles.saveConfirmBtns}>
                  <TouchableOpacity
                    style={styles.saveConfirmCancelBtn}
                    onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setShowSaveConfirm(false); pop(); }}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.saveConfirmCancelText}>저장 안 함</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.saveConfirmSaveBtn}
                    onPress={async () => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                      if (!selectedGym) return;
                      updateGymMachines(selectedGym.id, gymMachineIds);
                      const { error } = await saveGymMachineIds(selectedGym.id, gymMachineIds);
                      if (error) {
                        Alert.alert('저장 실패', 'Supabase 저장 중 오류가 발생했습니다.\n' + error);
                        return;
                      }
                      originalMachineIds.current = [...gymMachineIds];
                      setShowSaveConfirm(false);
                      pop();
                    }}
                    activeOpacity={0.88}
                  >
                    <Text style={styles.saveConfirmSaveText}>저장</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}
        </View>
      )}
      {currentView === 'stats' && selectedGym && (
        <GymStatsView
          gymId={selectedGym.id}
          gymName={selectedGym.name}
          totalMachines={gymMachineIds.length}
        />
      )}
      {currentView === 'manage' && (
        <ManageView
          activeManagerTab={activeManagerTab}
          setActiveManagerTab={setActiveManagerTab}
          routineTabProps={{
            machines,
            gymRoutines,
            gymMachineIds,
            routineBodyPart,
            routineModalVisible,
            setRoutineModalVisible,
            routineName,
            setRoutineName,
            setRoutineBodyPart,
            routineSelectedIds,
            setRoutineSelectedIds,
            editingRoutineId,
            onOpenAdd: openAddRoutine,
            onOpenEdit: openEditRoutine,
            onDelete: deleteRoutine,
            onSave: saveRoutine,
          }}
          noticeTabProps={{
            announcements,
            annModalVisible,
            setAnnModalVisible,
            onSubmit: submitAnnouncement,
            onDelete: handleDeleteAnn,
          }}
          requestTabProps={{
            requests,
            readIds,
            onMarkRead: handleMarkRead,
          }}
        />
      )}
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: C.bg },
  scroll: { padding: 20, paddingBottom: 52 },

  // Header
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.border, backgroundColor: C.bg, gap: 4 },
  backBtn:      { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle:  { fontSize: 17, fontWeight: '700', color: C.text },
  headerSub:    { fontSize: 11, color: C.textSub, marginTop: 1 },
  managerBadge: { paddingHorizontal: 11, paddingVertical: 5, borderRadius: R.pill, backgroundColor: C.accentBg, borderWidth: 1, borderColor: C.accent + '50' },
  managerBadgeText: { fontSize: 11, fontWeight: '700', color: C.accent },
  headerSaveBtn:     { paddingHorizontal: 14, paddingVertical: 7, backgroundColor: C.accent, borderRadius: R.pill },
  headerSaveBtnText: { fontSize: 13, fontWeight: '700', color: C.bg },

  // Summary stats row
  homeSummary: { flexDirection: 'row', backgroundColor: C.surface, borderRadius: R.card, borderWidth: 1, borderColor: C.border, marginBottom: 24, overflow: 'hidden' },
  summaryCell: { flex: 1, alignItems: 'center', paddingVertical: 16 },
  summaryCellValue: { fontSize: 24, fontWeight: '900', color: C.text, letterSpacing: -0.5 },
  summaryCellLabel: { fontSize: 10, fontWeight: '600', color: C.textSub, marginTop: 3 },

  groupLabel: { fontSize: 10, fontWeight: '700', color: C.textDim, letterSpacing: 1.2, marginBottom: 10, marginTop: 4 },

  // Gym card
  gymCard: { backgroundColor: C.surface, borderRadius: R.card, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: C.border, borderLeftWidth: 3 },
  gymCardHead:   { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12, gap: 8 },
  gymCardName:   { fontSize: 16, fontWeight: '700', color: C.text, marginBottom: 3 },
  gymCardLocRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  gymCardLoc:    { fontSize: 12, color: C.textSub },
  gymCardMeta:   { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 14 },
  metaChip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: C.surfaceHigh, paddingHorizontal: 9, paddingVertical: 5, borderRadius: R.pill },
  metaChipText: { fontSize: 11, fontWeight: '600', color: C.textSub },
  gymCardActions: { flexDirection: 'row', gap: 8 },
  gymActionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 9, borderRadius: R.inner, borderWidth: 1.5, borderColor: C.accent + '45', backgroundColor: C.accentBg },
  gymActionBtnText: { fontSize: 12, fontWeight: '700', color: C.accent },

  // Status badge
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 4, borderRadius: R.pill },
  statusDot:       { width: 6, height: 6, borderRadius: 3 },
  statusBadgeText: { fontSize: 11, fontWeight: '700' },

  registerBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: C.accent, paddingVertical: 15, borderRadius: R.btn, marginTop: 4, marginBottom: 14 },
  registerBtnText: { fontSize: 15, fontWeight: '800', color: C.bg },

  saveBtn:     { backgroundColor: C.accent, paddingVertical: 15, borderRadius: R.btn, alignItems: 'center', marginTop: 8 },
  saveBtnText: { fontSize: 15, fontWeight: '800', color: C.bg },
  // "루틴 저장" 버튼을 FlatList 안(ListFooterComponent)이 아니라 화면 하단에 고정된
  // 별도 바로 뺀 컨테이너 — 끝까지 스크롤하지 않아도 항상 보이게 함
  routineSaveBar: { padding: 16, paddingTop: 12, backgroundColor: C.bg, borderTopWidth: 1, borderTopColor: C.border },

  infoNote: { flexDirection: 'row', gap: 10, backgroundColor: C.surface, borderRadius: R.inner, padding: 13, borderWidth: 1, borderColor: C.border },
  infoNoteText: { flex: 1, fontSize: 12, color: C.textSub, lineHeight: 18 },

  // Section card / field
  sectionCard: { backgroundColor: C.surface, borderRadius: R.card, borderWidth: 1, borderColor: C.border, padding: 16, marginBottom: 14 },
  sectionCardTitle: { fontSize: 13, fontWeight: '700', color: C.textSub, marginBottom: 16, letterSpacing: 0.2 },
  field:      { marginBottom: 14 },
  fieldLabel: { fontSize: 10, fontWeight: '700', color: C.textSub, letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 6 },
  fieldInput: { backgroundColor: C.surfaceHigh, borderRadius: R.inner, borderWidth: 1.5, borderColor: C.border, paddingHorizontal: 13, paddingVertical: 11, fontSize: 15, color: C.text },
  fieldHint:  { fontSize: 11, color: C.textDim, marginTop: 5 },

  // OperatingHours
  hoursCard: { backgroundColor: C.surfaceHigh, borderRadius: R.inner, borderWidth: 1, borderColor: C.border, overflow: 'hidden', marginBottom: 8 },
  dayRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.border },
  dayLabel: { fontSize: 14, fontWeight: '700', color: C.text, width: 20 },
  timeRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  timeInput: { flex: 1, backgroundColor: C.surface, borderRadius: 8, borderWidth: 1, borderColor: C.border, paddingHorizontal: 8, paddingVertical: 7, fontSize: 14, color: C.text, textAlign: 'center' },
  timeSep: { fontSize: 13, color: C.textSub, fontWeight: '600' },
  closedLabel: { flex: 1, fontSize: 13, color: C.textDim, fontWeight: '600' },
  noticeChipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  noticeChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: R.pill, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border },
  noticeChipActive: { backgroundColor: C.accent, borderColor: C.accent },
  noticeChipText: { fontSize: 12, fontWeight: '600', color: C.textSub },
  noticeChipTextActive: { color: C.bg },

  // Step bar
  stepBar: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'center', marginBottom: 24, gap: 0 },
  stepItem:        { alignItems: 'center', gap: 6, width: 72 },
  stepCircle:      { width: 28, height: 28, borderRadius: 14, backgroundColor: C.surfaceHigh, borderWidth: 1.5, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
  stepCircleActive:{ backgroundColor: C.accent, borderColor: C.accent },
  stepCircleDone:  { backgroundColor: C.accentDim, borderColor: C.accentDim },
  stepNum:         { fontSize: 12, fontWeight: '700', color: C.textDim },
  stepLabel:       { fontSize: 10, fontWeight: '600', color: C.textDim, textAlign: 'center' },
  stepConnector:   { height: 1.5, flex: 1, backgroundColor: C.border, marginTop: 13, maxWidth: 28 },
  stepNav:         { flexDirection: 'row', gap: 10, marginTop: 8 },
  stepBack:        { paddingVertical: 14, paddingHorizontal: 20, borderRadius: R.btn, borderWidth: 1, borderColor: C.border, alignItems: 'center' },
  stepBackText:    { fontSize: 15, fontWeight: '700', color: C.textSub },
  stepNext: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: C.accent, paddingVertical: 15, borderRadius: R.btn },
  stepNextText: { fontSize: 15, fontWeight: '800', color: C.bg },

  // Review step
  reviewRow:     { flexDirection: 'row', gap: 12, paddingVertical: 11 },
  reviewDivider: { height: 1, backgroundColor: C.border },
  reviewLabel:   { width: 88, fontSize: 12, fontWeight: '700', color: C.textSub },
  reviewValue:   { flex: 1, fontSize: 13, color: C.text, lineHeight: 19 },
  reviewNote: { flexDirection: 'row', gap: 10, backgroundColor: C.surface, borderRadius: R.inner, padding: 13, borderWidth: 1, borderColor: C.border, marginTop: 4 },
  reviewNoteText: { flex: 1, fontSize: 12, color: C.textSub, lineHeight: 18 },

  // Completion screen
  completionScreen: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  completionIconWrap: { marginBottom: 20 },
  completionTitle: { fontSize: 22, fontWeight: '900', color: C.text, textAlign: 'center', marginBottom: 12, letterSpacing: -0.3 },
  completionMsg: { fontSize: 15, color: C.textSub, textAlign: 'center', lineHeight: 22, marginBottom: 6 },
  completionSub: { fontSize: 13, color: C.textDim, textAlign: 'center', lineHeight: 19 },

  // Photos
  photoSectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  photoCount:         { fontSize: 12, color: C.textSub },
  photoGrid:          { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  photoTile:          { borderRadius: R.inner, overflow: 'hidden' },
  photoPlaceholder:   { flex: 1, backgroundColor: C.surfaceHigh, alignItems: 'center', justifyContent: 'center' },
  photoRemoveBtn:     { position: 'absolute', top: 5, right: 5, width: 20, height: 20, borderRadius: 10, backgroundColor: '#000000bb', alignItems: 'center', justifyContent: 'center' },
  photoUploadBtn:     { borderWidth: 1.5, borderColor: C.border, borderStyle: 'dashed', backgroundColor: C.surfaceHigh, alignItems: 'center', justifyContent: 'center', gap: 4 },
  photoUploadText:    { fontSize: 10, fontWeight: '600', color: C.textSub },

  // Machines view
  machinesHeader: { flexDirection: 'row', backgroundColor: C.surface, borderRadius: R.card, borderWidth: 1, borderColor: C.border, marginBottom: 12, overflow: 'hidden' },
  machinesStat:      { flex: 1, alignItems: 'center', paddingVertical: 16 },
  machinesStatValue: { fontSize: 24, fontWeight: '900', color: C.text, letterSpacing: -0.5 },
  machinesStatLabel: { fontSize: 10, fontWeight: '600', color: C.textSub, marginTop: 3 },

  // Ownership filter
  ownershipFilterRow: { flexDirection: 'row', marginBottom: 12, gap: 8 },
  ownershipChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: R.pill, backgroundColor: C.surface,
    borderWidth: 1, borderColor: C.border,
  },
  ownershipChipActive:    { backgroundColor: C.accent, borderColor: C.accent },
  ownershipChipText:      { fontSize: 13, fontWeight: '600', color: C.textSub },
  ownershipChipTextActive: { color: '#000000', fontWeight: '800' },

  // Filter pills
  filterRow:        { maxHeight: 44, marginBottom: 4 },
  filterRowContent: { paddingHorizontal: 0, gap: 8, flexDirection: 'row', alignItems: 'center' },
  filterChip:           { paddingHorizontal: 12, paddingVertical: 6, borderRadius: R.pill, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border },
  filterChipActive:     { backgroundColor: C.accent, borderColor: C.accent },
  filterChipText:       { fontSize: 12, fontWeight: '600', color: C.textSub },
  filterChipTextActive: { color: C.bg },

  countText: { fontSize: 12, color: C.textDim, fontWeight: '600', marginBottom: 12 },

  // Machine card grid + checkmark overlay
  routineGridRow: { gap: 8, marginBottom: 8 },
  checkmarkOverlay: {
    position: 'absolute', top: 8, right: 8,
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: C.accent,
    alignItems: 'center', justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 4, shadowOffset: { width: 0, height: 2 },
  },

  // Muscle pill
  musclePill:     { paddingHorizontal: 9, paddingVertical: 4, borderRadius: R.pill },
  musclePillText: { fontSize: 11, fontWeight: '700' },

  // Manage view tabs
  tabBar: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: C.border },
  tabBtn: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  tabBtnActive: { borderBottomWidth: 2, borderBottomColor: C.accent },
  tabBtnText: { fontSize: 14, fontWeight: '600', color: C.textSub },
  tabBtnTextActive: { color: C.accent, fontWeight: '800' },

  tabScroll: { padding: 16, paddingBottom: 52 },
  tabSectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  tabSectionTitle: { fontSize: 15, fontWeight: '700', color: C.text },
  tabAddBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 7, borderRadius: R.pill, backgroundColor: C.accent },
  tabAddBtnText: { fontSize: 12, fontWeight: '800', color: C.bg },

  // Empty state
  emptyState:     { alignItems: 'center', gap: 10, paddingVertical: 40 },
  emptyStateText: { fontSize: 16, fontWeight: '700', color: C.textSub },
  emptyStateSub:  { fontSize: 13, color: C.textDim, textAlign: 'center', lineHeight: 20 },

  // Routine card
  routineCard: { backgroundColor: C.surface, borderRadius: R.card, borderWidth: 1, borderColor: C.border, padding: 14, marginBottom: 10 },
  routineCardHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  routineCardName: { fontSize: 15, fontWeight: '700', color: C.text },
  routineCardMeta: { fontSize: 12, color: C.textSub },
  routineCardMachines: { fontSize: 12, color: C.textDim, marginTop: 8, lineHeight: 18 },
  iconBtn: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },

  // Notice (announcement) list
  noticeRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingVertical: 12 },
  noticeRowHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  noticeRowTitle: { flex: 1, fontSize: 15, fontWeight: '700', color: C.text },
  noticeRowDate: { fontSize: 11, color: C.textDim, marginLeft: 8 },
  noticeRowContent: { fontSize: 13, color: C.textSub, lineHeight: 18 },
  listDivider: { height: 1, backgroundColor: C.border },

  // Request list
  requestsSubtitle: { fontSize: 12, color: C.textSub, marginBottom: 14, lineHeight: 18 },
  requestCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.surface, borderRadius: R.card, borderWidth: 1, borderColor: C.border, padding: 14, marginBottom: 10 },
  requestMsg:  { fontSize: 14, color: C.text, lineHeight: 20, marginBottom: 4 },
  requestDate: { fontSize: 11, color: C.textDim },
  readBtn:     { paddingHorizontal: 12, paddingVertical: 7, borderRadius: R.pill, backgroundColor: C.accentBg, borderWidth: 1, borderColor: C.accent + '50' },
  readBtnText: { fontSize: 12, fontWeight: '700', color: C.accent },

  // Save confirmation overlay (machine management)
  saveConfirmOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
    zIndex: 100,
  },
  saveConfirmCard: {
    backgroundColor: C.bg,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  saveConfirmTitle: { fontSize: 18, fontWeight: '900', color: C.text, marginBottom: 8 },
  saveConfirmSub:   { fontSize: 14, color: C.textSub, marginBottom: 24 },
  saveConfirmBtns:  { flexDirection: 'row', gap: 12 },
  saveConfirmCancelBtn: {
    flex: 1, paddingVertical: 14, borderRadius: R.btn,
    backgroundColor: C.surface, borderWidth: 1, borderColor: C.border,
    alignItems: 'center',
  },
  saveConfirmCancelText: { fontSize: 15, fontWeight: '700', color: C.textSub },
  saveConfirmSaveBtn:    { flex: 2, paddingVertical: 14, borderRadius: R.btn, backgroundColor: C.accent, alignItems: 'center' },
  saveConfirmSaveText:   { fontSize: 15, fontWeight: '800', color: '#000000' },

  hoursNoteInput: {
    backgroundColor: C.surfaceHigh,
    borderRadius: R.inner,
    borderWidth: 1,
    borderColor: C.border,
    color: C.text,
    fontSize: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 64,
    textAlignVertical: 'top',
    marginTop: 6,
  },
});

// ── 머신 등록 신청 모달 ──────────────────────────────────────────────────
function MachineRequestModal({
  visible, onClose, gymName, gymId, requesterId,
}: {
  visible:     boolean;
  onClose:     () => void;
  gymName:     string;
  gymId:       string | null;
  requesterId: string;
}) {
  const [brand,        setBrand]        = useState('');
  const [machineName,  setMachineName]  = useState('');
  const [targetMuscle, setTargetMuscle] = useState('');
  const [photoUrl,     setPhotoUrl]     = useState<string | null>(null);
  const [uploading,    setUploading]    = useState(false);
  const [submitting,   setSubmitting]   = useState(false);

  function resetAndClose() {
    setBrand(''); setMachineName(''); setTargetMuscle(''); setPhotoUrl(null);
    setUploading(false); setSubmitting(false);
    onClose();
  }

  async function uploadPhoto(uri: string) {
    if (!requesterId) { Alert.alert('업로드 실패', '로그인이 필요합니다.'); return; }
    setUploading(true);
    try {
      const photoId  = `machine_req_${Date.now()}`;
      const fileName = `machine-requests/${requesterId}/${photoId}.jpg`;
      const formData = new FormData();
      formData.append('file', { uri, name: fileName, type: 'image/jpeg' } as any);

      const { supabase } = await import('../../lib/supabase');
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { Alert.alert('업로드 실패', '로그인이 필요합니다.'); setUploading(false); return; }

      const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
      const uploadUrl    = `${SUPABASE_URL}/storage/v1/object/gym-photos/${fileName}`;
      const response = await fetch(uploadUrl, {
        method:  'POST',
        headers: { 'Authorization': `Bearer ${session.access_token}`, 'x-upsert': 'true' },
        body:    formData,
      });
      if (!response.ok) {
        if (__DEV__) console.warn('[MachineRequest] 업로드 실패:', await response.text());
        Alert.alert('업로드 실패', '사진 업로드에 실패했습니다.');
        setUploading(false);
        return;
      }
      setPhotoUrl(`${SUPABASE_URL}/storage/v1/object/public/gym-photos/${fileName}`);
    } catch (e) {
      if (__DEV__) console.warn('[MachineRequest] 업로드 오류:', e);
      Alert.alert('업로드 실패', '사진 업로드 중 오류가 발생했습니다.');
    } finally {
      setUploading(false);
    }
  }

  function pickPhoto() {
    Alert.alert('머신 사진 추가', '사진을 선택하세요', [
      { text: '카메라로 찍기', onPress: async () => {
          const { status } = await ImagePicker.requestCameraPermissionsAsync();
          if (status !== 'granted') { Alert.alert('권한 필요', '카메라 접근 권한이 필요합니다.'); return; }
          const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], allowsEditing: true, quality: 0.85 });
          if (!result.canceled && result.assets[0]) await uploadPhoto(result.assets[0].uri);
        } },
      { text: '앨범에서 선택', onPress: async () => {
          let result: ImagePicker.ImagePickerResult;
          try { result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, quality: 0.85 }); }
          catch (e) { Alert.alert('권한 필요', '사진 라이브러리 접근 권한이 필요합니다.'); return; }
          if (!result.canceled && result.assets[0]) await uploadPhoto(result.assets[0].uri);
        } },
      { text: '취소', style: 'cancel' },
    ]);
  }

  async function handleSubmit() {
    if (!machineName.trim()) { Alert.alert('입력 확인', '머신 이름을 입력해주세요.'); return; }
    if (!requesterId)        { Alert.alert('오류', '로그인이 필요합니다.'); return; }
    setSubmitting(true);
    const { error } = await submitMachineRequest({
      gymId,
      gymName,
      requesterId,
      brand:        brand.trim(),
      machineName:  machineName.trim(),
      targetMuscle: targetMuscle.trim(),
      photoUrl,
    });
    setSubmitting(false);
    if (error) { Alert.alert('신청 실패', error); return; }
    Alert.alert('신청 완료', '머신 등록 신청이 접수되었어요. 관리자 확인 후 반영됩니다.');
    resetAndClose();
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={resetAndClose}>
      <View style={mrStyles.overlay}>
        <View style={mrStyles.sheet}>
          <View style={mrStyles.header}>
            <Text style={mrStyles.title}>머신 등록 신청</Text>
            <TouchableOpacity onPress={resetAndClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close" size={22} color={C.text} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={mrStyles.body} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <Text style={mrStyles.label}>헬스장</Text>
            <View style={mrStyles.readonlyField}>
              <Text style={mrStyles.readonlyText}>{gymName || '—'}</Text>
            </View>

            <Text style={mrStyles.label}>브랜드</Text>
            <TextInput
              style={mrStyles.input}
              value={brand}
              onChangeText={setBrand}
              placeholder="예: Life Fitness"
              placeholderTextColor={C.textDim}
              autoCorrect={false}
              autoCapitalize="none"
            />

            <Text style={mrStyles.label}>머신 이름 *</Text>
            <TextInput
              style={mrStyles.input}
              value={machineName}
              onChangeText={setMachineName}
              placeholder="예: Lat Pulldown"
              placeholderTextColor={C.textDim}
              autoCorrect={false}
              autoCapitalize="none"
            />

            <Text style={mrStyles.label}>타겟 부위</Text>
            <TextInput
              style={mrStyles.input}
              value={targetMuscle}
              onChangeText={setTargetMuscle}
              placeholder="예: 등"
              placeholderTextColor={C.textDim}
              autoCorrect={false}
              autoCapitalize="none"
            />

            <Text style={mrStyles.label}>머신 사진 (선택)</Text>
            {photoUrl ? (
              <View style={mrStyles.photoPreviewWrap}>
                <ExpoImage source={{ uri: photoUrl }} style={mrStyles.photoPreview} contentFit="cover" />
                <TouchableOpacity style={mrStyles.photoRemove} onPress={() => setPhotoUrl(null)} activeOpacity={0.8}>
                  <Ionicons name="close-circle" size={22} color={C.danger} />
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity style={mrStyles.photoBtn} onPress={pickPhoto} activeOpacity={0.8} disabled={uploading}>
                <Ionicons name={uploading ? 'hourglass-outline' : 'camera-outline'} size={18} color={C.accent} />
                <Text style={mrStyles.photoBtnText}>{uploading ? '업로드 중...' : '사진 추가'}</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[mrStyles.submitBtn, (submitting || uploading) && { opacity: 0.5 }]}
              onPress={handleSubmit}
              activeOpacity={0.85}
              disabled={submitting || uploading}
            >
              <Text style={mrStyles.submitBtnText}>{submitting ? '신청 중...' : '신청하기'}</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const mrStyles = StyleSheet.create({
  requestBtn: {
    marginLeft:    'auto',
    flexDirection: 'row',
    alignItems:    'center',
    gap:           4,
    paddingVertical:   6,
    paddingHorizontal: 4,
  },
  requestBtnText: { fontSize: 13, fontWeight: '700', color: C.accent },

  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: C.bg,
    borderTopLeftRadius:  20,
    borderTopRightRadius: 20,
    maxHeight: '88%',
    paddingBottom: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems:    'center',
    justifyContent:'space-between',
    paddingHorizontal: 20,
    paddingVertical:   16,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  title: { fontSize: 17, fontWeight: '800', color: C.text },
  body:  { padding: 20, gap: 8 },
  label: { fontSize: 12, fontWeight: '700', color: C.textSub, marginTop: 10, marginBottom: 2 },
  input: {
    backgroundColor: C.surface,
    borderRadius: R.inner,
    borderWidth: 1,
    borderColor: C.border,
    color: C.text,
    fontSize: 14,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  readonlyField: {
    backgroundColor: C.surfaceHigh,
    borderRadius: R.inner,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  readonlyText: { fontSize: 14, color: C.textSub },
  photoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 13,
    borderRadius: R.inner,
    borderWidth: 1.5,
    borderColor: C.accent + '60',
    borderStyle: 'dashed',
  },
  photoBtnText: { fontSize: 14, fontWeight: '700', color: C.accent },
  photoPreviewWrap: { position: 'relative', alignSelf: 'flex-start' },
  photoPreview: { width: 120, height: 120, borderRadius: R.inner, backgroundColor: C.surface },
  photoRemove: { position: 'absolute', top: -8, right: -8, backgroundColor: C.bg, borderRadius: 12 },
  submitBtn: {
    backgroundColor: C.accent,
    borderRadius: R.btn,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 20,
  },
  submitBtnText: { fontSize: 15, fontWeight: '800', color: C.bg },
});
