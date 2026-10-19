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
  ActivityIndicator,
  InteractionManager,
  Animated,
  Linking,
  Platform,
  PixelRatio,
  ActionSheetIOS,
  KeyboardAvoidingView,
  Keyboard,
  NativeSyntheticEvent,
  NativeScrollEvent,
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
import { track } from '../../lib/analytics';
import { submitGymRegistrationRequest } from '../../lib/db/gymRegistrationRequests';
import { insertWorkoutSession, insertWorkoutEntries, insertWorkoutSets, insertWorkoutPhoto, fetchWorkoutEntriesForSessions, fetchWorkoutSetsForEntries } from '../../lib/db/workouts';
import { uploadWorkoutPhoto } from '../../lib/photoStorage';
import { androidFauxBold } from '../../lib/photoOverlayUtils';
import { containsBannedWord } from '../../lib/bannedWords';
import { insertFeedPost } from '../../lib/db/feedPosts';
import OunwanVisibilityNote from '../../components/feed/OunwanVisibilityNote';
import { getMachineImageUrl } from '../../lib/machineImageUrl';
import { invalidateActiveFeedPostsCache } from '../../data/feedPostsCache';
import GymPickLogo from '../../components/GymPickLogo';
import OnboardingTooltip from '../../components/OnboardingTooltip';
import VerticalWheelPicker from '../../components/VerticalWheelPicker';
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
export type OverlayStyle =
  | 's1a' | 's1b' | 's1c' | 's1d' | 's1e' | 's1f' | 's1g'
  | 's2a' | 's2b' | 's2c' | 's2d' | 's2e' | 's2f' | 's2g'
  | 's6a' | 's6b' | 's6c' | 's6d' | 's6e' | 's6f' | 's6g'
  | 's7a' | 's7b' | 's7c' | 's7d' | 's7e' | 's7f' | 's7g'
  | 's8a' | 's8b' | 's8c' | 's8d' | 's8e' | 's8f' | 's8g';

type FontSet = {
  muscle: string | undefined;
  routine: string | undefined;
  nickname: string | undefined;
};

const FONT_SETS: Record<number, FontSet> = {
  1: { muscle: 'Quicksilver-Italic',       routine: undefined,              nickname: undefined              },
  2: { muscle: 'Matcha Cih',               routine: 'Mat Saleh',            nickname: 'KCC-Ganpan'           },
  6: { muscle: 'biergartenlt',             routine: undefined,              nickname: undefined              },
  7: { muscle: 'My_handwriting',           routine: 'Leorio',               nickname: undefined              },
  8: { muscle: 'GLAMOROUS',                routine: 'Leorio',               nickname: undefined              },
};

export function getFontSet(style: OverlayStyle): FontSet {
  const setNum = parseInt(style.charAt(1));
  return FONT_SETS[setNum] ?? FONT_SETS[1];
}

export function getLayoutType(style: OverlayStyle): 'a' | 'b' | 'c' | 'd' | 'e' | 'f' | 'g' {
  const t = style.charAt(2);
  return (t === 'a' || t === 'b' || t === 'c' || t === 'd' || t === 'e' || t === 'f' || t === 'g') ? t : 'a';
}

// 2026-09-04: 폰트 세트 번호만 뽑아내는 헬퍼 — 레이아웃/폰트 선택 UI를
// 세로 스크롤 피커 두 축으로 분리하면서 필요해짐 (아래 composeOverlayStyle 참고).
export function getFontSetNumber(style: OverlayStyle): number {
  const n = parseInt(style.charAt(1));
  return FONT_SETS[n] ? n : 1;
}

// 폰트 세트 번호(FONT_SETS의 키) 목록 — 새 폰트 세트를 추가할 땐 여기에 번호만 추가하면 됨.
const FONT_SET_NUMBERS = [1, 2, 6, 7, 8] as const;

// 레이아웃 타입별 표시 이름(영문) — 새 레이아웃을 추가할 땐 여기에 한 줄만 추가하면 됨.
const LAYOUT_TYPE_OPTIONS: { key: 'a' | 'b' | 'c' | 'd' | 'e' | 'f' | 'g'; label: string }[] = [
  { key: 'a', label: 'Classic' },
  { key: 'b', label: 'Simple' },
  { key: 'c', label: 'Card' },
  { key: 'd', label: 'Impact' },
  { key: 'e', label: 'Magazine' },
  { key: 'f', label: 'Poster' },
  { key: 'g', label: 'Roster' },
];

// 폰트 번호 + 레이아웃 문자를 합쳐 OverlayStyle 문자열을 만든다.
// FONT_SET_NUMBERS × LAYOUT_TYPE_OPTIONS 조합은 항상 OverlayStyle 유니온의 유효한 멤버.
function composeOverlayStyle(fontNum: number, layoutType: 'a' | 'b' | 'c' | 'd' | 'e' | 'f' | 'g'): OverlayStyle {
  return `s${fontNum}${layoutType}` as OverlayStyle;
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
          <View style={{ paddingVertical: 48, alignItems: 'center', gap: 10 }}>
            <ActivityIndicator size="small" color={C.accent} />
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

function ExerciseSelectStep({ gym, selectedMuscles, loggedIds, preloadedIds, routineExtraInfo, templates, dbFreeWeights, onSelectExercise, onLoadTemplate, onDeleteTemplate, onFinish, onBack, onClose, onRegisterRect, onboardingActive, onboardingKey }: {
  gym: GymWithMachines;
  selectedMuscles: Set<string>;
  loggedIds: Set<string>;
  preloadedIds: Set<string>;
  routineExtraInfo?: MachineExtraInfo;
  templates: WorkoutTemplate[];
  dbFreeWeights: typeof FREE_WEIGHTS;
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

  // 2026-10-13: 프리웨이트 목록은 부모(PostWorkoutLogModal)가 이미 fetchFreeWeights()로
  // 가져와 dbFreeWeights state로 들고 있다. 여기서 또 fetchFreeWeights()를 호출하면
  // 이 스텝이 보일 때마다 같은 네트워크 요청이 중복으로 나가고, 두 호출의 응답
  // 시점이 다르면 부모/자식이 잠깐 서로 다른 목록을 보여줄 수도 있었다. 그래서
  // 자체 조회 없이 부모가 넘겨주는 dbFreeWeights prop을 그대로 사용한다
  // (fallback 포함 계산은 호출 쪽에서 이미 처리해 넘겨준다).

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

// --- Set Progress Banner (기록한 세트 요약 — SetLoggingStep 상단에 표시)
// 2026-09-05: "완료된 세트"는 실제로는 아직 다 채워지지 않은 세트도 포함해서
// 오해 소지가 있다는 피드백으로 "기록한 세트"로 명칭 변경, 테두리도 눈에
// 띄도록 accent(라임그린)로 변경.

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
          기록한 세트{machineName ? ` · ${machineName}` : ''}
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
  // 2026-09-05: 스크롤 중 화면 중앙에 가장 가까운 칩이 바뀔 때마다 햅틱 틱을
  // 울리기 위한 추적용 ref (실제 선택은 기존대로 onPress로만 확정됨)
  const lastHapticPreset = useRef<number | null>(value);

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

  const handleScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (!containerWidth.current) return;
    const centerX = e.nativeEvent.contentOffset.x + containerWidth.current / 2;
    let nearest: number | null = null;
    let nearestDist = Infinity;
    for (const p of presets) {
      const layout = chipLayouts.current[p];
      if (!layout) continue;
      const dist = Math.abs(layout.x + layout.width / 2 - centerX);
      if (dist < nearestDist) { nearestDist = dist; nearest = p; }
    }
    if (nearest !== null && nearest !== lastHapticPreset.current) {
      lastHapticPreset.current = nearest;
      Haptics.selectionAsync();
    }
  }, [presets]);

  return (
    <ScrollView
      ref={scrollRef}
      horizontal
      showsHorizontalScrollIndicator={false}
      style={{ flexShrink: 1 }}
      onScroll={handleScroll}
      scrollEventThrottle={16}
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
                <Ionicons name="close-circle" size={19} color={C.textSub} />
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
        {/* 2026-09-03: 세트가 하나도 없는 첫 화면에서는 유일한 액션이라 더 크게,
            세트가 이미 있어서 '이전 세트 복사'와 나란히 있을 때는 기존 크기 그대로. */}
        <TouchableOpacity
          style={[s.addSetBtn, sets.length === 0 && s.addSetBtnEmpty]}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); onAdd(); }}
          activeOpacity={0.75}
        >
          <Ionicons name="add" size={sets.length === 0 ? 20 : 15} color={C.bg} />
          <Text style={[s.addSetText, sets.length === 0 && s.addSetTextEmpty]}>세트 추가</Text>
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

        {/* Optional exercise note — 2026-09-03: 세트가 하나도 없는 첫 화면에서는
            숨기고, '세트 추가'로 첫 세트가 생긴 뒤부터 보이게 함.
            단, 온보딩 투어가 이 카드를 가리키는 'set-note' 단계일 때는 세트가
            아직 없어도 보여줘야 스포트라이트가 정상 표시됨. */}
        {(sets.length > 0 || (onboardingActive && onboardingKey === 'set-note')) && (
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
        )}

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
        <Text style={[s.overlayUsername, { color: tc, fontFamily: fontSet.nickname, fontWeight: Platform.OS === 'android' ? undefined : '900' }, androidFauxBold(tc)]}>{nickname}</Text>
        <Text style={[s.overlayTimestamp, { color: tc, fontFamily: fontSet.nickname, fontWeight: Platform.OS === 'android' ? undefined : '500' }, androidFauxBold(tc)]}>{timestamp}</Text>
      </View>
      <View style={s.overlayBottomLeft}>
        <Text style={[s.overlayMuscleTitle, { color: tc, fontFamily: fontSet.muscle }]}>{muscleLabel}</Text>
        <View style={s.sessionScroll}>
          {exercises.slice(0, 7).map(ex => {
            const sets     = logs[ex.id] ?? [];
            const setsLine = sets.map(st => `${st.weight} x ${st.reps}`).join(' / ');
            return (
              <View key={ex.id} style={s.overlayExBlock}>
                <Text style={[s.overlayExName, { color: tc, fontFamily: fontSet.routine, fontWeight: Platform.OS === 'android' ? undefined : '900' }, androidFauxBold(tc)]} numberOfLines={1}>
                  {`[${ex.brand.toUpperCase()}] ${ex.name.toUpperCase()}`}
                </Text>
                {setsLine ? (
                  <Text style={[s.overlayExSet, { color: tc, fontFamily: fontSet.routine, fontWeight: Platform.OS === 'android' ? undefined : '500' }, androidFauxBold(tc)]} numberOfLines={2}>{setsLine}</Text>
                ) : null}
              </View>
            );
          })}
          {exercises.length > 7 && (
            <Text style={[s.overlayExName, { color: tc, opacity: 0.6, marginTop: 2, fontFamily: fontSet.routine, fontWeight: Platform.OS === 'android' ? undefined : '900' }, androidFauxBold(tc)]}>
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
          ...androidFauxBold(tc),
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
          ...androidFauxBold(tc),
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
                  ...androidFauxBold(tc),
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
                    ...androidFauxBold(tc),
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
          ...androidFauxBold(tc),
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
          ...androidFauxBold(tc),
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
                  ...androidFauxBold(tc),
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
                  ...androidFauxBold(tc),
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
                    ...androidFauxBold(tc),
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
        <Text style={{ fontSize: 13, fontWeight: Platform.OS === 'android' ? undefined : '900', color: tc, fontFamily: fontSet.nickname, ...androidFauxBold(tc) }}>{nickname}</Text>
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
              <Text style={{ fontSize: 9, fontWeight: Platform.OS === 'android' ? undefined : '900', color: tc, fontFamily: fontSet.routine, marginBottom: 2, ...androidFauxBold(tc) }} numberOfLines={2}>
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
            style={{ fontSize: 10, fontWeight: Platform.OS === 'android' ? undefined : '900', color: tc, letterSpacing: 0.3, fontFamily: fontSet.nickname, ...androidFauxBold(tc) }}
            numberOfLines={1}
          >
            {nickname}
          </Text>
          <Text style={{ fontSize: 10, color: tc, opacity: 0.6, marginHorizontal: 5, fontFamily: fontSet.nickname }}>|</Text>
          <Text
            style={{ fontSize: 9, fontWeight: Platform.OS === 'android' ? undefined : '600', color: tc, opacity: 0.85, fontFamily: fontSet.nickname, ...androidFauxBold(tc) }}
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
                        style={{ fontSize: 7, fontWeight: Platform.OS === 'android' ? undefined : '700', color: tc, opacity: 0.75, letterSpacing: 0.2, fontFamily: fontSet.routine, textAlign: 'center', ...androidFauxBold(tc) }}
                        numberOfLines={1}
                      >
                        {`[${ex.brand.toUpperCase()}]`}
                      </Text>
                      <Text
                        style={{ fontSize: 8, fontWeight: Platform.OS === 'android' ? undefined : '900', color: tc, marginBottom: 2, fontFamily: fontSet.routine, textAlign: 'center', ...androidFauxBold(tc) }}
                        numberOfLines={2}
                      >
                        {ex.name.toUpperCase()}
                      </Text>
                      {sets.map((st, si) => (
                        <Text
                          key={si}
                          style={{ fontSize: 7, fontWeight: Platform.OS === 'android' ? undefined : '600', color: tc, opacity: 0.85, fontFamily: fontSet.routine, textAlign: 'center', ...androidFauxBold(tc) }}
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

// 2026-09-15 (6차, POSTER 재조정): "[타겟부위] DAY" 타이틀이 머신 목록 위로
// 겹쳐서 올라가는 포스터형 레이아웃.
// 2026-09-15 (8차): 겹침 비율을 15% → 5%로 축소 (TITLE_OVERLAP 참고).
// 2026-09-15 (9차): 타이틀 폰트를 Bigolive → My_handwriting으로 교체
// (FONT_SETS[7].muscle 참고, 폰트 파일 자체를 사용자가 새로 지정).
// - 닉네임/운동일시 표시 제거
// - 머신 표기는 브랜드 로고 이미지가 아니라 "[브랜드] 머신명" 텍스트, 앞에
//   001/002/003... 순번을 붙이고 화면 밖으로 넘어가면 항목 단위로 줄바꿈
//   (각 항목을 독립된 Text로 만들어 flexWrap에 맡김 — 글자 중간이 아니라
//   항목 경계에서만 줄이 바뀜)
// - 짐픽 로고는 화면 최하단 고정이 아니라 머신 목록 바로 아래에 위치
export function PosterOverlay({ exercises, logs, nickname, timestamp, muscleLabel, tc, photoW, photoH, fontSet }: OverlayProps & { fontSet: FontSet }) {
  const pureLabel = muscleLabel.replace(/_?day$/i, '').replace(/\s*day$/i, '').trim() || muscleLabel;
  const titleText = `${pureLabel} DAY`;
  const shownExercises = exercises.slice(0, 6);

  // 타이틀 20% 확대, 머신 목록 폰트 20% 축소·행간 50% 축소.
  const TITLE_FONT_SIZE = Math.round(photoW * 0.145 * 1.2);
  const ITEM_FONT_SIZE  = Math.round(photoW * 0.032 * 0.8);
  const ROW_GAP         = 5; // 기존 10의 50%
  const ITEM_GAP_H      = Math.round(ITEM_FONT_SIZE * 1.3);

  // 2026-10-07 (22차, "타겟부위"-루틴 겹침 버그 수정): 기존엔 겹침 여백을
  // "TITLE_FONT_SIZE * 1.05"라는 폰트 크기 기반 추정치로 미리 계산해뒀었는데,
  // 이 추정치는 표준 시스템 폰트 기준이라 My_handwriting처럼 어센더/디센더가
  // 큰 손글씨 폰트에서는 실제 렌더링 높이보다 훨씬 작게 나와, 의도했던
  // "살짝 겹침"이 아니라 머신목록 첫 줄 전체를 가려버리는 버그로 나타남
  // (실기기 스크린샷에서 확인). 폰트마다 실제 줄 높이가 달라 비율을 추정하는
  // 방식 자체가 근본 원인이므로, onLayout으로 타이틀 텍스트의 실제 렌더링
  // 높이를 측정해 그 값을 기준으로 겹침량을 계산하도록 변경 — 폰트가 또
  // 바뀌어도 매번 비율을 다시 추측할 필요가 없어짐. 최초 렌더(측정 전)만
  // 과거 추정치로 잠깐 자리를 잡고, onLayout 콜백 이후 실제 측정값으로
  // 다시 그려짐(한 프레임 내 반영이라 거의 눈에 띄지 않음).
  const [titleH, setTitleH] = useState(0);
  const TITLE_BLOCK_H_FALLBACK = Math.round(TITLE_FONT_SIZE * 1.05);
  const effectiveTitleH = titleH > 0 ? titleH : TITLE_BLOCK_H_FALLBACK;
  const TITLE_OVERLAP   = Math.round(effectiveTitleH * 0.05);

  return (
    <View style={{ position: 'absolute', top: 0, bottom: 0, left: OVERLAY_PAD, right: OVERLAY_PAD, justifyContent: 'center', alignItems: 'center' }}>
      <View style={{ width: '100%' }}>
        {/* 머신 목록 — 타이틀의 실제 측정 높이만큼 위쪽에 미리 여백을 비워둔다 */}
        <View style={{ paddingTop: effectiveTitleH - TITLE_OVERLAP }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', rowGap: ROW_GAP, columnGap: ITEM_GAP_H }}>
            {shownExercises.map((ex, i) => (
              <Text key={ex.id} style={{ fontSize: ITEM_FONT_SIZE, color: tc, fontFamily: fontSet.routine }}>
                {`${String(i + 1).padStart(3, '0')} [${ex.brand.toUpperCase()}] ${ex.name.toUpperCase()}`}
              </Text>
            ))}
          </View>
          {exercises.length > 6 && (
            <Text style={{ fontSize: ITEM_FONT_SIZE * 0.85, color: tc, opacity: 0.6, textAlign: 'center', fontFamily: fontSet.routine, marginTop: ROW_GAP }}>
              {`+${exercises.length - 6} more...`}
            </Text>
          )}
        </View>

        {/* "[타겟부위] DAY" — 머신 목록 위로 5% 겹쳐서 오버레이(최상위 레이어) */}
        <Text
          onLayout={(e) => {
            const h = Math.round(e.nativeEvent.layout.height);
            if (h > 0 && h !== titleH) setTitleH(h);
          }}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            fontFamily: fontSet.muscle,
            color: tc,
            textAlign: 'center',
            letterSpacing: -1,
            fontSize: TITLE_FONT_SIZE,
          }}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.05}
        >
          {titleText}
        </Text>
      </View>

      {/* 짐픽 로고 — 화면 최하단 고정이 아니라 머신 목록 바로 아래 */}
      <View style={{ marginTop: 14 }}>
        <GymPickLogo color={tc} width={Math.round(LOGO_STRIP_W * 0.595)} height={Math.round(LOGO_STRIP_H * 0.595)} />
      </View>
    </View>
  );
}

// 2026-09-15 (6차, ROSTER 재조정): 타이틀("[타겟부위] DAY", GLAMOROUS 폰트,
// 20% 확대) → 운동일시 → 머신 목록(순번 001/002/003..., 브랜드는 텍스트,
// 넘치면 항목 단위로 줄바꿈) → 짐픽 로고 순으로 4개 요소를 배치하되, 이 4개
// 요소 전체를 하나의 그룹으로 묶어 시계방향 90도 회전시켜 화면 우측에
// 붙인다. 닉네임은 표시하지 않는다.
// 2026-09-15 (8차, ROSTER 간격/정렬 재조정):
// - 회전 전 좌표계에서 4개 요소를 flexDirection:'row'로 배치해야, 회전 후
//   (시계방향 90도) 화면에서 위→아래 순서(타이틀→운동일시→머신목록→로고)가
//   유지된다는 것을 재확인함. 기존 코드는 실수로 'column'을 사용하고
//   있었는데, 이 경우 회전 후 순서가 아래→위로 뒤집히고 배치축도 어긋나는
//   버그였음 (이미 동작 중인 GridOverlayE의 회전 텍스트가 'row'를 쓰는 것과
//   비교해 확인) — 이번 수정으로 함께 바로잡음.
// - 요소 사이 간격을 확 줄이기 위해 justifyContent를 'space-evenly'
//   (GROUP_LEN 전체에 걸쳐 균등 분산) 대신 'center' + 작은 columnGap으로
//   변경 — 4개 요소가 서로 붙어서 그룹 중앙에 모이게 됨.
// - "우측 정렬"을 위해 교차축 정렬을 alignItems:'flex-start'로 변경. 회전
//   전 좌표계의 교차축 시작점(위쪽)이 회전 후에는 화면의 오른쪽 끝에
//   대응되므로(좌→상, 우→하, 상→우, 하→좌 매핑), 이렇게 하면 각 요소가
//   오른쪽 끝에 밀착된다.
// - GROUP_THICK(교차축 두께, 회전 후 화면의 가로 두께)을 고정값(photoW*0.82)
//   대신 실제 들어가는 요소들(타이틀/머신목록/로고) 중 가장 두꺼운 것을
//   기준으로 계산 — 불필요하게 넓어서 오른쪽 정렬처럼 보이지 않던 문제 해결.
// 2026-09-15 (9차): "[타겟부위]를 제일 우측에 위치"라는 요청을 "4개 요소를
// 각각 독립적으로 회전시켜 가로로 나열"하는 구조로 잘못 해석해 전면
// 재작성했었으나, 사용자가 보내준 실제 목업 이미지를 보고 확인한 결과 그런
// 뜻이 아니었음이 밝혀짐 — 아래 10차 참고.
// 2026-09-15 (10차, 9차 되돌림): 사용자가 보내준 목업 이미지는 타이틀→
// 운동일시→머신목록→로고가 간격 없이 하나로 이어진 "연속된 세로 띠" 형태였음
// (사진을 시계방향 90도로 돌려서 읽으면 왼쪽부터 로고→머신목록→운동일시→
// 타겟부위 순으로 읽혀서, 돌려서 봤을 때 타겟부위가 가장 오른쪽에 오게 됨).
// 즉 "우측"은 4개 요소를 화면에 물리적으로 좌우로 늘어놓으라는 뜻이 아니라,
// (이미 8차에 있던) "하나의 그룹으로 묶어 통째로 회전"시키는 구조를 그대로
// 돌려서 읽었을 때의 순서를 가리킨 것이었음 — 8차 구조가 이미 정확히
// 요청과 일치했던 것. 9차에서 추가했던 RotatedItem 헬퍼와 4-요소-개별-회전
// 구조는 전부 제거하고, 8차의 "하나의 그룹으로 묶어 통째로 회전" 구조로
// 복원함(로직은 8차와 동일 — 아래 참고).
// 2026-09-15 (11차, 겹침/잘림 버그 수정 — 동적 재분배): 10차(=8차) 구조에서
// 타이틀과 머신목록 둘 다에게 maxWidth를 거의 GROUP_LEN 전체(GROUP_LEN - 20)로
// 줬던 것이 원인이 되어, 실제 머신 데이터(이름이 긴 머신 여러 개)가 들어가면
// 타이틀+운동일시+머신목록+로고 4개를 합친 실제 폭이 GROUP_LEN을 넘어버림.
// RN의 flexDirection:'row' 자식은 기본적으로 줄어들지 않으므로(flexShrink
// 기본값 0), 넘친 만큼은 justifyContent:'center' 기준으로 양쪽에 똑같이
// 밀려나다가 바깥 overflow:'hidden' 박스에 잘림 — 회전 때문에 화면에서는
// 이게 위/아래(세로) 잘림으로 보였음(타이틀이 "AY"만 남고 머신목록도 일부만
// 보이는 버그).
//
// 단순히 maxWidth만 나눠주는 것으로는 부족했음: 운동일시(고정 포맷, ~21자)와
// 로고(고정 크기)만 해도 이미 GROUP_LEN의 절반 가까이를 차지해서, 남는 길이를
// 타이틀/머신목록에 아무리 비율로 나눠도 기존 "20% 확대"된 큰 타이틀 폰트가
// 들어갈 자리가 나오지 않음 — 그대로 두면 adjustsFontSizeToFit이 억지로 아주
// 작게 줄여버려 사실상 안 보이게 됨. 그래서 타이틀 "폰트 크기" 자체를 고정값이
// 아니라, 자신에게 배분된 폭(TITLE_MAXW)과 글자 수에서 역산해서 정하도록
// 바꿈 — 머신이 적어 여유가 있으면 원래의 "확대된" 크기에 가깝게, 머신이
// 많아 배분된 폭이 좁아지면 그에 맞춰 작아지되 최소 크기 밑으로는 떨어지지
// 않게 함(가독성 하한선).
//
// 운동일시(고정 포맷이라 글자수로 폭 예측 가능)와 로고(고정 크기)를 먼저 뺀
// 나머지 길이(CONTENT_LEN)를, 타이틀과 머신목록에 "실제 글자 수"(타이틀은
// 폰트가 훨씬 커서 가중치를 높여 계산)에 비례해서 동적으로 나눠줌 — 머신이
// 많거나 이름이 길수록 머신목록 쪽 예산이 커지고, 타겟부위 이름이 길면 타이틀
// 쪽 예산도 늘어남(30%~60% 사이로 클램프). 두 예산의 합은 항상 CONTENT_LEN과
// 정확히 일치하므로, 타이틀은 그 예산에 맞춰 폰트 크기를 역산하고(안전장치로
// adjustsFontSizeToFit도 유지) 머신목록은 flexWrap으로 그 예산 안에서
// 줄바꿈되어 — 4개 요소를 다 더해도 절대 GROUP_LEN을 넘지 않는 것이 계산상
// 보장됨. GROUP_THICK(교차축 두께)도 머신목록이 실제로 몇 줄로 줄바꿈될지
// (GRID_MAXW 기준 추정)와 최종 타이틀 폰트 크기를 반영해서 계산 — 기존엔
// "최대 2줄"과 고정 타이틀 폰트를 가정했었음.
//
// 참고: 이 계산은 실제 렌더링 측정이 아니라 근사치(글자 수 × 평균 글자폭)
// 기반이라, 머신이 많을 때는 타이틀이 기존보다 눈에 띄게 작아질 수 있음 —
// 실제 폰트(GLAMOROUS/My_handwriting 등)의 정확한 글자폭과는 차이가 있을 수
// 있어 실기기 확인 후 배율 조정이 필요할 수 있음.
// 2026-09-16 (12차, 요소 순서 재배치): 실기기 스크린샷 확인 후 "정상 방향으로
// 돌려 읽었을 때 좌측부터 로고 → 머신목록 → 운동일시 → 타겟부위 순서가
// 되도록" 요청받음 — 기존(11차까지) 순서(타이틀→운동일시→머신목록→로고)의
// 정확히 반대. 4개 요소의 렌더링 순서만 로고→머신목록→운동일시→타이틀로
// 뒤집음(각 요소의 폭 배분/폰트 크기 계산 로직은 위치와 무관하므로 그대로
// 유지). "폰트 크기는 이전에 말한대로"라는 요청에 대해서는, 11차에서 이미
// 타이틀 폰트 크기를 "여유 있으면 원래의 20% 확대 크기에 최대한 가깝게,
// 부족할 때만 최소한으로 줄어드는" 방식으로 만들어둔 상태라 — 이 로직이 이미
// "가능하면 원래 크기, 필요할 때만 축소"라는 취지를 만족하고 있다고 보고
// 그대로 유지함(고정 크기로 완전히 되돌리면 머신이 여러 개일 때 11차에서
// 고친 잘림 버그가 재발할 수 있음).
// 2026-09-17 (13차, 타이틀 크기 우선순위 조정): 사용자가 손으로 그린 배치
// 이미지를 픽셀 단위로 확인한 결과, 순서(로고→머신목록→운동일시→타겟부위)는
// 12차와 정확히 일치했지만, 타이틀("[타겟부위] DAY")의 세로 두께가 다른 3개
// 요소보다 훨씬 크게(밴드 전체 두께의 절반 이상) 그려져 있는 것을 확인 —
// "타이틀만 훨씬 크게, 공통 밴드 두께 제약을 깨고" 만들어야 한다는 것을
// AskUserQuestion으로 재확인함. 11차의 "머신 개수에 비례해 타이틀/머신목록
// 예산을 나누는" 방식(titleWeight/gridWeight 비율 분배)은 머신이 많아지면
// 타이틀이 계속 작아지는 구조라 이 요청과 맞지 않아 폐기 — 대신 타이틀을
// 먼저 MAX_TITLE_FONT_SIZE(기존 "20% 확대" 크기) 기준으로 필요한 폭을
// 계산해서 우선 배분하고(TITLE_MAX_RATIO=0.7을 상한으로 둬서 머신목록 공간이
// 0이 되는 극단적 경우만 방지), 머신목록은 남는 길이를 받아 그 안에서
// 줄바꿈되도록 바꿈. 결과적으로 타이틀은 머신 개수와 거의 무관하게 항상 큰
// 크기로 렌더링되고, GROUP_THICK(밴드 두께)은 커진 타이틀에 맞춰 자동으로
// 두꺼워짐 — "공통 두께 제약"이 사라지고 타이틀이 두께를 주도하는 구조가 됨.
// 머신목록이 받는 폭이 줄어들어 줄바꿈이 더 많이 필요해질 수 있어, 줄바꿈
// 추정 상한(rowsNeeded)도 기존 4줄에서 6줄로 늘려 두께 언더추정으로 인한
// 교차축 잘림을 방지함.
// 2026-09-17 (14차, 구조 전면 변경 — 그룹 통째 회전 폐기 → 요소별 개별
// 회전): 13차 반영본 실기기 확인 후 "수정한 레이아웃 출력물은 내가 원하는게
// 아니야"라는 피드백 — "각 요소들을 한번에 묶지 말고" 개별적으로 회전·배치할
// 것을 명시적으로 요청받음(8차부터 유지해온 "4개 요소를 하나의 그룹으로 묶어
// 통째로 회전"하는 구조 자체를 폐기하라는 뜻). 이 개별-회전 구조는 9차에서
// 한 번 시도했다가 "우측" 요청의 의미를 오해한 것으로 밝혀져 10차에서
// 되돌려진 적이 있어(AskUserQuestion으로 "9차와 같은 구조가 맞는지" 재확인),
// 이번엔 사용자가 명시적으로 그 구조를 다시 원한다는 것을 확인 후 진행함.
//
// 구조: 9차 때 쓰던 RotatedItem(len, thick) 헬퍼를 복원 — 각 요소를 감싸는
// "바깥 클리핑 박스(thick×len, 화면에 보일 최종 크기) + 안쪽 콘텐츠 박스
// (len×thick, 회전 전 자연 크기) 90도 회전" 기법을 요소 하나 단위로 적용.
// 최상위 컨테이너는 더 이상 회전시키지 않는 일반 flexDirection:'row' —
// 4개의 RotatedItem을 로고→머신목록→운동일시→타이틀 순서(배열 순서 그대로
// 왼쪽→오른쪽)로 배치하면, 컨테이너 자체가 회전하지 않으므로 이 순서가 곧
// 화면에 보이는 좌→우 순서와 그대로 일치함(타이틀이 가장 오른쪽 — "우측→
// 타겟부위→운동일시→머신목록→로고→좌측" 요청과 일치, 회전 방향을 머릿속으로
// 계산할 필요가 없어져 이전보다 훨씬 직관적).
//
// 가장 큰 이점: 각 요소가 더 이상 하나의 공통 GROUP_THICK을 나눠 쓰지
// 않고 자기 자신의 len/thick을 독립적으로 가짐 — 13차에서 시도했던 "타이틀만
// 크게, 나머지는 작게"가 이제 별도의 트릭(예산 우선순위 계산) 없이 구조적으로
// 자연스럽게 됨: 타이틀은 그냥 항상 MAX_TITLE_FONT_SIZE(20% 확대 크기)로
// 렌더링하고, 그 자연스러운 텍스트 폭(len)을 그대로 쓰면 됨 — 머신 개수나
// 다른 요소 크기와 전혀 무관.
// 14차: 요소 하나를 감싸서 "회전 전 자연 크기(len×thick)"로 렌더링한 뒤
// 화면에는 "회전 후 최종 크기(thick×len)"로 보이도록 시계방향 90도 회전시키는
// 헬퍼 — 9차에서 쓰던 것과 동일한 기법(바깥 클리핑 박스 가운데에 회전 전
// 콘텐츠 박스를 놓고 회전)을 그대로 복원. len=회전 전 폭(=화면상 세로 길이),
// thick=회전 전 높이(=화면상 가로 두께).
// 21차: innerJustify 추가 — 회전 전 박스 안에서 컨텐츠를 세로(top/bottom)로
// 어디에 붙일지 지정하는 옵션(기본값 'center', 기존 동작 그대로 유지).
// 이 세로(top/bottom, = thick) 방향이 회전 후에는 화면의 가로(좌/우, 즉
// row 안에서 옆 요소와의 간격이 생기는 바로 그 축)에 대응된다(90도 시계
// 회전: 회전 전 top→회전 후 right, 회전 전 bottom→회전 후 left — 8차에서
// 검증된 매핑과 동일). TITLE_THICK/TIMESTAMP_THICK 같은 두께 배수는
// 15~16차에서 "옆 요소와 붙어 보이지 않게" 일부러 실제 텍스트 높이보다
// 넉넉하게 잡아둔 여유값인데, 기존엔 이 여유가 justifyContent:'center'로
// 위/아래(=회전 후 좌/우) 양쪽에 똑같이 나뉘어 있었음. 즉 GAP_3를 0으로
// 만들어도 이 내부 여유 때문에 운동일시↔타이틀 사이에 눈에 보이는 공백이
// 남아있었던 것 — 여유 자체를 줄이면(클리핑 위험 재발) 안 되니, 대신
// 운동일시는 여유를 회전 후 왼쪽(로고 쪽, innerJustify='flex-start')으로,
// 타이틀은 여유를 회전 후 오른쪽(사진 바깥쪽, innerJustify='flex-end')으로
// 몰아서 두 요소가 맞닿는 경계 쪽에는 여유가 남지 않도록 재배치함(안전
// 여백 총량은 그대로 유지 — 클리핑 위험 추가 없음).
function RotatedItem({ len, thick, children, style, innerJustify = 'center' }: { len: number; thick: number; children: React.ReactNode; style?: any; innerJustify?: 'center' | 'flex-start' | 'flex-end' }) {
  return (
    <View style={[{ width: thick, height: len, overflow: 'hidden' }, style]}>
      <View
        style={{
          position: 'absolute',
          left: (thick - len) / 2,
          top: (len - thick) / 2,
          width: len,
          height: thick,
          transform: [{ rotate: '90deg' }],
          alignItems: 'center',
          justifyContent: innerJustify,
        }}
      >
        {children}
      </View>
    </View>
  );
}

// 2026-09-17 (15차, 14차 실기기 확인 후 3건): ① 머신목록이 운동일시 쪽으로
// 붙어 잘려 보이는 문제, ② 타겟부위 글자 수와 무관하게 타이틀이 항상 밴드
// 상하단(GROUP_LEN)에 꽉 차도록, ③ 머신목록이 한 줄에 한 개씩만 나오는 문제
// (잘리지 않는 선에서 최대한 여러 개씩 배치)에 대한 수정.
//
// 원인: (a) 머신목록 줄바꿈 추정을 "평균 글자수" 기반으로 계산했는데, 실제
// 머신명은 길이 편차가 커서 평균값이 실제 배치와 어긋났고, 줄 높이도
// 1.25배로 가정했지만 실제 폰트(Leorio 등)의 줄 간격이 이보다 커서 두께가
// 과소 추정됨 — 그 결과 GRID_THICK이 실제 필요한 두께보다 작게 계산돼
// 바로 옆(운동일시) 쪽 여백이 부족해 붙어 보임. (b) 줄바꿈 폭 예산
// (GRID_WRAP_LEN)이 photoH*0.4 정도로 좁아서, 웬만큼 짧은 머신명도 두 개가
// 한 줄에 못 들어가고 거의 항상 1개씩만 배치됐음. (c) 타이틀은 자기 폰트
// 크기(TITLE_FONT_SIZE, 고정 "20% 확대" 값) 기준 자연 폭만 썼기 때문에
// 타겟부위 글자 수(8~13자)에 따라 실제 길이가 들쭉날쭉했음.
//
// 수정:
// - 머신목록 줄바꿈 폭 예산을 GROUP_LEN의 70%(이전 photoH*0.4보다 훨씬
//   넉넉함)로 키우고, "평균 글자수 추정" 대신 각 항목을 실제 순서대로 왼쪽
//   부터 채우다 넘치면 다음 줄로 넘기는 그리디 packing(packGridLines,
//   React Native flexWrap의 실제 동작과 동일한 방식)으로 몇 줄이 필요한지
//   정확히 계산 — 짧은 머신명 여러 개는 자연스럽게 한 줄에 같이 들어가고,
//   실제 렌더링(flexWrap)도 같은 폭 예산을 쓰므로 추정과 실제가 거의 일치함.
// - 줄 높이 가정을 1.25배 → 1.45배로 늘려 실제 폰트 줄간격과의 오차 여유를
//   더 두고, 4개 요소 사이 간격(GROUP_GAP)도 2% → 2.5%, 운동일시 두께
//   배수도 1.4 → 1.6으로 소폭 늘려 인접 요소끼리 붙어 보이지 않게 함.
// - 타이틀은 더 이상 "자기 폰트 크기 기준 자연 폭"이 아니라, 밴드 전체 길이
//   (GROUP_LEN)를 목표 길이로 두고 글자 수로 나눠 필요한 폰트 크기를
//   역산(짧은 라벨일수록 폰트가 커지고, 긴 라벨일수록 작아지되 항상 같은
//   물리적 길이를 채움) — MIN/MAX_TITLE_FONT_SIZE는 실제 라벨 범위(8~13자)
//   에서는 거의 걸리지 않는 안전장치용 상/하한선.
//
// Node.js 시뮬레이션 검증: photoW=1179, photoH=round(1179*4/3)=1572
// (photoH는 실제 코드의 photoH = Math.round(PHOTO_W*4/3) 공식을 그대로 사용)
// 기준으로 7개 타겟부위 라벨 × 머신 개수(1/3/6) 21개 조합을 모두 확인 —
// 최악의 경우(BACK/LEGS/ARMS DAY처럼 짧은 라벨 + 머신 6개)에도 4개 요소
// 두께 합이 photoW의 약 62%(736/1179)에 그쳐 여유 있게 들어옴. 실기기 확인
// 아직 안 함 — 사용자가 실제 화면으로 다시 확인 필요.
function packGridLines(strings: string[], lineWidth: number, itemFontSize: number, gap: number): string[][] {
  const lines: string[][] = [];
  let current: string[] = [];
  let currentWidth = 0;
  for (const s of strings) {
    const w = s.length * itemFontSize * 0.62;
    const needed = current.length === 0 ? w : currentWidth + gap + w;
    if (current.length === 0 || needed <= lineWidth) {
      current.push(s);
      currentWidth = needed;
    } else {
      lines.push(current);
      current = [s];
      currentWidth = w;
    }
  }
  if (current.length > 0) lines.push(current);
  return lines;
}

export function RosterOverlay({ exercises, logs, nickname, timestamp, muscleLabel, tc, photoW, photoH, fontSet }: OverlayProps & { fontSet: FontSet }) {
  const pureLabel = muscleLabel.replace(/_?day$/i, '').replace(/\s*day$/i, '').trim() || muscleLabel;
  const titleText = `${pureLabel} DAY`;
  const shownExercises = exercises.slice(0, 6);
  const hasMore = exercises.length > 6;

  const ITEM_FONT_SIZE      = Math.round(photoW * 0.032 * 0.8); // 20% 축소
  const TIMESTAMP_FONT_SIZE = Math.round(12 * 1.2); // 19차: 20% 확대 요청(12→14)
  const ROW_GAP             = 5;                                 // 기존 10의 50%
  const ITEM_GAP_H          = Math.round(ITEM_FONT_SIZE * 1.3);
  const LOGO_W              = Math.round(LOGO_STRIP_W * 0.595);
  const LOGO_H              = Math.round(LOGO_STRIP_H * 0.595);

  // 16차: 15차에서 타이틀이 양끝("C"/"Y")이 잘려 보이던 원인은 이 폰트의
  // 실제 글자 폭이 TITLE_CHAR_W_RATIO(0.6)로 추정한 것보다 넓어서 —
  // "글자수 × 비율"로 역산한 폰트 크기가 실제보다 크게 나왔고, 그 결과 실제
  // 렌더링 폭이 선언한 박스(TITLE_LEN)를 넘어섰기 때문(adjustsFontSizeToFit이
  // 이 중첩 회전 구조에서 안정적으로 줄여주지 않음). 같은 이유로 운동일시도
  // TIMESTAMP_CHAR_W_RATIO(기존 0.55)가 과소추정되어 "..." 로 잘림 —
  // 두 증상이 같은 근본 원인(글자폭 비율 과소추정)을 뒷받침. 비율을 올리고,
  // 목표 길이도 100%가 아닌 92%(TITLE_FILL_RATIO)로 잡아 안전 여유를 둠.
  // 17차: 16차까지도 타이틀이 여전히 카드 위/아래 바깥으로 심하게 넘치는
  // 문제가 재발 — 원인은 MIN/MAX_TITLE_FONT_SIZE를 photoW=1179라는 잘못된
  // 가정(13차 때의 교차검증 오류)을 기준으로 고정 절대값(120~280)으로 정해둔
  // 것이었음. 실기기 스크린샷을 픽셀 단위로 직접 측정해보니 실제 카드
  // 폭(테두리 기준)은 화면 배율(3x)을 감안하면 약 361pt(=SCREEN_W-32,
  // iPhone 기준 393-32)로, 지금까지 가정해온 1179보다 약 3.27배 작음 —
  // 즉 photoW=1179는 애초에 틀린 값이었음. 이 잘못된 가정 때문에
  // GROUP_LEN도 실제보다 훨씬 크다고 착각했고, 그 결과 "채움 목표 길이에서
  // 역산한 폰트 크기"가 실제로는 아주 작게(약 40~65) 나와야 정상인데,
  // MIN_TITLE_FONT_SIZE=120이 그보다 훨씬 커서 MIN 쪽으로 강제로 끌어
  // 올려지며 실제 사용 가능한 공간(GROUP_LEN≈441)의 거의 2배에 달하는
  // 크기로 렌더링돼 카드 위/아래 바깥까지 넘친 것 — 15차 때와 16차 때
  // 서로 다른 비율(TITLE_CHAR_W_RATIO)을 썼는데도 똑같이 잘렸던 이유가
  // 바로 이 MIN 클램프였음(비율을 아무리 바꿔도 클램프가 항상 이겼음).
  // 수정: 다른 요소들(ITEM_FONT_SIZE, GROUP_GAP 등)처럼 MIN/MAX도 고정
  // 절대값이 아니라 photoW에 비례한 값으로 바꿔, 실제 기기 폭이 얼마든
  // (이번처럼 361이든, 이전에 착각했던 1179든) 항상 올바른 비율로
  // 스케일되게 함 — 특정 기기 폭을 추측해서 하드코딩하는 근본 문제 자체를
  // 없앰.
  const TITLE_CHAR_W_RATIO  = 0.78; // 16차 값 유지(글자 폭 비율 자체는 문제 없었음)
  const TITLE_FILL_RATIO    = 0.92; // 16차 값 유지
  const MIN_TITLE_FONT_SIZE = Math.round(photoW * 0.09); // 120(고정) → photoW 비례
  const MAX_TITLE_FONT_SIZE = Math.round(photoW * 0.30); // 280(고정) → photoW 비례

  // 목표 길이 — 사진 세로 길이에서 상하 여백(OVERLAY_PAD)만 뺀, 밴드가
  // 실제로 채울 수 있는 최대 길이. 타이틀은 이 값의 TITLE_FILL_RATIO만큼 채움(16차).
  const GROUP_LEN = photoH - OVERLAY_PAD * 2;

  // 16차: 기존엔 4개 요소 사이 간격이 전부 GROUP_GAP 하나로 동일했으나,
  // "타이틀-운동일시 사이만 좁혀달라"는 요청에 맞춰 쌍(pair)별로 독립된
  // 간격을 둠. 17차: 이번엔 "타이틀/운동일시/머신목록/로고 사이 간격을
  // 전부 더 줄여달라"는 요청 — GRID_THICK은 이미 정확한 줄바꿈 계산
  // (packGridLines)으로 안전하게 산출되고 있어(15차), 겹침 방지용
  // 여백(GAP_2)을 조금 줄여도 실제 겹침 위험은 낮음. 세 간격 모두 비율을
  // 낮춰 더 촘촘하게 배치.
  // 18차: 17차(photoW 스케일 수정)로 잘림 문제가 해소된 뒤, "간격을 더
  // 줄여달라"는 요청이 다시 와서 세 간격 모두 추가로 절반 수준까지 축소.
  // GRID_THICK은 15차의 정확한 그리디 packing으로 이미 안전하게 계산되고
  // 있어(줄바꿈 자체가 실제 폭 기준이라 여유가 있음), 간격을 줄여도 겹침
  // 재발 위험은 낮음.
  // 19차: "타이틀-운동일시, 운동일시-머신목록 사이만 더 줄여달라"는 요청 —
  // 로고→머신목록 간격(GAP_1)은 이번 요청 범위 밖이라 그대로 유지, GAP_2는
  // 더 축소, GAP_3(운동일시→타이틀)는 거의 맞닿을 정도로 0에 가깝게 축소.
  // 20차: "간격을 지금보다 50% 더 줄여달라"는 요청 — GAP_2를 다시 절반으로
  // 축소(0.005→0.0025). GAP_3는 19차에 이미 0(완전히 맞닿은 상태)이라 이
  // 이상 물리적으로 더 줄일 여지가 없어 그대로 유지(사용자에게 별도 안내 필요).
  const GAP_1 = Math.round(photoW * 0.01);   // 로고 → 머신목록 (18차 값 유지)
  const GAP_2 = Math.round(photoW * 0.0025); // 머신목록 → 운동일시 (20차: 0.005→0.0025 추가 축소)
  const GAP_3 = 0;                            // 운동일시 → 타이틀 (19차부터 0 — 더 줄일 수 없음)

  const gridItemStrings = shownExercises.map((ex, i) => `${String(i + 1).padStart(3, '0')} [${ex.brand.toUpperCase()}] ${ex.name.toUpperCase()}`);
  const moreText = hasMore ? `+${exercises.length - 6} more...` : '';
  const allGridStrings = hasMore ? [...gridItemStrings, moreText] : gridItemStrings;

  // --- 로고: 회전 전 자연 크기 그대로 ---
  const LOGO_LEN   = LOGO_W;
  const LOGO_THICK = LOGO_H;

  // --- 운동일시: 고정 포맷(21자)이라 폭 예측 가능 — 15차: 두께 배수를
  // 1.4→1.6으로 늘려 옆 요소와 붙어 보이지 않게 여유를 둠. 16차: 실제
  // 폰트 폭이 0.55 비율보다 넓어 "..." 로 잘리던 문제를 고쳐 전체 출력되게 함
  // (비율 0.55→0.65, 여유 패딩 +6→+14) ---
  const TIMESTAMP_CHAR_W_RATIO = 0.65; // 0.55 → 0.65(16차)
  // 19차: 폰트가 커진 만큼 글자폭 과소추정 오차도 비례해서 커지므로, 여유
  // 패딩(16차에 도입한 +14)도 폰트 확대 비율(1.2배)만큼 같이 늘려 잘림
  // 재발을 예방(14 → 17).
  const TIMESTAMP_LEN   = Math.round(timestamp.length * TIMESTAMP_FONT_SIZE * TIMESTAMP_CHAR_W_RATIO) + Math.round(14 * 1.2);
  const TIMESTAMP_THICK = Math.round(TIMESTAMP_FONT_SIZE * 1.6);

  // --- 머신목록(15차 재작성): 줄바꿈 폭 예산(GRID_WRAP_LEN)을 GROUP_LEN의
  // 70%로 넉넉하게 잡고(이전 photoH*0.4보다 훨씬 큼 — 짧은 머신명 여러 개가
  // 한 줄에 같이 들어갈 여지를 줌), "평균 글자수" 추정이 아니라 실제 항목을
  // 순서대로 채우다 넘치면 다음 줄로 넘기는 그리디 packing(packGridLines)으로
  // 몇 줄이 필요한지 정확히 계산 — 실제 렌더링(flexWrap)도 같은 폭 예산을
  // 쓰므로 추정과 실제 줄 수가 거의 일치함. 줄 높이 배수도 1.25→1.45로 늘려
  // 실제 폰트 줄간격 오차에 대한 여유를 더 둠(두께 과소추정이 인접 요소와
  // 붙어 보이던 문제의 주 원인이었음).
  // 20차: "첫 줄만 2개, 그 다음부터는 한 줄에 1개씩만 나오는 게 줄바꿈
  // 조건이 첫 줄에만 적용되는 버그인지" 질문 — 조사 결과 그런 특수 로직은
  // 코드에 없음(순수 RN flexWrap, 줄 위치와 무관하게 동일한 폭 예산으로 동작).
  // 실측 photoW(361) 기준 GROUP_LEN*0.7≈309인데, 실제 머신명 길이(9pt 폰트
  // 기준 약 128~195pt)가 이 예산에 비해 빠듯해서 가장 짧은 두 개만 우연히
  // 한 줄에 들어가고 나머지는 각각 한 줄씩 차지했던 것 — 그리디 packing이
  // 의도대로 정확히 동작한 결과이지 버그가 아님. 예산을 GROUP_LEN*0.9로
  // 넓히면 GRID_LEN(397)이 여전히 GROUP_LEN(441) 안에 안전하게 들어오면서,
  // 시뮬레이션상 필요한 줄 수가 줄고(예: 5줄→3줄) GRID_THICK도 함께
  // 작아지는(85→49) 순수 개선이라 이 비율로 확장.
  const GRID_WRAP_LEN = Math.round(GROUP_LEN * 0.9);
  const gridLines     = packGridLines(allGridStrings, GRID_WRAP_LEN, ITEM_FONT_SIZE, ITEM_GAP_H);
  const rowsNeeded    = Math.max(1, gridLines.length);
  const GRID_LEN      = GRID_WRAP_LEN;
  const GRID_THICK    = Math.round(rowsNeeded * ITEM_FONT_SIZE * 1.45 + (rowsNeeded - 1) * ROW_GAP);

  // --- 타이틀(16차): 타겟부위 글자 수와 무관하게 항상 밴드 길이의
  // TITLE_FILL_RATIO(92%)만큼 채우도록 폰트 크기를 역산 — 라벨이 짧을수록
  // (BACK/LEGS/ARMS DAY 등) 폰트가 커지고, 길수록(SHOULDERS DAY) 작아지되
  // 항상 같은 물리적 길이를 채움. 16차: 글자폭 비율을 0.78로 올리고 목표를
  // 100%→92%로 낮춰, 실제 렌더링 폭이 박스를 넘어 양끝이 잘리던 문제를 해결.
  // 두께 배수도 1.25→1.35로 늘려 실제 줄 높이에 대한 여유를 더 둠.
  const TITLE_TARGET_LEN = Math.round(GROUP_LEN * TITLE_FILL_RATIO);
  const titleFontRaw    = TITLE_TARGET_LEN / (titleText.length * TITLE_CHAR_W_RATIO);
  const TITLE_FONT_SIZE = Math.round(Math.min(MAX_TITLE_FONT_SIZE, Math.max(MIN_TITLE_FONT_SIZE, titleFontRaw)));
  const TITLE_LEN       = Math.round(titleText.length * TITLE_FONT_SIZE * TITLE_CHAR_W_RATIO);
  const TITLE_THICK     = Math.round(TITLE_FONT_SIZE * 1.35);

  return (
    <View
      style={{
        position: 'absolute',
        // 16차: 타이틀(가장 오른쪽 요소)이 사진 우측 끝에 더 가깝게 붙도록
        // 밴드 전체를 오른쪽으로 당김. 17차: "더 우측으로" 요청이 다시 와서
        // 추가로 더 줄임 — 16차 시점엔 MIN_TITLE_FONT_SIZE 버그로 타이틀
        // 박스 자체가 실제보다 훨씬 두꺼워서(TITLE_THICK 과대) 시각적으로
        // 여백이 커 보였던 것도 있었지만, 그 버그를 고친 뒤에도 여전히
        // 더 붙여달라는 요청이므로 배율을 추가로 낮춤.
        right: Math.round(OVERLAY_PAD * 0.1),
        top: 0,
        bottom: 0,
        flexDirection: 'row',
        alignItems: 'center',
      }}
    >
      {/* 1) 짐픽 로고 — 14차: 컨테이너 자체는 회전하지 않으므로, 배열 순서가
          곧 화면에 보이는 좌→우 순서. */}
      <RotatedItem len={LOGO_LEN} thick={LOGO_THICK}>
        <GymPickLogo color={tc} width={LOGO_LEN} height={LOGO_THICK} />
      </RotatedItem>

      {/* 2) 머신 목록 — 순번 + "[브랜드] 머신명" 텍스트, GRID_LEN 폭 안에서
          넘치면 항목 단위로 줄바꿈. 16차: 로고와의 간격은 GAP_1(독립 마진)로 관리 */}
      <RotatedItem len={GRID_LEN} thick={GRID_THICK} style={{ marginLeft: GAP_1 }}>
        <View style={{ width: GRID_LEN, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', rowGap: ROW_GAP, columnGap: ITEM_GAP_H }}>
          {shownExercises.map((ex, i) => (
            <Text key={ex.id} style={{ fontSize: ITEM_FONT_SIZE, color: tc, fontFamily: fontSet.routine }}>
              {gridItemStrings[i]}
            </Text>
          ))}
          {hasMore && (
            <Text style={{ fontSize: ITEM_FONT_SIZE * 0.85, color: tc, opacity: 0.6, fontFamily: fontSet.routine }}>
              {moreText}
            </Text>
          )}
        </View>
      </RotatedItem>

      {/* 3) 운동일시 — 고정 포맷이라 폭 고정(TIMESTAMP_LEN). 16차: 머신목록과의
          간격은 GAP_2(15차 값 유지, 겹침 방지). 21차: innerJustify='flex-start'로
          두께 여유를 로고 쪽에 몰아, 타이틀과 맞닿는 경계 쪽 여백을 최소화 */}
      <RotatedItem len={TIMESTAMP_LEN} thick={TIMESTAMP_THICK} style={{ marginLeft: GAP_2 }} innerJustify="flex-start">
        <Text
          style={{ fontSize: TIMESTAMP_FONT_SIZE, color: tc, opacity: 0.85, fontFamily: fontSet.nickname, width: TIMESTAMP_LEN }}
          numberOfLines={1}
        >
          {timestamp}
        </Text>
      </RotatedItem>

      {/* 4) "[타겟부위] DAY" — 15차: 글자 수와 무관하게 항상 밴드 전체 길이를
          채우도록 폰트 크기를 역산(TITLE_FONT_SIZE). 다른 요소와 두께를
          공유하지 않음(가장 오른쪽 = 요청한 "우측에 타겟부위"). 16차: 운동일시와의
          간격만 GAP_3로 축소(요청사항 — 겹치지 않는 선에서 좁힘). 21차:
          GAP_3가 이미 0이라 더 줄일 수 없어, innerJustify='flex-end'로 두께
          여유를 사진 바깥쪽(오른쪽)으로 몰아 운동일시와 맞닿는 경계의 여백을
          최소화(안전 여백 총량은 그대로, 위치만 반대편으로 이동). */}
      <RotatedItem len={TITLE_LEN} thick={TITLE_THICK} style={{ marginLeft: GAP_3 }} innerJustify="flex-end">
        <Text
          style={{
            fontFamily: fontSet.muscle,
            color: tc,
            textAlign: 'center',
            letterSpacing: -1,
            fontSize: TITLE_FONT_SIZE,
            width: TITLE_LEN,
          }}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.3}
        >
          {titleText}
        </Text>
      </RotatedItem>
    </View>
  );
}

// --- Step 5: Photo

function WorkoutPhotoStep({ gym, exercises, selectedMuscles, logs, photoTaken, photoUri, nickname, fontsLoaded, onColorChange, onStyleChange, onCapture, onCompositeUri, onRoutineCardUri, onSave, onBack, onClose, onCameraCapture, showCamera, onSetShowCamera, onRegisterRect, onboardingActive, onboardingKey, onOnboardingNext, onOnboardingJump }: {
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
  // 2026-09-03: 이 컴포넌트 로컬 state인 overlayStyle을 부모(PostWorkoutLogModal)의
  // handleSaveWorkout에서도 DB 저장용으로 알아야 해서, onColorChange와 동일한
  // 패턴으로 위로 끌어올린다 — 저장 시점엔 이 콜백으로 부모에 마지막으로 전달된
  // 값을 쓴다 (부모가 직접 이 컴포넌트의 로컬 state를 참조할 수 없기 때문).
  onStyleChange: (style: OverlayStyle) => void;
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
      Alert.alert('저장 완료', '오버레이 이미지 저장되었습니다.\n앱에서 이미지를 영상 위에 올려서 사용하시면되요!');
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
  // 21차: "POSTER(F), ROSTER(G)도 MAGAZINE(E)과 동일하게 테두리선 없애달라"는
  // 요청으로 테두리선 제외 대상에 f/g를 추가. 모서리 둥글기(borderRadius)는
  // 요청 범위 밖이라 그대로 유지 — 테두리 "선"만 없앰. 이 목록은 사진
  // 오버레이 미리보기와 '오버레이만 저장' 캡처 뷰 양쪽에서 동일하게 재사용된다
  // (두 곳 모두 같은 조건을 쓰므로, 여기 하나만 바꾸면 저장 결과도 자동으로
  // 테두리 없이 나옴).
  const NO_BORDER_LAYOUTS = ['e', 'f', 'g'];
  // 레이아웃/폰트 세로 피커 두 축을 독립적으로 다루기 위해 현재 폰트 번호도 미리 계산.
  const currentFontNum    = getFontSetNumber(overlayStyle);

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

    // 유형 F: PosterOverlay (My_handwriting 타이틀 + Leorio 2열 루틴 그리드, 브랜드 로고)
    if (layout === 'f') {
      return (
        <PosterOverlay
          {...commonProps}
          fontSet={fs}
        />
      );
    }

    // 유형 G: RosterOverlay (GLAMOROUS 타이틀 + Leorio 2열 그리드, 순번 001/002/003...)
    if (layout === 'g') {
      return (
        <RosterOverlay
          {...commonProps}
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

            {/* 테두리: overflow 클리핑 이후 absolute로 덮어 빈공간 방지
                (21차: E/F/G는 테두리선 없는 디자인이라 생략 — NO_BORDER_LAYOUTS 참고) */}
            {!NO_BORDER_LAYOUTS.includes(currentLayoutType) && (
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
              {/* 21차: 사진 오버레이의 NO_BORDER_LAYOUTS 조건과 동일 — POSTER/ROSTER도
                  이 '오버레이만 저장' 캡처본에서 테두리선 없이 저장됨 */}
              {!NO_BORDER_LAYOUTS.includes(currentLayoutType) && (
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
          {/* 2026-09-04: 레이아웃/폰트/색상 — 각각 독립된 세로 스크롤 휠 피커 3개를
              한 줄에 나란히 배치. 예전엔 폰트세트×레이아웃 조합 15개를 한 줄
              가로 스크롤에 다 펼쳐놓았는데, 두 축을 분리해서 각자 고르면
              composeOverlayStyle()로 다시 합치는 방식으로 변경. */}
          <View style={{ flexDirection: 'row', alignItems: 'stretch', gap: 10, marginBottom: 16 }}>
            <View
              ref={overlayStyleRef}
              style={{ flex: 2, flexDirection: 'row', alignItems: 'stretch', gap: 10 }}
              onLayout={() => {
                if (onboardingActive && onboardingKey === 'photo-overlay') {
                  overlayStyleRef.current?.measureInWindow((x, y, width, height) => {
                    onRegisterRect?.('photo-overlay', { x, y, width, height });
                  });
                }
              }}
            >
              {/* 레이아웃 */}
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 10, fontWeight: '700', color: C.textSub, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6, paddingHorizontal: 2, textAlign: 'center' }}>
                  레이아웃
                </Text>
                <VerticalWheelPicker
                  itemHeight={36}
                  selectedKey={currentLayoutType}
                  onChange={(layoutKey) => {
                    const next = composeOverlayStyle(currentFontNum, layoutKey);
                    setOverlayStyle(next);
                    onStyleChange(next);
                  }}
                  items={LAYOUT_TYPE_OPTIONS.map(opt => ({
                    key: opt.key,
                    render: (active: boolean) => (
                      <Text style={{ fontSize: active ? 16 : 13, fontWeight: active ? '800' : '600', color: active ? textColor : C.textSub }}>
                        {opt.label}
                      </Text>
                    ),
                  }))}
                />
              </View>

              {/* 구분선: 레이아웃 | 폰트 */}
              <View style={{ width: 1, backgroundColor: C.border }} />

              {/* 폰트 */}
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 10, fontWeight: '700', color: C.textSub, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6, paddingHorizontal: 2, textAlign: 'center' }}>
                  폰트
                </Text>
                <VerticalWheelPicker
                  itemHeight={36}
                  selectedKey={currentFontNum}
                  onChange={(fontNum) => {
                    const next = composeOverlayStyle(fontNum, currentLayoutType);
                    setOverlayStyle(next);
                    onStyleChange(next);
                  }}
                  items={FONT_SET_NUMBERS.map(num => ({
                    key: num,
                    render: (active: boolean) => (
                      <Text style={{ fontSize: active ? 20 : 14, color: active ? textColor : C.textSub, fontFamily: FONT_SETS[num].muscle }}>
                        DAY
                      </Text>
                    ),
                  }))}
                />
              </View>
            </View>

            {/* 구분선: (레이아웃·폰트) | 색상 */}
            <View style={{ width: 1, backgroundColor: C.border }} />

            {/* 텍스트 색상 */}
            <View
              ref={colorChipRef}
              style={{ flex: 1 }}
              onLayout={() => {
                if (onboardingActive && onboardingKey === 'photo-color') {
                  colorChipRef.current?.measureInWindow((x, y, width, height) => {
                    onRegisterRect?.('photo-color', { x, y, width, height });
                  });
                }
              }}
            >
              <Text style={{ fontSize: 10, fontWeight: '700', color: C.textSub, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6, paddingHorizontal: 2, textAlign: 'center' }}>
                색상
              </Text>
              <VerticalWheelPicker
                itemHeight={36}
                selectedKey={textColor}
                onChange={(hex) => { setTextColor(hex); onColorChange(hex); }}
                items={TEXT_COLORS.map(opt => ({
                  key: opt.hex,
                  render: (active: boolean) => (
                    <View
                      style={[
                        s.colorChip,
                        { backgroundColor: opt.hex },
                        active && s.colorChipActive,
                      ]}
                    />
                  ),
                }))}
              />
            </View>
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

        {/* 2026-10-20: 공개 여부 토글 제거 — 기본 공개, 운동일지에서 비공개 전환 */}
        <OunwanVisibilityNote />

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
    'My_handwriting':           require('../../../assets/fonts/my_handwriting.ttf'),
    'Leorio':                   require('../../../assets/fonts/leorio.ttf'),
    'GLAMOROUS':                require('../../../assets/fonts/glamorous.otf'),
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
  // WorkoutPhotoStep(자식)의 로컬 overlayStyle state를 onStyleChange로 그대로
  // 미러링한 값 — handleSaveWorkout(이 컴포넌트 스코프)에서 DB 저장 시 사용한다.
  // WorkoutPhotoStep의 기본값('s1a')과 동일하게 초기화해서, 사용자가 스타일을
  // 한 번도 안 바꿔도 기본 스타일 값이 저장되게 한다.
  const [overlayStyle,       setOverlayStyle]       = useState<OverlayStyle>('s1a');
  const [isSaving,           setIsSaving]           = useState(false);
  const [savingProgress,     setSavingProgress]     = useState(0);
  const savingAnim = useRef(new Animated.Value(0)).current;

  // 2026-09-09: 운동일지 작성 퍼널(어느 단계에서 이탈이 많은지) 추적용.
  // 헬스장선택→부위선택→루틴선택→머신선택→세트입력→사진, 6단계 각각을
  // 이 모달이 열려있는 동안(=세션 한 번) 최초 1회만 기록한다. 여러 머신을
  // 오가며 세트입력을 반복해도 flow_machine/flow_setinput이 중복 집계되지
  // 않도록 막아서, "이 세션이 이 단계까지 도달했는가"를 정확히 볼 수 있게 함.
  const funnelTrackedStages = useRef<Set<string>>(new Set());
  function trackFunnelStage(stage: string, props: Record<string, any> = {}) {
    if (funnelTrackedStages.current.has(stage)) return;
    funnelTrackedStages.current.add(stage);
    track(stage, props);
  }
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
  // date 외 weight/reps도 같이 들고 있어야 handleAddSet에서 "첫 세트 추가 시"
  // 프리필(마지막 사용 무게/횟수)을 적용할 수 있다 (2026-09-03: 빈 화면 시작으로 변경하며 추가).
  const [prefillInfo, setPrefillInfo] = useState<Record<string, { date: string; weight: number; reps: number } | null>>({});
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
    trackFunnelStage('flow_gym', { gym_id: g.id });
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
  // 2026-09-05: "머신 선택 → 세트 입력하기" 진입 시 세트 1이 곧바로 채워져
  // 있던 이전 방식으로 되돌림 — "세트 추가"를 한 번 더 눌러야 하는 게 불편하다는
  // 피드백. 마지막 사용 무게/횟수(prefillInfo)가 있으면 그 값으로, 없으면
  // 기존 기본값(60kg x 10회)으로 세트 1을 미리 채워서 진입시킨다.
  function openNewSlot(machineId: string, slotKey: string, isFirstSlot: boolean) {
    trackFunnelStage('flow_setinput');
    const last = isFirstSlot ? findLastFirstSet(machineId) : null;
    const seed: SetEntry = last ? { weight: last.weight, reps: last.reps } : { weight: 60, reps: 10 };
    setCurrentExerciseId(slotKey);
    setLogs(prev => ({
      ...prev,
      [slotKey]: prev[slotKey] ?? [seed],
    }));
    setPrefillInfo(prev => ({
      ...prev,
      [slotKey]: prev[slotKey] !== undefined ? prev[slotKey] : (last ? { date: last.date, weight: last.weight, reps: last.reps } : null),
    }));
    setStep('log-sets');
  }

  function handleSelectExercise(id: string) {
    if (loggedIds.size === 0) trackFunnelStage('flow_machine', { machine_id: id });
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
    setLogs(prev => {
      const existing = prev[id] ?? [];
      if (existing.length === 0) {
        // 화면에 세트가 하나도 없는 상태에서 처음 추가하는 세트 — 마지막 사용
        // 무게/횟수가 있으면(prefillInfo) 그 값으로, 없으면 기존 기본값(60kg x 10회)으로 채운다.
        const pf   = prefillInfo[id];
        const seed = pf ? { weight: pf.weight, reps: pf.reps } : { weight: 60, reps: 10 };
        return { ...prev, [id]: [seed] };
      }
      return { ...prev, [id]: [...existing, { weight: 0, reps: 10 }] };
    });
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

    // 2026-09-03: 이 아래 저장 로직 전체를 try/catch/finally + 타임아웃으로 감쌈 —
    // 예전엔 이 블록 안에서 뭔가 예상 못한 이유로 멈추거나(캐치 안 되는 에러,
    // 또는 응답이 영영 안 오는 네트워크 요청) 실패하면 setIsSaving(false)가
    // 함수 맨 끝(정상 종료 경로)에만 있어서 로딩화면이 영원히 안 꺼지는 문제가
    // 있었음. Promise.race로 25초 타임아웃을 둬서, 실제 요청이 응답 없이 걸려
    // 있어도(진짜 hang) UI는 반드시 풀리도록 하고, finally로 항상 로딩화면을
    // 끄고, catch로 실패를 사용자에게 알려서 다시 시도할 수 있게 한다.
    try {
      await Promise.race([
        (async () => {
    const effectiveCompositeUri = passedCompositeUri ?? compositeUri;
    const sessionId = `local-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const supabaseConfigured = !!(process.env.EXPO_PUBLIC_SUPABASE_URL);
    const nowIso = new Date().toISOString();

    // 2026-10-07 (저장 지연 개선, 1/2): 사진 업로드와 DB 저장(세션/운동/세트)은
    // 서로 데이터를 주고받지 않는 독립된 작업인데, 기존엔 사진 업로드가 끝나야
    // DB 저장을 시작해서 두 작업의 네트워크 왕복 시간이 그대로 더해졌다.
    // Promise.all로 동시에 실행해 전체 저장 시간을 줄인다 — 최종적으로
    // 저장되는 데이터/조건은 기존과 동일하고, 두 작업이 모두 끝나야 다음
    // 단계로 넘어가는 흐름도 그대로 유지된다.
    const [photoUpload, dbWrite] = await Promise.all([
      (async () => {
        // 사진 업로드 (Supabase Storage)
        let finalPhotoUrl: string | undefined;
        let finalThumbnailUrl: string | undefined;
        let finalBlurhash: string | undefined;
        if (effectiveCompositeUri && user && supabaseConfigured) {
          const uploaded = await uploadWorkoutPhoto(effectiveCompositeUri, user.id, sessionId, true);
          finalPhotoUrl     = uploaded.url;
          finalThumbnailUrl = uploaded.thumbnailUrl;
          finalBlurhash     = uploaded.blurhash;
        } else if (photoUri && user && supabaseConfigured) {
          const uploaded = await uploadWorkoutPhoto(photoUri, user.id, sessionId, false);
          finalPhotoUrl     = uploaded.url;
          finalThumbnailUrl = uploaded.thumbnailUrl;
          finalBlurhash     = uploaded.blurhash;
        }
        return { finalPhotoUrl, finalThumbnailUrl, finalBlurhash };
      })(),
      (async () => {
        // Supabase DB에 저장 (실패해도 로컬 저장은 유지)
        if (!(user && supabaseConfigured)) return { dbSessionId: undefined as string | undefined };
        try {
          const savedSession = await insertWorkoutSession({
            id:               sessionId,
            userId:           user.id,
            gymId:            gym.id,
            date:             nowIso,
            overlayTextColor: selectedColor,
            targetMuscles:    Array.from(selectedMuscles).map(toCanonMuscle),
          });

          // 2026-10-07 (저장 지연 개선, 2/2): 운동(entry)마다, 세트(set)마다
          // 한 건씩 await하며 순차로 insert하던 것을(운동 6개×세트 3개면
          // 최대 24회 네트워크 왕복) entries 전체를 한 번, sets 전체를 한
          // 번, 총 2회의 배치 insert로 모아 보내도록 변경 — 저장되는
          // 행/컬럼/값은 기존과 완전히 동일하고 왕복 횟수만 줄어든다.
          const entryIds = selectedExercises.map((_, i) => `entry-${Date.now()}-${i}`);
          await insertWorkoutEntries(selectedExercises.map((ex, i) => {
            const mid = machineIdFromKey(ex.id);
            return {
              id:           entryIds[i],
              sessionId,
              machineId:    mid,
              machineName:  ex.name,
              machineBrand: ex.brand,
              targetMuscle: ex.targetMuscle,
              exerciseKind: isFreeWeightId(mid, dbFreeWeights.length > 0 ? dbFreeWeights : FREE_WEIGHTS) ? 'freeweight' : 'machine',
              order:        i,
            };
          }));

          const setPayloads = selectedExercises.flatMap((ex, i) => {
            const exSets = logs[ex.id] ?? [];
            return exSets.map((s, j) => ({
              id:        `set-${Date.now()}-${i}-${j}`,
              entryId:   entryIds[i],
              setNumber: j + 1,
              weight:    s.weight,
              reps:      s.reps,
            }));
          });
          if (setPayloads.length) await insertWorkoutSets(setPayloads);

          return { dbSessionId: savedSession?.id };
        } catch (err) {
          if (__DEV__) console.warn('[PostWorkoutLog] Supabase write failed:', err);
          return { dbSessionId: undefined as string | undefined };
        }
      })(),
    ]);

    const { finalPhotoUrl, finalThumbnailUrl, finalBlurhash } = photoUpload;
    const { dbSessionId } = dbWrite;

    const sessionMuscles = Array.from(selectedMuscles).map(toCanonMuscle);

    const workoutLog: WorkoutLog = {
      id:               sessionId,
      gymId:            gym.id,
      gymName:          gym.name,
      gymLocation:      gym.location,
      date:             nowIso,
      overlayTextColor: selectedColor,
      overlayStyle:     overlayStyle,
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

    if (user && supabaseConfigured) {
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
              overlay_style: overlayStyle,
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
          blurhash:       finalBlurhash ?? undefined,
          routineCardUri: passedRoutineCardUri ?? routineCardUri ?? undefined,
          sessionId:      dbSessionId ?? sessionId,
          muscles:        Array.from(selectedMuscles).map(toCanonMuscle),
          // 2026-10-20: 오운완은 기본 공개 — 오늘의 오운완 + 헬스장 페이지 모두 노출
          isPublic:       true,
          showOnGym:      true,
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
    setStep('done');
        })(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('운동일지 저장 시간 초과 (25초)')), 25000)),
      ]);
    } catch (err) {
      if (__DEV__) console.error('[PostWorkoutLog] handleSaveWorkout 실패:', err);
      Alert.alert(
        '저장 실패',
        '운동일지를 저장하는 중 문제가 발생했습니다. 네트워크 상태를 확인한 뒤 다시 시도해 주세요.',
      );
    } finally {
      setIsSaving(false);
    }
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
            onNext={() => { trackFunnelStage('flow_muscle', { muscle_count: selectedMuscles.size }); setStep('routine-reference'); }}
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
              trackFunnelStage('flow_routine', { preloaded: ids.length > 0 });
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
            dbFreeWeights={dbFreeWeights.length > 0 ? dbFreeWeights : FREE_WEIGHTS}
            onSelectExercise={handleSelectExercise}
            onLoadTemplate={handleLoadTemplate}
            onDeleteTemplate={handleDeleteTemplate}
            onFinish={() => { trackFunnelStage('flow_photo'); setStep('photo'); }}
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
            onFinish={() => { trackFunnelStage('flow_photo'); setCurrentExerciseId(null); setStep('photo'); }}
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
            onStyleChange={setOverlayStyle}
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
  setBlockLabel:  { fontSize: 13, fontWeight: '800', color: C.text, letterSpacing: 0.5, textTransform: 'uppercase' },

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
  // 2026-09-03: 세트가 하나도 없을 때 유일한 액션이라 눈에 잘 띄어야 해서
  // 기존의 투명 텍스트 버튼 → CTA(ctaBtn)와 동일한 accent 채움 버튼으로 강조.
  addSetBtn:    { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: R.inner, backgroundColor: C.accent },
  addSetText:   { fontSize: 13, fontWeight: '800', color: C.bg },
  // 세트가 0개인 첫 화면 전용 — 버튼/텍스트를 더 크게 (이후 추가되는 세트 옆의
  // '세트 추가' 버튼에는 적용되지 않음, 기존 크기 그대로 유지).
  addSetBtnEmpty:  { paddingVertical: 18, borderRadius: R.btn },
  addSetTextEmpty: { fontSize: 16 },
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
  // 2026-09-05: 세로 스크롤 색상 피커용 — 기존 원형 칩을 직사각형으로 변경
  colorChip:         { width: 48, height: 26, borderRadius: 5, borderWidth: 2, borderColor: 'rgba(255,255,255,0.15)' },
  colorChipActive:   { borderColor: C.accent, transform: [{ scale: 1.15 }] },

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
    borderWidth: 1.5,
    borderColor: C.accent,
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
