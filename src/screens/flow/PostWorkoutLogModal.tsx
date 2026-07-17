import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
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
import { FREE_WEIGHTS } from '../../data/freeWeights';
import { fetchFreeWeights, fetchWorkoutLogs } from '../../lib/db';
import * as Location from 'expo-location';
import { calcDistanceKm, formatDistance } from '../../lib/geocoding';
import { fetchGymsWithMachines } from '../../lib/db/gyms';
import { brandLogos } from '../../constants/brandLogos';
import { fetchSplitConfig } from '../../lib/db/splitRoutine';
import { getTodayTargets, isRestToday, toEnMuscle, parseMuscles } from '../../lib/splitUtils';
import { useFonts } from 'expo-font';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path as SvgPath, Text as SvgText, TextPath, Defs } from 'react-native-svg';

// --- Types

type Step = 'muscle-select' | 'gym-select' | 'routine-reference' | 'today-list' | 'exercise-select' | 'log-sets' | 'photo' | 'done';


interface SetEntry { weight: number; reps: number; }

interface ExerciseInfo {
  id: string; name: string; brand: string; targetMuscle: string;
}

// --- Constants

const { width: SCREEN_W } = Dimensions.get('window');
const CARD_W        = Math.floor((SCREEN_W - 48) / 3);
const MUSCLE_CARD_W = Math.floor((SCREEN_W - 44) / 2);

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
  | 's1a' | 's1b' | 's1c' | 's1d'
  | 's2a' | 's2b' | 's2c' | 's2d'
  | 's3a' | 's3b' | 's3c' | 's3d'
  | 's4a' | 's4b' | 's4c' | 's4d'
  | 's5a' | 's5b' | 's5c' | 's5d'
  | 's6a' | 's6b' | 's6c' | 's6d'
  | 'archday';

type FontSet = {
  muscle: string | undefined;
  routine: string | undefined;
  nickname: string | undefined;
};

const FONT_SETS: Record<number, FontSet> = {
  1: { muscle: 'Quicksilver-Italic',       routine: undefined,              nickname: undefined              },
  2: { muscle: 'Matcha Cih',               routine: 'Mat Saleh',            nickname: 'KCC-Ganpan'           },
  3: { muscle: 'BasicFont',                routine: 'Abrakadaboom',         nickname: 'KERISKEDU_Line'       },
  4: { muscle: 'BlackwoodCastleShadow',    routine: 'BlackwoodCastle',      nickname: 'HeirofLightRegular'   },
  5: { muscle: 'Flamer',                   routine: 'HeavyHeapRg-Regular',  nickname: 'BMkkubulimTTF-Regular'},
  6: { muscle: 'biergartenlt',             routine: undefined,              nickname: undefined              },
};

export function getFontSet(style: OverlayStyle): FontSet {
  if (style === 'archday') return { muscle: 'Stadium1956-Regular', routine: 'CollegeBoy', nickname: 'CollegeBoy' };
  const setNum = parseInt(style.charAt(1));
  return FONT_SETS[setNum] ?? FONT_SETS[1];
}

export function getLayoutType(style: OverlayStyle): 'a' | 'b' | 'c' | 'd' | 'archday' {
  if (style === 'archday') return 'archday';
  const t = style.charAt(2);
  return (t === 'a' || t === 'b' || t === 'c' || t === 'd') ? t : 'a';
}

// Fixed presets as specified
const WEIGHT_PRESETS = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 120, 140, 160, 180, 200];
const REPS_PRESETS   = [2, 4, 6, 8, 10, 12, 14, 16, 18, 20];

// Global machine lookup map for resolving routine machines not in current gym
const ALL_MACHINES_MAP: Record<string, Machine> = Object.fromEntries(
  MACHINES.map((m) => [m.id, m]),
);

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

function Stepper({ value, onChange, step = 1, min = 0 }: {
  value: number; onChange: (v: number) => void; step?: number; min?: number;
}) {
  const display = value % 1 === 0 ? String(value) : value.toFixed(1);
  return (
    <View style={s.stepper}>
      <TouchableOpacity
        style={s.stepperBtn}
        onPress={() => onChange(Math.max(min, parseFloat((value - step).toFixed(1))))}
        activeOpacity={0.7}
      >
        <Ionicons name="remove" size={22} color={C.text} />
      </TouchableOpacity>
      <Text style={s.stepperVal}>{display}</Text>
      <TouchableOpacity
        style={s.stepperBtn}
        onPress={() => onChange(parseFloat((value + step).toFixed(1)))}
        activeOpacity={0.7}
      >
        <Ionicons name="add" size={22} color={C.text} />
      </TouchableOpacity>
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
        const globalMachine = ALL_MACHINES_MAP[id];
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
    : (dbFreeWeights.length > 0 ? dbFreeWeights : FREE_WEIGHTS)
        .filter(fw => parseMuscles(fw.targetMuscle).some(t => matchesMuscle(t)));
  const MACHINE_CARD_W2 = (SCREEN_W - 40) / 2;

  function handleCardPress(id: string) {
    setLocalSelectedId(prev => prev === id ? null : id);
  }

  return (
    <SafeAreaView style={s.safe} edges={["top", "bottom"]}>
      <NavHeader title="머신 선택" onBack={onBack} onClose={onClose} />
      <StepBar total={5} current={2} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.listPad}>
        {/* Template row */}
        <View style={s.tplRow}>
          <Text style={s.hint}>운동할 머신을 하나 선택하세요</Text>
          {templates.length > 0 && (
            <TouchableOpacity style={s.tplChip} onPress={() => setShowTplList(p => !p)} activeOpacity={0.8}>
              <Ionicons name="albums-outline" size={13} color={C.accent} />
              <Text style={s.tplChipTxt}>템플릿</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Inline template list */}
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

        {/* 루틴 선택 모드: 머신+프리웨이트 순서 통합 */}
        {hasPreloaded && routineOrderedAll.length > 0 && (
          <>
            <Text style={s.sectionTitle}>추천 루틴 머신</Text>
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

        {/* Start Fresh 모드: 머신 섹션 */}
        {machines.length > 0 && (
          <>
            <Text style={s.sectionTitle}>머신</Text>
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

        {freeWeights.length > 0 && (
          <>
            <Text style={[s.sectionTitle, { marginTop: 22 }]}>프리 웨이트</Text>
            <View style={s.machineCardGrid}>
              {freeWeights.map(fw => (
                <TouchableOpacity
                  key={fw.id}
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
              ))}
            </View>
          </>
        )}
        <View style={{ height: 100 }} />
      </ScrollView>
      <View style={s.ctaBar}>
        <View style={{ gap: 8 }}>
          <TouchableOpacity
            style={[s.ctaBtn, !localSelectedId && s.ctaDisabled]}
            activeOpacity={0.85}
            onPress={() => { if (localSelectedId) { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); onSelectExercise(localSelectedId); } }}
            disabled={!localSelectedId}
          >
            <Ionicons name="play" size={18} color={C.bg} />
            <Text style={s.ctaTxt}>이 머신으로 운동 시작</Text>
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

// --- Step 4: Log Sets (single exercise)

function SetCard({ ex, sets, realPR, prefill, onChange, onAdd, onCopyPrev, onRemove, onSetLayout, onRegisterRect, onboardingActive, onboardingKey }: {
  ex: ExerciseInfo;
  sets: SetEntry[];
  realPR?: { weight: number; reps: number };
  prefill?: { date: string } | null;
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
  const isFW   = ex.id.startsWith('fw');
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
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexShrink: 1 }}>
              <View style={s.presetRow}>
                {WEIGHT_PRESETS.map(p => (
                  <TouchableOpacity
                    key={p}
                    style={[s.presetChip, set.weight === p && s.presetChipActive]}
                    onPress={() => onChange(idx, 'weight', p)}
                  >
                    <Text style={[s.presetChipText, set.weight === p && s.presetChipTextActive]}>{p}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>
          <View style={s.stepperRow}>
            <Text style={s.stepperUnit}>kg</Text>
            <Stepper value={set.weight} onChange={v => onChange(idx, 'weight', v)} step={set.weight <= 10 ? 1 : 2.5} />
          </View>

          {/* Reps */}
          <View style={[s.inputRow, { marginTop: 10 }]}>
            <Text style={s.inputLabel}>횟수</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexShrink: 1 }}>
              <View style={s.presetRow}>
                {REPS_PRESETS.map(p => (
                  <TouchableOpacity
                    key={p}
                    style={[s.presetChip, set.reps === p && s.presetChipActive]}
                    onPress={() => onChange(idx, 'reps', p)}
                  >
                    <Text style={[s.presetChipText, set.reps === p && s.presetChipTextActive]}>{p}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>
          <View style={s.stepperRow}>
            <Text style={s.stepperUnit}>reps</Text>
            <Stepper value={set.reps} onChange={v => onChange(idx, 'reps', v)} step={1} min={1} />
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

function SetLoggingStep({ exercise, sets, note, onChange, onAdd, onCopyPrev, onRemove, onNoteChange, onSave, onFinish, onBack, onClose, onRegisterRect, onboardingActive, onboardingKey, realPR, prefill }: {
  exercise: ExerciseInfo;
  sets: SetEntry[];
  note: string;
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
  const completedSets = sets.slice(0, -1);

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
        <Text style={[s.overlayUsername, { color: tc, fontFamily: fontSet.nickname }]}>{nickname}</Text>
        <Text style={[s.overlayTimestamp, { color: tc, fontFamily: fontSet.nickname }]}>{timestamp}</Text>
      </View>
      <View style={s.overlayBottomLeft}>
        <Text style={[s.overlayMuscleTitle, { color: tc, fontFamily: fontSet.muscle }]}>{muscleLabel}</Text>
        <View style={s.sessionScroll}>
          {exercises.slice(0, 7).map(ex => {
            const sets     = logs[ex.id] ?? [];
            const setsLine = sets.map(st => `${st.weight} x ${st.reps}`).join(' / ');
            return (
              <View key={ex.id} style={s.overlayExBlock}>
                <Text style={[s.overlayExName, { color: tc, fontFamily: fontSet.routine }]} numberOfLines={1}>
                  {`[${ex.brand.toUpperCase()}] ${ex.name.toUpperCase()}`}
                </Text>
                {setsLine ? (
                  <Text style={[s.overlayExSet, { color: tc, fontFamily: fontSet.routine }]} numberOfLines={2}>{setsLine}</Text>
                ) : null}
              </View>
            );
          })}
          {exercises.length > 7 && (
            <Text style={[s.overlayExName, { color: tc, opacity: 0.6, marginTop: 2, fontFamily: fontSet.routine }]}>
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
          fontWeight: '900',
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
          fontWeight: '700',
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
                  fontWeight: '900',
                  color: tc,
                  letterSpacing: 0.5,
                  fontFamily: fontSet.routine,
                }} numberOfLines={1}>
                  {`[${ex.brand.toUpperCase()}] ${ex.name.toUpperCase()}`}
                </Text>
                {setsLine ? (
                  <Text style={{
                    fontSize: 11,
                    fontWeight: '500',
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
          fontWeight: '900',
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
          fontWeight: '700',
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
            marginBottom: 20,
            fontSize: photoW - 20,
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
              <View key={ex.id} style={{ width: COL_W, alignItems: 'center', marginBottom: 12 }}>
                <Text style={{
                  fontSize: 8,
                  fontWeight: '700',
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
                  fontWeight: '900',
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
                    fontWeight: '600',
                    color: tc,
                    opacity: 0.85,
                    lineHeight: 13,
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
        <Text style={{ fontSize: 13, fontWeight: '900', color: tc, fontFamily: fontSet.nickname }}>{nickname}</Text>
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
              <Text style={{ fontSize: 9, fontWeight: '900', color: tc, fontFamily: fontSet.routine, marginBottom: 2 }} numberOfLines={2}>
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

export function ArchDayOverlay({ exercises, logs, nickname, timestamp, muscleLabel, tc, photoW, photoH }: OverlayProps) {
  const COL_COUNT = 3;
  const COL_W = Math.floor((photoW - OVERLAY_PAD * 2 - 16) / COL_COUNT);

  // 아치형 SVG 설정
  const svgW = photoW;
  const svgH = Math.round(photoW * 0.55);
  const cx   = svgW / 2;
  const cy   = svgH + svgH * 0.1;
  const r    = svgH * 0.85;

  // 반원 호 path (위쪽 아치)
  const startX = cx - r;
  const startY = cy;
  const endX   = cx + r;
  const endY   = cy;
  const archPath = `M ${startX} ${startY} A ${r} ${r} 0 0 1 ${endX} ${endY}`;

  return (
    <>
      {/* 상단 좌: 닉네임 */}
      <View style={{ position: 'absolute', top: OVERLAY_PAD, left: OVERLAY_PAD }}>
        <Text style={{ fontSize: 13, color: tc, fontFamily: 'CollegeBoy', letterSpacing: 0.3 }}>
          {nickname}
        </Text>
      </View>
      {/* 상단 우: 날짜 */}
      <View style={{ position: 'absolute', top: OVERLAY_PAD, right: OVERLAY_PAD, alignItems: 'flex-end' }}>
        <Text style={{ fontSize: 10, color: tc, opacity: 0.85, fontFamily: 'CollegeBoy' }}>
          {timestamp}
        </Text>
      </View>

      {/* 중앙 아치형 타겟부위 */}
      <View style={{
        position: 'absolute',
        top: OVERLAY_PAD + 28,
        left: 0,
        width: photoW,
        height: svgH,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <Svg width={svgW} height={svgH}>
          <Defs>
            <SvgPath id="archPath" d={archPath} />
          </Defs>
          <SvgText
            fill={tc}
            fontSize={Math.round(photoW * 0.13)}
            fontFamily="Oklahoma"
            textAnchor="middle"
          >
            <TextPath href="#archPath" startOffset="50%">
              {muscleLabel.toUpperCase()}
            </TextPath>
          </SvgText>
        </Svg>
      </View>

      {/* 3열 운동 목록 - GridOverlay와 동일한 구조 */}
      <View style={{
        position: 'absolute',
        top: OVERLAY_PAD + 28 + svgH - 80,
        left: OVERLAY_PAD,
        right: OVERLAY_PAD,
        bottom: OVERLAY_PAD + 32,
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        alignContent: 'flex-start',
        justifyContent: 'center',
      }}>
        {exercises.slice(0, 9).map(ex => {
          const sets = logs[ex.id] ?? [];
          return (
            <View key={ex.id} style={{ width: COL_W, marginBottom: 8, alignItems: 'center' }}>
              <Text style={{
                fontSize: 8,
                fontFamily: 'CollegeBoy',
                color: tc,
                opacity: 0.7,
                letterSpacing: 0.5,
                textAlign: 'center',
              }}>
                {`[${ex.brand.toUpperCase()}]`}
              </Text>
              <Text style={{
                fontSize: 9,
                fontFamily: 'CollegeBoy',
                color: tc,
                letterSpacing: 0.2,
                marginBottom: 2,
                lineHeight: 9,
                textAlign: 'center',
              }} numberOfLines={2}>
                {ex.name.toUpperCase()}
              </Text>
              {sets.map((st, si) => (
                <Text key={si} style={{
                  fontSize: 8,
                  fontFamily: 'CollegeBoy',
                  color: tc,
                  opacity: 0.85,
                  lineHeight: 9,
                  textAlign: 'center',
                }}>
                  {`S${si + 1} ${st.weight}kg × ${st.reps}`}
                </Text>
              ))}
            </View>
          );
        })}
        {exercises.length > 9 && (
          <View style={{ width: COL_W }}>
            <Text style={{ fontSize: 8, fontFamily: 'CollegeBoy', color: tc, opacity: 0.6 }}>
              {`+${exercises.length - 9} more...`}
            </Text>
          </View>
        )}
      </View>

      {/* 하단 중앙 로고 */}
      <View style={{ position: 'absolute', bottom: OVERLAY_PAD, left: 0, right: 0, alignItems: 'center' }}>
        <GymPickLogo color={tc} width={Math.round(LOGO_STRIP_W * 0.595)} height={Math.round(LOGO_STRIP_H * 0.595)} />
      </View>
    </>
  );
}

// --- Step 5: Photo

function WorkoutPhotoStep({ gym, exercises, selectedMuscles, logs, photoTaken, photoUri, nickname, onColorChange, onCapture, onCompositeUri, onRoutineCardUri, onSave, onBack, onClose, onCameraCapture, showCamera, onSetShowCamera, onRegisterRect, onboardingActive, onboardingKey, onOnboardingNext, onOnboardingJump }: {
  gym: GymWithMachines;
  exercises: ExerciseInfo[];
  selectedMuscles: string[];
  logs: Record<string, SetEntry[]>;
  photoTaken: boolean;
  photoUri?: string;
  nickname?: string;
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
            style={[s.photoFrame, s.photoFrameActive, { height: photoH, backgroundColor: 'transparent', borderWidth: 0, borderRadius: 20, overflow: 'hidden' }]}
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
            {(() => {
              if (overlayStyle === 'archday') {
                return (
                  <ArchDayOverlay
                    exercises={exercises}
                    logs={logs}
                    nickname={displayName}
                    timestamp={timestamp}
                    muscleLabel={muscleLabel}
                    tc={tc}
                    photoW={PHOTO_W}
                    photoH={photoH}
                  />
                );
              }
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

              return null;
            })()}

            {/* 테두리: overflow 클리핑 이후 absolute로 덮어 빈공간 방지 */}
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
              const imageUrl  = `https://okrouzqqvfioodfieljv.supabase.co/storage/v1/object/public/machine-images/${machineIdFromKey(ex.id)}.webp`;

              return (
                <React.Fragment key={ex.id}>
                  {i > 0 && <View style={{ height: 1, backgroundColor: '#E5E5E5' }} />}
                  <View style={{ flexDirection: 'row', alignItems: 'flex-start', padding: 12, gap: 10 }}>

                    {/* 머신 이미지 */}
                    <View style={{ width: 64, height: 64, borderRadius: 10, overflow: 'hidden', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5E5E5' }}>
                      <Image
                        source={{ uri: imageUrl }}
                        style={{ width: '100%', height: '100%' }}
                        resizeMode="contain"
                      />
                    </View>

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

        {/* 머신 행 실제 높이 측정용 (화면 밖에 숨김) */}
        <View style={{ position: 'absolute', top: -9999, left: -9999, width: PHOTO_W, backgroundColor: 'transparent' }} pointerEvents="none">
          {exercises.map((ex, i) => {
            const exSets    = logs[ex.id] ?? [];
            const brandKey  = ex.brand.toUpperCase().replace(/\s+/g, '_');
            const brandLogo = brandLogos[brandKey];
            const imageUrl  = `https://okrouzqqvfioodfieljv.supabase.co/storage/v1/object/public/machine-images/${machineIdFromKey(ex.id)}.webp`;
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
                <View style={{ width: 64, height: 64, borderRadius: 10, overflow: 'hidden', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5E5E5' }}>
                  <Image source={{ uri: imageUrl }} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
                </View>
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
                    const imageUrl  = `https://okrouzqqvfioodfieljv.supabase.co/storage/v1/object/public/machine-images/${machineIdFromKey(ex.id)}.webp`;
                    return (
                      <React.Fragment key={ex.id}>
                        {i > 0 && <View style={{ height: 1, backgroundColor: '#E5E5E5' }} />}
                        <View style={{ flexDirection: 'row', alignItems: 'flex-start', padding: 12, gap: 10 }}>
                          <View style={{ width: 64, height: 64, borderRadius: 10, overflow: 'hidden', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5E5E5' }}>
                            <Image source={{ uri: imageUrl }} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
                          </View>
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
                { key: 's2a', set: 2, type: 'A', muscle: 'Matcha Cih' },
                { key: 's2b', set: 2, type: 'B', muscle: 'Matcha Cih' },
                { key: 's2c', set: 2, type: 'C', muscle: 'Matcha Cih' },
                { key: 's2d', set: 2, type: 'D', muscle: 'Matcha Cih' },
                { key: 's3a', set: 3, type: 'A', muscle: 'BasicFont' },
                { key: 's3b', set: 3, type: 'B', muscle: 'BasicFont' },
                { key: 's3c', set: 3, type: 'C', muscle: 'BasicFont' },
                { key: 's3d', set: 3, type: 'D', muscle: 'BasicFont' },
                { key: 's4a', set: 4, type: 'A', muscle: 'BlackwoodCastleShadow' },
                { key: 's4b', set: 4, type: 'B', muscle: 'BlackwoodCastleShadow' },
                { key: 's4c', set: 4, type: 'C', muscle: 'BlackwoodCastleShadow' },
                { key: 's4d', set: 4, type: 'D', muscle: 'BlackwoodCastleShadow' },
                { key: 's5a', set: 5, type: 'A', muscle: 'Flamer' },
                { key: 's5b', set: 5, type: 'B', muscle: 'Flamer' },
                { key: 's5c', set: 5, type: 'C', muscle: 'Flamer' },
                { key: 's5d', set: 5, type: 'D', muscle: 'Flamer' },
                { key: 's6a', set: 6, type: 'A', muscle: 'biergartenlt' },
                { key: 's6b', set: 6, type: 'B', muscle: 'biergartenlt' },
                { key: 's6c', set: 6, type: 'C', muscle: 'biergartenlt' },
                { key: 's6d', set: 6, type: 'D', muscle: 'biergartenlt' },
                { key: 'archday', set: 0, type: '9', muscle: 'Stadium1956-Regular' },
              ] as { key: OverlayStyle; set: number; type: string; muscle: string }[]).map((opt, idx) => {
                const isActive = overlayStyle === opt.key;
                const isArchday = opt.key === 'archday';
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
                      borderColor: isActive ? C.accent : isArchday ? '#fb923c50' : C.border,
                      backgroundColor: isActive ? '#1a1a1a' : C.surface,
                      alignItems: 'center',
                      justifyContent: 'center',
                      minWidth: 48,
                      marginLeft: (!isArchday && idx > 0 && idx % 4 === 0) ? 8 : 0,
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
                      {isArchday ? '9' : `${opt.set}${opt.type}`}
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
                    options: ['취소', '기기에 저장', '인스타그램에 업로드'],
                    cancelButtonIndex: 0,
                    title: '저장 방식 선택',
                  },
                  (buttonIndex) => {
                    if (buttonIndex === 1) handleSaveImage();
                    if (buttonIndex === 2) handleInstagramShare();
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
        <TouchableOpacity style={s.ctaBtn} activeOpacity={0.85} onPress={async () => {
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

function WorkoutDoneStep({ gym, exercises, logs, detectedPRs, selectedMuscles, onClose }: {
  gym: GymWithMachines;
  exercises: ExerciseInfo[];
  logs: Record<string, SetEntry[]>;
  detectedPRs: { name: string; weight: number; reps: number }[];
  selectedMuscles: Set<string>;
  onClose: () => void;
}) {
  const [tplName,    setTplName]    = useState('');
  const [tplSaved,   setTplSaved]   = useState(false);

  const totalSets = exercises.reduce((a, e) => a + (logs[e.id]?.length ?? 0), 0);
  const totalVol  = exercises.reduce((a, e) =>
    a + (logs[e.id] ?? []).reduce((sa, s) => sa + s.weight * s.reps, 0), 0,
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

  return (
    <SafeAreaView style={s.safe} edges={["top", "bottom"]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.listPad}>
        <View style={s.doneHero}>
          <View style={s.doneCheck}>
            <Ionicons name="checkmark" size={44} color={C.bg} />
          </View>
          <Text style={s.doneTitle}>운동이 기록됐어요!</Text>
          <Text style={s.doneSub}>{gym.name}에서 수고하셨어요</Text>
        </View>

        <View style={s.doneStats}>
          <View style={s.doneStat}>
            <Text style={s.doneStatVal}>{exercises.length}</Text>
            <Text style={s.doneStatLab}>운동</Text>
          </View>
          <View style={s.doneStatDiv} />
          <View style={s.doneStat}>
            <Text style={s.doneStatVal}>{totalSets}</Text>
            <Text style={s.doneStatLab}>총 세트</Text>
          </View>
          <View style={s.doneStatDiv} />
          <View style={s.doneStat}>
            <Text style={s.doneStatVal}>{totalVol > 0 ? totalVol.toFixed(0) : '—'}</Text>
            <Text style={s.doneStatLab}>볼륨 (kg)</Text>
          </View>
        </View>

        {/* PR celebration panel */}
        {detectedPRs.length > 0 && (
          <View style={s.prCelebCard}>
            <Text style={s.prCelebTitle}>🎉 신기록 달성!</Text>
            {detectedPRs.map((pr, i) => (
              <View key={i} style={s.prCelebRow}>
                <Ionicons name="trophy" size={14} color={C.accent} />
                <Text style={s.prCelebName}>{pr.name}</Text>
                <Text style={s.prCelebVal}>{pr.weight} kg</Text>
              </View>
            ))}
          </View>
        )}

        <Text style={s.sectionTitle}>운동 요약</Text>
        <View style={s.summaryCard}>
          {exercises.map((ex, i) => {
            const col  = mp(ex.targetMuscle);
            const sets = logs[ex.id] ?? [];
            return (
              <React.Fragment key={ex.id}>
                {i > 0 && <View style={s.divider} />}
                <View style={s.summaryRow}>
                  <View style={[s.summaryIcon, { backgroundColor: col.bg }]}>
                    <Ionicons name={ex.id.startsWith('fw') ? 'fitness-outline' : 'barbell-outline'} size={14} color={col.fg} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.summaryName}>{ex.name}</Text>
                    <Text style={s.summaryDetail}>
                      {sets.length} set{sets.length !== 1 ? 's' : ''}
                      {sets[0]?.weight ? ` · ${sets[0].weight} kg × ${sets[0].reps}` : ''}
                    </Text>
                  </View>
                  <View style={[s.logMusclePill, { backgroundColor: col.bg }]}>
                    <Text style={[s.logMusclePillText, { color: col.fg }]}>{ex.targetMuscle}</Text>
                  </View>
                </View>
              </React.Fragment>
            );
          })}
        </View>
        {/* Save as Template */}
        <View style={s.tplCard}>
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
      if (mid.startsWith('fw')) {
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
    if (mid.startsWith('fw')) {
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
    if (effectiveCompositeUri && user && supabaseConfigured) {
      finalPhotoUrl = await uploadWorkoutPhoto(effectiveCompositeUri, user.id, sessionId, true);
    } else if (photoUri && user && supabaseConfigured) {
      finalPhotoUrl = await uploadWorkoutPhoto(photoUri, user.id, sessionId, false);
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
            exerciseKind: mid.startsWith('fw') ? 'freeweight' : 'machine',
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
            sessionId:   sessionId,
            userId:      user.id,
            capturedAt:  new Date().toISOString(),
            textColor:   '#ffffff',
            aspectRatio: '9:16',
          });

          // composite_uri 업데이트 (insertWorkoutPhoto는 기본 컬럼만 저장하므로 별도 update)
          const { supabase } = await import('../../lib/supabase');
          await supabase
            .from('workout_photos')
            .update({
              composite_uri: finalPhotoUrl,
              photo_uri:     photoUri ?? null,
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
          routineCardUri: passedRoutineCardUri ?? routineCardUri ?? undefined,
          sessionId:      dbSessionId ?? sessionId,
          muscles:        Array.from(selectedMuscles).map(toCanonMuscle),
          isPublic:       true,
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

  // Machine card 2-column grid for exercise select
  machineCardGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
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
  inputLabel:  { fontSize: 10, fontWeight: '700', color: C.textDim, width: 44, letterSpacing: 0.5, textTransform: 'uppercase' },

  presetRow:           { flexDirection: 'row', gap: 6 },
  presetChip:          { minWidth: 40, paddingHorizontal: 12, paddingVertical: 8, borderRadius: R.pill, backgroundColor: C.surfaceHigh, alignItems: 'center' },
  presetChipActive:    { backgroundColor: C.accent, borderColor: C.accent },
  presetChipText:      { fontSize: 12, fontWeight: '700', color: C.textSub },
  presetChipTextActive:{ color: C.bg },

  stepperRow:  { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 },
  stepperUnit: { fontSize: 10, fontWeight: '700', color: C.textDim, width: 44, letterSpacing: 0.5, textTransform: 'uppercase' },
  stepper:     { flexDirection: 'row', alignItems: 'center', backgroundColor: C.surface, borderRadius: R.inner, overflow: 'hidden' },
  stepperBtn:  { width: 56, height: 56, alignItems: 'center', justifyContent: 'center' },
  stepperVal:  { minWidth: 64, textAlign: 'center', fontSize: 28, fontWeight: '900', color: C.text, fontVariant: ['tabular-nums'] },

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
