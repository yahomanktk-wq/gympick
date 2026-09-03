import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  FlatList,
  TouchableOpacity,
  TextInput,
  Dimensions,
  Alert,
  Image,
  InteractionManager,
  Animated,
  Linking,
  Platform,
  PixelRatio,
  ActionSheetIOS,
  KeyboardAvoidingView,
  Keyboard,
} from 'react-native';
import * as Sharing from 'expo-sharing';
import { SafeAreaView, SafeAreaProvider } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import ChestIcon     from '../../assets/muscle-icons/chest.svg';
import BackIcon       from '../../assets/muscle-icons/back.svg';
import ShouldersIcon  from '../../assets/muscle-icons/shoulders.svg';
import ArmsIcon       from '../../assets/muscle-icons/arms.svg';
import LegsIcon       from '../../assets/muscle-icons/legs.svg';
import GlutesIcon     from '../../assets/muscle-icons/glutes.svg';
import * as MediaLibrary from 'expo-media-library';
import * as ImagePicker from 'expo-image-picker';
import { captureRef } from 'react-native-view-shot';
import { Ionicons } from '@expo/vector-icons';
import { C, R, T } from '../../theme';
import { GymWithMachines, Machine, MACHINES } from '../../data';
import { MOCK_SESSIONS, getMachinePRsFull, getMachinePRsFromSets } from '../../data/workoutSessions';
import { WorkoutLog, WorkoutEntry, WorkoutSet } from '../../data/types';
import { addNewSession } from '../../data/sessionStore';
import { saveTemplate, getTemplates, deleteTemplate, WorkoutTemplate } from '../../data/templateStore';
import { recordPR } from '../../data/prStore';
import { useAuth } from '../../context/AuthContext';
import { submitGymRegistrationRequest } from '../../lib/db/gymRegistrationRequests';
import { insertWorkoutSession, insertWorkoutEntry, insertWorkoutSet, insertWorkoutPhoto, fetchWorkoutEntriesForSessions, fetchWorkoutSetsForEntries } from '../../lib/db/workouts';
import { uploadWorkoutPhoto } from '../../lib/photoStorage';
import { containsBannedWord } from '../../lib/bannedWords';
import { insertFeedPost } from '../../lib/db/feedPosts';
import { getMachineImageUrl } from '../../lib/machineImageUrl';
import { invalidateActiveFeedPostsCache } from '../../data/feedPostsCache';
import GymPickLogo from '../../components/GymPickLogo';
import OnboardingTooltip from '../../components/OnboardingTooltip';
import { useOnboarding } from '../../hooks/useOnboarding';
import type { OnboardingPointKey } from '../../data/onboardingSteps';
import type { SpotlightRect } from '../../components/OnboardingTooltip';
import WorkoutCameraOverlay from './WorkoutCameraOverlay';
import RoutineReferenceScreen, { MachineExtraInfo } from './RoutineReferenceScreen';
import TodayWorkoutListScreen from './TodayWorkoutListScreen';
import MachineCard from '../../components/MachineCard';
import MachineCardBorder from '../../components/MachineCardBorder';
import RoutineCardMachineThumb from '../../components/RoutineCardMachineThumb';
import { FREE_WEIGHTS, FreeWeightExercise } from '../../data/freeWeights';
import { fetchFreeWeights, fetchWorkoutLogs } from '../../lib/db';
import { fetchMachines, getMachinesCacheSync } from '../../lib/db/machines';
import * as Location from 'expo-location';
import { calcDistanceKm, formatDistance } from '../../lib/geocoding';
import { fetchGymsWithMachines } from '../../lib/db/gyms';
import { brandLogos } from '../../constants/brandLogos';
import { fetchSplitConfig } from '../../lib/db/splitRoutine';
import { getTodayTargets, isRestToday, toEnMuscle, parseMuscles } from '../../lib/splitUtils';
import { useFonts } from 'expo-font';
import { LinearGradient } from 'expo-linear-gradient';

// --- Types

type Step = 'muscle-select' | 'gym-select' | 'routine-reference' | 'today-list' | 'exercise-select' | 'log-sets' | 'photo' | 'done';


export interface SetEntry { weight: number; reps: number; }

export interface ExerciseInfo {
  id: string; name: string; brand: string; targetMuscle: string;
}

// --- Constants

const { width: SCREEN_W } = Dimensions.get('window');
const CARD_W        = Math.floor((SCREEN_W - 48) / 3);
const MUSCLE_CARD_W = Math.floor((SCREEN_W - 44) / 2);

// 프리웨이트 "다른 부위도 보기" 필터칩 순서 (freeWeightsGymVisual.ts의 targetMuscle 값과 일치)
const FW_MUSCLE_FILTERS = ['Chest', 'Back', 'Shoulder', 'Arms', 'Leg'] as const;

// Historical PR map - machineId → { weight, reps } of best set ever logged
const HIST_PRS = getMachinePRsFull(MOCK_SESSIONS);

// 며칠 전인지 문구 (B안: 13일까지 '일', 그 이상 '주')
function formatAgoForCard(dateIso: string): string {
  const then = new Date(dateIso); then.setHours(0, 0, 0, 0);
  const now  = new Date();        now.setHours(0, 0, 0, 0);
  const diffDays = Math.round((now.getTime() - then.getTime()) / 86400000);
  if (diffDays <= 0) return '오늘';
  if (diffDays === 1) return '어제';
  if (diffDays <= 13) return `${diffDays}일 전`;
  return `${Math.floor(diffDays / 7)}주 전`;
}

// --- Date formatter for overlay
function formatWorkoutDate(date: Date): string {
  const year  = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day   = String(date.getDate()).padStart(2, '0');
  const hours = date.getHours();
  const mins  = String(date.getMinutes()).padStart(2, '0');
  const ampm  = hours < 12 ? '오전' : '오후';
  const h12   = hours % 12 === 0 ? 12 : hours % 12;
  return `${year}.${month}.${day} · ${ampm} ${h12}:${mins}`;
}
// Photo: 9:16 vertical social-media ratio (Instagram Story / Reels / TikTok)
const PHOTO_W = SCREEN_W - 32;
const PHOTO_H = Math.round(PHOTO_W * (16 / 9));

// Logo strip sizing (SVG native aspect ≈ 10.05:1)
const LOGO_STRIP_H = 14;
const LOGO_STRIP_W = Math.round(LOGO_STRIP_H * (2805 / 279)); // ≈ 141px

// Safe padding inside the overlay
const OVERLAY_PAD = 20;

// Overlay layout style variants
type OverlayStyle =
  | 's1a' | 's1b' | 's1c' | 's1d' | 's1e'
  | 's2a' | 's2b' | 's2c' | 's2d' | 's2e'
  | 's6a' | 's6b' | 's6c' | 's6d' | 's6e';

type FontSet = {
  muscle: string | undefined;
  routine: string | undefined;
  nickname: string | undefined;
};

const FONT_SETS: Record<number, FontSet> = {
  1: { muscle: 'Quicksilver-Italic',       routine: undefined,              nickname: undefined              },
  2: { muscle: 'Matcha Cih',               routine: 'Mat Saleh',            nickname: 'KCC-Ganpan'           },
  6: { muscle: 'biergartenlt',             routine: undefined,              nickname: undefined              },
};

export function getFontSet(style: OverlayStyle): FontSet {
  const setNum = parseInt(style.charAt(1));
  return FONT_SETS[setNum] ?? FONT_SETS[1];
}

export function getLayoutType(style: OverlayStyle): 'a' | 'b' | 'c' | 'd' | 'e' {
  const t = style.charAt(2);
  return (t === 'a' || t === 'b' || t === 'c' || t === 'd' || t === 'e') ? t : 'a';
}

/**
 * 배경색(hex)의 밝기를 계산해 대비되는 검정/흰색을 반환한다.
 * 오운완 인증샷 레이아웃 E의 GYM PICK 로고 박스처럼, 사용자가 고른 색을
 * 배경으로 쓰면서 그 위에 항상 읽히는 글자색이 필요한 경우에 사용한다.
 */
export function getContrastTextColor(hex: string): string {
  const h = hex.replace('#', '');
  if (h.length !== 6) return '#000000';
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.55 ? '#000000' : '#ffffff';
}

// Fixed presets as specified
const WEIGHT_PRESETS = [
  10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 120, 140, 160, 180, 200,
  220, 240, 260, 280, 300, 320, 340, 360, 380, 400, 420, 440, 460, 480, 500,
];
const REPS_PRESETS   = [2, 4, 6, 8, 10, 12, 14, 16, 18, 20];

// Global machine lookup for resolving routine machines not in current gym.
// 2026-09-02: Supabase가 머신 카탈로그의 유일한 원본이 된 뒤로는, 로컬 정적
// 배열(MACHINES)만 보면 Supabase에만 새로 추가된 항목(예: 새 STANDARD 유형)을
// 못 찾을 수 있다 — fetchMachines()가 채워둔 최신 캐시(getMachinesCacheSync())를
// 뒤에 합쳐서 그런 항목도 찾을 수 있게 한다. 캐시는 비동기로 채워지므로 이 값을
// 쓰는 컴포넌트(ExerciseSelectStep)에서 fetchMachines() 완료 후 재계산한다.
function buildAllMachinesMap(): Record<string, Machine> {
  return Object.fromEntries(
    [...MACHINES, ...getMachinesCacheSync()].map((m) => [m.id, m]),
  );
}

// 부위 그룹 라벨 → 머신 targetMuscle 표준명으로 정규화
// (예: 'Hip (Glutes)' → 'Glutes'). 저장/표시 경계에서만 사용한다.
const MUSCLE_GROUP_TO_CANON: Record<string, string> = {
  'Hip (Glutes)': 'Glutes',
};
function toCanonMuscle(m: string): string {
  return MUSCLE_GROUP_TO_CANON[m] ?? m;
}

// 복합키('m02#1')에서 순수 machineId('m02') 추출. 슬롯 없으면 그대로.
function machineIdFromKey(key: string): string {
  const i = key.lastIndexOf('#');
  return i === -1 ? key : key.slice(0, i);
}

// mid가 프리웨이트인지 실제 목록 멤버십으로 판별한다 (id가 'fw' 접두사를 따른다는
// 가정은 일반 머신-등록 파이프라인으로 들어온 프리웨이트 행에서 깨지므로 사용 금지).
function isFreeWeightId(mid: string, freeWeights: FreeWeightExercise[]): boolean {
  return freeWeights.some(f => f.id === mid);
}

// --- Muscle palette

const MUSCLE_COLORS: Record<string, { fg: string; bg: string }> = {
  Chest:            C.tagMachine,
  Back:             C.tagBrand,
  Leg:             C.tagMuscle,
  Shoulder:        { fg: '#ffd166', bg: '#ffd16618' },
  Arms:             C.tagCategory,
  Core:             { fg: '#06d6a0', bg: '#06d6a018' },
  'Full Body':      { fg: '#a8dadc', bg: '#a8dadc18' },
  'Hip (Glutes)':   { fg: '#ff9ecd', bg: '#ff9ecd18' },
  Glutes:           { fg: '#ff9ecd', bg: '#ff9ecd18' }, // alias kept for machine data
};

function mp(muscle: string) {
  return MUSCLE_COLORS[muscle] ?? { fg: C.textSub, bg: C.border };
}

// --- Muscle group definitions

type SvgComponent = React.FC<{ width?: number; height?: number; color?: string }>;

const MUSCLE_GROUPS: { name: string; sub: string; SvgIcon: SvgComponent }[] = [
  { name: 'Chest',        sub: 'Pectorals',              SvgIcon: ChestIcon     },
  { name: 'Back',         sub: 'Lats & Rhomboids',       SvgIcon: BackIcon      },
  { name: 'Shoulder',    sub: 'Deltoids',               SvgIcon: ShouldersIcon },
  { name: 'Arms',         sub: 'Biceps & Triceps',       SvgIcon: ArmsIcon      },
  { name: 'Leg',         sub: 'Quads & Hamstrings',     SvgIcon: LegsIcon      },
  { name: 'Hip (Glutes)', sub: 'Glutes & Hip Abductors', SvgIcon: GlutesIcon    },
];

// --- Shared atoms

function NavHeader({
  title, onBack, onClose,
}: { title: string; onBack?: () => void; onClose: () => void }) {
  return (
    <View style={s.navHeader}>
      {onBack ? (
        <TouchableOpacity style={s.navBtn} onPress={onBack} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={20} color={C.text} />
        </TouchableOpacity>
      ) : (
        <View style={s.navBtn} />
      )}
      <Text style={s.navTitle} numberOfLines={1}>{title}</Text>
      <TouchableOpacity style={s.navBtn} onPress={onClose} activeOpacity={0.7}>
        <Ionicons name="close" size={20} color={C.textSub} />
      </TouchableOpacity>
    </View>
  );
}

function StepBar({ total, current }: { total: number; current: number }) {
  return (
    <View style={s.stepBar}>
      {Array.from({ length: total }).map((_, i) => (
        <View key={i} style={[s.stepSeg, { backgroundColor: i <= current ? C.accent : C.border }]} />
      ))}
    </View>
  );
}

// --- Stepper

const WEIGHT_DIRECT_INPUT_MAX = 999;
const WEIGHT_DIRECT_INPUT_MIN = 0;
const REPS_DIRECT_INPUT_MAX   = 999;

function formatWeightText(value: number): string {
  return value % 1 === 0 ? String(value) : value.toFixed(1);
}

// allowDecimal=false(REPS 등 정수 전용 입력)면 소수점을 아예 못 치게 막고, 커밋 시에도
// 반올림한 정수로만 저장한다. weight 쪽은 기존 그대로 소수 첫째자리까지 입력 가능.
function formatStepperText(value: number, allowDecimal: boolean): string {
  if (!allowDecimal) return String(Math.round(value));
  return value % 1 === 0 ? String(value) : value.toFixed(1);
}

function Stepper({ value, onChange, step = 1, min = 0, max = WEIGHT_DIRECT_INPUT_MAX, directInput = false, allowDecimal = true }: {
  value: number; onChange: (v: number) => void; step?: number; min?: number; max?: number;
  directInput?: boolean; allowDecimal?: boolean;
}) {
  const display = value % 1 === 0 ? String(value) : value.toFixed(1);

  const [editing, setEditing] = useState(false);
  const [text,    setText]    = useState(() => formatStepperText(value, allowDecimal));
  const focusedRef            = useRef(false);

  // 프리셋/스테퍼로 값이 바뀌면 입력칸 텍스트 동기화 (단, 사용자가 타이핑 중이면 덮어쓰지 않음)
  useEffect(() => {
    if (directInput && !focusedRef.current) {
      setText(formatStepperText(value, allowDecimal));
    }
  }, [value, directInput, allowDecimal]);

  function handleChangeText(t: string) {
    const pattern = allowDecimal ? /^\d{0,3}(\.\d{0,1})?$/ : /^\d{0,3}$/;
    if (pattern.test(t)) {
      setText(t);
    }
  }

  function commit() {
    const parsed = parseFloat(text);
    if (text === '' || isNaN(parsed)) {
      setText(formatStepperText(value, allowDecimal));
      setEditing(false);
      return;
    }
    const normalized = allowDecimal ? parsed : Math.round(parsed);
    const clamped     = Math.min(max, Math.max(min, normalized));
    setText(formatStepperText(clamped, allowDecimal));
    if (clamped !== value) onChange(clamped);
    setEditing(false);
  }

  return (
    <View style={s.stepper}>
      {!editing && (
        <TouchableOpacity
          style={s.stepperBtn}
          onPress={() => onChange(Math.max(min, parseFloat((value - step).toFixed(1))))}
          activeOpacity={0.7}
        >
          <Ionicons name="remove" size={22} color={C.text} />
        </TouchableOpacity>
      )}
      {directInput && editing ? (
        <TextInput
          value={text}
          onChangeText={handleChangeText}
          onFocus={() => { focusedRef.current = true; }}
          onBlur={() => { focusedRef.current = false; commit(); }}
          onSubmitEditing={() => { commit(); Keyboard.dismiss(); }}
          keyboardType={allowDecimal ? 'decimal-pad' : 'number-pad'}
          returnKeyType="done"
          style={s.stepperValEditing}
          autoFocus
          maxLength={6}
        />
      ) : directInput ? (
        <TouchableOpacity
          onPress={() => { focusedRef.current = true; setText(formatStepperText(value, allowDecimal)); setEditing(true); }}
          activeOpacity={0.7}
        >
          <Text style={s.stepperVal} numberOfLines={1}>{display}</Text>
        </TouchableOpacity>
      ) : (
        <Text style={s.stepperVal} numberOfLines={1}>{display}</Text>
      )}
      {!editing && (
        <TouchableOpacity
          style={s.stepperBtn}
          onPress={() => onChange(parseFloat((value + step).toFixed(1)))}
          activeOpacity={0.7}
        >
          <Ionicons name="add" size={22} color={C.text} />
        </TouchableOpacity>
      )}
    </View>
  );
}

// --- Step 1: Muscle Select - card grid UI

function MuscleCard({ name, sub, SvgIcon, selected, onToggle }: {
  name: string; sub: string; SvgIcon: SvgComponent;
  selected: boolean; onToggle: () => void;
}) {
  const col = mp(name);

  return (
    <TouchableOpacity
      style={[
        s.muscleCard,
        { width: MUSCLE_CARD_W },
        selected && { borderColor: col.fg, backgroundColor: col.fg + '14' },
      ]}
      onPress={onToggle}
      activeOpacity={0.75}
    >
      {selected && (
        <View style={[s.muscleCardCheck, { backgroundColor: col.fg }]}>
          <Ionicons name="checkmark" size={12} color={C.bg} />
        </View>
      )}
      <SvgIcon width={60} height={60} color="#C8FF57" />
      <Text style={[s.muscleCardName, selected && { color: col.fg }]}>{name}</Text>
      <Text style={s.muscleCardSub}>{sub}</Text>
    </TouchableOpacity>
  );
}

function MuscleSelectStep({ selected, onToggle, onNext, onBack, onClose, isRestDay, onRegisterRect, onboardingActive, onboardingKey }: {
  selected:   Set<string>;
  onToggle:   (m: string) => void;
  onNext:     () => void;
  onBack:     () => void;
  onClose:    () => void;
  isRestDay?: boolean;
  onRegisterRect?: (key: OnboardingPointKey, rect: SpotlightRect) => void;
  onboardingActive?: boolean;
  onboardingKey?: OnboardingPointKey | null;
}) {
  const muscleGridRef = useRef<View>(null);

  useEffect(() => {
    if (!onboardingActive) return;
    if (onboardingKey === 'muscle-grid') {
      requestAnimationFrame(() => {
        muscleGridRef.current?.measureInWindow((x, y, width, height) => {
          onRegisterRect?.('muscle-grid', { x, y, width, height });
        });
      });
    }
  }, [onboardingActive, onboardingKey]);

  return (
    <SafeAreaView style={s.safe} edges={["top", "bottom"]}>
      <NavHeader title="어떤 부위를 운동했나요?" onBack={onBack} onClose={onClose} />
      <StepBar total={5} current={1} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.listPad}>
        <Text style={s.hint}>
          {isRestDay
            ? '오늘은 휴식 날이에요. 그래도 운동하실 건가요?'
            : '오늘 운동한 부위를 모두 선택하세요'}
        </Text>

        <View
          ref={muscleGridRef}
          style={s.muscleGrid}
          onLayout={() => {
            if (onboardingActive) {
              muscleGridRef.current?.measureInWindow((x, y, width, height) => {
                onRegisterRect?.('muscle-grid', { x, y, width, height });
              });
            }
          }}
        >
          {MUSCLE_GROUPS.map(g => (
            <MuscleCard
              key={g.name}
              name={g.name} sub={g.sub} SvgIcon={g.SvgIcon}
              selected={selected.has(g.name)}
              onToggle={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onToggle(g.name); }}
            />
          ))}
        </View>

        <View style={{ height: 80 }} />
      </ScrollView>
      <View style={s.ctaBar}>
        <TouchableOpacity
          style={[s.ctaBtn, selected.size === 0 && s.ctaDisabled]}
          activeOpacity={0.85}
          onPress={onNext}
          disabled={selected.size === 0}
        >
          <Text style={s.ctaTxt}>
            {selected.size === 0
              ? '부위를 선택하세요'
              : `계속 — ${Array.from(selected).join(', ')}`}
          </Text>
          <Ionicons name="chevron-forward" size={18} color={C.bg} />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

// --- Step 1 (was Step 2): Gym Select

function GymSelectStep({ onSelect, onClose, onRegisterRect, onboardingActive, onboardingKey }: {
  onSelect: (gym: GymWithMachines) => void;
  onClose: () => void;
  onRegisterRect?: (key: OnboardingPointKey, rect: SpotlightRect) => void;
  onboardingActive?: boolean;
  onboardingKey?: OnboardingPointKey | null;
}) {
  const [gyms,         setGyms]         = useState<GymWithMachines[]>([]);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [loading,      setLoading]      = useState(true);
  const [locError,     setLocError]     = useState(false);

  const gymListRef        = useRef<View>(null);
  const gymRequestLinkRef = useRef<View>(null);

  const { user } = useAuth();
  const [showGymRequestModal, setShowGymRequestModal] = useState(false);
  const [reqGymName,   setReqGymName]   = useState('');
  const [reqLocation,  setReqLocation]  = useState('');
  const [reqNotes,     setReqNotes]     = useState('');
  const [reqLoading,   setReqLoading]   = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);

      const gymList = await fetchGymsWithMachines();

      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          const userLat = loc.coords.latitude;
          const userLon = loc.coords.longitude;
          setUserLocation({ latitude: userLat, longitude: userLon });

          const sorted = [...gymList].sort((a, b) => {
            const distA = (a.latitude != null && a.longitude != null)
              ? calcDistanceKm(userLat, userLon, a.latitude, a.longitude)
              : 9999;
            const distB = (b.latitude != null && b.longitude != null)
              ? calcDistanceKm(userLat, userLon, b.latitude, b.longitude)
              : 9999;
            return distA - distB;
          });
          setGyms(sorted);
        } else {
          setLocError(true);
          setGyms(gymList);
        }
      } catch {
        setLocError(true);
        setGyms(gymList);
      }

      setLoading(false);
    }
    load();
  }, []);

  useEffect(() => {
    if (!onboardingActive) return;
    if (onboardingKey === 'gym-list') {
      requestAnimationFrame(() => {
        gymListRef.current?.measureInWindow((x, y, width, height) => {
          onRegisterRect?.('gym-list', { x, y, width, height });
        });
      });
    }
    if (onboardingKey === 'gym-request-link') {
      requestAnimationFrame(() => {
        gymRequestLinkRef.current?.measureInWindow((x, y, width, height) => {
          onRegisterRect?.('gym-request-link', { x, y, width, height });
        });
      });
    }
  }, [onboardingActive, onboardingKey]);

  function getDistLabel(gym: GymWithMachines): string {
    if (!userLocation || gym.latitude == null || gym.longitude == null) return '';
    const km = calcDistanceKm(userLocation.latitude, userLocation.longitude, gym.latitude, gym.longitude);
    return formatDistance(km);
  }

  async function handleSubmitGymRequest() {
    if (!reqGymName.trim() || !reqLocation.trim()) {
      Alert.alert('입력 오류', '헬스장명과 위치를 입력해주세요.');
      return;
    }
    if (!user) {
      Alert.alert('로그인 필요', '로그인 후 이용해주세요.');
      return;
    }
    setReqLoading(true);
    const { error } = await submitGymRegistrationRequest(
      user.id,
      reqGymName.trim(),
      reqLocation.trim(),
      '',
      reqNotes.trim(),
    );
    setReqLoading(false);
    if (error) {
      Alert.alert('오류', error);
      return;
    }
    Alert.alert('신청 완료', '헬스장 등록 요청이 접수되었습니다.\n검토 후 등록해드리겠습니다.');
    setShowGymRequestModal(false);
    setReqGymName('');
    setReqLocation('');
    setReqNotes('');
  }

  return (
    <SafeAreaView style={s.safe} edges={["top", "bottom"]}>
      <NavHeader title="어디서 운동했나요?" onClose={onClose} />
      <StepBar total={5} current={0} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.listPad}>
        <Text style={s.hint}>오늘 운동한 헬스장을 선택하세요</Text>

        <View
          ref={gymRequestLinkRef}
          onLayout={() => {
            if (onboardingActive) {
              gymRequestLinkRef.current?.measureInWindow((x, y, width, height) => {
                onRegisterRect?.('gym-request-link', { x, y, width, height });
              });
            }
          }}
        >
          <TouchableOpacity
            style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 14 }}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setShowGymRequestModal(true); }}
            activeOpacity={0.7}
          >
            <Ionicons name="add-circle-outline" size={14} color={C.accent} />
            <Text style={{ fontSize: 12, fontWeight: '700', color: C.accent }}>
              내가 다니는 헬스장이 없나요? 등록 요청하기
            </Text>
          </TouchableOpacity>
        </View>

        {locError && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12, backgroundColor: C.surfaceHigh, borderRadius: R.inner, padding: 10 }}>
            <Ionicons name="location-outline" size={13} color={C.textSub} />
            <Text style={{ fontSize: 12, color: C.textSub }}>위치 권한이 없어 거리 정보를 표시할 수 없어요</Text>
          </View>
        )}

        {loading ? (
          <View style={{ paddingVertical: 48, alignItems: 'center' }}>
            <Text style={{ fontSize: 13, color: C.textDim }}>헬스장 목록 로딩 중...</Text>
          </View>
        ) : (
          <View
            ref={gymListRef}
            onLayout={() => {
              if (onboardingActive) {
                gymListRef.current?.measureInWindow((x, y, width, height) => {
                  onRegisterRect?.('gym-list', { x, y, width, height });
                });
              }
            }}
          >
          {gyms.map(gym => {
            const distLabel    = getDistLabel(gym);
            const machineCount = gym.machines.length;
            return (
              <TouchableOpacity key={gym.id} style={s.gymCard} activeOpacity={0.8} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onSelect(gym); }}>
                <View style={{ flex: 1, paddingLeft: 14 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text style={[s.gymCardName, { flex: 1 }]} numberOfLines={1}>{gym.name}</Text>
                    {distLabel ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                        <Ionicons name="navigate-outline" size={11} color={C.accent} />
                        <Text style={s.gymMetaDist}>{distLabel}</Text>
                      </View>
                    ) : null}
                  </View>
                  <View style={s.gymMeta}>
                    <Ionicons name="location-outline" size={12} color={C.textSub} />
                    <Text style={s.gymMetaLoc} numberOfLines={1}>{gym.location}</Text>
                  </View>
                  <Text style={s.gymMachineCount}>{machineCount} 머신</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={C.textDim} style={{ alignSelf: 'center' }} />
              </TouchableOpacity>
            );
          })}
          </View>
        )}
      </ScrollView>

      <Modal visible={showGymRequestModal} transparent animationType="slide" onRequestClose={() => setShowGymRequestModal(false)}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' }}>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ flexGrow: 1, justifyContent: 'flex-end' }}
              showsVerticalScrollIndicator={false}
            >
              <View style={{ backgroundColor: C.bg, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, gap: 16 }}>
                <Text style={{ fontSize: 18, fontWeight: '800', color: C.text }}>헬스장 등록 요청</Text>

                <View style={{ gap: 8 }}>
                  <Text style={{ fontSize: 12, color: C.textSub, fontWeight: '600' }}>헬스장명 *</Text>
                  <TextInput
                    value={reqGymName}
                    onChangeText={setReqGymName}
                    placeholder="예) 짐픽 강남점"
                    placeholderTextColor={C.textDim}
                    style={{ backgroundColor: C.surface, borderRadius: R.inner, padding: 12, color: C.text, fontSize: 14 }}
                  />
                </View>

                <View style={{ gap: 8 }}>
                  <Text style={{ fontSize: 12, color: C.textSub, fontWeight: '600' }}>위치 *</Text>
                  <TextInput
                    value={reqLocation}
                    onChangeText={setReqLocation}
                    placeholder="예) 서울 강남구 역삼동"
                    placeholderTextColor={C.textDim}
                    style={{ backgroundColor: C.surface, borderRadius: R.inner, padding: 12, color: C.text, fontSize: 14 }}
                  />
                </View>

                <View style={{ gap: 8 }}>
                  <Text style={{ fontSize: 12, color: C.textSub, fontWeight: '600' }}>기타사항</Text>
                  <TextInput
                    value={reqNotes}
                    onChangeText={setReqNotes}
                    placeholder="추가로 알려주실 내용이 있으면 입력해주세요"
                    placeholderTextColor={C.textDim}
                    multiline
                    numberOfLines={3}
                    style={{ backgroundColor: C.surface, borderRadius: R.inner, padding: 12, color: C.text, fontSize: 14, minHeight: 80, textAlignVertical: 'top' }}
                  />
                </View>

                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <TouchableOpacity
                    style={{ flex: 1, padding: 14, borderRadius: R.btn, backgroundColor: C.surface, alignItems: 'center' }}
                    onPress={() => setShowGymRequestModal(false)}
                  >
                    <Text style={{ color: C.textSub, fontWeight: '700' }}>취소</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={{ flex: 1, padding: 14, borderRadius: R.btn, backgroundColor: C.accent, alignItems: 'center' }}
                    onPress={handleSubmitGymRequest}
                    disabled={reqLoading}
                  >
                    <Text style={{ color: C.bg, fontWeight: '800' }}>{reqLoading ? '신청 중...' : '신청하기'}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

// --- Step 3: Exercise Select

function ExerciseCard({ name, brand, targetMuscle, logged, preloaded, onPress, isFreeWeight, pr }: {
  name: string; brand: string; targetMuscle: string;
  logged: boolean; preloaded: boolean; onPress: () => void; isFreeWeight: boolean;
  pr?: { weight: number; reps: number };
}) {
  const col = mp(targetMuscle);
  const DONE_GREEN = '#3dd68c';
  return (
    <TouchableOpacity
      style={[s.exCard, { width: CARD_W }, logged && s.exCardOn, preloaded && !logged && s.exCardPreloaded]}
      activeOpacity={0.8}
      onPress={onPress}
    >
      <View style={[s.exCardImg, { backgroundColor: logged ? DONE_GREEN + '22' : col.bg }]}>
        <Ionicons name="barbell" size={40} color={col.fg} style={{ opacity: 0.15 }} />
        <View style={[s.exCardIconBadge, { backgroundColor: col.fg + '25' }]}>
          <Ionicons name={isFreeWeight ? 'fitness-outline' : 'barbell-outline'} size={20} color={col.fg} />
        </View>
        {isFreeWeight && (
          <View style={s.fwBadge}>
            <Text style={s.fwBadgeText}>FREE</Text>
          </View>
        )}
        <View style={[s.muscleTag, { backgroundColor: col.fg + 'cc' }]}>
          <Text style={s.muscleTagText}>{targetMuscle}</Text>
        </View>
        {logged && (
          <View style={s.cardCheckOverlay}>
            <View style={[s.cardCheckCircle, { backgroundColor: DONE_GREEN }]}>
              <Ionicons name="checkmark" size={16} color="#fff" />
            </View>
          </View>
        )}
      </View>
      <View style={s.exCardInfo}>
        <Text style={s.exCardName} numberOfLines={2}>{name}</Text>
        <Text style={s.exCardBrand} numberOfLines={1}>{brand}</Text>
        {logged ? (
          <View style={s.exCardDoneBadge}>
            <Text style={s.exCardDoneBadgeText}>완료</Text>
          </View>
        ) : pr ? (
          <View style={s.exCardPRRow}>
            <Text style={s.exCardPRLabel}>PR</Text>
            <Text style={s.exCardPRVal}>{pr.weight} kg × {pr.reps}</Text>
          </View>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

// --- View mode toggle button (섹션 타이틀과 같은 줄, 우측 정렬로 재사용)

function ViewModeToggleButton({
  viewMode, hasPreloaded, viewCategory, onPress,
}: { viewMode: 'routine' | 'all'; hasPreloaded: boolean; viewCategory?: 'machine' | 'freeweight'; onPress: () => void }) {
  return (
    <TouchableOpacity style={s.viewModeToggle} onPress={onPress} activeOpacity={0.8}>
      <Ionicons name="grid-outline" size={13} color={C.accent} />
      <Text style={s.viewModeToggleTxt}>
        {viewMode === 'all'
          ? (hasPreloaded ? '루틴 머신만 보기' : '타겟부위만 보기')
          : (!hasPreloaded && viewCategory === 'freeweight' ? '다른 부위도 보기' : '다른 머신도 보기')}
      </Text>
    </TouchableOpacity>
  );
}

function ExerciseSelectStep({ gym, selectedMuscles, loggedIds, preloadedIds, routineExtraInfo, templates, onSelectExercise, onLoadTemplate, onDeleteTemplate, onFinish, onBack, onClose, onRegisterRect, onboardingActive, onboardingKey }: {
  gym: GymWithMachines;
  selectedMuscles: Set<string>;
  loggedIds: Set<string>;
  preloadedIds: Set<string>;
  routineExtraInfo?: MachineExtraInfo;
  templates: WorkoutTemplate[];
  onSelectExercise: (id: string) => void;
  onLoadTemplate: (tpl: WorkoutTemplate) => void;
  onDeleteTemplate: (id: string) => void;
  onFinish: () => void;
  onBack: () => void;
  onClose: () => void;
  onRegisterRect?: (key: OnboardingPointKey, rect: SpotlightRect) => void;
  onboardingActive?: boolean;
  onboardingKey?: OnboardingPointKey | null;
}) {
  const [localSelectedId, setLocalSelectedId] = useState<string | null>(null);
  const [showTplList,     setShowTplList]     = useState(false);
  const [dbFreeWeights,   setDbFreeWeights]   = useState<typeof FREE_WEIGHTS>([]);
  const [allMachinesMap,  setAllMachinesMap]  = useState<Record<string, Machine>>(() => buildAllMachinesMap());
  const [viewMode,        setViewMode]        = useState<'routine' | 'all'>('routine');
  const [viewCategory,    setViewCategory]    = useState<'machine' | 'freeweight'>('machine');
  // "다른 부위도 보기"(viewMode==='all') 상태의 프리웨이트 목록은 부위 필터가 없어
  // 129개가 뒤섞여 나온다 — 이때만 부위 필터칩으로 좁혀볼 수 있게 한다. null이면 전체.
  const [fwMuscleFilter,  setFwMuscleFilter]  = useState<string | null>(null);

  const exerciseGridRef = useRef<View>(null);

  useEffect(() => {
    if (!onboardingActive) return;
    if (onboardingKey === 'exercise-grid') {
      requestAnimationFrame(() => {
        exerciseGridRef.current?.measureInWindow((x, y, width, height) => {
          onRegisterRect?.('exercise-grid', { x, y, width, height });
        });
      });
    }
  }, [onboardingActive, onboardingKey]);

  useEffect(() => {
    fetchFreeWeights().then(data => {
      setDbFreeWeights(data.map(m => ({
        id:           m.id,
        name:         m.name,
        brand:        m.brand,
        targetMuscle: m.targetMuscle,
      })));
    }).catch(() => {
      setDbFreeWeights(FREE_WEIGHTS);
    });
  }, []);

  // Supabase 캐시가 채워진 뒤(또는 이미 채워져 있으면 즉시) 전역 머신 맵을 다시
  // 계산 — 로컬 정적 배열엔 없는, Supabase에만 있는 새 항목도 반영되게 한다.
  useEffect(() => {
    fetchMachines().then(() => {
      setAllMachinesMap(buildAllMachinesMap());
    }).catch(() => {
      // 조회 실패 시 로컬 폴백만으로 계산된 초기값을 그대로 사용
    });
  }, []);

  // 'Hip (Glutes)' selection should match machines with targetMuscle 'Glutes'
  function matchesMuscle(targetMuscle: string): boolean {
    if (selectedMuscles.has(targetMuscle)) return true;
    if (targetMuscle === 'Glutes' && selectedMuscles.has('Hip (Glutes)')) return true;
    if (targetMuscle === 'Glutes' && selectedMuscles.has('Leg')) return true;
    if (targetMuscle === 'Other') return true;
    return false;
  }

  const hasPreloaded = preloadedIds.size > 0;
  let machines: Machine[];
  let routineOrderedAll: Machine[] = []; // 루틴 선택 시 순서 통합 리스트

  if (hasPreloaded) {
    // 루틴 선택: preloadedIds 순서대로 머신+프리웨이트 통합
    routineOrderedAll = [...preloadedIds]
      .map(id => {
        const gymMachine = gym.machines.find(m => m.id === id);
        if (gymMachine) return gymMachine;
        const globalMachine = allMachinesMap[id];
        if (globalMachine) return globalMachine;
        const dbFw = dbFreeWeights.find(f => f.id === id);
        if (dbFw) return { id: dbFw.id, name: dbFw.name, brand: dbFw.brand, targetMuscle: dbFw.targetMuscle, category: 'Free Weight', exerciseKind: 'freeweight' as const } as Machine;
        const localFw = FREE_WEIGHTS.find(f => f.id === id);
        if (localFw) return { id: localFw.id, name: localFw.name, brand: localFw.brand, targetMuscle: localFw.targetMuscle, category: 'Free Weight', exerciseKind: 'freeweight' as const } as Machine;
        const extra = routineExtraInfo?.[id];
        if (extra) return { id, name: extra.name, brand: extra.brand, targetMuscle: extra.targetMuscle, category: '' } as Machine;
        return null;
      })
      .filter(Boolean) as Machine[];
    machines = []; // 루틴 모드에서는 분리된 machines 섹션 사용 안 함
  } else if (viewMode === 'all') {
    // Start Fresh - 다른 머신도 보기: 부위 필터 없이 헬스장 전체 머신 (정렬 없음)
    machines = gym.machines;
  } else {
    // Start Fresh: 헬스장 머신만 표시 (선택 부위 머신 먼저, Other는 뒤로)
    machines = gym.machines
      .filter(m => parseMuscles(m.targetMuscle).some(t => matchesMuscle(t)))
      .sort((a, b) => {
        const aOther = parseMuscles(a.targetMuscle).includes('Other') ? 1 : 0;
        const bOther = parseMuscles(b.targetMuscle).includes('Other') ? 1 : 0;
        return aOther - bOther;
      });
  }

  // 프리웨이트: 루틴 모드가 아닐 때만 별도 섹션 표시
  const freeWeights = hasPreloaded
    ? []
    : viewMode === 'all'
      ? (dbFreeWeights.length > 0 ? dbFreeWeights : FREE_WEIGHTS) // Start Fresh - 다른 머신도 보기: 부위 필터 없음
      : (dbFreeWeights.length > 0 ? dbFreeWeights : FREE_WEIGHTS)
          .filter(fw => parseMuscles(fw.targetMuscle).some(t => matchesMuscle(t)));

  // "다른 부위도 보기"(viewMode==='all') 상태에서만 부위 필터칩 적용 — 타겟부위 모드는
  // 이미 matchesMuscle로 좁혀져 있어 추가 필터가 필요 없다. FlatList에는 이 필터링된
  // 목록을 넘기고, freeWeights(필터 전) 자체는 헤더 노출 여부 판단에 그대로 쓴다.
  const freeWeightsFiltered = (viewMode === 'all' && fwMuscleFilter)
    ? freeWeights.filter(fw => fw.targetMuscle === fwMuscleFilter)
    : freeWeights;

  // "다른 머신도 보기" 모드: 루틴 머신(순번 유지) + 부위 매칭되는 헬스장 전체 머신/프리웨이트(루틴에 없는 것) 통합
  const allModeOrderedList: Machine[] = (hasPreloaded && viewMode === 'all')
    ? [
        ...routineOrderedAll,
        ...gym.machines.filter(m => !preloadedIds.has(m.id) && parseMuscles(m.targetMuscle).some(t => matchesMuscle(t))),
        ...(dbFreeWeights.length > 0 ? dbFreeWeights : FREE_WEIGHTS)
            .filter(fw => !preloadedIds.has(fw.id) && parseMuscles(fw.targetMuscle).some(t => matchesMuscle(t)))
            .map(fw => ({ id: fw.id, name: fw.name, brand: fw.brand, targetMuscle: fw.targetMuscle, category: 'Free Weight', exerciseKind: 'freeweight' as const } as Machine)),
      ]
    : [];
  const MACHINE_CARD_W2 = (SCREEN_W - 40) / 2;

  function handleCardPress(id: string) {
    setLocalSelectedId(prev => prev === id ? null : id);
  }

  // Start Fresh 모드에서 "프리웨이트 보기"가 활성화된 상태 — 이때는 아래 스크롤
  // 영역 전체가 머신 그리드(ScrollView) 대신 프리웨이트 FlatList로 바뀐다.
  const showFreeWeightList = !hasPreloaded && viewCategory === 'freeweight';

  return (
    <SafeAreaView style={s.safe} edges={["top", "bottom"]}>
      <NavHeader title="머신 선택" onBack={onBack} onClose={onClose} />
      <StepBar total={5} current={2} />

      {/* 템플릿 행 + 머신/프리웨이트 토글 헤더는 스크롤 영역 밖의 고정 헤더다 —
          토글해도 이 부분은 그대로 있고, 아래 컨텐츠 영역만 ScrollView<->FlatList로
          바뀐다 (기존처럼 별도 화면으로 이동하지 않고 같은 화면 안에서 카드만 교체). */}
      <View style={s.listPad}>
        <View style={s.tplRow}>
          <Text style={s.hint}>운동할 머신을 하나 선택하세요</Text>
          {templates.length > 0 && (
            <TouchableOpacity style={s.tplChip} onPress={() => setShowTplList(p => !p)} activeOpacity={0.8}>
              <Ionicons name="albums-outline" size={13} color={C.accent} />
              <Text style={s.tplChipTxt}>템플릿</Text>
            </TouchableOpacity>
          )}
        </View>

        {showTplList && (
          <View style={s.tplList}>
            {templates.map(t => (
              <View key={t.id} style={s.tplItem}>
                <TouchableOpacity style={{ flex: 1 }} onPress={() => { onLoadTemplate(t); setShowTplList(false); }} activeOpacity={0.8}>
                  <Text style={s.tplItemName}>{t.name}</Text>
                  <Text style={s.tplItemSub}>{t.exerciseIds.length} 운동 · {t.muscles.join(', ')}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => onDeleteTemplate(t.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="trash-outline" size={15} color={C.textDim} />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {/* Start Fresh 모드: 머신/프리웨이트 카테고리 헤더 (viewCategory와 무관하게 항상 노출되어야 토글이 막히지 않음) */}
        {!hasPreloaded && (machines.length > 0 || freeWeights.length > 0) && (
          <View style={[s.sectionTitleRow, { marginBottom: 0 }]}>
            <Text style={[s.sectionTitle, { marginBottom: 0 }]}>
              {viewCategory === 'freeweight' ? '프리 웨이트' : '머신'}
            </Text>
            <ViewModeToggleButton
              viewMode={viewMode}
              hasPreloaded={hasPreloaded}
              viewCategory={viewCategory}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setViewMode(prev => prev === 'routine' ? 'all' : 'routine');
              }}
            />
            <View style={s.categoryToggleRow}>
              <TouchableOpacity
                style={[s.categoryToggleChip, viewCategory === 'machine' && s.categoryToggleChipActive]}
                onPress={() => setViewCategory('machine')}
                activeOpacity={0.8}
              >
                <Text style={[s.categoryToggleChipText, viewCategory === 'machine' && s.categoryToggleChipTextActive]}>
                  머신
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.categoryToggleChip, viewCategory === 'freeweight' && s.categoryToggleChipActive]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setViewCategory('freeweight');
                }}
                activeOpacity={0.8}
              >
                <Text style={[s.categoryToggleChipText, viewCategory === 'freeweight' && s.categoryToggleChipTextActive]}>
                  프리웨이트 보기
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* "다른 부위도 보기" 상태의 프리웨이트 목록(부위 필터 없이 129개)만 부위 필터칩 노출 —
            타겟부위 모드는 이미 좁혀져 있어 칩이 필요 없다. */}
        {showFreeWeightList && viewMode === 'all' && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={s.fwFilterScroll}
            contentContainerStyle={s.fwFilterRow}
          >
            <TouchableOpacity
              style={[s.categoryToggleChip, fwMuscleFilter === null && s.categoryToggleChipActive]}
              onPress={() => setFwMuscleFilter(null)}
              activeOpacity={0.8}
            >
              <Text style={[s.categoryToggleChipText, fwMuscleFilter === null && s.categoryToggleChipTextActive]}>
                전체
              </Text>
            </TouchableOpacity>
            {FW_MUSCLE_FILTERS.map(muscle => (
              <TouchableOpacity
                key={muscle}
                style={[s.categoryToggleChip, fwMuscleFilter === muscle && s.categoryToggleChipActive]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setFwMuscleFilter(muscle);
                }}
                activeOpacity={0.8}
              >
                <Text style={[s.categoryToggleChipText, fwMuscleFilter === muscle && s.categoryToggleChipTextActive]}>
                  {muscle}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
      </View>

      {showFreeWeightList ? (
        <FlatList
          data={freeWeightsFiltered}
          keyExtractor={fw => fw.id}
          numColumns={2}
          columnWrapperStyle={s.freeWeightRow}
          contentContainerStyle={s.listPad}
          showsVerticalScrollIndicator={false}
          removeClippedSubviews
          initialNumToRender={8}
          maxToRenderPerBatch={6}
          updateCellsBatchingPeriod={50}
          windowSize={7}
          renderItem={({ item: fw }) => (
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => handleCardPress(fw.id)}
              style={{ position: 'relative' }}
            >
              <MachineCardBorder width={MACHINE_CARD_W2}>
                <MachineCard
                  machine={{ id: fw.id, name: fw.name, brand: fw.brand, targetMuscle: fw.targetMuscle, category: 'Free Weight' }}
                  variant="grid"
                  width={MACHINE_CARD_W2}
                />
              </MachineCardBorder>
              {/* Start Fresh(hasPreloaded=false)에서는 preloadedIds가 항상 비어있어 이 배지는 렌더되지 않음 */}
              {preloadedIds.has(fw.id) && (
                <View style={s.cardOrderOverlay}>
                  <View style={s.cardOrderBadge}>
                    <Text style={s.cardOrderText}>
                      {[...preloadedIds].indexOf(fw.id) + 1}
                    </Text>
                  </View>
                </View>
              )}
              {!preloadedIds.has(fw.id) && localSelectedId === fw.id && (
                <View style={s.cardSelectedOverlay}>
                  <View style={s.cardSelectedBadge}>
                    <Ionicons name="checkmark" size={14} color={C.bg} />
                  </View>
                </View>
              )}
              {[...loggedIds].some(k => machineIdFromKey(k) === fw.id) && (
                <View style={s.cardCompletedOverlay}>
                  <View style={s.cardCompletedBadge}>
                    <Ionicons name="checkmark-circle" size={13} color={C.accent} />
                    <Text style={s.cardCompletedTxt}>완료</Text>
                  </View>
                </View>
              )}
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <Text style={s.hint}>
              {fwMuscleFilter ? `${fwMuscleFilter} 부위 프리웨이트가 없습니다.` : '표시할 프리웨이트가 없습니다.'}
            </Text>
          }
        />
      ) : (
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.listPad}>
        {/* 루틴 선택 모드: 머신+프리웨이트 순서 통합 */}
        {hasPreloaded && viewMode === 'routine' && routineOrderedAll.length > 0 && (
          <>
            <View style={s.sectionTitleRow}>
              <Text style={[s.sectionTitle, { marginBottom: 0 }]}>추천 루틴 머신</Text>
              <ViewModeToggleButton
                viewMode={viewMode}
                hasPreloaded={hasPreloaded}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setViewMode(prev => prev === 'routine' ? 'all' : 'routine');
                }}
              />
            </View>
            <View
              ref={exerciseGridRef}
              style={s.machineCardGrid}
              onLayout={() => {
                if (onboardingActive) {
                  exerciseGridRef.current?.measureInWindow((x, y, width, height) => {
                    onRegisterRect?.('exercise-grid', { x, y, width, height });
                  });
                }
              }}
            >
              {routineOrderedAll.map((m, idx) => (
                <TouchableOpacity
                  key={m.id}
                  activeOpacity={0.85}
                  onPress={() => handleCardPress(m.id)}
                  style={{ position: 'relative' }}
                >
                  <MachineCardBorder width={MACHINE_CARD_W2}>
                    <MachineCard machine={m} variant="grid" width={MACHINE_CARD_W2} />
                  </MachineCardBorder>
                  {/* 루틴 순서 번호 */}
                  <View style={s.cardOrderOverlay}>
                    <View style={s.cardOrderBadge}>
                      <Text style={s.cardOrderText}>{idx + 1}</Text>
                    </View>
                  </View>
                  {localSelectedId === m.id && (
                    <View style={s.cardSelectedOverlay}>
                      <View style={s.cardSelectedBadge}>
                        <Ionicons name="checkmark" size={14} color={C.bg} />
                      </View>
                    </View>
                  )}
                  {[...loggedIds].some(k => machineIdFromKey(k) === m.id) && (
                    <View style={s.cardCompletedOverlay}>
                      <View style={s.cardCompletedBadge}>
                        <Ionicons name="checkmark-circle" size={13} color={C.accent} />
                        <Text style={s.cardCompletedTxt}>완료</Text>
                      </View>
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        {/* 다른 머신도 보기 모드: 루틴 머신(순번 유지) + 헬스장 전체 머신/프리웨이트 통합 */}
        {hasPreloaded && viewMode === 'all' && allModeOrderedList.length > 0 && (
          <>
            <View style={s.sectionTitleRow}>
              <Text style={[s.sectionTitle, { marginBottom: 0 }]}>전체 머신</Text>
              <ViewModeToggleButton
                viewMode={viewMode}
                hasPreloaded={hasPreloaded}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setViewMode(prev => prev === 'routine' ? 'all' : 'routine');
                }}
              />
            </View>
            <View
              ref={exerciseGridRef}
              style={s.machineCardGrid}
              onLayout={() => {
                if (onboardingActive) {
                  exerciseGridRef.current?.measureInWindow((x, y, width, height) => {
                    onRegisterRect?.('exercise-grid', { x, y, width, height });
                  });
                }
              }}
            >
              {allModeOrderedList.map(m => (
                <TouchableOpacity
                  key={m.id}
                  activeOpacity={0.85}
                  onPress={() => handleCardPress(m.id)}
                  style={{ position: 'relative' }}
                >
                  <MachineCardBorder width={MACHINE_CARD_W2}>
                    <MachineCard machine={m} variant="grid" width={MACHINE_CARD_W2} />
                  </MachineCardBorder>
                  {preloadedIds.has(m.id) && (
                    <View style={s.cardOrderOverlay}>
                      <View style={s.cardOrderBadge}>
                        <Text style={s.cardOrderText}>
                          {[...preloadedIds].indexOf(m.id) + 1}
                        </Text>
                      </View>
                    </View>
                  )}
                  {localSelectedId === m.id && (
                    <View style={s.cardSelectedOverlay}>
                      <View style={s.cardSelectedBadge}>
                        <Ionicons name="checkmark" size={14} color={C.bg} />
                      </View>
                    </View>
                  )}
                  {[...loggedIds].some(k => machineIdFromKey(k) === m.id) && (
                    <View style={s.cardCompletedOverlay}>
                      <View style={s.cardCompletedBadge}>
                        <Ionicons name="checkmark-circle" size={13} color={C.accent} />
                        <Text style={s.cardCompletedTxt}>완료</Text>
                      </View>
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        {/* Start Fresh 모드: 머신 섹션 (머신/프리웨이트 토글 헤더는 위 고정 영역으로 이동함) */}
        {viewCategory === 'machine' && machines.length > 0 && (
          <>
            <View
              ref={exerciseGridRef}
              style={s.machineCardGrid}
              onLayout={() => {
                if (onboardingActive) {
                  exerciseGridRef.current?.measureInWindow((x, y, width, height) => {
                    onRegisterRect?.('exercise-grid', { x, y, width, height });
                  });
                }
              }}
            >
              {machines.map(m => (
                <TouchableOpacity
                  key={m.id}
                  activeOpacity={0.85}
                  onPress={() => handleCardPress(m.id)}
                  style={{ position: 'relative' }}
                >
                  <MachineCardBorder width={MACHINE_CARD_W2}>
                    <MachineCard machine={m} variant="grid" width={MACHINE_CARD_W2} />
                  </MachineCardBorder>
                  {/* Start Fresh(hasPreloaded=false)에서는 preloadedIds가 항상 비어있어 이 배지는 렌더되지 않음 */}
                  {preloadedIds.has(m.id) && (
                    <View style={s.cardOrderOverlay}>
                      <View style={s.cardOrderBadge}>
                        <Text style={s.cardOrderText}>
                          {[...preloadedIds].indexOf(m.id) + 1}
                        </Text>
                      </View>
                    </View>
                  )}
                  {!preloadedIds.has(m.id) && localSelectedId === m.id && (
                    <View style={s.cardSelectedOverlay}>
                      <View style={s.cardSelectedBadge}>
                        <Ionicons name="checkmark" size={14} color={C.bg} />
                      </View>
                    </View>
                  )}
                  {[...loggedIds].some(k => machineIdFromKey(k) === m.id) && (
                    <View style={s.cardCompletedOverlay}>
                      <View style={s.cardCompletedBadge}>
                        <Ionicons name="checkmark-circle" size={13} color={C.accent} />
                        <Text style={s.cardCompletedTxt}>완료</Text>
                      </View>
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>
      )}
      <View style={s.ctaBar}>
        <View style={{ gap: 8 }}>
          <TouchableOpacity
            style={[s.ctaBtn, !localSelectedId && s.ctaDisabled]}
            activeOpacity={0.85}
            onPress={() => { if (localSelectedId) { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); onSelectExercise(localSelectedId); } }}
            disabled={!localSelectedId}
          >
            <Ionicons name="play" size={18} color={C.bg} />
            <Text style={s.ctaTxt}>{showFreeWeightList ? '이 프리웨이트로 운동 시작' : '이 머신으로 운동 시작'}</Text>
          </TouchableOpacity>
          {loggedIds.size > 0 && (
            <TouchableOpacity
              style={[s.ctaBtn, { backgroundColor: C.surfaceHigh, marginBottom: 0 }]}
              activeOpacity={0.85}
              onPress={onFinish}
            >
              <Ionicons name="checkmark-done" size={18} color={C.accent} />
              <Text style={[s.ctaTxt, { color: C.accent }]}>운동 종료 ({loggedIds.size} 운동)</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

// --- Set Progress Banner (완료된 세트 요약 — SetLoggingStep 상단에 표시)

function SetProgressBanner({
  sets,
  machineName,
}: {
  sets: SetEntry[];
  machineName: string;
}) {
  return (
    <View style={s.setProgressBanner}>
      <View style={s.setProgressHeader}>
        <Ionicons name="checkmark-circle" size={13} color={C.accent} />
        <Text style={s.setProgressHeaderText} numberOfLines={1}>
          완료된 세트{machineName ? ` · ${machineName}` : ''}
        </Text>
        <View style={s.setProgressCountBadge}>
          <Text style={s.setProgressCountText}>{sets.length}</Text>
        </View>
      </View>
      <View style={s.setProgressList}>
        {sets.map((set, idx) => (
          <View
            key={idx}
            style={[
              s.setProgressRow,
              idx === sets.length - 1 && { borderBottomWidth: 0 },
            ]}
          >
            <View style={s.setProgressIndex}>
              <Text style={s.setProgressIndexText}>{idx + 1}</Text>
            </View>
            <View style={s.setProgressKgBlock}>
              <Text style={s.setProgressKgValue}>{set.weight}</Text>
              <Text style={s.setProgressKgUnit}>kg</Text>
            </View>
            <View style={s.setProgressSeparator}>
              <Text style={s.setProgressSeparatorText}>×</Text>
            </View>
            <View style={s.setProgressRepsBlock}>
              <Text style={s.setProgressRepsValue}>{set.reps}</Text>
              <Text style={s.setProgressRepsUnit}>reps</Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

// --- 무게/횟수 프리셋 가로 스크롤 — 현재 값(또는 가장 가까운 프리셋)을 화면 중앙에 자동 배치
function PresetScrollRow({ presets, value, onSelect }: {
  presets: number[];
  value: number;
  onSelect: (v: number) => void;
}) {
  const scrollRef       = useRef<ScrollView>(null);
  const chipLayouts     = useRef<Record<number, { x: number; width: number }>>({});
  const containerWidth  = useRef(0);
  const isMount          = useRef(true);

  // 정확히 일치하는 프리셋이 있으면 그 값, 없으면 가장 가까운 값
  const nearestPreset = presets.reduce((a, b) => (Math.abs(b - value) < Math.abs(a - value) ? b : a));

  const centerOn = (target: number, animated: boolean) => {
    const layout = chipLayouts.current[target];
    if (!layout || !containerWidth.current) return;
    const x = layout.x + layout.width / 2 - containerWidth.current / 2;
    scrollRef.current?.scrollTo({ x: Math.max(0, x), animated });
  };

  useEffect(() => {
    const animated = !isMount.current;
    isMount.current = false;
    const raf = requestAnimationFrame(() => centerOn(nearestPreset, animated));
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <ScrollView
      ref={scrollRef}
      horizontal
      showsHorizontalScrollIndicator={false}
      style={{ flexShrink: 1 }}
      onLayout={(e) => {
        containerWidth.current = e.nativeEvent.layout.width;
        centerOn(nearestPreset, false);
      }}
    >
      <View style={s.presetRow}>
        {presets.map(p => (
          <TouchableOpacity
            key={p}
            style={[s.presetChip, value === p && s.presetChipActive]}
            onPress={() => onSelect(p)}
            onLayout={(e) => {
              chipLayouts.current[p] = { x: e.nativeEvent.layout.x, width: e.nativeEvent.layout.width };
              if (p === nearestPreset) centerOn(nearestPreset, false);
            }}
          >
            <Text style={[s.presetChipText, value === p && s.presetChipTextActive]}>{p}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );
}

// --- Step 4: Log Sets (single exercise)

function SetCard({ ex, sets, realPR, prefill, freeWeights, onChange, onAdd, onCopyPrev, onRemove, onSetLayout, onRegisterRect, onboardingActive, onboardingKey }: {
  ex: ExerciseInfo;
  sets: SetEntry[];
  realPR?: { weight: number; reps: number };
  prefill?: { date: string } | null;
  freeWeights: FreeWeightExercise[];
  onChange: (idx: number, field: keyof SetEntry, val: number) => void;
  onAdd: () => void;
  onCopyPrev: () => void;
  onRemove: (idx: number) => void;
  onSetLayout?: (idx: number, y: number) => void;
  onRegisterRect?: (key: OnboardingPointKey, rect: SpotlightRect) => void;
  onboardingActive?: boolean;
  onboardingKey?: OnboardingPointKey | null;
}) {
  const col    = mp(ex.targetMuscle);
  const isFW   = isFreeWeightId(machineIdFromKey(ex.id), freeWeights);
  const curMax  = sets.length ? Math.max(...sets.map(s => s.weight)) : 0;
  const histPR  = realPR; // 실제 유저 기록 기반 PR (없으면 undefined → 배지 미표시)
  const isNewPR = curMax > 0 && (histPR === undefined || curMax > histPR.weight);

  const setInputRef   = useRef<View>(null);
  const setActionsRef = useRef<View>(null);

  useEffect(() => {
    if (!onboardingActive) return;
    const measure = (key: OnboardingPointKey, ref: React.RefObject<View | null>) => {
      requestAnimationFrame(() => {
        ref.current?.measureInWindow((x, y, width, height) => {
          onRegisterRect?.(key, { x, y, width, height });
        });
      });
    };
    if (onboardingKey === 'set-input')    measure('set-input', setInputRef);
    if (onboardingKey === 'set-add-copy') measure('set-add-copy', setActionsRef);
  }, [onboardingActive, onboardingKey]);

  useEffect(() => {
    if (isNewPR) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    }
  }, [isNewPR]);

  return (
    <View style={s.logCard}>
      <View style={s.logCardHead}>
        <View style={[s.logExIcon, { backgroundColor: col.bg }]}>
          <Ionicons name={isFW ? 'fitness-outline' : 'barbell'} size={18} color={col.fg} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.logExName} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{ex.name}</Text>
          <Text style={s.logExBrand}>{ex.brand}</Text>
        </View>
        {/* 신기록 배지 제거 */}
        {/* 타겟부위 칩 제거 */}
      </View>

      {/* Your PR reference */}
      {histPR && (
        <View style={s.yourPRRow}>
          <Text style={s.yourPRLabel}>내 PR</Text>
          <Text style={s.yourPRVal}>{histPR.weight} kg × {histPR.reps}</Text>
        </View>
      )}
      {prefill && (
        <View style={s.prefillRow}>
          <Ionicons name="time-outline" size={12} color={C.textDim} />
          <Text style={s.prefillText}>지난 기록을 불러왔어요 ({formatAgoForCard(prefill.date)})</Text>
        </View>
      )}

      {sets.map((set, idx) => (
        <View
          key={idx}
          ref={idx === 0 ? setInputRef : undefined}
          style={s.setBlock}
          onLayout={(e) => {
            onSetLayout?.(idx, e.nativeEvent.layout.y);
            if (idx === 0 && onboardingActive) {
              setInputRef.current?.measureInWindow((x, y, width, height) => {
                onRegisterRect?.('set-input', { x, y, width, height });
              });
            }
          }}
        >
          <View style={s.setBlockHeader}>
            <Text style={s.setBlockLabel}>세트 {idx + 1}</Text>
            {sets.length > 1 && (
              <TouchableOpacity onPress={() => onRemove(idx)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="remove-circle-outline" size={16} color={C.textDim} />
              </TouchableOpacity>
            )}
          </View>

          {/* Weight */}
          <View style={s.inputRow}>
            <Text style={s.inputLabel}>무게</Text>
            <PresetScrollRow presets={WEIGHT_PRESETS} value={set.weight} onSelect={v => onChange(idx, 'weight', v)} />
          </View>
          <View style={s.stepperRow}>
            <Text style={s.stepperUnit}>kg</Text>
            <Stepper value={set.weight} onChange={v => onChange(idx, 'weight', v)} step={2.5} directInput />
          </View>

          {/* Reps */}
          <View style={[s.inputRow, { marginTop: 10 }]}>
            <Text style={s.inputLabel}>횟수</Text>
            <PresetScrollRow presets={REPS_PRESETS} value={set.reps} onSelect={v => onChange(idx, 'reps', v)} />
          </View>
          <View style={s.stepperRow}>
            <Text style={s.stepperUnit}>reps</Text>
            <Stepper value={set.reps} onChange={v => onChange(idx, 'reps', v)} step={1} min={1} max={REPS_DIRECT_INPUT_MAX} directInput allowDecimal={false} />
          </View>
        </View>
      ))}

      <View
        ref={setActionsRef}
        style={s.setActions}
        onLayout={() => {
          if (onboardingActive) {
            setActionsRef.current?.measureInWindow((x, y, width, height) => {
              onRegisterRect?.('set-add-copy', { x, y, width, height });
            });
          }
        }}
      >
        <TouchableOpacity style={s.addSetBtn} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); onAdd(); }} activeOpacity={0.75}>
          <Ionicons name="add" size={14} color={C.accent} />
          <Text style={s.addSetText}>세트 추가</Text>
        </TouchableOpacity>
        {sets.length > 0 && (
          <TouchableOpacity style={s.copySetBtn} onPress={onCopyPrev} activeOpacity={0.75}>
            <Ionicons name="copy-outline" size={13} color={C.textSub} />
            <Text style={s.copySetText}>이전 세트 복사</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

function SetLoggingStep({ exercise, sets, note, freeWeights, onChange, onAdd, onCopyPrev, onRemove, onNoteChange, onSave, onFinish, onBack, onClose, onRegisterRect, onboardingActive, onboardingKey, realPR, prefill }: {
  exercise: ExerciseInfo;
  sets: SetEntry[];
  note: string;
  freeWeights: FreeWeightExercise[];
  onChange: (idx: number, field: keyof SetEntry, val: number) => void;
  onAdd: () => void;
  onCopyPrev: () => void;
  onRemove: (idx: number) => void;
  onNoteChange: (v: string) => void;
  onSave: () => void;
  onFinish: () => void;
  onBack: () => void;
  onClose: () => void;
  onRegisterRect?: (key: OnboardingPointKey, rect: SpotlightRect) => void;
  onboardingActive?: boolean;
  onboardingKey?: OnboardingPointKey | null;
  realPR?: { weight: number; reps: number };
  prefill?: { date: string } | null;
}) {
  const scrollRef        = useRef<ScrollView>(null);
  const setLayoutsRef    = useRef<number[]>([]);
  const pendingScrollIdx = useRef<number>(-1);
  const noteCardRef      = useRef<View>(null);
  const hasSets = sets.length > 0 && sets.some(s => s.weight > 0 || s.reps > 0);
  // 버그 수정(2026-09-01): 예전엔 sets.slice(0, -1)로 마지막 세트를 "완료된 세트"
  // 배너에서 항상 제외했음 — 하지만 "저장하고 다음 머신"(handleSaveExercise)은
  // 잘린 배열이 아니라 sets(=logs[currentExerciseId]) 전체를 그대로 저장하고,
  // 인증샷 오버레이도 같은 sets/logs를 그대로 쓴다. 그래서 배너에만 실제 저장되는
  // 세트 수보다 항상 1개 적게 표시되는 불일치가 있었음 — 실제 저장 데이터와
  // 항상 일치하도록 잘라내지 않고 sets 전체를 그대로 보여준다.
  const completedSets = sets;

  function handleSetLayout(idx: number, y: number) {
    setLayoutsRef.current[idx] = y;
    if (pendingScrollIdx.current === idx) {
      pendingScrollIdx.current = -1;
      scrollRef.current?.scrollTo({ y, animated: true });
    }
  }

  function handleAdd() {
    pendingScrollIdx.current = sets.length;
    onAdd();
  }

  function handleCopyPrev() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    pendingScrollIdx.current = sets.length;
    onCopyPrev();
  }

  useEffect(() => {
    if (!onboardingActive) return;
    if (onboardingKey === 'set-note') {
      requestAnimationFrame(() => {
        noteCardRef.current?.measureInWindow((x, y, width, height) => {
          onRegisterRect?.('set-note', { x, y, width, height });
        });
      });
    }
  }, [onboardingActive, onboardingKey]);

  return (
    <SafeAreaView style={s.safe} edges={["top", "bottom"]}>
      <NavHeader title="세트 기록" onBack={onBack} onClose={onClose} />
      <StepBar total={5} current={2} />
      {completedSets.length > 0 && (
        <SetProgressBanner
          sets={completedSets}
          machineName={exercise.name}
        />
      )}
      <ScrollView ref={scrollRef} showsVerticalScrollIndicator={false} contentContainerStyle={s.listPad}>
        <Text style={s.hint}>프리셋 또는 스테퍼로 입력하세요</Text>
        <SetCard
          ex={exercise}
          sets={sets}
          realPR={realPR}
          prefill={prefill}
          freeWeights={freeWeights}
          onChange={onChange}
          onAdd={handleAdd}
          onCopyPrev={handleCopyPrev}
          onRemove={onRemove}
          onSetLayout={handleSetLayout}
          onRegisterRect={onRegisterRect}
          onboardingActive={onboardingActive}
          onboardingKey={onboardingKey}
        />

        {/* Optional exercise note */}
        <View
          ref={noteCardRef}
          style={s.noteCard}
          onLayout={() => {
            if (onboardingActive) {
              noteCardRef.current?.measureInWindow((x, y, width, height) => {
                onRegisterRect?.('set-note', { x, y, width, height });
              });
            }
          }}
        >
          <Text style={s.noteLabel}>노트 (선택)</Text>
          <TextInput
            style={s.noteInput}
            value={note}
            onChangeText={onNoteChange}
            placeholder="예: 팔꿈치 안으로, 시트 4번 조절…"
            placeholderTextColor={C.textDim}
            multiline
            maxLength={200}
          />
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>
      <View style={s.ctaBar}>
        <TouchableOpacity
          style={[s.ctaBtn, !hasSets && s.ctaDisabled]}
          activeOpacity={0.85}
          onPress={() => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            onSave();
          }}
          disabled={!hasSets}
        >
          <Ionicons name="checkmark" size={18} color={C.bg} />
          <Text style={s.ctaTxt}>저장하고 다음 머신</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

// --- Text colour presets

const TEXT_COLORS = [
  { label: 'White',  hex: '#ffffff' },
  { label: 'Lime',   hex: '#c8ff57' },
  { label: 'Black',  hex: '#000000' },
  { label: 'Red',    hex: '#FF3B3B' },
  { label: 'Orange', hex: '#FF8C00' },
  { label: 'Yellow', hex: '#FFE600' },
  { label: 'Green',  hex: '#00C853' },
  { label: 'Blue',   hex: '#2979FF' },
  { label: 'Pink',   hex: '#FF2D78' },
  { label: 'Cyan',   hex: '#00E5FF' },
  { label: 'Purple', hex: '#AA00FF' },
  { label: 'Brown',    hex: '#8B5A2B' },
  { label: 'Dusty Red',  hex: '#A85751' },
  { label: 'Dusty Blue', hex: '#5C7A8C' },
];

// --- Overlay layout components (module-level, exported for WorkoutCameraOverlay)

interface OverlayProps {
  exercises: ExerciseInfo[];
  logs: Record<string, SetEntry[]>;
  nickname: string;
  timestamp: string;
  muscleLabel: string;
  tc: string;
  photoW: number;
  photoH: number;
}

export function ClassicOverlay({ exercises, logs, nickname, timestamp, muscleLabel, tc, photoW, photoH, fontSet }: OverlayProps & { fontSet: FontSet }) {
  const LOGO_STRIP_H_L = 14;
  const LOGO_STRIP_W_L = Math.round(LOGO_STRIP_H_L * (2805 / 279));
  const LOGO_EDGE_GAP  = 8;

  const logoTlLeft = Math.round(LOGO_EDGE_GAP + LOGO_STRIP_H_L / 2 - LOGO_STRIP_W_L / 2);
  const logoTlTop  = Math.round(OVERLAY_PAD   + LOGO_STRIP_W_L / 2 - LOGO_STRIP_H_L / 2);
  const logoBrLeft = Math.round((photoW - LOGO_EDGE_GAP - LOGO_STRIP_H_L) + LOGO_STRIP_H_L / 2 - LOGO_STRIP_W_L / 2);
  const logoBrTop  = Math.round((photoH - OVERLAY_PAD - LOGO_STRIP_W_L)   + LOGO_STRIP_W_L / 2 - LOGO_STRIP_H_L / 2);

  return (
    <>
      <View style={[s.overlayLogoAbsolute, { left: logoTlLeft, top: logoTlTop, transform: [{ rotate: '90deg' }] }]}>
        <GymPickLogo color={tc} width={LOGO_STRIP_W_L} height={LOGO_STRIP_H_L} />
      </View>
      <View style={[s.overlayLogoAbsolute, { left: logoBrLeft, top: logoBrTop, transform: [{ rotate: '270deg' }] }]}>
        <GymPickLogo color={tc} width={LOGO_STRIP_W_L} height={LOGO_STRIP_H_L} />
      </View>
      <View style={s.overlayTopRight}>
        <Text style={[s.overlayUsername, { color: tc, fontFamily: fontSet.nickname, fontWeight: Platform.OS === 'android' ? undefined : '900' }]}>{nickname}</Text>
        <Text style={[s.overlayTimestamp, { color: tc, fontFamily: fontSet.nickname, fontWeight: Platform.OS === 'android' ? undefined : '500' }]}>{timestamp}</Text>
      </View>
      <View style={s.overlayBottomLeft}>
        <Text style={[s.overlayMuscleTitle, { color: tc, fontFamily: fontSet.muscle }]}>{muscleLabel}</Text>
        <View style={s.sessionScroll}>
          {exercises.slice(0, 7).map(ex => {
            const sets     = logs[ex.id] ?? [];
            const setsLine = sets.map(st => `${st.weight} x ${st.reps}`).join(' / ');
            return (
              <View key={ex.id} style={s.overlayExBlock}>
                <Text style={[s.overlayExName, { color: tc, fontFamily: fontSet.routine, fontWeight: Platform.OS === 'android' ? undefined : '900' }]} numberOfLines={1}>
                  {`[${ex.brand.toUpperCase()}] ${ex.name.toUpperCase()}`}
                </Text>
                {setsLine ? (
                  <Text style={[s.overlayExSet, { color: tc, fontFamily: fontSet.routine, fontWeight: Platform.OS === 'android' ? undefined : '500' }]} numberOfLines={2}>{setsLine}</Text>
                ) : null}
              </View>
            );
          })}
          {exercises.length > 7 && (
            <Text style={[s.overlayExName, { color: tc, opacity: 0.6, marginTop: 2, fontFamily: fontSet.routine, fontWeight: Platform.OS === 'android' ? undefined : '900' }]}>
              {`+${exercises.length - 7} more...`}
            </Text>
          )}
        </View>
      </View>
    </>
  );
}

export function LeftColOverlay({ exercises, logs, nickname, timestamp, muscleLabel, tc, photoW, photoH }: OverlayProps) {
  const tsParts = timestamp.split('_');
  const tsDate  = tsParts[0] ?? timestamp;
  const tsTime  = tsParts[1] ?? '';

  return (
    <>
      <View style={{
        position: 'absolute',
        top: OVERLAY_PAD,
        left: OVERLAY_PAD,
        right: photoW * 0.45,
      }}>
        <Text style={{
          fontSize: 24,
          fontWeight: '900',
          color: tc,
          letterSpacing: -0.5,
          fontFamily: 'Quicksilver-Italic',
        }} numberOfLines={2}>
          {muscleLabel}
        </Text>
      </View>
      <View style={{
        position: 'absolute',
        top: OVERLAY_PAD,
        right: OVERLAY_PAD,
        alignItems: 'flex-end',
      }}>
        <Text style={{ fontSize: 13, fontWeight: '900', color: tc, letterSpacing: 0.3 }}>
          {nickname}
        </Text>
        <Text style={{ fontSize: 11, fontWeight: '700', color: tc, opacity: 0.85, marginTop: 2 }}>
          {tsDate}
        </Text>
        {tsTime ? (
          <Text style={{ fontSize: 11, fontWeight: '700', color: tc, opacity: 0.85 }}>
            {tsTime}
          </Text>
        ) : null}
      </View>
      <View style={{
        position: 'absolute',
        top: OVERLAY_PAD + 52,
        left: OVERLAY_PAD,
        right: OVERLAY_PAD,
        bottom: OVERLAY_PAD + 32,
      }}>
        {exercises.slice(0, 6).map(ex => {
          const sets = logs[ex.id] ?? [];
          return (
            <View key={ex.id} style={{ marginBottom: 10 }}>
              <Text style={{ fontSize: 10, fontWeight: '900', color: tc, letterSpacing: 0.3, marginBottom: 3 }} numberOfLines={1}>
                {`[${ex.brand.toUpperCase()}] ${ex.name.toUpperCase()}`}
              </Text>
              {sets.map((st, si) => (
                <Text key={si} style={{ fontSize: 9, fontWeight: '600', color: tc, opacity: 0.85, lineHeight: 14 }}>
                  {`S${si + 1}  ${st.weight}kg × ${st.reps}`}
                </Text>
              ))}
            </View>
          );
        })}
        {exercises.length > 6 && (
          <Text style={{ fontSize: 9, fontWeight: '700', color: tc, opacity: 0.6 }}>
            {`+${exercises.length - 6} more...`}
          </Text>
        )}
      </View>
      <View style={{
        position: 'absolute',
        bottom: OVERLAY_PAD,
        right: OVERLAY_PAD,
      }}>
        <GymPickLogo color={tc} width={Math.round(LOGO_STRIP_W * 0.595)} height={Math.round(LOGO_STRIP_H * 0.595)} />
      </View>
    </>
  );
}

export function GridOverlay({ exercises, logs, nickname, timestamp, muscleLabel, tc, photoW, photoH }: OverlayProps) {
  const COL_COUNT = 3;
  const COL_W     = Math.floor((photoW - OVERLAY_PAD * 2 - 16) / COL_COUNT);

  return (
    <>
      <View style={{
        position: 'absolute',
        top: OVERLAY_PAD,
        left: OVERLAY_PAD,
        right: OVERLAY_PAD,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
      }}>
        <Text style={{ fontSize: 13, fontWeight: '900', color: tc, letterSpacing: 0.3 }}>
          {nickname}
        </Text>
        <Text style={{ fontSize: 10, fontWeight: '700', color: tc, opacity: 0.85 }}>
          {timestamp}
        </Text>
      </View>
      {/* 중앙 그룹: 타겟부위 + 루틴 — 세로 중앙 정렬 */}
      <View style={{
        position: 'absolute',
        top: OVERLAY_PAD + 30,
        bottom: OVERLAY_PAD + 30,
        left: OVERLAY_PAD,
        right: OVERLAY_PAD,
        justifyContent: 'center',
        alignItems: 'center',
      }}>
        {/* 타겟부위 */}
        <Text style={{
          fontSize: 46,
          color: tc,
          letterSpacing: -0.5,
          textAlign: 'center',
          fontFamily: 'Honfleur-Heavy',
          marginBottom: 57,
        }}>
          {muscleLabel}
        </Text>

        {/* 3열 루틴 그리드 */}
        <View style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: 8,
          justifyContent: 'center',
          width: '100%',
        }}>
          {exercises.slice(0, 9).map(ex => {
            const sets = logs[ex.id] ?? [];
            return (
              <View key={ex.id} style={{ width: COL_W, marginBottom: 12, alignItems: 'center' }}>
                <Text style={{ fontSize: 14, fontWeight: '700', color: tc, opacity: 0.7, letterSpacing: 0.5, textAlign: 'center' }}>
                  {`[${ex.brand.toUpperCase()}]`}
                </Text>
                <Text style={{ fontSize: 16, fontWeight: '900', color: tc, letterSpacing: 0.2, marginBottom: 3, lineHeight: 22, textAlign: 'center' }} numberOfLines={2}>
                  {ex.name.toUpperCase()}
                </Text>
                {sets.map((st, si) => (
                  <Text key={si} style={{ fontSize: 14, fontWeight: '600', color: tc, opacity: 0.85, lineHeight: 22, textAlign: 'center' }}>
                    {`S${si + 1} ${st.weight}kg × ${st.reps}`}
                  </Text>
                ))}
              </View>
            );
          })}
          {exercises.length > 9 && (
            <View style={{ width: COL_W }}>
              <Text style={{ fontSize: 14, fontWeight: '700', color: tc, opacity: 0.6, textAlign: 'center' }}>
                {`+${exercises.length - 9} more...`}
              </Text>
            </View>
          )}
        </View>
      </View>
      <View style={{
        position: 'absolute',
        bottom: OVERLAY_PAD,
        left: 0,
        right: 0,
        alignItems: 'center',
      }}>
        <GymPickLogo color={tc} width={Math.round(LOGO_STRIP_W * 0.595)} height={Math.round(LOGO_STRIP_H * 0.595)} />
      </View>
    </>
  );
}

export function CenteredOverlay({ exercises, logs, nickname, timestamp, muscleLabel, tc, photoW, photoH }: OverlayProps) {
  const COL_COUNT = 2;
  const COL_W = Math.floor((photoW - OVERLAY_PAD * 2 - 12) / COL_COUNT);
  return (
    <>
      <View style={{ position: 'absolute', top: OVERLAY_PAD, left: OVERLAY_PAD }}>
        <Text style={{ fontSize: 13, color: tc, letterSpacing: 0.3, fontFamily: 'KCC-Ganpan' }}>
          {nickname}
        </Text>
      </View>
      <View style={{ position: 'absolute', top: OVERLAY_PAD, right: OVERLAY_PAD, alignItems: 'flex-end' }}>
        <Text style={{ fontSize: 10, color: tc, opacity: 0.85, fontFamily: 'Mat Saleh' }}>
          {timestamp}
        </Text>
      </View>
      <View style={{ position: 'absolute', top: OVERLAY_PAD + 44, left: OVERLAY_PAD, right: OVERLAY_PAD, alignItems: 'center' }}>
        <Text style={{
          fontSize: 32,
          color: tc,
          letterSpacing: -0.5,
          textAlign: 'center',
          fontFamily: 'Matcha Cih',
        }}>
          {muscleLabel}
        </Text>
      </View>
      <View style={{
        position: 'absolute',
        top: OVERLAY_PAD + 44 + 52,
        left: OVERLAY_PAD,
        right: OVERLAY_PAD,
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        alignContent: 'flex-start',
      }}>
        {exercises.slice(0, 8).map(ex => {
          const sets = logs[ex.id] ?? [];
          const setsLine = sets.map(st => `${st.weight} × ${st.reps}`).join(' / ');
          return (
            <View key={ex.id} style={{ width: COL_W, marginBottom: 10 }}>
              <Text style={{
                fontSize: 9,
                color: tc,
                letterSpacing: 0.3,
                marginBottom: 2,
                fontFamily: 'Mat Saleh',
              }} numberOfLines={1}>
                {`[${ex.brand.toUpperCase()}] ${ex.name.toUpperCase()}`}
              </Text>
              {setsLine ? (
                <Text style={{
                  fontSize: 8,
                  color: tc,
                  opacity: 0.85,
                  fontFamily: 'Mat Saleh',
                }} numberOfLines={1}>
                  {setsLine}
                </Text>
              ) : null}
            </View>
          );
        })}
        {exercises.length > 8 && (
          <Text style={{ fontSize: 8, color: tc, opacity: 0.6, fontFamily: 'Mat Saleh' }}>
            {`+${exercises.length - 8} more...`}
          </Text>
        )}
      </View>
      <View style={{ position: 'absolute', bottom: OVERLAY_PAD, left: 0, right: 0, alignItems: 'center' }}>
        <GymPickLogo color={tc} width={Math.round(LOGO_STRIP_W * 0.595)} height={Math.round(LOGO_STRIP_H * 0.595)} />
      </View>
    </>
  );
}

export function SidebarOverlay({ exercises, logs, nickname, timestamp, muscleLabel, tc, photoW, photoH }: OverlayProps) {
  const tsParts = timestamp.split('_');
  const tsDate  = tsParts[0] ?? timestamp;
  const tsTime  = tsParts[1] ?? '';
  const SIDEBAR_W = Math.round(photoW * 0.22);
  return (
    <>
      <View style={{ position: 'absolute', top: OVERLAY_PAD, left: OVERLAY_PAD }}>
        <Text style={{ fontSize: 13, fontWeight: '900', color: tc, letterSpacing: 0.3 }}>{nickname}</Text>
        <Text style={{ fontSize: 10, fontWeight: '700', color: tc, opacity: 0.85, marginTop: 2 }}>{tsDate}</Text>
        {tsTime ? (
          <Text style={{ fontSize: 10, fontWeight: '700', color: tc, opacity: 0.85 }}>{tsTime}</Text>
        ) : null}
      </View>
      <View style={{
        position: 'absolute',
        left: OVERLAY_PAD - 8,
        top: photoH * 0.38,
        width: 40,
        alignItems: 'center',
      }}>
        <Text style={{
          fontSize: 26,
          fontWeight: '900',
          color: tc,
          transform: [{ rotate: '90deg' }],
          width: photoH * 0.55,
          textAlign: 'center',
          letterSpacing: -0.3,
          fontFamily: 'SportypoReguler',
        }} adjustsFontSizeToFit minimumFontScale={0.5}>
          {muscleLabel}
        </Text>
      </View>
      <View style={{
        position: 'absolute',
        top: OVERLAY_PAD,
        right: OVERLAY_PAD,
        left: SIDEBAR_W + OVERLAY_PAD,
        bottom: OVERLAY_PAD + 24,
        alignItems: 'flex-end',
      }}>
        {exercises.slice(0, 8).map(ex => {
          const sets = logs[ex.id] ?? [];
          return (
            <View key={ex.id} style={{ marginBottom: 12, alignItems: 'flex-end' }}>
              <Text style={{ fontSize: 9, fontWeight: '900', color: tc, letterSpacing: 0.3, textAlign: 'right' }} numberOfLines={1}>
                {`[${ex.brand.toUpperCase()}]`}
              </Text>
              <Text style={{ fontSize: 10, fontWeight: '900', color: tc, textAlign: 'right' }} numberOfLines={1}>
                {ex.name.toUpperCase()}
              </Text>
              {sets.map((st, si) => (
                <Text key={si} style={{ fontSize: 9, fontWeight: '600', color: tc, opacity: 0.85, textAlign: 'right' }}>
                  {`S${si + 1} ${st.weight}kg × ${st.reps}`}
                </Text>
              ))}
            </View>
          );
        })}
        {exercises.length > 8 && (
          <Text style={{ fontSize: 8, fontWeight: '700', color: tc, opacity: 0.6 }}>{`+${exercises.length - 8} more...`}</Text>
        )}
      </View>
      <View style={{ position: 'absolute', bottom: OVERLAY_PAD, left: 0, right: 0, alignItems: 'center' }}>
        <GymPickLogo color={tc} width={Math.round(LOGO_STRIP_W * 0.595)} height={Math.round(LOGO_STRIP_H * 0.595)} />
      </View>
    </>
  );
}

export function TopBigOverlay({ exercises, logs, nickname, timestamp, muscleLabel, tc, photoW, photoH }: OverlayProps) {
  const COL_W = Math.floor((photoW - OVERLAY_PAD * 2 - 12) / 2);
  return (
    <>
      <View style={{ position: 'absolute', top: OVERLAY_PAD, left: OVERLAY_PAD, right: OVERLAY_PAD, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <Text style={{ fontSize: 13, fontWeight: '900', color: tc, letterSpacing: 0.3 }}>{nickname}</Text>
        <Text style={{ fontSize: 10, fontWeight: '700', color: tc, opacity: 0.85 }}>{timestamp}</Text>
      </View>
      <View style={{ position: 'absolute', top: OVERLAY_PAD + 28, left: OVERLAY_PAD, right: OVERLAY_PAD }}>
        <Text style={{ fontSize: 34, fontWeight: '900', color: tc, letterSpacing: -0.5, fontFamily: 'Vdevaca-Bold' }} numberOfLines={1}>
          {muscleLabel}
        </Text>
      </View>
      <View style={{
        position: 'absolute',
        top: OVERLAY_PAD + 28 + 64,
        left: OVERLAY_PAD,
        right: OVERLAY_PAD,
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
        alignContent: 'flex-start',
      }}>
        {exercises.slice(0, 8).map(ex => {
          const sets = logs[ex.id] ?? [];
          const setsLine = sets.map(st => `${st.weight}×${st.reps}`).join(' / ');
          return (
            <View key={ex.id} style={{ width: COL_W, marginBottom: 8 }}>
              <Text style={{ fontSize: 9, fontWeight: '900', color: tc, letterSpacing: 0.3, marginBottom: 1 }} numberOfLines={1}>
                {`[${ex.brand.toUpperCase()}] ${ex.name.toUpperCase()}`}
              </Text>
              {setsLine ? (
                <Text style={{ fontSize: 8, fontWeight: '600', color: tc, opacity: 0.85 }} numberOfLines={1}>{setsLine}</Text>
              ) : null}
            </View>
          );
        })}
        {exercises.length > 8 && (
          <Text style={{ fontSize: 8, fontWeight: '700', color: tc, opacity: 0.6 }}>{`+${exercises.length - 8} more...`}</Text>
        )}
      </View>
      <View style={{ position: 'absolute', bottom: OVERLAY_PAD, left: 0, right: 0, alignItems: 'center' }}>
        <GymPickLogo color={tc} width={Math.round(LOGO_STRIP_W * 0.595)} height={Math.round(LOGO_STRIP_H * 0.595)} />
      </View>
    </>
  );
}

export function CenterListOverlay({ exercises, logs, nickname, timestamp, muscleLabel, tc, photoW, photoH }: OverlayProps) {
  const COL_COUNT = 2;
  const COL_W = Math.floor((photoW - OVERLAY_PAD * 2 - 12) / COL_COUNT);
  return (
    <>
      {/* 상단 좌: 닉네임 */}
      <View style={{ position: 'absolute', top: OVERLAY_PAD, left: OVERLAY_PAD }}>
        <Text style={{ fontSize: 13, color: tc, letterSpacing: 0.3, fontFamily: 'BlackwoodCastle' }}>
          {nickname}
        </Text>
      </View>
      {/* 상단 우: 날짜 */}
      <View style={{ position: 'absolute', top: OVERLAY_PAD, right: OVERLAY_PAD, alignItems: 'flex-end' }}>
        <Text style={{ fontSize: 10, color: tc, opacity: 0.85, fontFamily: 'BlackwoodCastle' }}>
          {timestamp}
        </Text>
      </View>
      {/* 중앙 타겟부위 - BlaccS 폰트 */}
      <View style={{ position: 'absolute', top: OVERLAY_PAD + 44, left: OVERLAY_PAD, right: OVERLAY_PAD, alignItems: 'center' }}>
        <Text style={{
          fontSize: 32,
          color: tc,
          letterSpacing: -0.5,
          textAlign: 'center',
          fontFamily: 'BlackwoodCastleShadow',
        }}>
          {muscleLabel}
        </Text>
      </View>
      {/* 2열 운동 목록 - Blacc 폰트 */}
      <View style={{
        position: 'absolute',
        top: OVERLAY_PAD + 44 + 52,
        left: OVERLAY_PAD,
        right: OVERLAY_PAD,
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        alignContent: 'flex-start',
      }}>
        {exercises.slice(0, 8).map(ex => {
          const sets = logs[ex.id] ?? [];
          const setsLine = sets.map(st => `${st.weight} × ${st.reps}`).join(' / ');
          return (
            <View key={ex.id} style={{ width: COL_W, marginBottom: 10 }}>
              <Text style={{
                fontSize: 9,
                color: tc,
                letterSpacing: 0.3,
                marginBottom: 2,
                fontFamily: 'BlackwoodCastle',
              }} numberOfLines={1}>
                {`[${ex.brand.toUpperCase()}] ${ex.name.toUpperCase()}`}
              </Text>
              {setsLine ? (
                <Text style={{
                  fontSize: 8,
                  color: tc,
                  opacity: 0.85,
                  fontFamily: 'BlackwoodCastle',
                }} numberOfLines={1}>
                  {setsLine}
                </Text>
              ) : null}
            </View>
          );
        })}
        {exercises.length > 8 && (
          <Text style={{ fontSize: 8, color: tc, opacity: 0.6, fontFamily: 'BlackwoodCastle' }}>
            {`+${exercises.length - 8} more...`}
          </Text>
        )}
      </View>
      {/* 하단 중앙 로고 */}
      <View style={{ position: 'absolute', bottom: OVERLAY_PAD, left: 0, right: 0, alignItems: 'center' }}>
        <GymPickLogo color={tc} width={Math.round(LOGO_STRIP_W * 0.595)} height={Math.round(LOGO_STRIP_H * 0.595)} />
      </View>
    </>
  );
}

export function BottomInfoOverlay({ exercises, logs, nickname, timestamp, muscleLabel, tc, photoW, photoH }: OverlayProps) {
  return (
    <>
      {/* 상단 좌: 타겟부위 - Flamer 폰트, 밑줄 없음 */}
      <View style={{ position: 'absolute', top: OVERLAY_PAD, left: OVERLAY_PAD, right: OVERLAY_PAD }}>
        <Text style={{
          fontSize: 38,
          color: tc,
          letterSpacing: -0.5,
          fontFamily: 'Flamer',
        }} numberOfLines={1}>
          {muscleLabel}
        </Text>
      </View>
      {/* 운동 목록 - HeavyHeapRg 폰트 */}
      <View style={{
        position: 'absolute',
        top: OVERLAY_PAD + 60,
        left: OVERLAY_PAD,
        right: OVERLAY_PAD,
        bottom: OVERLAY_PAD + 44,
      }}>
        {exercises.slice(0, 6).map(ex => {
          const sets = logs[ex.id] ?? [];
          const setsLine = sets.map(st => `${st.weight} × ${st.reps}`).join(' / ');
          return (
            <View key={ex.id} style={{ marginBottom: 10 }}>
              <Text style={{
                fontSize: 10,
                color: tc,
                letterSpacing: 0.3,
                marginBottom: 1,
                fontFamily: 'HeavyHeapRg-Regular',
              }} numberOfLines={1}>
                {`[${ex.brand.toUpperCase()}] ${ex.name.toUpperCase()}`}
              </Text>
              {setsLine ? (
                <Text style={{
                  fontSize: 9,
                  color: tc,
                  opacity: 0.85,
                  fontFamily: 'HeavyHeapRg-Regular',
                }} numberOfLines={1}>
                  {setsLine}
                </Text>
              ) : null}
            </View>
          );
        })}
        {exercises.length > 6 && (
          <Text style={{ fontSize: 8, color: tc, opacity: 0.6, fontFamily: 'HeavyHeapRg-Regular' }}>
            {`+${exercises.length - 6} more...`}
          </Text>
        )}
      </View>
      {/* 좌하단 로고 */}
      <View style={{ position: 'absolute', bottom: OVERLAY_PAD, left: OVERLAY_PAD }}>
        <GymPickLogo color={tc} width={Math.round(LOGO_STRIP_W * 0.595)} height={Math.round(LOGO_STRIP_H * 0.595)} />
      </View>
      {/* 우하단 닉네임 + 날짜 - HeavyHeapRg 폰트 */}
      <View style={{ position: 'absolute', bottom: OVERLAY_PAD, right: OVERLAY_PAD, alignItems: 'flex-end' }}>
        <Text style={{ fontSize: 12, color: tc, fontFamily: 'HeavyHeapRg-Regular' }}>{nickname}</Text>
        <Text style={{ fontSize: 9, color: tc, opacity: 0.85, marginTop: 2, fontFamily: 'HeavyHeapRg-Regular' }}>{timestamp}</Text>
      </View>
    </>
  );
}

export function LeftColOverlayB({ exercises, logs, nickname, timestamp, muscleLabel, tc, photoW, photoH, fontSet }: OverlayProps & { fontSet: FontSet }) {
  return (
    <>
      {/* 좌상단: 닉네임 */}
      <View style={{ position: 'absolute', top: OVERLAY_PAD, left: OVERLAY_PAD }}>
        <Text style={{
          fontSize: 15,
          fontWeight: Platform.OS === 'android' ? undefined : '900',
          color: tc,
          letterSpacing: 0.3,
          fontFamily: fontSet.nickname,
        }}>
          {nickname}
        </Text>
      </View>

      {/* 우상단: GYM PICK 가로 로고 */}
      <View style={{ position: 'absolute', top: OVERLAY_PAD, right: OVERLAY_PAD }}>
        <GymPickLogo color={tc} width={Math.round(LOGO_STRIP_W * 0.595)} height={Math.round(LOGO_STRIP_H * 0.595)} />
      </View>

      {/* 중하단: 날짜 → 타겟부위 → 운동 목록 */}
      <View style={{
        position: 'absolute',
        left: OVERLAY_PAD,
        right: OVERLAY_PAD,
        bottom: OVERLAY_PAD,
      }}>
        {/* 날짜 */}
        <Text style={{
          fontSize: 11,
          fontWeight: Platform.OS === 'android' ? undefined : '700',
          color: tc,
          opacity: 0.75,
          marginBottom: 4,
          fontFamily: fontSet.nickname,
        }}>
          {timestamp}
        </Text>

        {/* 타겟부위_day — 크고 굵게, 밑줄 없음 */}
        <Text style={{
          fontSize: 40,
          color: tc,
          fontFamily: fontSet.muscle,
          letterSpacing: -1,
          lineHeight: 46,
          marginBottom: 16,
        }} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
          {muscleLabel}
        </Text>

        {/* 운동 목록 */}
        <View>
          {exercises.slice(0, 8).map(ex => {
            const sets = logs[ex.id] ?? [];
            const setsLine = sets.map(st => `${st.weight} × ${st.reps}`).join(' / ');
            return (
              <View key={ex.id} style={{ marginBottom: 10 }}>
                <Text style={{
                  fontSize: 11,
                  fontWeight: Platform.OS === 'android' ? undefined : '900',
                  color: tc,
                  letterSpacing: 0.5,
                  fontFamily: fontSet.routine,
                }} numberOfLines={1}>
                  {`[${ex.brand.toUpperCase()}] ${ex.name.toUpperCase()}`}
                </Text>
                {setsLine ? (
                  <Text style={{
                    fontSize: 11,
                    fontWeight: Platform.OS === 'android' ? undefined : '500',
                    color: tc,
                    opacity: 0.85,
                    marginTop: 2,
                    fontFamily: fontSet.routine,
                  }} numberOfLines={1}>
                    {setsLine}
                  </Text>
                ) : null}
              </View>
            );
          })}
          {exercises.length > 8 && (
            <Text style={{ fontSize: 9, color: tc, opacity: 0.6, fontFamily: fontSet.routine }}>
              {`+${exercises.length - 8} more...`}
            </Text>
          )}
        </View>
      </View>
    </>
  );
}

export function GridOverlayD({ exercises, logs, nickname, timestamp, muscleLabel, tc, photoW, photoH, fontSet }: OverlayProps & { fontSet: FontSet }) {
  const COL_COUNT = 3;
  const COL_W     = Math.floor((photoW - OVERLAY_PAD * 2 - 16) / COL_COUNT);

  const pureLabel = muscleLabel.replace(/_?day$/i, '').replace(/\s*day$/i, '').trim();

  return (
    <>
      {/* 좌상단: 닉네임 */}
      <View style={{ position: 'absolute', top: OVERLAY_PAD, left: OVERLAY_PAD }}>
        <Text style={{
          fontSize: 14,
          fontWeight: Platform.OS === 'android' ? undefined : '900',
          color: tc,
          letterSpacing: 0.3,
          fontFamily: fontSet.nickname,
        }}>
          {nickname}
        </Text>
      </View>

      {/* 우상단: 날짜 */}
      <View style={{ position: 'absolute', top: OVERLAY_PAD, right: OVERLAY_PAD }}>
        <Text style={{
          fontSize: 12,
          fontWeight: Platform.OS === 'android' ? undefined : '700',
          color: tc,
          opacity: 0.85,
          fontFamily: fontSet.nickname,
        }}>
          {timestamp}
        </Text>
      </View>

      {/* 중앙 그룹: 타겟부위 + 3열 루틴 — 세로 중앙 정렬 */}
      <View style={{
        position: 'absolute',
        top: OVERLAY_PAD + 30,
        bottom: OVERLAY_PAD + 30,
        left: OVERLAY_PAD,
        right: OVERLAY_PAD,
        justifyContent: 'center',
        alignItems: 'center',
      }}>
        {/* 타겟부위 — 최대한 크게, 한 줄 */}
        <Text
          style={{
            fontFamily: fontSet.muscle,
            color: tc,
            textAlign: 'center',
            letterSpacing: -2,
            marginBottom: 4,
            fontSize: photoW * 0.32,
            width: photoW - 20,
          }}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.05}
        >
          {pureLabel}
        </Text>

        {/* 3열 루틴 그리드 */}
        <View style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          justifyContent: 'center',
          gap: 8,
          width: '100%',
        }}>
          {exercises.slice(0, 9).map(ex => {
            const sets = logs[ex.id] ?? [];
            return (
              <View key={ex.id} style={{ width: COL_W, alignItems: 'center', marginBottom: 10 }}>
                <Text style={{
                  fontSize: 8,
                  fontWeight: Platform.OS === 'android' ? undefined : '700',
                  color: tc,
                  opacity: 0.7,
                  letterSpacing: 0.5,
                  textAlign: 'center',
                  fontFamily: fontSet.routine,
                }}>
                  {`[${ex.brand.toUpperCase()}]`}
                </Text>
                <Text style={{
                  fontSize: 9,
                  fontWeight: Platform.OS === 'android' ? undefined : '900',
                  color: tc,
                  letterSpacing: 0.2,
                  marginBottom: 3,
                  lineHeight: 13,
                  textAlign: 'center',
                  fontFamily: fontSet.routine,
                }} numberOfLines={2}>
                  {ex.name.toUpperCase()}
                </Text>
                {sets.map((st, si) => (
                  <Text key={si} style={{
                    fontSize: 8,
                    fontWeight: Platform.OS === 'android' ? undefined : '600',
                    color: tc,
                    opacity: 0.85,
                    lineHeight: 11,
                    textAlign: 'center',
                    fontFamily: fontSet.routine,
                  }}>
                    {`S${si + 1} ${st.weight}kg × ${st.reps}`}
                  </Text>
                ))}
              </View>
            );
          })}
          {exercises.length > 9 && (
            <View style={{ width: COL_W }}>
              <Text style={{ fontSize: 8, fontWeight: '700', color: tc, opacity: 0.6, textAlign: 'center' }}>
                {`+${exercises.length - 9} more...`}
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* 하단 중앙: GYM PICK 로고 */}
      <View style={{
        position: 'absolute',
        bottom: OVERLAY_PAD,
        left: 0,
        right: 0,
        alignItems: 'center',
      }}>
        <GymPickLogo color={tc} width={Math.round(LOGO_STRIP_W * 0.595)} height={Math.round(LOGO_STRIP_H * 0.595)} />
      </View>
    </>
  );
}

export function GridOverlayC({ exercises, logs, nickname, timestamp, muscleLabel, tc, photoW, photoH, fontSet }: OverlayProps & { fontSet: FontSet }) {
  const COL_COUNT = 3;
  const COL_W = Math.floor((photoW - OVERLAY_PAD * 2 - 16) / COL_COUNT);

  return (
    <>
      {/* 상단: 닉네임 좌, 날짜 우 */}
      <View style={{ position: 'absolute', top: OVERLAY_PAD, left: OVERLAY_PAD, right: OVERLAY_PAD, flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={{ fontSize: 13, fontWeight: Platform.OS === 'android' ? undefined : '900', color: tc, fontFamily: fontSet.nickname }}>{nickname}</Text>
        <Text style={{ fontSize: 10, color: tc, opacity: 0.85, fontFamily: fontSet.nickname }}>{timestamp}</Text>
      </View>
      {/* 타겟부위 */}
      <View style={{ position: 'absolute', top: OVERLAY_PAD + 28, left: OVERLAY_PAD, right: OVERLAY_PAD, alignItems: 'center' }}>
        <Text style={{ fontSize: 29, color: tc, fontFamily: fontSet.muscle, textAlign: 'center' }} numberOfLines={1}>
          {muscleLabel}
        </Text>
      </View>
      {/* 3열 운동 목록 */}
      <View style={{
        position: 'absolute',
        top: OVERLAY_PAD + 28 + 48,
        left: OVERLAY_PAD,
        right: OVERLAY_PAD,
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        alignContent: 'flex-start',
      }}>
        {exercises.slice(0, 9).map(ex => {
          const sets = logs[ex.id] ?? [];
          return (
            <View key={ex.id} style={{ width: COL_W, marginBottom: 10 }}>
              <Text style={{ fontSize: 8, color: tc, opacity: 0.7, fontFamily: fontSet.routine, letterSpacing: 0.5 }} numberOfLines={1}>
                {`[${ex.brand.toUpperCase()}]`}
              </Text>
              <Text style={{ fontSize: 9, fontWeight: Platform.OS === 'android' ? undefined : '900', color: tc, fontFamily: fontSet.routine, marginBottom: 2 }} numberOfLines={2}>
                {ex.name.toUpperCase()}
              </Text>
              {sets.map((st, si) => (
                <Text key={si} style={{ fontSize: 8, color: tc, opacity: 0.85, fontFamily: fontSet.routine }}>
                  {`S${si + 1} ${st.weight}kg × ${st.reps}`}
                </Text>
              ))}
            </View>
          );
        })}
        {exercises.length > 9 && (
          <Text style={{ fontSize: 8, color: tc, opacity: 0.6 }}>{`+${exercises.length - 9} more...`}</Text>
        )}
      </View>
      {/* 하단 중앙 로고 */}
      <View style={{ position: 'absolute', bottom: OVERLAY_PAD, left: 0, right: 0, alignItems: 'center' }}>
        <GymPickLogo color={tc} width={Math.round(LOGO_STRIP_W * 0.595)} height={Math.round(LOGO_STRIP_H * 0.595)} />
      </View>
    </>
  );
}

export function GridOverlayE({ exercises, logs, nickname, timestamp, muscleLabel, tc, photoW, photoH, fontSet }: OverlayProps & { fontSet: FontSet }) {
  const COL_COUNT = 4;

  // 구분선을 별도 요소로 두고 좌우 여백을 동일하게 줘서 루틴과 루틴 사이 정중앙에 오도록 한다.
  const DIVIDER_W    = 2;   // 구분선 굵기
  const DIVIDER_GAP  = 6;   // 구분선 좌우 여백(대칭 → 자동으로 중앙 위치)
  const DIVIDER_SLOT = DIVIDER_W + DIVIDER_GAP * 2;
  const COL_W  = Math.floor((photoW - OVERLAY_PAD * 2 - DIVIDER_SLOT * (COL_COUNT - 1)) / COL_COUNT);
  const GRID_W = COL_W * COL_COUNT + DIVIDER_SLOT * (COL_COUNT - 1);

  // 좌상단: "닉네임 | 타임스탬프"를 세로로 회전시켜 배치하기 위한 치수.
  // SIDE_LEN(회전 후 세로 길이)은 고정값으로 두고 numberOfLines=1로 넘치는 글자는 잘라낸다.
  const SIDE_THICK = 13;
  const SIDE_LEN   = 260;
  const SIDE_EDGE_GAP = 8; // 최상단/최좌측에 붙이되 아주 살짝만 여백

  // 우상단: GYM PICK 로고 박스 (배경 = 사용자가 고른 색, 로고 = 그 색과 대비되는 색)
  // 원본 예시 이미지 대비: 상단에서 더 아래로 내리고, 두께는 더 두껍게, 위/아래 여백 차이는
  // 완만하게 줄였다. (회전 전 좌표를 직접 계산해서 로고가 박스 "안"에 정확히 들어가도록 한다.)
  const BOX_SIDE_PAD   = 15;  // 박스 좌우(두께 방향) 여백 — 박스 두께 2px 축소(좌우 1px씩)
  const BOX_TOP_GAP    = 12;  // 로고 위쪽 여백 — 완만하게 축소
  const BOX_BOTTOM_GAP = 9;   // 로고 아래쪽 여백 — 위쪽과 차이를 완만하게
  const BOX_TOP_OFFSET = 48;  // 사진 최상단에서 더 아래로 내림
  const LOGO_H     = 9;
  const LOGO_W     = Math.round(LOGO_H * (2805 / 279));
  const LOGO_BOX_W = LOGO_H + BOX_SIDE_PAD * 2;                    // 박스 폭(두께)
  const LOGO_BOX_H = LOGO_W + BOX_TOP_GAP + BOX_BOTTOM_GAP;        // 박스 높이(길이)
  const logoColor  = getContrastTextColor(tc);

  // rotate(90deg)는 요소 자기 중심을 기준으로 회전한다. "회전 후 보이길 원하는 위치"를
  // 먼저 정하고(로고를 박스 가로 중앙에서 살짝 좌측 / 세로 하단 쪽에 배치), 그 중심이 유지되도록
  // 회전 전(pre-rotation) left/top을 역산해야 로고가 박스 바깥으로 새지 않는다.
  const LOGO_LEFT_SHIFT = 3; // 박스 안에서 로고만 살짝 좌측으로 (우측으로 1px 이동)
  const logoVisualLeft = (LOGO_BOX_W - LOGO_H) / 2 - LOGO_LEFT_SHIFT;
  const logoVisualTop  = LOGO_BOX_H - BOX_BOTTOM_GAP - LOGO_W;
  const logoPreLeft = logoVisualLeft + LOGO_H / 2 - LOGO_W / 2;
  const logoPreTop  = logoVisualTop  + LOGO_W / 2 - LOGO_H / 2;

  // "가슴 Day" → "가슴" 처럼 뒤에 붙는 Day 표기만 제거 (실제 부위명은 그대로 노출)
  const pureLabel = muscleLabel.replace(/_?day$/i, '').replace(/\s*day$/i, '').trim() || muscleLabel;

  const shownExercises = exercises.slice(0, 9);
  const routineRows: (typeof shownExercises)[] = [];
  for (let i = 0; i < shownExercises.length; i += COL_COUNT) {
    routineRows.push(shownExercises.slice(i, i + COL_COUNT));
  }

  return (
    <>
      {/* 좌상단: 닉네임 | 타임스탬프 (세로 회전, 최상단·최좌측에 살짝만 여백을 두고 붙임) */}
      <View style={{ position: 'absolute', left: SIDE_EDGE_GAP, top: SIDE_EDGE_GAP, width: SIDE_THICK, height: SIDE_LEN, overflow: 'hidden' }}>
        <View
          style={{
            position: 'absolute',
            width: SIDE_LEN,
            height: SIDE_THICK,
            left: (SIDE_THICK - SIDE_LEN) / 2,
            top: (SIDE_LEN - SIDE_THICK) / 2,
            transform: [{ rotate: '90deg' }],
            flexDirection: 'row',
            alignItems: 'center',
          }}
        >
          <Text
            style={{ fontSize: 10, fontWeight: Platform.OS === 'android' ? undefined : '900', color: tc, letterSpacing: 0.3, fontFamily: fontSet.nickname }}
            numberOfLines={1}
          >
            {nickname}
          </Text>
          <Text style={{ fontSize: 10, color: tc, opacity: 0.6, marginHorizontal: 5, fontFamily: fontSet.nickname }}>|</Text>
          <Text
            style={{ fontSize: 9, fontWeight: Platform.OS === 'android' ? undefined : '600', color: tc, opacity: 0.85, fontFamily: fontSet.nickname }}
            numberOfLines={1}
          >
            {timestamp}
          </Text>
        </View>
      </View>

      {/* 우상단: GYM PICK 로고 박스 — 우측에 붙이되 상단은 아래로 내리고, 로고는 박스 안쪽 아래에 치우치게 배치 */}
      <View
        style={{
          position: 'absolute',
          top: BOX_TOP_OFFSET,
          right: 0,
          width: LOGO_BOX_W,
          height: LOGO_BOX_H,
          backgroundColor: tc,
          overflow: 'hidden',
        }}
      >
        <View style={{ position: 'absolute', left: logoPreLeft, top: logoPreTop, transform: [{ rotate: '90deg' }] }}>
          <GymPickLogo color={logoColor} width={LOGO_W} height={LOGO_H} />
        </View>
      </View>

      {/* 하단 고정: 타겟부위 + 3열 루틴 그리드 — bottom anchor라 내용이 늘면 위로 밀려 올라간다. 둘 다 가운데 정렬 */}
      <View style={{ position: 'absolute', left: OVERLAY_PAD, right: OVERLAY_PAD, bottom: OVERLAY_PAD }}>
        <Text
          style={{ fontSize: 32, color: tc, fontFamily: fontSet.muscle, letterSpacing: -1, marginBottom: 14, textAlign: 'center' }}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.5}
        >
          {pureLabel}
        </Text>

        <View style={{ width: GRID_W, alignSelf: 'center' }}>
          {routineRows.map((row, ri) => (
            <View key={ri} style={{ flexDirection: 'row', marginBottom: 10 }}>
              {row.map((ex, ci) => {
                const sets = logs[ex.id] ?? [];
                return (
                  <React.Fragment key={ex.id}>
                    {ci > 0 && (
                      <View
                        style={{
                          width: DIVIDER_W,
                          alignSelf: 'stretch',
                          backgroundColor: tc + '55',
                          marginHorizontal: DIVIDER_GAP,
                        }}
                      />
                    )}
                    <View style={{ width: COL_W }}>
                      <Text
                        style={{ fontSize: 7, fontWeight: Platform.OS === 'android' ? undefined : '700', color: tc, opacity: 0.75, letterSpacing: 0.2, fontFamily: fontSet.routine, textAlign: 'center' }}
                        numberOfLines={1}
                      >
                        {`[${ex.brand.toUpperCase()}]`}
                      </Text>
                      <Text
                        style={{ fontSize: 8, fontWeight: Platform.OS === 'android' ? undefined : '900', color: tc, marginBottom: 2, fontFamily: fontSet.routine, textAlign: 'center' }}
                        numberOfLines={2}
                      >
                        {ex.name.toUpperCase()}
                      </Text>
                      {sets.map((st, si) => (
                        <Text
                          key={si}
                          style={{ fontSize: 7, fontWeight: Platform.OS === 'android' ? undefined : '600', color: tc, opacity: 0.85, fontFamily: fontSet.routine, textAlign: 'center' }}
                        >
                          {`S${si + 1} ${st.weight}kg × ${st.reps}`}
                        </Text>
                      ))}
                    </View>
                  </React.Fragment>
                );
              })}
            </View>
          ))}
          {exercises.length > 9 && (
            <Text style={{ fontSize: 9, fontWeight: '700', color: tc, opacity: 0.6, textAlign: 'center' }}>
              {`+${exercises.length - 9} more...`}
            </Text>
          )}
        </View>
      </View>
    </>
  );
}

// --- Step 5: Photo

function WorkoutPhotoStep({ gym, exercises, selectedMuscles, logs, photoTaken, photoUri, nickname, fontsLoaded, onColorChange, onCapture, onCompositeUri, onRoutineCardUri, onSave, onBack, onClose, onCameraCapture, showCamera, onSetShowCamera, onRegisterRect, onboardingActive, onboardingKey, onOnboardingNext, onOnboardingJump }: {
  gym: GymWithMachines;
  exercises: ExerciseInfo[];
  selectedMuscles: string[];
  logs: Record<string, SetEntry[]>;
  photoTaken: boolean;
  photoUri?: string;
  nickname?: string;
  /** expo-font useFonts 로딩 완료 여부 — 인증샷 캡처가 폰트 로딩보다 먼저 실행되어
   *  Android에서 시스템 폰트로 캡처되는 레이스 컨디션을 막기 위한 가드 */
  fontsLoaded: boolean;
  onColorChange: (color: string) => void;
  onCapture: (aspect: [number, number]) => void;
  onCameraCapture: (uri: string) => void;
  onCompositeUri:    (uri: string) => void;
  onRoutineCardUri?: (uri: string) => void;
  onSave: (captured?: string, capturedRoutineUri?: string) => void;
  onBack: () => void;
  onClose: () => void;
  showCamera: boolean;
  onSetShowCamera: (v: boolean) => void;
  onRegisterRect?: (key: OnboardingPointKey, rect: SpotlightRect) => void;
  onboardingActive?: boolean;
  onboardingKey?: OnboardingPointKey | null;
  onOnboardingNext?: () => void;
  onOnboardingJump?: (key: OnboardingPointKey) => void;
}) {
  const [textColor,     setTextColor]     = useState('#ffffff');
  const [saveSuccess,   setSaveSuccess]   = useState(false);
  const [overlayStyle,  setOverlayStyle]  = useState<OverlayStyle>('s1a');
  const overlayRef = useRef<View>(null);
  /** 사진 없이 오버레이(닉네임/부위/통계 텍스트)만 투명 배경 PNG로 캡처하기 위한
   *  화면 밖 전용 뷰 참조. 영상에 직접 오버레이할 수 있도록 배경을 투명하게 유지한 채 캡처한다. */
  const layoutOnlyRef = useRef<View>(null);
  const routineCardRef = useRef<View>(null);
  const photoFrameRef   = useRef<View>(null);
  const overlayStyleRef = useRef<View>(null);
  const colorChipRef    = useRef<View>(null);
  const shareRowRef     = useRef<View>(null);
  const ctaBarRef       = useRef<View>(null);
  const photoScrollRef  = useRef<ScrollView>(null);
  const photoScrollYRef = useRef(0);

  useEffect(() => {
    if (!onboardingActive) return;
    const measure = (key: OnboardingPointKey, ref: React.RefObject<View | null>) => {
      requestAnimationFrame(() => {
        ref.current?.measureInWindow((x, y, width, height) => {
          onRegisterRect?.(key, { x, y, width, height });
        });
      });
    };

    // 스크롤 후 measureInWindow: photo-overlay/color/save-share 전용
    // 스크롤 완료(380ms) 후에 좌표를 재측정해야 스포트라이트가 정확하게 표시됨
    const scrollThenMeasure = (key: OnboardingPointKey, ref: React.RefObject<View | null>) => {
      ref.current?.measureInWindow((ex, ey) => {
        (photoScrollRef.current as any)?.measureInWindow((_sx: number, sy: number) => {
          const contentY = (ey - sy) + photoScrollYRef.current;
          photoScrollRef.current?.scrollTo({ y: Math.max(0, contentY - 50), animated: true });
          setTimeout(() => {
            requestAnimationFrame(() => {
              ref.current?.measureInWindow((x, y, width, height) => {
                onRegisterRect?.(key, { x, y, width, height });
              });
            });
          }, 380);
        });
      });
    };

    if (onboardingKey === 'photo-capture') {
      const target = photoTaken ? overlayRef : photoFrameRef;
      measure('photo-capture', target as React.RefObject<View>);
    }
    // 카메라 화면 진입 시 카메라 힌트 포인트로 이동
    if (onboardingKey === 'photo-camera-hint') {
      // 카메라 화면 전체를 스포트라이트로 표시
      const { width: W, height: H } = Dimensions.get('window');
      onRegisterRect?.('photo-camera-hint', { x: 0, y: 0, width: W, height: H });
    }
    // photo-capture-done은 overlayRef의 onLayout에서 처리 (마운트 완료 시점 보장)
    // useEffect에서는 이미 마운트된 경우에만 측정 시도
    if (onboardingKey === 'photo-capture-done' && photoTaken) {
      requestAnimationFrame(() => {
        overlayRef.current?.measureInWindow((x, y, width, height) => {
          if (width > 0 && height > 0) {
            onRegisterRect?.('photo-capture-done', { x, y, width, height });
          }
          // width/height가 0이면 onLayout이 아직 안 됨 → onLayout에서 처리됨
        });
      });
    }
    if (onboardingKey === 'photo-overlay') {
      if (!photoTaken && !showCamera) {
        onOnboardingJump?.('workout-save');
      } else {
        scrollThenMeasure('photo-overlay', overlayStyleRef);
      }
    }
    if (onboardingKey === 'photo-color') {
      if (!photoTaken && !showCamera) {
        onOnboardingJump?.('workout-save');
      } else {
        scrollThenMeasure('photo-color', colorChipRef);
      }
    }
    if (onboardingKey === 'photo-save-share') {
      if (!photoTaken) {
        onOnboardingJump?.('workout-save');
      } else {
        scrollThenMeasure('photo-save-share', shareRowRef);
      }
    }
    if (onboardingKey === 'workout-save') {
      measure('workout-save', ctaBarRef);
    }
  }, [onboardingActive, onboardingKey, photoTaken, showCamera]);

  useEffect(() => {
    if (!onboardingActive) return;
    if (photoTaken && (
      onboardingKey === 'photo-capture' ||
      onboardingKey === 'photo-camera-hint'
    )) {
      // 사진 촬영/선택 완료 → photo-capture-done으로 이동
      onOnboardingJump?.('photo-capture-done');
    }
  }, [photoTaken, onboardingActive, onboardingKey]);

  const ROUTINE_CARD_H = Math.round(PHOTO_W * 4 / 3);
  const RC_HEADER_H    = 64;
  const RC_FOOTER_H    = 28;
  const RC_AVAIL_H     = ROUTINE_CARD_H - RC_HEADER_H - RC_FOOTER_H - 1;

  const [itemHeights, setItemHeights] = useState<number[]>([]);

  const pageGroups = useMemo<number[][]>(() => {
    if (itemHeights.length !== exercises.length) {
      return exercises.map((_, i) => [i]);
    }
    const groups: number[][] = [];
    let current: number[] = [];
    let accumulated = 0;
    for (let i = 0; i < exercises.length; i++) {
      const h = itemHeights[i] + (current.length > 0 ? 1 : 0);
      if (current.length > 0 && accumulated + h > RC_AVAIL_H) {
        groups.push(current);
        current = [i];
        accumulated = itemHeights[i];
      } else {
        current.push(i);
        accumulated += h;
      }
    }
    if (current.length > 0) groups.push(current);
    return groups;
  }, [itemHeights, exercises.length, RC_AVAIL_H]);

  const pageCount       = Math.max(1, pageGroups.length);
  const routinePageRefs = useRef<(View | null)[]>([]);

  const photoH = Math.round(PHOTO_W * 4 / 3);

  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const ENG_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const dateLabel = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}(${ENG_DAYS[now.getDay()]})`;
  const timestamp = `${dateLabel}_${pad(now.getHours())}:${pad(now.getMinutes())}`;
  const displayName = nickname ?? 'gympick_user';

  // 사용자가 고른 타겟부위(selectedMuscles) 기준으로 라벨 생성 (경로 2).
  // 비어 있으면 기록된 운동에서 역산한 부위로 fallback.
  const muscleCounts = exercises.reduce<Record<string, number>>((acc, ex) => {
    acc[ex.targetMuscle] = (acc[ex.targetMuscle] ?? 0) + 1;
    return acc;
  }, {});
  const sortedMuscles = Object.entries(muscleCounts)
    .sort(([, a], [, b]) => b - a)
    .map(([m]) => m);
  const labelMuscles = (selectedMuscles && selectedMuscles.length > 0)
    ? selectedMuscles
    : sortedMuscles;
  const muscleLabel = labelMuscles.length > 1
    ? labelMuscles.join(' + ')
    : `${labelMuscles[0] ?? 'WORKOUT'} Day`;

  async function handleSaveImage() {
    if (!photoUri || !overlayRef.current) {
      Alert.alert('사진 없음', '먼저 사진을 찍어주세요.');
      return;
    }
    try {
      await new Promise(resolve => requestAnimationFrame(resolve));
      await new Promise<void>(resolve => InteractionManager.runAfterInteractions(() => resolve()));
      if (!overlayRef.current) {
        Alert.alert('저장 실패', '저장에 실패했습니다.');
        return;
      }
      const ratio = Math.max(PixelRatio.get(), 4);
      const capturedUri = await captureRef(overlayRef, {
        format: 'png', quality: 1, result: 'tmpfile',
        pixelRatio: ratio,
        ...(Platform.OS === 'android' ? { width: Math.round(PHOTO_W * ratio), height: Math.round(photoH * ratio) } : {}),
      });
      onCompositeUri(capturedUri);
      await MediaLibrary.saveToLibraryAsync(capturedUri);

      // 루틴카드 페이지별 캡처 및 저장 (인스타그램 방식과 동일)
      const routineUris: string[] = [];
      for (let i = 0; i < pageCount; i++) {
        const ref = routinePageRefs.current[i];
        if (ref) {
          try {
            await new Promise(resolve => requestAnimationFrame(resolve));
            await new Promise(resolve => setTimeout(resolve, 100));
            const ratio = Math.max(PixelRatio.get(), 4);
            const pageUri = await captureRef(ref, {
              format: 'png', quality: 1, result: 'tmpfile',
              pixelRatio: ratio,
              ...(Platform.OS === 'android' ? { width: Math.round(PHOTO_W * ratio), height: Math.round(ROUTINE_CARD_H * ratio) } : {}),
            });
            routineUris.push(pageUri);
            await MediaLibrary.saveToLibraryAsync(pageUri);
          } catch (e) {
            console.error(`[SaveImage] 루틴카드 페이지 ${i} 캡처 실패:`, e);
          }
        }
      }
      if (routineUris.length > 0) {
        onRoutineCardUri?.(routineUris[0]);
      }

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('저장 완료', '인증샷과 운동 루틴 카드가 저장되었습니다.');
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
    } catch (error) {
      console.error('[GymPick] 이미지 저장 오류:', error);
      Alert.alert('저장에 실패했습니다', '다시 시도해 주세요.');
    }
  }

  /** 사진 없이 오버레이(닉네임/부위/통계 텍스트)만 투명 배경 PNG로 사진첩에 저장.
   *  루틴 카드는 포함하지 않고, 오버레이 프레임 한 장만 저장한다. 저장된 PNG는
   *  짐픽 밖에서(예: 영상 편집 앱) 유저가 직접 영상 위에 올려 쓰는 용도다. */
  async function handleSaveLayoutOnly() {
    if (!photoTaken || !layoutOnlyRef.current) {
      Alert.alert('사진 없음', '먼저 사진을 찍어주세요.');
      return;
    }
    try {
      await new Promise(resolve => requestAnimationFrame(resolve));
      await new Promise<void>(resolve => InteractionManager.runAfterInteractions(() => resolve()));
      if (!layoutOnlyRef.current) {
        Alert.alert('저장 실패', '저장에 실패했습니다.');
        return;
      }
      const ratio = Math.max(PixelRatio.get(), 4);
      const capturedUri = await captureRef(layoutOnlyRef, {
        format: 'png', quality: 1, result: 'tmpfile',
        pixelRatio: ratio,
        ...(Platform.OS === 'android' ? { width: Math.round(PHOTO_W * ratio), height: Math.round(photoH * ratio) } : {}),
      });
      await MediaLibrary.saveToLibraryAsync(capturedUri);

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('저장 완료', '오버레이 이미지(투명 배경 PNG)가 사진첩에 저장되었습니다.\n영상 편집 앱에서 이 이미지를 영상 위에 올려서 사용하세요.');
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
    } catch (error) {
      console.error('[GymPick] 오버레이 이미지 저장 오류:', error);
      Alert.alert('저장에 실패했습니다', '다시 시도해 주세요.');
    }
  }

  async function handleInstagramShare() {
    if (!photoUri || !overlayRef.current) {
      Alert.alert('사진 없음', '먼저 사진을 찍어주세요.');
      return;
    }
    try {
      await new Promise(resolve => requestAnimationFrame(resolve));
      await new Promise<void>(resolve => InteractionManager.runAfterInteractions(() => resolve()));

      // 1. 인증샷 캡처
      let capturedUri: string;
      try {
        const ratio = Math.max(PixelRatio.get(), 4);
        capturedUri = await captureRef(overlayRef, {
          format: 'png', quality: 1, result: 'tmpfile',
          pixelRatio: ratio,
          ...(Platform.OS === 'android' ? { width: Math.round(PHOTO_W * ratio), height: Math.round(photoH * ratio) } : {}),
        });
      } catch (e) {
        console.error('[Instagram] 인증샷 캡처 실패:', e);
        Alert.alert('캡처 실패', '인증샷 캡처에 실패했습니다. 다시 시도해 주세요.');
        return;
      }

      // 2. 루틴카드 페이지별 캡처
      const pageUris: string[] = [];
      for (let i = 0; i < pageCount; i++) {
        const ref = routinePageRefs.current[i];
        if (ref) {
          try {
            await new Promise(resolve => requestAnimationFrame(resolve));
            await new Promise(resolve => setTimeout(resolve, 100));
            const ratio = Math.max(PixelRatio.get(), 4);
            const pageUri = await captureRef(ref, {
              format: 'png', quality: 1, result: 'tmpfile',
              pixelRatio: ratio,
              ...(Platform.OS === 'android' ? { width: Math.round(PHOTO_W * ratio), height: Math.round(ROUTINE_CARD_H * ratio) } : {}),
            });
            pageUris.push(pageUri);
          } catch (e) {
            console.error(`[Instagram] 루틴카드 페이지 ${i} 캡처 실패:`, e);
          }
        } else {
          console.warn(`[Instagram] routinePageRefs[${i}] is null`);
        }
      }

      // 3. 갤러리 저장
      const allUris = [capturedUri, ...pageUris];
      const assets: MediaLibrary.Asset[] = [];
      for (const uri of allUris) {
        try {
          const asset = await MediaLibrary.createAssetAsync(uri);
          assets.push(asset);
        } catch (e) {
          console.error('[Instagram] 갤러리 저장 실패:', e);
        }
      }

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      // 4. 인스타그램 실행
      if (Platform.OS === 'ios' && assets.length > 0) {
        const instagramUrl = `instagram://library?LocalIdentifier=${assets[0].id}`;
        try {
          await Linking.openURL(instagramUrl);
        } catch (e) {
          console.warn('[Instagram] 딥링크 실패, 앱스토어로 이동:', e);
          Alert.alert(
            '저장 완료',
            `${assets.length}장이 갤러리에 저장되었습니다.\n인스타그램 앱을 실행해서 업로드해주세요.`,
          );
        }
      } else {
        try {
          const canShare = await Sharing.isAvailableAsync();
          if (canShare && capturedUri) {
            await Sharing.shareAsync(capturedUri, {
              mimeType: 'image/png',
              dialogTitle: '인스타그램에 공유',
            });
          } else {
            Alert.alert(
              '저장 완료',
              `${assets.length}장이 갤러리에 저장되었습니다.\n인스타그램 앱에서 업로드해주세요.`
            );
          }
        } catch (e) {
          console.error('[Instagram] 공유 실패:', e);
          Alert.alert('저장 완료', `${assets.length}장이 갤러리에 저장되었습니다.`);
        }
      }
    } catch (error) {
      console.error('[GymPick] 인스타그램 공유 오류:', error);
      Alert.alert('공유에 실패했습니다', `오류: ${String(error)}`);
    }
  }

  const tc = textColor;
  // 레이아웃 E(각진 모서리 + 테두리선 없음)만 사진 프레임 스타일이 달라서 미리 계산해둔다.
  const currentLayoutType = getLayoutType(overlayStyle);

  // 스타일별 오버레이(닉네임/부위/통계 텍스트 등) — 사진 위 미리보기와
  // 사진 없는 "오버레이만" 캡처 뷰 양쪽에서 동일하게 재사용한다.
  function renderStyleOverlay() {
    const fs = getFontSet(overlayStyle);
    const layout = getLayoutType(overlayStyle);

    const commonProps = {
      exercises,
      logs,
      nickname: displayName,
      timestamp,
      muscleLabel,
      tc,
      photoW: PHOTO_W,
      photoH,
    };

    // 유형 A: ClassicOverlay
    if (layout === 'a') {
      return (
        <ClassicOverlay
          exercises={exercises}
          logs={logs}
          nickname={displayName}
          timestamp={timestamp}
          muscleLabel={muscleLabel}
          tc={tc}
          photoW={PHOTO_W}
          photoH={photoH}
          fontSet={fs}
        />
      );
    }

    // 유형 B: LeftColOverlayB
    if (layout === 'b') {
      return (
        <LeftColOverlayB
          {...commonProps}
          fontSet={fs}
        />
      );
    }

    // 유형 D: GridOverlayD
    if (layout === 'd') {
      return (
        <GridOverlayD
          exercises={exercises}
          logs={logs}
          nickname={displayName}
          timestamp={timestamp}
          muscleLabel={muscleLabel}
          tc={tc}
          photoW={PHOTO_W}
          photoH={photoH}
          fontSet={fs}
        />
      );
    }

    // 유형 C: GridOverlayC
    if (layout === 'c') {
      return (
        <GridOverlayC
          exercises={exercises}
          logs={logs}
          nickname={displayName}
          timestamp={timestamp}
          muscleLabel={muscleLabel}
          tc={tc}
          photoW={PHOTO_W}
          photoH={photoH}
          fontSet={fs}
        />
      );
    }

    // 유형 E: GridOverlayE (모서리 각짐 + 테두리선 없음 — 아래 테두리 렌더링에서 별도 처리)
    if (layout === 'e') {
      return (
        <GridOverlayE
          exercises={exercises}
          logs={logs}
          nickname={displayName}
          timestamp={timestamp}
          muscleLabel={muscleLabel}
          tc={tc}
          photoW={PHOTO_W}
          photoH={photoH}
          fontSet={fs}
        />
      );
    }

    return null;
  }

  return (
    <SafeAreaView style={s.safe} edges={["top", "bottom"]}>
      <NavHeader title="운동 사진" onBack={onBack} onClose={onClose} />
      <StepBar total={5} current={3} />
      <ScrollView
        ref={photoScrollRef}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.listPad}
        onScroll={e => { photoScrollYRef.current = e.nativeEvent.contentOffset.y; }}
        scrollEventThrottle={16}
      >
        {/* No photo: show camera CTA as TouchableOpacity */}
        {!photoTaken && !showCamera && (
          <TouchableOpacity
            ref={photoFrameRef}
            style={[s.photoFrame, { height: photoH }]}
            activeOpacity={0.85}
            onLayout={() => {
              if (onboardingActive && onboardingKey === 'photo-capture') {
                photoFrameRef.current?.measureInWindow((x, y, width, height) => {
                  onRegisterRect?.('photo-capture', { x, y, width, height });
                });
              }
            }}
            onPress={() => {
              Alert.alert(
                '사진 선택',
                '운동 사진을 추가하세요',
                [
                  {
                    text: '카메라로 찍기',
                    onPress: () => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                      if (onboardingActive && onboardingKey === 'photo-capture') {
                        onOnboardingJump?.('photo-camera-hint');
                      }
                      onSetShowCamera(true);
                    },
                  },
                  {
                    text: '사진 선택',
                    onPress: () => {
                      if (onboardingActive && onboardingKey === 'photo-capture') {
                        onOnboardingJump?.('photo-capture-done');
                      }
                      onCapture([3, 4]);
                    },
                  },
                  { text: '취소', style: 'cancel' },
                ],
              );
            }}
          >
            <View style={s.photoCta}>
              <View style={s.photoCtaIcon}>
                <Ionicons name="camera" size={30} color={C.textSub} />
              </View>
              <Text style={s.photoCtaTitle}>탭하여 사진 찍기</Text>
            </View>
          </TouchableOpacity>
        )}

        {/* 인앱 카메라 오버레이: showCamera가 true면 photoTaken 상태와 무관하게 표시 */}
        {showCamera && (
          <WorkoutCameraOverlay
            gym={gym}
            exercises={exercises}
            logs={logs}
            nickname={nickname}
            textColor={textColor}
            muscleLabel={muscleLabel}
            overlayStyle={overlayStyle}
            onCaptureDone={(uri) => {
              onSetShowCamera(false);
              onCameraCapture(uri);
            }}
            onCancel={() => onSetShowCamera(false)}
          />
        )}

        {/* Photo taken: overlay View - showCamera 중에는 숨김 */}
        {photoTaken && !showCamera && (
          <View
            ref={overlayRef}
            style={[s.photoFrame, s.photoFrameActive, { height: photoH, backgroundColor: 'transparent', borderWidth: 0, borderRadius: currentLayoutType === 'e' ? 0 : 20, overflow: 'hidden' }]}
            collapsable={false}
            onLayout={() => {
              if (!onboardingActive) return;
              if (onboardingKey === 'photo-capture') {
                overlayRef.current?.measureInWindow((x, y, width, height) => {
                  onRegisterRect?.('photo-capture', { x, y, width, height });
                });
              }
              if (onboardingKey === 'photo-capture-done') {
                // onLayout 시점에 바로 측정 (마운트 완료 보장)
                overlayRef.current?.measureInWindow((x, y, width, height) => {
                  onRegisterRect?.('photo-capture-done', { x, y, width, height });
                });
              }
            }}
          >
            {/* Background photo */}
            {photoUri ? (
              <Image
                source={{ uri: photoUri }}
                style={StyleSheet.absoluteFill}
                resizeMode="cover"
              />
            ) : null}

            {/* 스타일별 오버레이 */}
            {renderStyleOverlay()}

            {/* 테두리: overflow 클리핑 이후 absolute로 덮어 빈공간 방지 (레이아웃 E는 각진 디자인이라 생략) */}
            {currentLayoutType !== 'e' && (
              <View
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  borderRadius: 20,
                  borderWidth: 2,
                  borderColor: tc,
                }}
                pointerEvents="none"
              />
            )}
          </View>
        )}

        {/* 루틴카드 — 캡처 전용 (화면 밖에 배치) */}
        <View style={{ position: 'absolute', top: -9999, left: -9999, backgroundColor: 'transparent' }} pointerEvents="none">
          <View
            ref={routineCardRef}
            collapsable={false}
            style={{
              width: PHOTO_W,
              backgroundColor: '#FFFFFF',
              borderWidth: 3,
              borderColor: textColor,
              borderRadius: 16,
              overflow: 'hidden',
            }}
          >
            {/* 헤더 */}
            <View style={{ paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#FFFFFF' }}>
              {/* 헬스장명 + 타겟부위 칩 한 줄 */}
              <View style={{
                flexDirection:  'row',
                alignItems:     'center',
                justifyContent: 'space-between',
                marginBottom:   2,
              }}>
                <Text
                  style={{ fontSize: 15, fontWeight: '900', color: '#111111', flex: 1, marginRight: 8 }}
                  numberOfLines={1}
                >
                  {gym.name}
                </Text>
                {/* 타겟부위 칩 */}
                <View style={{
                  backgroundColor:  textColor,
                  borderRadius:     20,
                  paddingHorizontal: 10,
                  paddingVertical:   3,
                }}>
                  <Text style={{
                    fontSize:      10,
                    fontWeight:    '800',
                    color:         '#FFFFFF',
                    letterSpacing: 0.5,
                    textTransform: 'uppercase',
                  }}>
                    {muscleLabel.replace(' Day', '')}
                  </Text>
                </View>
              </View>
              <Text style={{ fontSize: 11, color: '#888888', fontWeight: '500' }}>
                {timestamp}
              </Text>
            </View>
            <View style={{ height: 1, backgroundColor: '#E5E5E5' }} />

            {/* 머신 목록 */}
            {exercises.map((ex, i) => {
              const exSets    = logs[ex.id] ?? [];
              const brandKey  = ex.brand.toUpperCase().replace(/\s+/g, '_');
              const brandLogo = brandLogos[brandKey];
              const imageUrl  = getMachineImageUrl(machineIdFromKey(ex.id), { width: 128 });

              return (
                <React.Fragment key={ex.id}>
                  {i > 0 && <View style={{ height: 1, backgroundColor: '#E5E5E5' }} />}
                  <View style={{ flexDirection: 'row', alignItems: 'flex-start', padding: 12, gap: 10 }}>

                    {/* 머신 이미지 */}
                    <RoutineCardMachineThumb uri={imageUrl} />

                    {/* 머신명 + 제조사 로고 */}
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 12, fontWeight: '700', color: '#000000', lineHeight: 16, marginBottom: 4 }} numberOfLines={2}>
                        {ex.name.toUpperCase()}
                      </Text>
                      {brandLogo ? (
                        <Image
                          source={brandLogo}
                          style={{ width: 56, height: 18 }}
                          resizeMode="contain"
                        />
                      ) : (
                        <Text style={{ fontSize: 10, color: '#333333' }}>{ex.brand}</Text>
                      )}
                    </View>

                    {/* 세트 목록 */}
                    <View style={{ alignItems: 'flex-end', justifyContent: 'flex-start', minWidth: 80 }}>
                      {exSets.map((st, si) => (
                        <Text key={si} style={{ fontSize: 11, fontWeight: '600', color: '#000000', lineHeight: 18 }}>
                          {st.weight > 0 ? `${st.weight}kg` : '--'} × {st.reps}
                        </Text>
                      ))}
                    </View>

                  </View>
                </React.Fragment>
              );
            })}

            {/* 푸터 */}
            <View style={{ paddingHorizontal: 16, paddingVertical: 10, alignItems: 'flex-end', backgroundColor: '#FFFFFF' }}>
              <GymPickLogo color="#000000" width={60} height={6} />
            </View>
          </View>
        </View>

        {/* 머신 행 실제 높이 측정용 (화면 밖에 숨김) — 행 높이는 이미지 로드 여부와
            무관(고정 64×64 박스)하므로 실제 네트워크 요청 없이 빈 박스로만 측정한다 */}
        <View style={{ position: 'absolute', top: -9999, left: -9999, width: PHOTO_W, backgroundColor: 'transparent' }} pointerEvents="none">
          {exercises.map((ex, i) => {
            const exSets    = logs[ex.id] ?? [];
            const brandKey  = ex.brand.toUpperCase().replace(/\s+/g, '_');
            const brandLogo = brandLogos[brandKey];
            return (
              <View
                key={`measure-${ex.id}`}
                collapsable={false}
                onLayout={e => {
                  const h = e.nativeEvent.layout.height;
                  setItemHeights(prev => {
                    const next = [...prev];
                    next[i] = h;
                    return next;
                  });
                }}
                style={{ flexDirection: 'row', alignItems: 'flex-start', padding: 12, gap: 10 }}
              >
                <View style={{ width: 64, height: 64, borderRadius: 10, overflow: 'hidden', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5E5E5' }} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: '#000000', lineHeight: 16, marginBottom: 4 }} numberOfLines={2}>
                    {ex.name.toUpperCase()}
                  </Text>
                  {brandLogo ? (
                    <Image source={brandLogo} style={{ width: 56, height: 18 }} resizeMode="contain" />
                  ) : (
                    <Text style={{ fontSize: 10, color: '#333333' }}>{ex.brand}</Text>
                  )}
                </View>
                <View style={{ alignItems: 'flex-end', justifyContent: 'flex-start', minWidth: 80 }}>
                  {exSets.map((st, si) => (
                    <Text key={si} style={{ fontSize: 11, fontWeight: '600', color: '#000000', lineHeight: 18 }}>
                      {st.weight > 0 ? `${st.weight}kg` : '--'} × {st.reps}
                    </Text>
                  ))}
                </View>
              </View>
            );
          })}
        </View>

        {/* 인스타 공유용 루틴카드 페이지 분할 */}
        {pageGroups.map((group, pageIdx) => {
          const pageExercises = group.map(i => exercises[i]);
          return (
            <View
              key={`rpage-${pageIdx}`}
              style={{ position: 'absolute', top: -9999, left: -9999, backgroundColor: 'transparent' }}
              pointerEvents="none"
            >
              <View
                ref={el => { routinePageRefs.current[pageIdx] = el; }}
                collapsable={false}
                style={{
                  width: PHOTO_W,
                  height: ROUTINE_CARD_H,
                  backgroundColor: '#FFFFFF',
                  borderWidth: 3,
                  borderColor: textColor,
                  borderRadius: 16,
                  overflow: 'hidden',
                }}
              >
                {/* 헤더 */}
                <View style={{ paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#FFFFFF' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
                    <Text style={{ fontSize: 15, fontWeight: '900', color: '#111111', flex: 1, marginRight: 8 }} numberOfLines={1}>
                      {gym.name}
                    </Text>
                    <View style={{ backgroundColor: textColor, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3 }}>
                      <Text style={{ fontSize: 10, fontWeight: '800', color: '#FFFFFF', letterSpacing: 0.5, textTransform: 'uppercase' }}>
                        {muscleLabel.replace(' Day', '')}
                      </Text>
                    </View>
                  </View>
                  <Text style={{ fontSize: 11, color: '#888888', fontWeight: '500' }}>
                    {timestamp}{pageCount > 1 ? `  (${pageIdx + 1}/${pageCount})` : ''}
                  </Text>
                </View>
                <View style={{ height: 1, backgroundColor: '#E5E5E5' }} />
                {/* 머신 목록 */}
                <View style={{ flex: 1, overflow: 'hidden' }}>
                  {pageExercises.map((ex, i) => {
                    const exSets    = logs[ex.id] ?? [];
                    const brandKey  = ex.brand.toUpperCase().replace(/\s+/g, '_');
                    const brandLogo = brandLogos[brandKey];
                    const imageUrl  = getMachineImageUrl(machineIdFromKey(ex.id), { width: 128 });
                    return (
                      <React.Fragment key={ex.id}>
                        {i > 0 && <View style={{ height: 1, backgroundColor: '#E5E5E5' }} />}
                        <View style={{ flexDirection: 'row', alignItems: 'flex-start', padding: 12, gap: 10 }}>
                          <RoutineCardMachineThumb uri={imageUrl} />
                          <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 12, fontWeight: '700', color: '#000000', lineHeight: 16, marginBottom: 4 }} numberOfLines={2}>
                              {ex.name.toUpperCase()}
                            </Text>
                            {brandLogo ? (
                              <Image source={brandLogo} style={{ width: 56, height: 18 }} resizeMode="contain" />
                            ) : (
                              <Text style={{ fontSize: 10, color: '#333333' }}>{ex.brand}</Text>
                            )}
                          </View>
                          <View style={{ alignItems: 'flex-end', justifyContent: 'flex-start', minWidth: 80 }}>
                            {exSets.map((st, si) => (
                              <Text key={si} style={{ fontSize: 11, fontWeight: '600', color: '#000000', lineHeight: 18 }}>
                                {st.weight > 0 ? `${st.weight}kg` : '--'} × {st.reps}
                              </Text>
                            ))}
                          </View>
                        </View>
                      </React.Fragment>
                    );
                  })}
                </View>
                {/* 푸터 */}
                <View style={{ paddingHorizontal: 16, paddingVertical: 10, alignItems: 'flex-end', backgroundColor: '#FFFFFF' }}>
                  <GymPickLogo color="#000000" width={60} height={6} />
                </View>
              </View>
            </View>
          );
        })}

        {/* 오버레이만 저장용 — 사진 없이 오버레이(닉네임/부위/통계 텍스트)만 투명 배경으로
            캡처하기 위한 화면 밖 전용 뷰. 사진 레이어를 넣지 않고 배경도 투명하게 유지해서,
            캡처한 PNG를 유저가 영상 위에 직접 오버레이할 수 있게 한다. */}
        {photoTaken && !showCamera && (
          <View style={{ position: 'absolute', top: -9999, left: -9999, backgroundColor: 'transparent' }} pointerEvents="none">
            <View
              ref={layoutOnlyRef}
              collapsable={false}
              style={{
                width: PHOTO_W,
                height: photoH,
                backgroundColor: 'transparent',
                borderRadius: currentLayoutType === 'e' ? 0 : 20,
                overflow: 'hidden',
              }}
            >
              {renderStyleOverlay()}
              {currentLayoutType !== 'e' && (
                <View
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    borderRadius: 20,
                    borderWidth: 2,
                    borderColor: tc,
                  }}
                  pointerEvents="none"
                />
              )}
            </View>
          </View>
        )}

        {/* 다시 찍기 버튼: 사진이 찍혔을 때만 */}
        {photoTaken && (
          <TouchableOpacity
            style={s.retakeRow}
            onPress={() => {
              Alert.alert(
                '다시 찍기',
                '사진 촬영 방법을 선택하세요',
                [
                  { text: '카메라로 찍기', onPress: () => onSetShowCamera(true) },
                  { text: '사진 선택',     onPress: () => onCapture([3, 4]) },
                  { text: '취소', style: 'cancel' },
                ],
              );
            }}
            activeOpacity={0.75}
          >
            <Ionicons name="camera-reverse-outline" size={13} color={C.textSub} />
            <Text style={s.retakeText}>다시 찍기</Text>
          </TouchableOpacity>
        )}

        {/* 텍스트 색상 + 레이아웃 스타일: 카메라 활성 중 또는 사진 찍힌 후 모두 표시 */}
        {(photoTaken || showCamera) && (
          <>
          {/* 레이아웃 스타일: 폰트 세트 × 유형 버튼 */}
          <View
            ref={overlayStyleRef}
            style={{ marginBottom: 10 }}
            onLayout={() => {
              if (onboardingActive && onboardingKey === 'photo-overlay') {
                overlayStyleRef.current?.measureInWindow((x, y, width, height) => {
                  onRegisterRect?.('photo-overlay', { x, y, width, height });
                });
              }
            }}
          >
            <Text style={{ fontSize: 9, fontWeight: '700', color: C.textDim, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 8, paddingHorizontal: 2 }}>
              레이아웃
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ flexDirection: 'row', gap: 6, paddingRight: 4 }}
            >
              {([
                { key: 's1a', set: 1, type: 'A', muscle: 'Quicksilver-Italic' },
                { key: 's1b', set: 1, type: 'B', muscle: 'Quicksilver-Italic' },
                { key: 's1c', set: 1, type: 'C', muscle: 'Quicksilver-Italic' },
                { key: 's1d', set: 1, type: 'D', muscle: 'Quicksilver-Italic' },
                { key: 's1e', set: 1, type: 'E', muscle: 'Quicksilver-Italic' },
                { key: 's2a', set: 2, type: 'A', muscle: 'Matcha Cih' },
                { key: 's2b', set: 2, type: 'B', muscle: 'Matcha Cih' },
                { key: 's2c', set: 2, type: 'C', muscle: 'Matcha Cih' },
                { key: 's2d', set: 2, type: 'D', muscle: 'Matcha Cih' },
                { key: 's2e', set: 2, type: 'E', muscle: 'Matcha Cih' },
                { key: 's6a', set: 6, type: 'A', muscle: 'biergartenlt' },
                { key: 's6b', set: 6, type: 'B', muscle: 'biergartenlt' },
                { key: 's6c', set: 6, type: 'C', muscle: 'biergartenlt' },
                { key: 's6d', set: 6, type: 'D', muscle: 'biergartenlt' },
                { key: 's6e', set: 6, type: 'E', muscle: 'biergartenlt' },
              ] as { key: OverlayStyle; set: number; type: string; muscle: string }[]).map((opt, idx) => {
                const isActive = overlayStyle === opt.key;
                const isTypeD   = opt.type === 'D';
                return (
                  <TouchableOpacity
                    key={opt.key}
                    onPress={() => setOverlayStyle(opt.key)}
                    activeOpacity={0.8}
                    style={{
                      paddingHorizontal: 10,
                      paddingVertical: 10,
                      borderRadius: 10,
                      borderWidth: isActive ? 2 : 1.5,
                      borderColor: isActive ? C.accent : C.border,
                      backgroundColor: isActive ? '#1a1a1a' : C.surface,
                      alignItems: 'center',
                      justifyContent: 'center',
                      minWidth: 48,
                      marginLeft: (idx > 0 && idx % 5 === 0) ? 8 : 0,
                    }}
                  >
                    <Text style={{
                      fontSize: 14,
                      color: isActive ? C.accent : C.textSub,
                      fontFamily: opt.muscle,
                    }}>
                      DAY
                    </Text>
                    <Text style={{
                      fontSize: 8,
                      fontWeight: '700',
                      color: isActive ? C.accent : C.textDim,
                      marginTop: 3,
                    }}>
                      {`${opt.set}${opt.type}`}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* 컬러칩 */}
          <View
            ref={colorChipRef}
            style={{ marginBottom: 16 }}
            onLayout={() => {
              if (onboardingActive && onboardingKey === 'photo-color') {
                colorChipRef.current?.measureInWindow((x, y, width, height) => {
                  onRegisterRect?.('photo-color', { x, y, width, height });
                });
              }
            }}
          >
            <Text style={{ fontSize: 9, fontWeight: '700', color: C.textDim, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 8, paddingHorizontal: 2 }}>
              텍스트 색상
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ flexDirection: 'row', gap: 6, alignItems: 'center', paddingRight: 8 }}
            >
              {TEXT_COLORS.map(opt => (
                <TouchableOpacity
                  key={opt.hex}
                  style={[
                    s.colorChip,
                    { backgroundColor: opt.hex },
                    textColor === opt.hex && s.colorChipActive,
                  ]}
                  onPress={() => { setTextColor(opt.hex); onColorChange(opt.hex); }}
                  activeOpacity={0.8}
                />
              ))}
            </ScrollView>
          </View>
          </>
        )}

        {/* 저장 / 인스타그램 버튼 */}
        <View
          ref={shareRowRef}
          style={s.shareRow}
          onLayout={() => {
            if (onboardingActive && onboardingKey === 'photo-save-share') {
              shareRowRef.current?.measureInWindow((x, y, width, height) => {
                onRegisterRect?.('photo-save-share', { x, y, width, height });
              });
            }
          }}
        >
          <TouchableOpacity
            style={[s.shareBtn, { flex: 1 }]}
            activeOpacity={0.8}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              if (Platform.OS === 'ios') {
                ActionSheetIOS.showActionSheetWithOptions(
                  {
                    options: ['취소', '기기에 저장', '인스타그램에 업로드', '오버레이만 저장'],
                    cancelButtonIndex: 0,
                    title: '저장 방식 선택',
                  },
                  (buttonIndex) => {
                    if (buttonIndex === 1) handleSaveImage();
                    if (buttonIndex === 2) handleInstagramShare();
                    if (buttonIndex === 3) handleSaveLayoutOnly();
                  }
                );
              } else {
                Alert.alert(
                  '저장 방식 선택',
                  '어떻게 저장할까요?',
                  [
                    { text: '취소', style: 'cancel' },
                    { text: '기기에 저장', onPress: handleSaveImage },
                    { text: '인스타그램에 업로드', onPress: handleInstagramShare },
                    { text: '오버레이만 저장', onPress: handleSaveLayoutOnly },
                  ]
                );
              }
            }}
          >
            <Ionicons name="share-outline" size={18} color={C.text} />
            <Text style={s.shareBtnTxt}>
              {saveSuccess ? '저장됨 ✓' : '저장 / 공유'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>
      <View
        ref={ctaBarRef}
        style={s.ctaBar}
        onLayout={() => {
          if (onboardingActive && onboardingKey === 'workout-save') {
            ctaBarRef.current?.measureInWindow((x, y, width, height) => {
              onRegisterRect?.('workout-save', { x, y, width, height });
            });
          }
        }}
      >
        <TouchableOpacity
          style={[s.ctaBtn, !fontsLoaded && { opacity: 0.5 }]}
          activeOpacity={0.85}
          disabled={!fontsLoaded}
          onPress={async () => {
          if (!photoTaken) {
            Alert.alert(
              '사진을 등록해주세요',
              '운동 사진을 등록해야 저장할 수 있어요.\n카메라로 찍거나 사진을 선택해주세요.',
              [
                {
                  text: '카메라로 찍기',
                  onPress: () => onSetShowCamera(true),
                },
                {
                  text: '사진 선택',
                  onPress: () => onCapture([3, 4]),
                },
                { text: '취소', style: 'cancel' },
              ],
            );
            return;
          }

          let captured: string | undefined;
          let capturedRoutineUri: string | undefined;
          if (photoTaken && overlayRef.current) {
            try {
              await new Promise(resolve => requestAnimationFrame(resolve));
              await new Promise<void>(resolve => InteractionManager.runAfterInteractions(() => resolve()));
              const ratio = Math.max(PixelRatio.get(), 4);
              if (overlayRef.current) {
                captured = await captureRef(overlayRef, {
                  format: 'png', quality: 1, result: 'tmpfile',
                  pixelRatio: ratio,
                  ...(Platform.OS === 'android' ? { width: Math.round(PHOTO_W * ratio), height: Math.round(photoH * ratio) } : {}),
                });
                onCompositeUri(captured);
              }
              if (routineCardRef.current) {
                await new Promise(resolve => requestAnimationFrame(resolve));
                let measuredHeight = 0;
                if (Platform.OS === 'android') {
                  measuredHeight = await new Promise<number>((resolve) => {
                    routineCardRef.current!.measure((_x, _y, _w, h) => resolve(h > 0 ? h : ROUTINE_CARD_H));
                  });
                }
                capturedRoutineUri = await captureRef(routineCardRef, {
                  format: 'png', quality: 1, result: 'tmpfile',
                  pixelRatio: ratio,
                  ...(Platform.OS === 'android' ? { width: Math.round(PHOTO_W * ratio), height: Math.round(measuredHeight * ratio) } : {}),
                });
                onRoutineCardUri?.(capturedRoutineUri);
              }
            } catch (_) {}
          }
          onSave(captured, capturedRoutineUri);
        }}>
          <Ionicons name="checkmark-done" size={18} color={C.bg} />
          <Text style={s.ctaTxt}>운동 저장</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

// --- Step 6: Done

// --- 머신별 비교 카드 데이터 빌드 (점진적 과부하 비교)

type CompBar  = { label: string; width: string; value: string; color: string; textColor: string };
type CompRow  = { i: number; prev: string; now: string; delta: string; color: string };
type CompCard = {
  id: string; machineId: string; isFW: boolean;
  name: string; brand: string;
  headline: string; tone: string;
  bars: CompBar[]; rows: CompRow[]; note: string;
};

export function buildComparisonCard({ ex, logs, pastEntries, pastSets, sessions, realPRs, freeWeights }: {
  ex: ExerciseInfo;
  logs: Record<string, SetEntry[]>;
  pastEntries: WorkoutEntry[];
  pastSets: WorkoutSet[];
  sessions: WorkoutLog[];
  realPRs: Record<string, { weight: number; reps: number }>;
  freeWeights: FreeWeightExercise[];
}): CompCard {
  const mid   = machineIdFromKey(ex.id);
  const isFW  = isFreeWeightId(mid, freeWeights);
  const nowSets: [number, number][] = (logs[ex.id] ?? []).map(st => [st.weight, st.reps]);

  const sessionDateById: Record<string, string> = {};
  for (const sess of sessions) sessionDateById[sess.id] = sess.date;

  const pastForMachine = pastEntries
    .filter(e => e.machineId === mid)
    .map(e => ({ entry: e, date: sessionDateById[e.sessionId] ?? '' }))
    .filter(x => !!x.date)
    .sort((a, b) => b.date.localeCompare(a.date));

  const prevInfo     = pastForMachine[0] ?? null;
  const prevPrevInfo = pastForMachine[1] ?? null;

  const setsFor = (entryId: string): [number, number][] =>
    pastSets.filter(st => st.entryId === entryId).sort((a, b) => a.setNumber - b.setNumber).map(st => [st.weight, st.reps]);

  const prevSets     = prevInfo ? setsFor(prevInfo.entry.id) : [];
  const prevPrevSets = prevPrevInfo ? setsFor(prevPrevInfo.entry.id) : null;
  const isFirst = prevSets.length === 0;

  const vol  = (arr: [number, number][]) => arr.reduce((a, [w, r]) => a + w * r, 0);
  const reps = (arr: [number, number][]) => arr.reduce((a, [, r]) => a + r, 0);
  const num  = (n: number) => Math.round(n).toLocaleString('en-US');

  const vNow  = vol(nowSets);
  const vPrev = vol(prevSets);
  const pct   = (!isFirst && vPrev > 0) ? Math.round(((vNow - vPrev) / vPrev) * 100) : 0;

  const maxNow = nowSets.length ? Math.max(...nowSets.map(x => x[0])) : 0;
  const histPR = realPRs[mid];
  const isPR   = !isFirst && maxNow > 0 && histPR !== undefined && maxNow > histPR.weight;

  const startDelta = isFirst ? 0 : (nowSets[0]?.[0] ?? 0) - (prevSets[0]?.[0] ?? 0);
  const repDelta   = isFirst ? 0 : reps(nowSets) - reps(prevSets);

  // 정체: 직전이 2회 전보다 나아지지 못했고, 이번도 직전보다 나아지지 못했을 때 (연속 무변화/감소)
  const prevImprovedOverPrevPrev = prevPrevSets
    ? (vol(prevSets) > vol(prevPrevSets) || (prevSets[0]?.[0] ?? 0) > (prevPrevSets[0]?.[0] ?? 0))
    : null;
  const isStagnant = !isFirst && pct <= 0 && startDelta <= 0 && repDelta <= 0 && prevImprovedOverPrevPrev === false;

  let headline: string, tone: string;
  if (isFirst) { headline = '첫 기록이에요!'; tone = C.tagMachine.fg; }
  else if (isPR) { headline = 'PR을 달성했어요!'; tone = C.accent; }
  else if (pct > 0) { headline = `총 볼륨이 ${pct}% 늘었어요!`; tone = C.accent; }
  else if (startDelta > 0) { headline = `시작 무게가 ${startDelta}kg 늘었어요!`; tone = C.accent; }
  else if (startDelta === 0 && repDelta > 0) { headline = '같은 무게로 반복 횟수가 늘었어요!'; tone = C.accent; }
  else if (isStagnant) { headline = '정체 중이에요'; tone = C.textSub; }
  else if (pct < 0) { headline = `총 볼륨이 ${Math.abs(pct)}% 줄었어요`; tone = C.textSub; }
  else if (startDelta < 0) { headline = `시작 무게가 ${Math.abs(startDelta)}kg 줄었어요`; tone = C.textSub; }
  else { headline = '지난번과 같았어요'; tone = C.textSub; }

  let gapLabel: string;
  if (!prevInfo) {
    gapLabel = '첫 사용';
  } else {
    const then = new Date(prevInfo.date); then.setHours(0, 0, 0, 0);
    const today = new Date();            today.setHours(0, 0, 0, 0);
    const diffDays = Math.round((today.getTime() - then.getTime()) / 86400000);
    gapLabel = diffDays <= 0 ? '오늘' : `${diffDays}일 만`;
  }

  let bars: CompBar[];
  if (prevPrevSets && prevPrevSets.length) {
    const vals = [
      { label: '2회 전', v: vol(prevPrevSets) },
      { label: '직전',   v: vPrev },
      { label: '이번',   v: vNow },
    ];
    const max = Math.max(...vals.map(x => x.v), 1);
    bars = vals.map((x, i) => ({
      label: x.label,
      width: `${Math.round((x.v / max) * 100)}%`,
      value: `${num(x.v)}kg`,
      color: i === 2 ? tone : C.text + '20',
      textColor: i === 2 ? C.text : C.textSub,
    }));
  } else if (!isFirst) {
    const max = Math.max(vPrev, vNow, 1);
    bars = [
      { label: '직전', width: `${Math.round((vPrev / max) * 100)}%`, value: `${num(vPrev)}kg`, color: C.text + '20', textColor: C.textSub },
      { label: '이번', width: `${Math.round((vNow  / max) * 100)}%`, value: `${num(vNow)}kg`,  color: tone,          textColor: C.text },
    ];
  } else {
    bars = [{ label: '이번', width: '100%', value: `${num(vNow)}kg`, color: C.tagMachine.fg, textColor: C.text }];
  }

  const n = Math.max(nowSets.length, prevSets.length);
  const rows: CompRow[] = [];
  for (let i = 0; i < n; i++) {
    const a = prevSets[i], b = nowSets[i];
    let delta = '', color: string = C.textDim;
    if (a && b) {
      const dw = b[0] - a[0], dr = b[1] - a[1];
      if (dw !== 0) { delta = `${dw > 0 ? '+' : ''}${dw}kg`; color = dw > 0 ? C.accent : C.textSub; }
      else if (dr !== 0) { delta = `${dr > 0 ? '+' : ''}${dr}회`; color = dr > 0 ? C.accent : C.textSub; }
      else { delta = '='; }
    } else if (b && !a) { delta = 'NEW'; color = C.accent; }
    rows.push({
      i: i + 1,
      prev: a ? `${a[0]}kg × ${a[1]}` : '—',
      now:  b ? `${b[0]}kg × ${b[1]}` : '—',
      delta, color,
    });
  }

  let note: string;
  if (isFirst) note = '비교할 지난 기록이 없어요. 다음 방문 때부터 이 머신의 변화가 쌓입니다.';
  else if (nowSets.length !== prevSets.length) note = `지난번은 ${prevSets.length}세트, 이번은 ${nowSets.length}세트예요. 세트 순서대로 비교하고 남는 세트는 총 볼륨에만 반영했어요.`;
  else if (isStagnant) note = '최근 2회 동안 무게와 볼륨이 그대로예요. 다음엔 2.5kg 올리거나 반복을 1~2회 늘려보세요.';
  else note = `직전 세션(${gapLabel}) 기록과 세트 단위로 비교했어요.`;

  return {
    id: ex.id, machineId: mid, isFW,
    name: ex.name, brand: isFW ? '프리웨이트' : ex.brand,
    headline, tone, bars, rows, note,
  };
}

function ComparisonCard({ card, open, onToggle }: { card: CompCard; open: boolean; onToggle: () => void }) {
  return (
    <View style={s.compCard}>
      <TouchableOpacity onPress={onToggle} activeOpacity={0.85} style={s.compCardHead}>
        <View style={s.compThumb}>
          <Image
            source={{ uri: getMachineImageUrl(card.machineId, { width: 128, height: 128 }) }}
            style={{ width: '100%', height: '100%' }}
            resizeMode="cover"
          />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={s.compName} numberOfLines={1}>{card.name}</Text>
          <Text style={s.compBrand} numberOfLines={1}>{card.brand}</Text>
          <Text style={[s.compHeadline, { color: card.tone }]} numberOfLines={2}>{card.headline}</Text>
        </View>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={16} color={C.textDim} />
      </TouchableOpacity>

      {open && (
        <View style={s.compBody}>
          <View style={{ gap: 7, marginBottom: 14 }}>
            {card.bars.map((bar, i) => (
              <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}>
                <Text style={s.barLabel}>{bar.label}</Text>
                <View style={s.barTrack}>
                  <View style={[s.barFill, { width: bar.width as any, backgroundColor: bar.color }]} />
                </View>
                <Text style={[s.barValue, { color: bar.textColor }]}>{bar.value}</Text>
              </View>
            ))}
          </View>

          <View style={s.rowsHeader}>
            <Text style={[s.rowsHeaderTxt, s.colIdx]}>세트</Text>
            <Text style={[s.rowsHeaderTxt, s.colFlex]}>직전</Text>
            <Text style={[s.rowsHeaderTxt, s.colFlex]}>이번</Text>
            <Text style={[s.rowsHeaderTxt, s.colDelta]}>변화</Text>
          </View>
          {card.rows.map(r => (
            <View key={r.i} style={s.compRow}>
              <Text style={[s.compRowIdx, s.colIdx]}>{r.i}</Text>
              <Text style={[s.compRowPrev, s.colFlex]}>{r.prev}</Text>
              <Text style={[s.compRowNow, s.colFlex]}>{r.now}</Text>
              <Text style={[s.compRowDelta, s.colDelta, { color: r.color }]}>{r.delta}</Text>
            </View>
          ))}

          <Text style={s.compNote}>{card.note}</Text>
        </View>
      )}
    </View>
  );
}

export function WorkoutDoneStep({ gym, exercises, logs, detectedPRs, selectedMuscles, freeWeights, sessions, pastEntries, pastSets, realPRs, photoUri, onClose }: {
  gym: { name: string };
  exercises: ExerciseInfo[];
  logs: Record<string, SetEntry[]>;
  detectedPRs: { name: string; weight: number; reps: number }[];
  selectedMuscles: Set<string>;
  freeWeights: FreeWeightExercise[];
  sessions: WorkoutLog[];
  pastEntries: WorkoutEntry[];
  pastSets: WorkoutSet[];
  realPRs: Record<string, { weight: number; reps: number }>;
  photoUri?: string | null;
  onClose: () => void;
}) {
  const [tplName,  setTplName]  = useState('');
  const [tplSaved, setTplSaved] = useState(false);
  const [openIds,  setOpenIds]  = useState<Set<string>>(new Set());

  const totalSets = exercises.reduce((a, e) => a + (logs[e.id]?.length ?? 0), 0);
  const totalVol  = exercises.reduce((a, e) =>
    a + (logs[e.id] ?? []).reduce((sa, st) => sa + st.weight * st.reps, 0), 0,
  );

  async function handleSaveTemplate() {
    const banned = await containsBannedWord(tplName);
    if (banned) {
      Alert.alert('사용 불가', '사용할 수 없는 단어가 포함되어 있어요.');
      return;
    }
    const name = tplName.trim() || `Workout ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
    saveTemplate({
      name,
      exerciseIds: exercises.map(e => e.id),
      muscles:     Array.from(selectedMuscles).map(toCanonMuscle),
    });
    setTplSaved(true);
  }

  // 직전 동일 타겟부위 세션 대비 총 볼륨 비교
  const canonTargets = useMemo(
    () => new Set(Array.from(selectedMuscles).map(toCanonMuscle)),
    [selectedMuscles],
  );
  const muscleBySession = useMemo(() => {
    const map: Record<string, Set<string>> = {};
    for (const e of pastEntries) {
      (map[e.sessionId] ??= new Set()).add(toCanonMuscle(e.targetMuscle));
    }
    return map;
  }, [pastEntries]);
  const prevMuscleSession = useMemo(() => {
    if (canonTargets.size === 0) return null;
    const candidates = sessions
      .filter(sess => {
        const ms = muscleBySession[sess.id];
        if (!ms) return false;
        for (const m of ms) if (canonTargets.has(m)) return true;
        return false;
      })
      .sort((a, b) => b.date.localeCompare(a.date));
    return candidates[0] ?? null;
  }, [sessions, muscleBySession, canonTargets]);
  const prevMuscleSessionStats = useMemo(() => {
    if (!prevMuscleSession) return null;
    const entries  = pastEntries.filter(e => e.sessionId === prevMuscleSession.id);
    const entryIds = new Set(entries.map(e => e.id));
    const sets     = pastSets.filter(st => entryIds.has(st.entryId));
    const vol      = sets.reduce((a, st) => a + st.weight * st.reps, 0);
    return { count: entries.length, sets: sets.length, vol };
  }, [prevMuscleSession, pastEntries, pastSets]);

  const targetLabel = selectedMuscles.size > 0
    ? Array.from(selectedMuscles).join(' · ')
    : Array.from(new Set(exercises.map(e => e.targetMuscle))).join(' · ');

  // 직전 동일 타겟부위 세션 대비 [머신·프리웨이트 개수 / 총 세트 / 총 볼륨] 비교
  type CompareDelta = { dir: 'up' | 'down' | 'flat'; text: string };
  const compareData = useMemo((): { count: CompareDelta; sets: CompareDelta; vol: CompareDelta } | null => {
    if (!prevMuscleSessionStats) return null;
    const dCount = exercises.length - prevMuscleSessionStats.count;
    const dSets  = totalSets - prevMuscleSessionStats.sets;
    const dVol   = Math.round(totalVol - prevMuscleSessionStats.vol);
    const mk = (n: number, unit: string): CompareDelta => ({
      dir:  n > 0 ? 'up' : n < 0 ? 'down' : 'flat',
      text: n === 0 ? '지난번과 같아요' : `${Math.abs(n).toLocaleString('en-US')}${unit} ${n > 0 ? '늘었어요' : '줄었어요'}`,
    });
    return {
      count: mk(dCount, '개'),
      sets:  mk(dSets, '세트'),
      vol:   mk(dVol, 'kg'),
    };
  }, [prevMuscleSessionStats, exercises.length, totalSets, totalVol]);

  const dateLabel = formatWorkoutDate(new Date());

  const cards = useMemo(
    () => exercises.map(ex => buildComparisonCard({ ex, logs, pastEntries, pastSets, sessions, realPRs, freeWeights })),
    [exercises, logs, pastEntries, pastSets, sessions, realPRs, freeWeights],
  );

  function toggleCard(id: string) {
    setOpenIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  return (
    <SafeAreaView style={s.safe} edges={["top", "bottom"]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.listPad}>

        {/* 헤더: 인증샷 + 헬스장/타겟부위 뱃지 + 일시 */}
        <View style={s.sumHeader}>
          {photoUri ? (
            <Image source={{ uri: photoUri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
          ) : null}
          <LinearGradient
            colors={['rgba(10,10,12,0.75)', 'rgba(10,10,12,0.05)', 'rgba(10,10,12,0.85)']}
            locations={[0, 0.4, 1]}
            style={StyleSheet.absoluteFill}
          />
          <View style={s.sumHeaderTopRow}>
            <Text style={s.sumHeaderTag}>운동일지 저장 완료</Text>
          </View>
          <View style={s.sumHeaderBottom}>
            <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
              <View style={s.sumBadge}><Text style={s.sumBadgeTxt}>{gym.name}</Text></View>
              <View style={s.sumBadgeAccent}><Text style={s.sumBadgeAccentTxt}>{targetLabel}</Text></View>
            </View>
            <Text style={s.sumHeaderDateTime}>{dateLabel}</Text>
          </View>
        </View>

        {/* 통계: 머신·프리웨이트 / 총 세트 / 이번 총 볼륨 — 한 줄 */}
        <View style={s.sumStatRow}>
          <View style={s.sumStatCell}>
            <Text style={s.sumStatVal}>{exercises.length}</Text>
            <Text style={s.sumStatLab}>머신·프리웨이트</Text>
          </View>
          <View style={s.sumStatDiv} />
          <View style={s.sumStatCell}>
            <Text style={s.sumStatVal}>{totalSets}</Text>
            <Text style={s.sumStatLab}>총 세트</Text>
          </View>
          <View style={s.sumStatDiv} />
          <View style={s.sumStatCell}>
            <Text style={s.sumStatVal}>{totalVol > 0 ? Math.round(totalVol).toLocaleString('en-US') : '0'}</Text>
            <Text style={s.sumStatLab}>이번 총 볼륨(kg)</Text>
          </View>
        </View>

        <View style={{ marginBottom: 20 }}>
          <Text style={s.sumCompareLabel}>직전 {targetLabel} 세션 대비</Text>
          {compareData ? (
            <View style={{ gap: 6 }}>
              {([
                { label: '머신·프리웨이트', d: compareData.count },
                { label: '총 세트',        d: compareData.sets },
                { label: '총 볼륨',        d: compareData.vol },
              ] as { label: string; d: CompareDelta }[]).map(row => {
                const color = row.d.dir === 'up' ? C.accent : row.d.dir === 'down' ? C.textSub : C.textDim;
                return (
                  <View key={row.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Ionicons
                      name={row.d.dir === 'up' ? 'caret-up' : row.d.dir === 'down' ? 'caret-down' : 'remove'}
                      size={13}
                      color={color}
                    />
                    <Text style={s.sumCompareRowLabel}>{row.label}</Text>
                    <Text style={[s.sumCompareRowVal, { color }]}>{row.d.text}</Text>
                  </View>
                );
              })}
            </View>
          ) : (
            <Text style={s.sumCompareEmpty}>비교할 이전 기록이 없어요.</Text>
          )}
        </View>

        {/* PR 배너 */}
        {detectedPRs.length > 0 && (
          <View style={s.sumPrBanner}>
            <Text style={s.sumPrCount}>{detectedPRs.length}</Text>
            <View style={{ flex: 1 }}>
              <Text style={s.sumPrTitle}>오늘 PR {detectedPRs.length}개 달성!</Text>
              <Text style={s.sumPrSub} numberOfLines={1}>{detectedPRs.map(pr => pr.name).join(' · ')}에서 전체 기간 최고 기록</Text>
            </View>
          </View>
        )}

        {/* 머신별 비교 */}
        <View style={{ marginTop: 8, marginBottom: 12 }}>
          <Text style={s.sectionTitle}>머신별 비교</Text>
          <Text style={s.sumSectionSub}>다른 헬스장의 같은 머신도 함께 비교돼요</Text>
        </View>
        <View style={{ gap: 12 }}>
          {cards.map(card => (
            <ComparisonCard key={card.id} card={card} open={openIds.has(card.id)} onToggle={() => toggleCard(card.id)} />
          ))}
        </View>
        <Text style={s.sumFootnote}>세트 수가 달라진 머신은 세트 순서대로 나란히 두고, 없는 세트는 비워 뒀어요. 비교는 늘 총 볼륨 기준으로도 함께 계산돼요.</Text>

        {/* Save as Template */}
        <View style={[s.tplCard, { marginTop: 28 }]}>
          <Text style={s.tplCardTitle}>템플릿으로 저장</Text>
          {tplSaved ? (
            <View style={s.tplSavedRow}>
              <Ionicons name="checkmark-circle" size={16} color={C.accent} />
              <Text style={s.tplSavedTxt}>템플릿 저장됨!</Text>
            </View>
          ) : (
            <View style={s.tplInputRow}>
              <TextInput
                style={s.tplInput}
                value={tplName}
                onChangeText={setTplName}
                placeholder="e.g. Push Day, Chest & Tris…"
                placeholderTextColor={C.textDim}
                maxLength={40}
              />
              <TouchableOpacity style={s.tplSaveBtn} activeOpacity={0.8} onPress={handleSaveTemplate}>
                <Text style={s.tplSaveBtnTxt}>저장</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
      <View style={s.ctaBar}>
        <TouchableOpacity style={s.ctaBtn} activeOpacity={0.85} onPress={onClose}>
          <Ionicons name="book-outline" size={18} color={C.bg} />
          <Text style={s.ctaTxt}>운동일지로 돌아가기</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

// --- Root modal

interface PostWorkoutLogModalProps {
  visible: boolean;
  onClose: (saved: boolean) => void;
}

export default function PostWorkoutLogModal({ visible, onClose }: PostWorkoutLogModalProps) {
  const { user } = useAuth();

  const [fontsLoaded] = useFonts({
    'KCC-Ganpan':               require('../../../assets/fonts/kcc_ganpan.ttf'),
    'Mat Saleh':                require('../../../assets/fonts/mat_saleh.ttf'),
    'Matcha Cih':               require('../../../assets/fonts/matcha_cih.ttf'),
    'Oklahoma':                 require('../../../assets/fonts/oklahoma.ttf'),
    'Quicksilver-Italic':       require('../../../assets/fonts/quicksilver_italic.ttf'),
    'SportypoReguler':          require('../../../assets/fonts/sportypo_reguler_demo.ttf'),
    'Stadium1956-Regular':      require('../../../assets/fonts/stadium1956_regular.otf'),
    'Vdevaca-Bold':             require('../../../assets/fonts/v_de_vacia_defharo.ttf'),
    'BlackwoodCastle':          require('../../../assets/fonts/blacc.ttf'),
    'BlackwoodCastleShadow':    require('../../../assets/fonts/blaccs.ttf'),
    'CollegeBoy':               require('../../../assets/fonts/college_boy.otf'),
    'Flamer':                   require('../../../assets/fonts/flamer.ttf'),
    'HeavyHeapRg-Regular':      require('../../../assets/fonts/heavy_heap_rg.otf'),
    'Honfleur-Heavy':           require('../../../assets/fonts/honfleur_heavy.otf'),
    'BasicFont':                require('../../../assets/fonts/basif.ttf'),
    'Abrakadaboom':             require('../../../assets/fonts/abrakadaboom.ttf'),
    'KERISKEDU_Line':           require('../../../assets/fonts/keriskedu_line.ttf'),
    'HeirofLightRegular':       require('../../../assets/fonts/heiroflightregular.ttf'),
    'BMkkubulimTTF-Regular':    require('../../../assets/fonts/bmkkubulim.ttf'),
    'biergartenlt':             require('../../../assets/fonts/biergartenlt.ttf'),
  });

  const onboarding = useOnboarding();

  const [step,              setStep]              = useState<Step>('gym-select');
  const [selectedMuscles,   setSelectedMuscles]   = useState<Set<string>>(new Set());
  const [isRestDay,         setIsRestDay]         = useState(false);
  const [gym,               setGym]               = useState<GymWithMachines | null>(null);
  const [currentExerciseId, setCurrentExerciseId] = useState<string | null>(null);
  const [loggedIds,         setLoggedIds]         = useState<Set<string>>(new Set());
  const [logs,              setLogs]              = useState<Record<string, SetEntry[]>>({});
  const [notes,             setNotes]             = useState<Record<string, string>>({});
  const [photoTaken,        setPhotoTaken]        = useState(false);
  const [showCamera,        setShowCamera]        = useState(false);
  const [photoUri,          setPhotoUri]          = useState<string | null>(null);
  const [compositeUri,      setCompositeUri]      = useState<string | null>(null);
  const [routineCardUri,    setRoutineCardUri]    = useState<string | null>(null);
  const [detectedPRs,       setDetectedPRs]       = useState<{ name: string; weight: number; reps: number }[]>([]);
  const [prCelebration,     setPrCelebration]     = useState<{ name: string; weight: number; reps: number } | null>(null);
  // Overlay
  const [selectedColor,      setSelectedColor]      = useState('#ffffff');
  const [isSaving,           setIsSaving]           = useState(false);
  const [savingProgress,     setSavingProgress]     = useState(0);
  const savingAnim = useRef(new Animated.Value(0)).current;
  // Template loading
  const [showTemplates,       setShowTemplates]       = useState(false);
  const [templates,           setTemplates]           = useState<WorkoutTemplate[]>([]);
  const [preloadedIdsOrdered, setPreloadedIdsOrdered] = useState<string[]>([]);
  const preloadedIds = useMemo(() => new Set(preloadedIdsOrdered), [preloadedIdsOrdered]);
  const [routineMachineIds,   setRoutineMachineIds]   = useState<string[]>([]);
  const [routineReadOnly,     setRoutineReadOnly]     = useState(false);
  const [routineExtraInfo,    setRoutineExtraInfo]    = useState<MachineExtraInfo | undefined>(undefined);
  const [sessions,            setSessions]            = React.useState<WorkoutLog[]>([]);
  const [pastEntries, setPastEntries] = useState<WorkoutEntry[]>([]);
  const [pastSets,    setPastSets]    = useState<WorkoutSet[]>([]);
  const [realPRs,     setRealPRs]     = useState<Record<string, { weight: number; reps: number }>>({});
  const [prefillInfo, setPrefillInfo] = useState<Record<string, { date: string } | null>>({});
  const [dbFreeWeights,       setDbFreeWeights]       = useState<typeof FREE_WEIGHTS>([]);

  React.useEffect(() => {
    if (!visible) return;
    fetchFreeWeights().then(data => {
      setDbFreeWeights(data.map(m => ({
        id:           m.id,
        name:         m.name,
        brand:        m.brand,
        targetMuscle: m.targetMuscle,
      })));
    }).catch(() => {
      setDbFreeWeights(FREE_WEIGHTS);
    });
  }, [visible]);

  React.useEffect(() => {
    if (!visible || !user) return;
    fetchWorkoutLogs(user.id).then(async data => {
      setSessions(data);
      try {
        const sessionIds = data.map(s => s.id);
        const entries = await fetchWorkoutEntriesForSessions(sessionIds);
        const setsArr = await fetchWorkoutSetsForEntries(entries.map(e => e.id));
        setPastEntries(entries);
        setPastSets(setsArr);
        setRealPRs(getMachinePRsFromSets(entries, setsArr));
      } catch {
        setPastEntries([]);
        setPastSets([]);
        setRealPRs({});
      }
    }).catch(() => {
      setSessions(MOCK_SESSIONS);
    });
  }, [visible, user?.id]);

  React.useEffect(() => {
    if (visible) {
      setStep('gym-select');
      setSelectedMuscles(new Set());
      setGym(null);
      setCurrentExerciseId(null);
      setLoggedIds(new Set());
      setLogs({});
      setNotes({});
      setPhotoTaken(false);
      setPhotoUri(null);
      setShowCamera(false);
      setCompositeUri(null);
      setRoutineCardUri(null);
      setDetectedPRs([]);
      setPrCelebration(null);
      setSelectedColor('#ffffff');
      setShowTemplates(false);
      setTemplates(getTemplates());
      setPreloadedIdsOrdered([]);
      setRoutineMachineIds([]);
      setRoutineReadOnly(false);
    }
  }, [visible]);

  React.useEffect(() => {
    if (!visible || !user?.id) return;
    fetchSplitConfig(user.id).then(config => {
      if (!config) return;
      if (isRestToday(config.splitType, config.workoutSplit, config.splitCurrentIndex)) {
        setIsRestDay(true);
        return;
      }
      setIsRestDay(false);
      const targets = getTodayTargets(config.splitType, config.workoutSplit, config.splitCurrentIndex);
      if (targets.length > 0) {
        const en = targets.map(toEnMuscle).filter(Boolean);
        if (en.length > 0) setSelectedMuscles(new Set(en));
      }
    }).catch(() => {});
  }, [visible, user?.id]);

  function toggleMuscle(m: string) {
    setSelectedMuscles(prev => {
      const next = new Set(prev);
      next.has(m) ? next.delete(m) : next.add(m);
      return next;
    });
  }

  function handleLoadTemplate(tpl: WorkoutTemplate) {
    // Pre-load muscles from the template
    setSelectedMuscles(new Set(tpl.muscles));
    // Mark template exercises as pre-loaded (visible but not yet logged)
    setPreloadedIdsOrdered(tpl.exerciseIds);
    setShowTemplates(false);
  }

  function handleDeleteTemplate(id: string) {
    deleteTemplate(id);
    setTemplates(getTemplates());
  }

  function handleSelectGym(g: GymWithMachines) {
    setGym(g);
    setStep('muscle-select');
  }

  // 특정 머신의 '가장 최근 날의 첫 세트' (없으면 null)
  function findLastFirstSet(machineId: string): { weight: number; reps: number; date: string } | null {
    const machineEntries = pastEntries.filter(e => e.machineId === machineId);
    if (machineEntries.length === 0) return null;
    const sessionDateById: Record<string, string> = {};
    for (const s of sessions) sessionDateById[s.id] = s.date;
    let bestEntry = machineEntries[0];
    let bestDate  = sessionDateById[bestEntry.sessionId] ?? '';
    for (const e of machineEntries) {
      const d = sessionDateById[e.sessionId] ?? '';
      if (d > bestDate) { bestDate = d; bestEntry = e; }
    }
    if (!bestDate) return null;
    const entrySets = pastSets
      .filter(st => st.entryId === bestEntry.id)
      .sort((a, b) => a.setNumber - b.setNumber);
    if (entrySets.length === 0) return null;
    const first = entrySets[0];
    return { weight: first.weight, reps: first.reps, date: bestDate };
  }

  // 특정 머신의 현재 슬롯 키들 (loggedIds 포함). 정렬된 배열 반환.
  function slotKeysForMachine(machineId: string): string[] {
    const keys: string[] = [];
    for (const k of loggedIds) {
      if (machineIdFromKey(k) === machineId) keys.push(k);
    }
    return keys.sort();
  }

  // 새 슬롯을 만들어 세트 입력으로 진입 (프리필 적용 여부 isFirstSlot로 제어)
  function openNewSlot(machineId: string, slotKey: string, isFirstSlot: boolean) {
    const last = isFirstSlot ? findLastFirstSet(machineId) : null;
    setCurrentExerciseId(slotKey);
    setLogs(prev => ({
      ...prev,
      [slotKey]: prev[slotKey]?.length
        ? prev[slotKey]
        : (last ? [{ weight: last.weight, reps: last.reps }] : [{ weight: 60, reps: 10 }]),
    }));
    setPrefillInfo(prev => ({
      ...prev,
      [slotKey]: prev[slotKey] !== undefined ? prev[slotKey] : (last ? { date: last.date } : null),
    }));
    setStep('log-sets');
  }

  function handleSelectExercise(id: string) {
    // id = 순수 machineId
    const existing = slotKeysForMachine(id);
    if (existing.length === 0) {
      openNewSlot(id, `${id}#0`, true);
      return;
    }
    Alert.alert(
      '이미 기록한 머신이에요',
      '기존 기록을 수정하거나 새로 추가할 수 있어요.',
      [
        {
          text: '기존 수정',
          onPress: () => {
            const lastKey = existing[existing.length - 1];
            setCurrentExerciseId(lastKey);
            setStep('log-sets');
          },
        },
        {
          text: '새로 추가',
          onPress: () => {
            const maxSlot = existing.reduce((mx, k) => {
              const n = parseInt(k.slice(k.lastIndexOf('#') + 1), 10);
              return isNaN(n) ? mx : Math.max(mx, n);
            }, -1);
            openNewSlot(id, `${id}#${maxSlot + 1}`, false);
          },
        },
        { text: '취소', style: 'cancel' },
      ],
    );
  }

  async function handleSaveExercise() {
    const noteText = currentExerciseId ? notes[currentExerciseId] : undefined;
    if (noteText) {
      const banned = await containsBannedWord(noteText);
      if (banned) {
        Alert.alert('사용 불가', '사용할 수 없는 단어가 포함되어 있어요.');
        return;
      }
    }
    if (currentExerciseId) {
      setLoggedIds(prev => new Set([...prev, currentExerciseId]));

      const exSets  = logs[currentExerciseId] ?? [];

      // PR detection (PR은 머신 단위 → 순수 machineId 사용)
      const midForPR = machineIdFromKey(currentExerciseId);
      const curMax  = exSets.length ? Math.max(...exSets.map(s => s.weight)) : 0;
      const histPR  = realPRs[midForPR];
      let   isPR    = false;
      if (curMax > 0 && (histPR === undefined || curMax > histPR.weight)) {
        const bestSet = exSets.reduce<SetEntry | null>((b, s) => (!b || s.weight > b.weight ? s : b), null);
        const exInfo  = currentExercise;
        if (exInfo && bestSet) {
          isPR = true;
          const pr = { name: exInfo.name, weight: curMax, reps: bestSet.reps };
          setPrCelebration(pr);
          setDetectedPRs(prev => [...prev, pr]);
          recordPR({
            exerciseId:   midForPR,
            exerciseName: exInfo.name,
            weight:       curMax,
            reps:         bestSet.reps,
            date:         new Date().toISOString(),
          });
        }
      }

    }
    setCurrentExerciseId(null);
    setStep('exercise-select');
  }

  function handleChangeSet(idx: number, field: keyof SetEntry, val: number) {
    if (!currentExerciseId) return;
    const id = currentExerciseId;
    setLogs(prev => ({
      ...prev,
      [id]: prev[id].map((s, i) => i === idx ? { ...s, [field]: val } : s),
    }));
  }

  function handleAddSet() {
    if (!currentExerciseId) return;
    const id = currentExerciseId;
    setLogs(prev => ({
      ...prev,
      [id]: [...prev[id], { weight: 0, reps: 10 }],
    }));
  }

  function handleCopyPrev() {
    if (!currentExerciseId) return;
    const id = currentExerciseId;
    setLogs(prev => {
      const sets = prev[id];
      if (!sets.length) return prev;
      return { ...prev, [id]: [...sets, { ...sets[sets.length - 1] }] };
    });
  }

  function handleNoteChange(note: string) {
    if (!currentExerciseId) return;
    const id = currentExerciseId;
    setNotes(prev => ({ ...prev, [id]: note }));
  }

  function handleRemoveSet(idx: number) {
    if (!currentExerciseId) return;
    const id = currentExerciseId;
    setLogs(prev => ({
      ...prev,
      [id]: prev[id].filter((_, i) => i !== idx),
    }));
  }

  const selectedExercises: ExerciseInfo[] = useMemo(() => {
    if (!gym) return [];
    const result: ExerciseInfo[] = [];
    for (const key of loggedIds) {
      const mid = machineIdFromKey(key);
      if (isFreeWeightId(mid, dbFreeWeights.length > 0 ? dbFreeWeights : FREE_WEIGHTS)) {
        const fw = (dbFreeWeights.length > 0 ? dbFreeWeights : FREE_WEIGHTS).find(f => f.id === mid);
        if (fw) result.push({ id: key, name: fw.name, brand: fw.brand, targetMuscle: fw.targetMuscle });
      } else {
        const m = gym.machines.find(m => m.id === mid);
        if (m) result.push({ id: key, name: m.name, brand: m.brand, targetMuscle: m.targetMuscle });
      }
    }
    return result;
  }, [loggedIds, gym, dbFreeWeights]);

  // currentExercise object for SetLoggingStep
  const currentExercise: ExerciseInfo | null = useMemo(() => {
    if (!currentExerciseId || !gym) return null;
    const mid = machineIdFromKey(currentExerciseId);
    if (isFreeWeightId(mid, dbFreeWeights.length > 0 ? dbFreeWeights : FREE_WEIGHTS)) {
      const fw = (dbFreeWeights.length > 0 ? dbFreeWeights : FREE_WEIGHTS).find(f => f.id === mid);
      if (fw) return { id: currentExerciseId, name: fw.name, brand: fw.brand, targetMuscle: fw.targetMuscle };
    } else {
      const m = gym.machines.find(m => m.id === mid);
      if (m) return { id: currentExerciseId, name: m.name, brand: m.brand, targetMuscle: m.targetMuscle };
    }
    return null;
  }, [currentExerciseId, gym, dbFreeWeights]);

  const ORDER: Step[] = ['gym-select', 'muscle-select', 'routine-reference', 'today-list', 'exercise-select', 'photo', 'done'];

  function goBack() {
    if (step === 'log-sets') {
      setCurrentExerciseId(null);
      setStep('exercise-select');
    } else {
      const i = ORDER.indexOf(step);
      if (i <= 0) onClose(false);
      else setStep(ORDER[i - 1] as Step);
    }
  }

  async function handleSaveWorkout(passedCompositeUri?: string, passedRoutineCardUri?: string) {
    if (!gym) return;
    setIsSaving(true);
    savingAnim.setValue(0);

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    Animated.timing(savingAnim, {
      toValue:         0.8,
      duration:        2000,
      useNativeDriver: false,
    }).start();

    setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light), 500);
    setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light), 1000);
    setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light), 1500);

    const effectiveCompositeUri = passedCompositeUri ?? compositeUri;
    const sessionId = `local-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const supabaseConfigured = !!(process.env.EXPO_PUBLIC_SUPABASE_URL);

    // 사진 업로드 (Supabase Storage)
    let finalPhotoUrl: string | undefined;
    let finalThumbnailUrl: string | undefined;
    if (effectiveCompositeUri && user && supabaseConfigured) {
      const uploaded = await uploadWorkoutPhoto(effectiveCompositeUri, user.id, sessionId, true);
      finalPhotoUrl     = uploaded.url;
      finalThumbnailUrl = uploaded.thumbnailUrl;
    } else if (photoUri && user && supabaseConfigured) {
      const uploaded = await uploadWorkoutPhoto(photoUri, user.id, sessionId, false);
      finalPhotoUrl     = uploaded.url;
      finalThumbnailUrl = uploaded.thumbnailUrl;
    }

    const sessionMuscles = Array.from(selectedMuscles).map(toCanonMuscle);

    const workoutLog: WorkoutLog = {
      id:               sessionId,
      gymId:            gym.id,
      gymName:          gym.name,
      gymLocation:      gym.location,
      date:             new Date().toISOString(),
      overlayTextColor: selectedColor,
      targetMuscles:    sessionMuscles,
      machines:         selectedExercises.map(ex => {
        const exSets = logs[ex.id] ?? [];
        const maxSet = exSets.reduce<{ weight: number; reps: number } | null>(
          (best, s) => (!best || s.weight > best.weight ? s : best), null
        );
        const note = notes[ex.id]?.trim();
        return {
          machineId:    machineIdFromKey(ex.id),
          machineName:  ex.name,
          machineBrand: ex.brand,
          targetMuscle: ex.targetMuscle,
          weight:       maxSet?.weight ?? 0,
          reps:         maxSet?.reps ?? 0,
          sets:         exSets.length,
          ...(note ? { note } : {}),
        };
      }),
      hasPhoto: photoTaken,
      ...(photoUri ? { photoUri: finalPhotoUrl ?? photoUri } : {}),
      ...(effectiveCompositeUri ? { compositeUri: finalPhotoUrl ?? effectiveCompositeUri } : {}),
      ...(finalThumbnailUrl ? { thumbnailUri: finalThumbnailUrl } : {}),
    };
    addNewSession(user?.id ?? 'guest', workoutLog);

    // Supabase DB에 저장 (실패해도 로컬 저장은 유지)
    let dbSessionId: string | undefined;
    if (user && supabaseConfigured) {
      try {
        const savedSession = await insertWorkoutSession({
          id:               sessionId,
          userId:           user.id,
          gymId:            gym.id,
          date:             workoutLog.date,
          overlayTextColor: selectedColor,
          targetMuscles:    sessionMuscles,
        });
        dbSessionId = savedSession?.id;

        for (let i = 0; i < selectedExercises.length; i++) {
          const ex = selectedExercises[i];
          const mid = machineIdFromKey(ex.id);
          const entryId = `entry-${Date.now()}-${i}`;
          await insertWorkoutEntry({
            id:           entryId,
            sessionId,
            machineId:    mid,
            machineName:  ex.name,
            machineBrand: ex.brand,
            targetMuscle: ex.targetMuscle,
            exerciseKind: isFreeWeightId(mid, dbFreeWeights.length > 0 ? dbFreeWeights : FREE_WEIGHTS) ? 'freeweight' : 'machine',
            order:        i,
          });

          const exSets = logs[ex.id] ?? [];
          for (let j = 0; j < exSets.length; j++) {
            await insertWorkoutSet({
              id:        `set-${Date.now()}-${i}-${j}`,
              entryId,
              setNumber: j + 1,
              weight:    exSets[j].weight,
              reps:      exSets[j].reps,
            });
          }
        }
      } catch (err) {
        if (__DEV__) console.warn('[PostWorkoutLog] Supabase write failed:', err);
      }

      // 오운완 사진 DB 저장
      if (finalPhotoUrl && user) {
        try {
          await insertWorkoutPhoto({
            sessionId:    sessionId,
            userId:       user.id,
            capturedAt:   new Date().toISOString(),
            textColor:    '#ffffff',
            aspectRatio:  '9:16',
            thumbnailUri: finalThumbnailUrl,
          });

          // composite_uri 업데이트 (insertWorkoutPhoto는 기본 컬럼만 저장하므로 별도 update)
          const { supabase } = await import('../../lib/supabase');
          await supabase
            .from('workout_photos')
            .update({
              composite_uri: finalPhotoUrl,
              photo_uri:     photoUri ?? null,
              thumbnail_uri: finalThumbnailUrl ?? null,
            })
            .eq('session_id', sessionId)
            .eq('user_id', user.id);
        } catch (err) {
          if (__DEV__) console.warn('[PostWorkoutLog] insertWorkoutPhoto failed:', err);
        }
      }

      // 오운완 피드 포스트 저장
      if (effectiveCompositeUri ?? photoUri) {
        insertFeedPost({
          id:             `feed-${Date.now()}`,
          userId:         user.id,
          nickname:       user.nickname ?? user.name,
          gymId:          gym.id,
          gymName:        gym.name,
          photoUri:       finalPhotoUrl ?? photoUri ?? effectiveCompositeUri ?? '',
          compositeUri:   finalPhotoUrl ?? effectiveCompositeUri ?? undefined,
          thumbnailUri:   finalThumbnailUrl ?? undefined,
          routineCardUri: passedRoutineCardUri ?? routineCardUri ?? undefined,
          sessionId:      dbSessionId ?? sessionId,
          muscles:        Array.from(selectedMuscles).map(toCanonMuscle),
          isPublic:       true,
        }).then(() => {
          invalidateActiveFeedPostsCache();
        }).catch(err => {
          if (__DEV__) console.warn('[feed] insertFeedPost failed:', err);
        });
      }
    }

    Animated.timing(savingAnim, {
      toValue:         1,
      duration:        300,
      useNativeDriver: false,
    }).start();

    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    await new Promise(resolve => setTimeout(resolve, 300));
    setIsSaving(false);
    setStep('done');
  }

  /** Called by WorkoutPhotoStep's "운동 저장" button */
  async function requestSaveWorkout(socialCapturedUri?: string, capturedRoutineUri?: string) {
    if (socialCapturedUri) {
      setCompositeUri(socialCapturedUri);
      await handleSaveWorkout(socialCapturedUri, capturedRoutineUri);
      return;
    }
    await handleSaveWorkout(undefined, capturedRoutineUri);
  }

  async function handleCapture(_aspect: [number, number] = [3, 4]) {
    let result: ImagePicker.ImagePickerResult;
    try {
      result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.9,
        exif: true,
      });
    } catch (e) {
      console.warn('[GymPick] 사진 라이브러리 접근 실패:', e);
      Alert.alert('권한 필요', '사진 라이브러리 접근 권한이 필요합니다.');
      return;
    }
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      let photoDate: Date | null = null;
      if (asset.exif?.DateTimeOriginal) {
        const raw = asset.exif.DateTimeOriginal as string;
        const [datePart, timePart] = raw.split(' ');
        const [y, m, d] = datePart.split(':');
        photoDate = new Date(`${y}-${m}-${d}T${timePart}`);
      } else if ((asset as any).creationTime) {
        photoDate = new Date((asset as any).creationTime);
      }

      if (photoDate && photoDate < today) {
        Alert.alert('오늘 사진만 가능해요', '운동 당일 촬영한 사진만 업로드할 수 있어요.');
        return;
      }

      setPhotoUri(asset.uri);
      setPhotoTaken(true);
    }
  }

  function renderStep() {
    switch (step) {
      case 'gym-select':
        return (
          <GymSelectStep
            onSelect={handleSelectGym}
            onClose={() => onClose(false)}
            onRegisterRect={onboarding.registerRect}
            onboardingActive={onboarding.active}
            onboardingKey={onboarding.currentKey}
          />
        );
      case 'muscle-select':
        return (
          <MuscleSelectStep
            selected={selectedMuscles}
            onToggle={toggleMuscle}
            onNext={() => setStep('routine-reference')}
            onBack={goBack}
            onClose={() => onClose(false)}
            isRestDay={isRestDay}
            onRegisterRect={onboarding.registerRect}
            onboardingActive={onboarding.active}
            onboardingKey={onboarding.currentKey}
          />
        );
      case 'routine-reference':
        return (
          <RoutineReferenceScreen
            gymId={gym!.id}
            gymName={gym!.name}
            selectedMuscles={Array.from(selectedMuscles)}
            pastSessions={sessions}
            onSelectMachineIds={(ids, extraInfo) => {
              if (ids.length === 0) {
                setStep('exercise-select');
              } else {
                setPreloadedIdsOrdered(ids);
                setRoutineMachineIds(ids);
                setRoutineReadOnly(true);
                setRoutineExtraInfo(extraInfo);
                setStep('today-list');
              }
            }}
            onBack={goBack}
            onClose={() => onClose(false)}
            onRegisterRect={onboarding.registerRect}
            onboardingActive={onboarding.active}
            onboardingKey={onboarding.currentKey}
            onJumpToExerciseGrid={() => onboarding.jumpTo('exercise-grid')}
          />
        );
      case 'today-list':
        return (
          <TodayWorkoutListScreen
            initialMachineIds={routineMachineIds}
            gymMachines={gym!.machines}
            selectedMuscles={Array.from(selectedMuscles)}
            readOnly={routineReadOnly}
            extraMachineInfo={routineExtraInfo}
            onConfirm={(ids) => {
              setPreloadedIdsOrdered(ids);
              setStep('exercise-select');
            }}
            onBack={goBack}
            onClose={() => onClose(false)}
            onRegisterRect={onboarding.registerRect}
            onboardingActive={onboarding.active}
            onboardingKey={onboarding.currentKey}
          />
        );
      case 'exercise-select':
        return (
          <ExerciseSelectStep
            gym={gym!}
            selectedMuscles={selectedMuscles}
            loggedIds={loggedIds}
            preloadedIds={preloadedIds}
            routineExtraInfo={routineExtraInfo}
            templates={templates}
            onSelectExercise={handleSelectExercise}
            onLoadTemplate={handleLoadTemplate}
            onDeleteTemplate={handleDeleteTemplate}
            onFinish={() => setStep('photo')}
            onBack={goBack}
            onClose={() => onClose(false)}
            onRegisterRect={onboarding.registerRect}
            onboardingActive={onboarding.active}
            onboardingKey={onboarding.currentKey}
          />
        );
      case 'log-sets':
        return currentExercise ? (
          <SetLoggingStep
            exercise={currentExercise}
            sets={logs[currentExercise.id] ?? []}
            realPR={realPRs[machineIdFromKey(currentExercise.id)]}
            prefill={prefillInfo[currentExercise.id] ?? null}
            note={notes[currentExercise.id] ?? ''}
            freeWeights={dbFreeWeights.length > 0 ? dbFreeWeights : FREE_WEIGHTS}
            onChange={handleChangeSet}
            onAdd={handleAddSet}
            onCopyPrev={handleCopyPrev}
            onRemove={handleRemoveSet}
            onNoteChange={handleNoteChange}
            onSave={handleSaveExercise}
            onFinish={() => { setCurrentExerciseId(null); setStep('photo'); }}
            onBack={goBack}
            onClose={() => onClose(false)}
            onRegisterRect={onboarding.registerRect}
            onboardingActive={onboarding.active}
            onboardingKey={onboarding.currentKey}
          />
        ) : null;
      case 'photo':
        return (
          <WorkoutPhotoStep
            gym={gym!}
            exercises={selectedExercises}
            selectedMuscles={Array.from(selectedMuscles).map(toCanonMuscle)}
            logs={logs}
            photoTaken={photoTaken}
            photoUri={photoUri ?? undefined}
            nickname={user?.nickname ?? user?.name ?? undefined}
            onColorChange={setSelectedColor}
            onCapture={(aspect) => handleCapture(aspect)}
            onCameraCapture={(uri) => {
              setShowCamera(false);
              setPhotoUri(uri);
              setPhotoTaken(true);
            }}
            showCamera={showCamera}
            onSetShowCamera={setShowCamera}
            onCompositeUri={(uri) => setCompositeUri(uri)}
            onRoutineCardUri={(uri) => setRoutineCardUri(uri)}
            fontsLoaded={fontsLoaded}
            onSave={requestSaveWorkout}
            onBack={goBack}
            onClose={() => onClose(false)}
            onRegisterRect={onboarding.registerRect}
            onboardingActive={onboarding.active}
            onboardingKey={onboarding.currentKey}
            onOnboardingNext={onboarding.next}
            onOnboardingJump={onboarding.jumpTo}
          />
        );
      case 'done':
        return (
          <WorkoutDoneStep
            gym={gym!}
            exercises={selectedExercises}
            logs={logs}
            detectedPRs={detectedPRs}
            selectedMuscles={selectedMuscles}
            freeWeights={dbFreeWeights.length > 0 ? dbFreeWeights : FREE_WEIGHTS}
            sessions={sessions}
            pastEntries={pastEntries}
            pastSets={pastSets}
            realPRs={realPRs}
            photoUri={compositeUri ?? photoUri}
            onClose={() => onClose(true)}
          />
        );
    }
  }

  return (
    <>
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={goBack}
    >
      <SafeAreaProvider>
      <View style={{ flex: 1, backgroundColor: C.bg }}>
          {renderStep()}

          <OnboardingTooltip
            visible={onboarding.active}
            rect={onboarding.currentRect}
            message={onboarding.currentMessage}
            stepIndex={onboarding.currentIndex}
            totalSteps={onboarding.total}
            isLast={onboarding.isLast}
            hideNext={onboarding.hideNext}
            hideSkip={onboarding.hideSkip}
            hideSpotlightBorder={onboarding.hideSpotlightBorder}
            onNext={onboarding.next}
            onSkip={onboarding.skip}
          />

        {/* 저장 중 로딩 팝업 */}
        {isSaving && (
          <View style={s.savingOverlay}>
            <View style={s.savingCard}>
              <Ionicons name="barbell-outline" size={32} color={C.accent} />
              <Text style={s.savingText}>운동일지를 저장 중입니다 💪</Text>
              <View style={s.savingBarBg}>
                <Animated.View
                  style={[
                    s.savingBarFill,
                    {
                      width: savingAnim.interpolate({
                        inputRange:  [0, 1],
                        outputRange: ['0%', '100%'],
                      }),
                    },
                  ]}
                />
              </View>
            </View>
          </View>
        )}

        {/* PR Celebration overlay */}
        {prCelebration && (
          <View style={s.prOverlay}>
            <View style={s.prOverlayCard}>
              <Text style={s.prOverlayEmoji}>🎉</Text>
              <Text style={s.prOverlayTitle}>신기록 달성!</Text>
              <Text style={s.prOverlayExName}>{prCelebration.name}</Text>
              <Text style={s.prOverlayWeight}>{prCelebration.weight} kg</Text>
              <Text style={s.prOverlayReps}>× {prCelebration.reps} reps</Text>
              <TouchableOpacity
                style={s.prOverlayBtn}
                activeOpacity={0.85}
                onPress={() => setPrCelebration(null)}
              >
                <Text style={s.prOverlayBtnTxt}>최고예요!</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

      </View>
      </SafeAreaProvider>
    </Modal>

    </>
  );
}

// --- Styles

const s = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: C.bg },
  listPad: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 24 },
  hint:    { fontSize: 13, color: C.textSub, marginBottom: 20, lineHeight: 18 },
  sectionTitle: { ...T.section, color: C.text, marginBottom: 12 },
  sectionTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },

  // Machine card 2-column grid for exercise select
  machineCardGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  freeWeightRow: { gap: 8, marginBottom: 8 },
  fwFilterScroll: { marginTop: 10 },
  fwFilterRow: { flexDirection: 'row', gap: 6, paddingRight: 16 },
  cardOrderOverlay: { position: 'absolute', top: 8, left: 8 },
  cardOrderBadge: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center',
  },
  cardOrderText: { fontSize: 13, fontWeight: '900', color: C.bg },
  cardSelectedOverlay: { position: 'absolute', top: 8, right: 8 },
  cardSelectedBadge: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center',
  },
  cardCompletedOverlay: { position: 'absolute', top: 8, right: 8 },
  cardCompletedBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(0,0,0,0.65)', borderRadius: R.pill,
    paddingHorizontal: 8, paddingVertical: 4,
  },
  cardCompletedTxt: { fontSize: 11, fontWeight: '700', color: C.accent },

  navHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 12 },
  navBtn:    { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  navTitle:  { flex: 1, textAlign: 'center', ...T.section, color: C.text },

  stepBar: { flexDirection: 'row', gap: 4, paddingHorizontal: 16, paddingVertical: 10 },
  stepSeg: { flex: 1, height: 3, borderRadius: 2 },

  // Muscle selection cards
  muscleGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  muscleCard: {
    borderRadius: R.card,
    borderWidth: 2,
    borderColor: C.border,
    backgroundColor: C.surface,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    minHeight: 168,
    position: 'relative',
    overflow: 'hidden',
  },
  muscleCardWide: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: R.card,
    borderWidth: 2,
    borderColor: C.border,
    backgroundColor: C.surface,
    padding: 20,
    width: '100%',
    position: 'relative',
    overflow: 'hidden',
    gap: 0,
  },
  muscleCardCircle: { width: 68, height: 68, borderRadius: 34, alignItems: 'center', justifyContent: 'center' },
  muscleCardName:   { fontSize: 16, fontWeight: '800', color: C.text, textAlign: 'center' },
  muscleCardSub:    { fontSize: 11, color: C.textDim, textAlign: 'center', fontWeight: '500' },
  muscleCardCheck:  {
    position: 'absolute', top: 10, right: 10,
    width: 24, height: 24, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },

  // Gym card
  gymCard:         { flexDirection: 'row', alignItems: 'stretch', backgroundColor: C.surface, borderRadius: R.card, marginBottom: 10, overflow: 'hidden', paddingHorizontal: 16, paddingVertical: 16 },
  gymCardName:     { fontSize: 15, fontWeight: '700', color: C.text, marginBottom: 4 },
  gymMeta:         { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 3 },
  gymMetaLoc:      { fontSize: 12, color: C.textSub },
  dot:             { fontSize: 12, color: C.textDim },
  gymMetaDist:     { fontSize: 11, fontWeight: '700', color: C.accent },
  gymMachineCount: { fontSize: 11, color: C.textDim },

  emptyState: { alignItems: 'center', paddingVertical: 48, gap: 10 },
  emptyText:  { fontSize: 14, color: C.textSub, textAlign: 'center', lineHeight: 20 },

  // Exercise card grid
  cardGrid:         { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  exCard:           { borderRadius: R.card, overflow: 'hidden', borderWidth: 1.5, borderColor: C.border, backgroundColor: C.surface },
  exCardOn:         { borderColor: '#3dd68c' },
  // 3:4 trading-card ratio
  exCardImg:        { height: CARD_W * (4 / 3), alignItems: 'center', justifyContent: 'center', position: 'relative' },
  exCardIconBadge:  { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', position: 'absolute' },
  fwBadge:          { position: 'absolute', bottom: 10, left: 10, paddingHorizontal: 6, paddingVertical: 2, borderRadius: R.pill, backgroundColor: 'rgba(255,255,255,0.12)' },
  fwBadgeText:      { fontSize: 8, fontWeight: '900', color: 'rgba(255,255,255,0.6)', letterSpacing: 1 },
  muscleTag:        { position: 'absolute', top: 10, right: 10, paddingHorizontal: 8, paddingVertical: 3, borderRadius: R.pill },
  muscleTagText:    { fontSize: 9, fontWeight: '800', color: '#fff', letterSpacing: 0.3 },
  cardCheckOverlay: { position: 'absolute', top: 10, left: 10 },
  cardCheckCircle:  { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  exCardInfo:       { paddingHorizontal: 10, paddingVertical: 10, backgroundColor: C.surface },
  exCardName:       { fontSize: 12, fontWeight: '700', color: C.text, marginBottom: 2 },
  exCardBrand:      { fontSize: 10, color: C.textSub },
  exCardPRRow:      { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 5 },
  exCardPRLabel:    { fontSize: 8, fontWeight: '900', color: C.accent, letterSpacing: 0.5 },
  exCardPRVal:      { fontSize: 9, fontWeight: '700', color: C.textSub },
  exCardDoneBadge:  { marginTop: 5, paddingHorizontal: 6, paddingVertical: 2, borderRadius: R.pill, backgroundColor: '#3dd68c22', alignSelf: 'flex-start' },
  exCardDoneBadgeText: { fontSize: 9, fontWeight: '800', color: '#3dd68c' },

  // Log sets
  logCard:      { backgroundColor: C.surface, borderRadius: R.card, padding: 16, marginBottom: 14 },
  logCardHead:  { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  logExIcon:    { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  logExName:    { fontSize: 14, fontWeight: '800', color: C.text },
  logExBrand:   { fontSize: 11, color: C.textSub, marginTop: 1 },
  logMusclePill:    { paddingHorizontal: 8, paddingVertical: 3, borderRadius: R.pill },
  logMusclePillText:{ fontSize: 10, fontWeight: '700' },
  newPRBadge:       { paddingHorizontal: 8, paddingVertical: 3, borderRadius: R.pill, backgroundColor: C.accentBg, borderWidth: 1, borderColor: C.accent + '50', marginRight: 6 },
  newPRBadgeTxt:    { fontSize: 10, fontWeight: '900', color: C.accent },
  yourPRRow:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: C.accentBg, borderRadius: R.inner, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 8 },
  yourPRLabel:      { fontSize: 9, fontWeight: '900', color: C.accent, letterSpacing: 1 },
  yourPRVal:        { fontSize: 13, fontWeight: '800', color: C.accent },
  prefillRow:       { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6 },
  prefillText:      { fontSize: 12, color: C.textDim, fontWeight: '600' },

  setBlock:       { backgroundColor: C.surfaceHigh, borderRadius: R.inner, padding: 16, marginBottom: 10 },
  setBlockHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  setBlockLabel:  { fontSize: 11, fontWeight: '800', color: C.textSub, letterSpacing: 0.5, textTransform: 'uppercase' },

  inputRow:    { flexDirection: 'row', alignItems: 'center', gap: 6 },
  inputLabel:  { fontSize: 10, fontWeight: '700', color: C.textSub, width: 44, letterSpacing: 0.5, textTransform: 'uppercase' },

  presetRow:           { flexDirection: 'row', gap: 6 },
  presetChip:          { minWidth: 40, paddingHorizontal: 12, paddingVertical: 8, borderRadius: R.pill, backgroundColor: C.surfaceHigh, alignItems: 'center' },
  presetChipActive:    { backgroundColor: C.accent, borderColor: C.accent },
  presetChipText:      { fontSize: 12, fontWeight: '700', color: C.textSub },
  presetChipTextActive:{ color: C.bg },

  stepperRow:  { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 },
  stepperUnit: { fontSize: 10, fontWeight: '700', color: C.textSub, width: 44, letterSpacing: 0.5, textTransform: 'uppercase' },
  stepper:     { flexDirection: 'row', alignItems: 'center', backgroundColor: C.surface, borderRadius: R.inner, overflow: 'hidden' },
  stepperBtn:  { width: 56, height: 56, alignItems: 'center', justifyContent: 'center' },
  stepperVal:  { width: 84, textAlign: 'center', fontSize: 28, fontWeight: '900', color: C.text, fontVariant: ['tabular-nums'] },
  stepperValEditing: {
    width: 84, height: 56, textAlign: 'center', fontSize: 28, fontWeight: '900', color: C.text,
    fontVariant: ['tabular-nums'], padding: 0, margin: 0,
  },

  setActions:   { flexDirection: 'row', gap: 10, marginTop: 4 },
  addSetBtn:    { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: R.inner },
  addSetText:   { fontSize: 13, fontWeight: '700', color: C.accent },
  copySetBtn:   { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: R.inner, backgroundColor: C.surfaceHigh },
  copySetText:  { fontSize: 12, fontWeight: '700', color: C.textSub },

  ctaBar:     { padding: 16, backgroundColor: C.bg },
  ctaBtn:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: C.accent, borderRadius: R.btn, paddingVertical: 16 },
  ctaDisabled:{ opacity: 0.35 },
  ctaTxt:     { fontSize: 15, fontWeight: '800', color: C.bg },

  // Aspect ratio selector
  aspectRow:         { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  aspectLabel:       { fontSize: 11, fontWeight: '700', color: C.textSub },
  aspectChip:        { paddingHorizontal: 14, paddingVertical: 7, borderRadius: R.pill, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border },
  aspectChipActive:  { backgroundColor: C.accent, borderColor: C.accent },
  aspectChipText:    { fontSize: 13, fontWeight: '700', color: C.textSub },
  aspectChipTextActive: { color: C.bg },

  // Photo - variable aspect ratio
  photoFrame:       { width: PHOTO_W, height: PHOTO_H, borderRadius: R.card, borderWidth: 2, borderColor: C.border, borderStyle: 'dashed', overflow: 'hidden', marginBottom: 10, backgroundColor: 'transparent', alignItems: 'center', justifyContent: 'center', alignSelf: 'center' },
  photoFrameActive: { borderStyle: 'solid', borderColor: C.accent + '60', backgroundColor: 'transparent' },
  photoCta:         { alignItems: 'center', gap: 10 },
  photoCtaIcon:     { width: 64, height: 64, borderRadius: 32, backgroundColor: C.surfaceHigh, alignItems: 'center', justifyContent: 'center' },
  photoCtaTitle:    { fontSize: 15, fontWeight: '700', color: C.textSub },
  photoCtaSub:      { fontSize: 12, color: C.textDim },
  retakeRow:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 16 },
  retakeText:       { fontSize: 12, color: C.textSub },

  // Overlay — no dark layer, photo shows through
  overlayWrap:        { flex: 1, width: '100%', position: 'relative' },

  // Rotated SVG logo strips (absolutely positioned, transform offsets computed in component)
  overlayLogoAbsolute: { position: 'absolute', zIndex: 2 },

  // Top-right: nickname + timestamp (우측으로 5% 이동 = right 감소)
  overlayTopRight:   { position: 'absolute', top: OVERLAY_PAD, right: Math.max(0, OVERLAY_PAD + LOGO_STRIP_H + 4 - Math.round(PHOTO_W * 0.05)), alignItems: 'flex-end', zIndex: 3 },
  overlayUsername:   { fontSize: 12, fontWeight: '900', letterSpacing: 0.5 },
  overlayTimestamp:  { fontSize: 10, fontWeight: '500', opacity: 0.75, marginTop: 2 },

  // Lower-left: muscle label + scrollable session (좌측으로 5% 이동 = left 감소)
  overlayBottomLeft: { position: 'absolute', left: Math.max(0, OVERLAY_PAD + LOGO_STRIP_H + 4 - Math.round(PHOTO_W * 0.05)), right: OVERLAY_PAD, bottom: OVERLAY_PAD, zIndex: 3 },
  overlayMuscleTitle:{ fontSize: 24, letterSpacing: -0.5, marginBottom: 8 },
  sessionScroll:     { maxHeight: 220 },
  overlayExBlock:    { marginBottom: 6 },
  overlayExName:     { fontSize: 9, fontWeight: '900', letterSpacing: 0.5 },
  overlayExSet:      { fontSize: 9, fontWeight: '500', opacity: 0.8, marginTop: 1 },

  // Text colour selector
  colorPickerWrap:   { marginBottom: 20 },
  colorPickerLabel:  { fontSize: 9, fontWeight: '700', color: C.textDim, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 10 },
  colorPickerRow:    { flexDirection: 'row' },
  colorChip:         { width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: 'rgba(255,255,255,0.15)', marginRight: 8 },
  colorChipActive:   { borderColor: C.accent, transform: [{ scale: 1.2 }] },

  // Done
  doneHero:    { alignItems: 'center', paddingVertical: 32 },
  doneCheck:   { width: 84, height: 84, borderRadius: 42, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center', marginBottom: 18 },
  doneTitle:   { ...T.title, color: C.text, marginBottom: 6 },
  doneSub:     { fontSize: 14, color: C.textSub },
  doneStats:   { flexDirection: 'row', backgroundColor: C.surface, borderRadius: R.card, marginBottom: 24, paddingVertical: 16 },
  doneStat:    { flex: 1, alignItems: 'center' },
  doneStatVal: { fontSize: 22, fontWeight: '900', color: C.accent },
  doneStatLab: { fontSize: 11, color: C.textSub, fontWeight: '600', marginTop: 4 },
  doneStatDiv: { width: 1, backgroundColor: C.border },

  summaryCard:   { backgroundColor: C.surface, borderRadius: R.card, overflow: 'hidden', marginBottom: 24 },
  divider:       { height: 1, backgroundColor: C.border },
  summaryRow:    { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14 },
  summaryIcon:   { width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  summaryName:   { fontSize: 13, fontWeight: '700', color: C.text },
  summaryDetail: { fontSize: 11, color: C.textSub, marginTop: 2 },

  // --- Workout summary (완료 화면: 점진적 과부하 비교)
  sumHeader:         { height: 260, borderRadius: R.card, overflow: 'hidden', backgroundColor: C.surface, marginBottom: 18, position: 'relative' },
  sumHeaderTopRow:   { position: 'absolute', top: 16, left: 16, right: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sumHeaderTag:      { fontSize: 11, fontWeight: '700', letterSpacing: 1, color: C.text + 'a0' },
  sumHeaderBottom:   { position: 'absolute', left: 16, right: 16, bottom: 16, gap: 10 },
  sumBadge:          { paddingHorizontal: 10, paddingVertical: 5, borderRadius: R.pill, backgroundColor: C.text + '18', borderWidth: 1, borderColor: C.text + '25' },
  sumBadgeTxt:       { fontSize: 11, fontWeight: '700', color: C.text },
  sumBadgeAccent:    { paddingHorizontal: 10, paddingVertical: 5, borderRadius: R.pill, backgroundColor: C.accentBg, borderWidth: 1, borderColor: C.accent + '50' },
  sumBadgeAccentTxt: { fontSize: 11, fontWeight: '700', color: C.accent },
  sumHeaderDateTime: { fontSize: 18, fontWeight: '800', color: C.text, letterSpacing: -0.3 },

  sumStatRow:   { flexDirection: 'row', backgroundColor: C.surface, borderRadius: R.card, paddingVertical: 16, marginBottom: 10 },
  sumStatCell:  { flex: 1, alignItems: 'center' },
  sumStatVal:   { fontSize: 24, fontWeight: '900', color: C.text, fontVariant: ['tabular-nums'] },
  sumStatLab:   { fontSize: 11, color: C.textSub, fontWeight: '600', marginTop: 4 },
  sumStatDiv:   { width: 1, backgroundColor: C.border },
  sumCompareLabel:    { fontSize: 11, fontWeight: '800', letterSpacing: 0.6, color: C.textDim, textTransform: 'uppercase', marginBottom: 10 },
  sumCompareRowLabel: { fontSize: 13, fontWeight: '600', color: C.textSub, width: 100 },
  sumCompareRowVal:   { fontSize: 15, fontWeight: '800', letterSpacing: -0.2, fontVariant: ['tabular-nums'] },
  sumCompareEmpty:    { fontSize: 12.5, color: C.textDim },

  sumVolBlock:    { marginBottom: 20 },
  sumVolLabel:    { fontSize: 11, fontWeight: '700', letterSpacing: 1, color: C.textDim, marginBottom: 8, textTransform: 'uppercase' },
  sumVolVal:      { fontSize: 48, fontWeight: '900', color: C.text, letterSpacing: -1, fontVariant: ['tabular-nums'] },
  sumVolUnit:     { fontSize: 16, fontWeight: '700', color: C.textSub, marginBottom: 6 },
  sumVolDelta:    { fontSize: 13, fontWeight: '800', fontVariant: ['tabular-nums'] },
  sumVolDeltaSub: { fontSize: 12, color: C.textSub },

  sumPrBanner: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: C.accent, borderRadius: R.card, paddingHorizontal: 16, paddingVertical: 14, marginBottom: 20 },
  sumPrCount:  { fontSize: 32, fontWeight: '900', color: C.bg, fontVariant: ['tabular-nums'] },
  sumPrTitle:  { fontSize: 14, fontWeight: '800', color: C.bg },
  sumPrSub:    { fontSize: 11, color: C.bg + 'aa', fontWeight: '600', marginTop: 2 },

  sumSectionSub: { fontSize: 11.5, color: C.textSub, marginTop: 4 },
  sumFootnote:   { fontSize: 11, lineHeight: 16, color: C.textDim, marginTop: 18 },

  compCard:          { backgroundColor: C.surface, borderRadius: R.card, borderWidth: 1, borderColor: C.border, overflow: 'hidden' },
  compCardHead:      { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14 },
  compThumb:         { width: 64, height: 64, borderRadius: R.inner, overflow: 'hidden', backgroundColor: C.surfaceHigh },
  compThumbFallback: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  compName:          { fontSize: 13, fontWeight: '700', color: C.text },
  compBrand:         { fontSize: 11, color: C.textDim, marginTop: 1, marginBottom: 5 },
  compHeadline:      { fontSize: 19, fontWeight: '800', letterSpacing: -0.3, marginTop: 1 },

  compBody:  { borderTopWidth: 1, borderTopColor: C.border, padding: 14, backgroundColor: C.surfaceHigh },
  barLabel:  { fontSize: 10.5, color: C.textDim, width: 44 },
  barTrack:  { flex: 1, height: 8, borderRadius: 4, backgroundColor: C.surfaceHigh, overflow: 'hidden' },
  barFill:   { height: '100%', borderRadius: 4 },
  barValue:  { fontSize: 11.5, width: 58, textAlign: 'right', fontVariant: ['tabular-nums'] },

  rowsHeader:    { flexDirection: 'row', alignItems: 'center', gap: 8, paddingBottom: 8, marginTop: 12 },
  rowsHeaderTxt: { fontSize: 10.5, color: C.textDim },
  compRow:       { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 7, borderTopWidth: 1, borderTopColor: C.border },
  compRowIdx:    { fontSize: 12, color: C.textDim, fontVariant: ['tabular-nums'] },
  compRowPrev:   { fontSize: 12, color: C.textSub, fontVariant: ['tabular-nums'] },
  compRowNow:    { fontSize: 13, fontWeight: '600', color: C.text, fontVariant: ['tabular-nums'] },
  compRowDelta:  { fontSize: 12, fontWeight: '700', fontVariant: ['tabular-nums'] },
  colIdx:        { width: 28 },
  colFlex:       { flex: 1 },
  colDelta:      { width: 54, textAlign: 'right' },
  compNote:      { fontSize: 11.5, lineHeight: 16, color: C.textDim, marginTop: 12 },

  // --- Exercise note
  noteCard: {
    backgroundColor: C.surface, borderRadius: R.inner,
    padding: 14, marginTop: 12,
  },
  noteLabel: { fontSize: 10, fontWeight: '700', color: C.textDim, letterSpacing: 1, marginBottom: 8 },
  noteInput: {
    color: C.text, fontSize: 13, fontWeight: '500',
    minHeight: 64, textAlignVertical: 'top',
  },

  // --- Share / Download buttons
  shareRow: { flexDirection: 'row', gap: 10, marginTop: 16 },
  shareBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: C.surface, borderRadius: R.inner, paddingVertical: 12,
  },
  shareBtnTxt: { fontSize: 13, fontWeight: '700', color: C.accent },

  // --- Template loading (ExerciseSelectStep)
  tplRow:         { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 0 },
  tplChip:        { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: C.accentBg, borderRadius: R.pill, paddingHorizontal: 10, paddingVertical: 6 },
  tplChipTxt:     { fontSize: 12, fontWeight: '700', color: C.accent },
  tplList:        { backgroundColor: C.surface, borderRadius: R.inner, marginBottom: 14, overflow: 'hidden' },
  tplItem:        { flexDirection: 'row', alignItems: 'center', padding: 12, borderBottomWidth: 1, borderBottomColor: C.border },
  tplItemName:    { fontSize: 13, fontWeight: '700', color: C.text },
  tplItemSub:     { fontSize: 11, color: C.textSub, marginTop: 2 },
  tplLoadedBanner:{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.accentBg, borderRadius: R.inner, padding: 10, marginBottom: 14 },
  tplLoadedTxt:   { flex: 1, fontSize: 12, fontWeight: '600', color: C.accent },
  exCardPreloaded:{ borderWidth: 1, borderColor: C.accent + '60' },
  viewModeToggle:   { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: C.accentBg, borderRadius: R.pill, paddingHorizontal: 10, paddingVertical: 6 },
  viewModeToggleTxt:{ fontSize: 12, fontWeight: '700', color: C.accent },
  categoryToggleRow: { flexDirection: 'row', gap: 6 },
  categoryToggleChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: R.pill,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
  },
  categoryToggleChipActive: { backgroundColor: C.accent, borderColor: C.accent },
  categoryToggleChipText:       { fontSize: 12, fontWeight: '600', color: C.textSub },
  categoryToggleChipTextActive: { color: C.bg, fontWeight: '700' },

  // --- Save as Template (WorkoutDoneStep)
  tplCard:      { backgroundColor: C.surface, borderRadius: R.card, padding: 16, marginBottom: 16 },
  tplCardTitle: { fontSize: 10, fontWeight: '700', color: C.textDim, letterSpacing: 1, marginBottom: 10 },
  tplInputRow:  { flexDirection: 'row', alignItems: 'center', gap: 10 },
  tplInput:     { flex: 1, backgroundColor: C.surfaceHigh, borderRadius: R.inner, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, color: C.text, fontWeight: '500' },
  tplSaveBtn:   { backgroundColor: C.accent, borderRadius: R.inner, paddingHorizontal: 14, paddingVertical: 10 },
  tplSaveBtnTxt:{ fontSize: 13, fontWeight: '800', color: C.bg },
  tplSavedRow:  { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tplSavedTxt:  { fontSize: 13, fontWeight: '700', color: C.accent },

  // --- PR celebration panel (WorkoutDoneStep)
  prCelebCard: { backgroundColor: C.accentBg, borderRadius: R.card, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: C.accent + '40' },
  prCelebTitle:{ fontSize: 14, fontWeight: '900', color: C.accent, marginBottom: 10 },
  prCelebRow:  { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  prCelebName: { flex: 1, fontSize: 13, fontWeight: '700', color: C.text },
  prCelebVal:  { fontSize: 15, fontWeight: '900', color: C.accent },

  // --- PR celebration overlay (fullscreen)
  offscreenComposite: { position: 'absolute', left: -9999, top: -9999, opacity: 0 },

  // Preview overlay (visible photo step)
  previewHeatmapWrap: {
    position:        'absolute',
    bottom:          12,
    right:           12,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius:    12,
    padding:         6,
  },
  previewBadgesWrap: {
    position:      'absolute',
    top:           12,
    right:         12,
    flexDirection: 'column',
    gap:           4,
  },

  // Overlay options (photo step)
  overlayOptions: {
    marginTop: 12,
    paddingHorizontal: 16,
  },
  overlayOptionsTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: C.textDim,
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  overlayOptionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  overlayOptionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: C.border,
    backgroundColor: C.surface,
  },
  overlayOptionBtnActive: {
    borderColor: C.accent,
    backgroundColor: C.accentBg,
  },
  overlayOptionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: C.textSub,
  },
  overlayOptionLabelActive: {
    color: C.accent,
  },
  overlayOptionEmoji: {
    fontSize: 14,
  },
  savingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 999,
  },
  savingCard: {
    backgroundColor:   C.surface,
    borderRadius:      R.card,
    paddingHorizontal: 32,
    paddingVertical:   28,
    alignItems:        'center',
    gap:               16,
    width:             260,
    borderWidth:       1,
    borderColor:       C.border,
  },
  savingText: {
    fontSize:   15,
    fontWeight: '700',
    color:      C.text,
    textAlign:  'center',
  },
  savingBarBg: {
    width:           '100%',
    height:          6,
    backgroundColor: C.border,
    borderRadius:    3,
    overflow:        'hidden',
  },
  savingBarFill: {
    height:          6,
    backgroundColor: C.accent,
    borderRadius:    3,
  },
  prOverlay:     { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.75)', alignItems: 'center', justifyContent: 'center', zIndex: 99 },
  prOverlayCard: { backgroundColor: C.surface, borderRadius: R.card, padding: 32, alignItems: 'center', marginHorizontal: 32, borderWidth: 1, borderColor: C.accent + '40' },
  prOverlayEmoji:{ fontSize: 40, marginBottom: 12 },
  prOverlayTitle:{ fontSize: 18, fontWeight: '900', color: C.text, marginBottom: 8 },
  prOverlayExName:{ fontSize: 14, fontWeight: '700', color: C.textSub, marginBottom: 12 },
  prOverlayWeight:{ fontSize: 40, fontWeight: '900', color: C.accent, letterSpacing: -1 },
  prOverlayReps: { fontSize: 14, color: C.textSub, fontWeight: '600', marginBottom: 24 },
  prOverlayBtn:  { backgroundColor: C.accent, borderRadius: R.btn, paddingHorizontal: 32, paddingVertical: 14 },
  prOverlayBtnTxt:{ fontSize: 15, fontWeight: '900', color: C.bg },

  // --- Set Progress Banner
  setProgressBanner: {
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 2,
    backgroundColor: C.surface,
    borderRadius: R.card,
    borderWidth: 1,
    borderColor: C.border,
    overflow: 'hidden',
    paddingBottom: 4,
  },
  setProgressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  setProgressHeaderText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
    color: C.textSub,
    letterSpacing: 0.3,
  },
  setProgressCountBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: C.accentBg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  setProgressCountText: {
    fontSize: 11,
    fontWeight: '800',
    color: C.accent,
  },
  setProgressList: {
    paddingHorizontal: 14,
    paddingTop: 4,
  },
  setProgressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    gap: 0,
  },
  setProgressIndex: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: C.surfaceHigh,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  setProgressIndexText: {
    fontSize: 11,
    fontWeight: '800',
    color: C.textSub,
  },
  setProgressKgBlock: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 3,
  },
  setProgressKgValue: {
    fontSize: 15,
    fontWeight: '900',
    color: C.text,
    letterSpacing: -0.5,
  },
  setProgressKgUnit: {
    fontSize: 10,
    fontWeight: '600',
    color: C.textDim,
  },
  setProgressSeparator: {
    paddingHorizontal: 10,
  },
  setProgressSeparatorText: {
    fontSize: 13,
    color: C.textDim,
    fontWeight: '500',
  },
  setProgressRepsBlock: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 3,
  },
  setProgressRepsValue: {
    fontSize: 15,
    fontWeight: '900',
    color: C.text,
    letterSpacing: -0.5,
  },
  setProgressRepsUnit: {
    fontSize: 10,
    fontWeight: '600',
    color: C.textDim,
  },
});
