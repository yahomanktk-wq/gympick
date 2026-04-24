import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  TextInput,
  Share,
  Dimensions,
  Alert,
  Image,
  InteractionManager,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as MediaLibrary from 'expo-media-library';
import { captureRef } from 'react-native-view-shot';
import { Ionicons } from '@expo/vector-icons';
import { C, R, T } from '../../theme';
import { GYMS_WITH_MACHINES, GymWithMachines, Machine, MACHINES } from '../../data';
import { MOCK_SESSIONS, getMachinePRsFull } from '../../data/workoutSessions';
import { WorkoutLog } from '../../data/types';
import { addNewSession } from '../../data/sessionStore';
import { saveTemplate, getTemplates, deleteTemplate, WorkoutTemplate } from '../../data/templateStore';
import { recordPR } from '../../data/prStore';
import { useAuth } from '../../context/AuthContext';
import { calculateXP, addXP } from '../../lib/machineLevelUtils';
import { getMachineLevelData, updateMachineLevelData } from '../../data/machineLevelStore';
import { insertWorkoutSession, insertWorkoutEntry, insertWorkoutSet } from '../../lib/db/workouts';
import { uploadWorkoutPhoto } from '../../lib/photoStorage';
import { saveMachineLevelData } from '../../lib/db/machineLevels';
import { insertFeedPost } from '../../lib/db/feedPosts';
import XPGainPopup from '../../components/XPGainPopup';
import { MachineLevelData } from '../../data/types';
import GymPickLogo from '../../components/GymPickLogo';
import RoutineReferenceScreen, { MachineExtraInfo } from './RoutineReferenceScreen';
import TodayWorkoutListScreen from './TodayWorkoutListScreen';
import MachineCard from '../../components/MachineCard';
import MachineCardBorder from '../../components/MachineCardBorder';
import { FREE_WEIGHTS } from '../../data/freeWeights';
import { fetchFreeWeights } from '../../lib/db';

// --- Types

type Step = 'muscle-select' | 'gym-select' | 'routine-reference' | 'today-list' | 'exercise-select' | 'log-sets' | 'photo' | 'done';
type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

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

const MOCK_DIST: Record<string, { dist: string; distNum: number }> = {
  g01: { dist: '0.3 km', distNum: 0.3 },
  g02: { dist: '0.9 km', distNum: 0.9 },
  g03: { dist: '1.1 km', distNum: 1.1 },
  g04: { dist: '1.4 km', distNum: 1.4 },
  g05: { dist: '2.0 km', distNum: 2.0 },
  g06: { dist: '2.3 km', distNum: 2.3 },
  g07: { dist: '3.1 km', distNum: 3.1 },
  g08: { dist: '4.5 km', distNum: 4.5 },
};

// Fixed presets as specified
const WEIGHT_PRESETS = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 120, 140, 160, 180, 200];
const REPS_PRESETS   = [2, 4, 6, 8, 10, 12, 14, 16, 18, 20];

function getDist(id: string) {
  return MOCK_DIST[id] ?? { dist: '? km', distNum: 99 };
}

const GYM_LIST = [...GYMS_WITH_MACHINES].sort(
  (a, b) => getDist(a.id).distNum - getDist(b.id).distNum,
);

// Global machine lookup map for resolving routine machines not in current gym
const ALL_MACHINES_MAP: Record<string, Machine> = Object.fromEntries(
  MACHINES.map((m) => [m.id, m]),
);

// --- Muscle palette

const MUSCLE_COLORS: Record<string, { fg: string; bg: string }> = {
  Chest:            C.tagMachine,
  Back:             C.tagBrand,
  Legs:             C.tagMuscle,
  Shoulders:        { fg: '#ffd166', bg: '#ffd16618' },
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

const MUSCLE_GROUPS: { name: string; sub: string; icon: IoniconName }[] = [
  { name: 'Chest',          sub: 'Pectorals',                  icon: 'body-outline'    },
  { name: 'Back',           sub: 'Lats & Rhomboids',           icon: 'barbell-outline' },
  { name: 'Shoulders',      sub: 'Deltoids',                   icon: 'person-outline'  },
  { name: 'Arms',           sub: 'Biceps & Triceps',           icon: 'fitness-outline' },
  { name: 'Legs',           sub: 'Quads & Hamstrings',         icon: 'walk-outline'    },
  { name: 'Hip (Glutes)',   sub: 'Glutes & Hip Abductors',     icon: 'body-outline'    },
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

function MuscleCard({ name, sub, icon, selected, onToggle }: {
  name: string; sub: string; icon: IoniconName;
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
      <View style={[s.muscleCardCircle, { backgroundColor: selected ? col.fg + '22' : C.surfaceHigh }]}>
        <Ionicons name={icon} size={32} color={selected ? col.fg : C.textSub} />
      </View>
      <Text style={[s.muscleCardName, selected && { color: col.fg }]}>{name}</Text>
      <Text style={s.muscleCardSub}>{sub}</Text>
    </TouchableOpacity>
  );
}

function MuscleSelectStep({ selected, onToggle, onNext, onBack, onClose }: {
  selected: Set<string>;
  onToggle: (m: string) => void;
  onNext: () => void;
  onBack: () => void;
  onClose: () => void;
}) {
  return (
    <SafeAreaView style={s.safe}>
      <NavHeader title="어떤 부위를 운동했나요?" onBack={onBack} onClose={onClose} />
      <StepBar total={5} current={1} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.listPad}>
        <Text style={s.hint}>오늘 운동한 부위를 모두 선택하세요</Text>

        <View style={s.muscleGrid}>
          {MUSCLE_GROUPS.map(g => (
            <MuscleCard
              key={g.name}
              name={g.name} sub={g.sub} icon={g.icon}
              selected={selected.has(g.name)}
              onToggle={() => onToggle(g.name)}
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

function GymSelectStep({ onSelect, onClose }: {
  onSelect: (gym: GymWithMachines) => void;
  onClose: () => void;
}) {
  return (
    <SafeAreaView style={s.safe}>
      <NavHeader title="어디서 운동했나요?" onClose={onClose} />
      <StepBar total={5} current={0} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.listPad}>
        <Text style={s.hint}>오늘 운동한 헬스장을 선택하세요</Text>
        {GYM_LIST.map(gym => {
          const machineCount = gym.machines.length;
          return (
            <TouchableOpacity key={gym.id} style={s.gymCard} activeOpacity={0.8} onPress={() => onSelect(gym)}>
              <View style={{ flex: 1, paddingLeft: 14 }}>
                <Text style={s.gymCardName}>{gym.name}</Text>
                <View style={s.gymMeta}>
                  <Ionicons name="location-outline" size={12} color={C.textSub} />
                  <Text style={s.gymMetaLoc}>{gym.location}</Text>
                  <Text style={s.dot}>·</Text>
                  <Ionicons name="navigate-outline" size={11} color={C.accent} />
                  <Text style={s.gymMetaDist}>{getDist(gym.id).dist}</Text>
                </View>
                <Text style={s.gymMachineCount}>{machineCount} 머신</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={C.textDim} style={{ alignSelf: 'center' }} />
            </TouchableOpacity>
          );
        })}
      </ScrollView>
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

function ExerciseSelectStep({ gym, selectedMuscles, loggedIds, preloadedIds, routineExtraInfo, templates, onSelectExercise, onLoadTemplate, onDeleteTemplate, onFinish, onBack, onClose }: {
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
}) {
  const [localSelectedId, setLocalSelectedId] = useState<string | null>(null);
  const [showTplList,     setShowTplList]     = useState(false);
  const [dbFreeWeights,   setDbFreeWeights]   = useState<typeof FREE_WEIGHTS>([]);

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
    return false;
  }

  const hasPreloaded = preloadedIds.size > 0;
  let machines: Machine[];
  if (hasPreloaded) {
    // Routine selected: show the routine's machines in order, resolved from any source
    machines = [...preloadedIds]
      .map(id => {
        const gymMachine = gym.machines.find(m => m.id === id);
        if (gymMachine) return gymMachine;
        const globalMachine = ALL_MACHINES_MAP[id];
        if (globalMachine) return globalMachine;
        const extra = routineExtraInfo?.[id];
        if (extra) return { id, name: extra.name, brand: extra.brand, targetMuscle: extra.targetMuscle, category: '' } as Machine;
        return null;
      })
      .filter(Boolean) as Machine[];
  } else {
    // Start Fresh: show all gym machines matching selected muscles
    machines = gym.machines.filter(m => matchesMuscle(m.targetMuscle));
  }
  // Always show free weights filtered by selected muscles (Supabase first, local fallback)
  const freeWeights = (dbFreeWeights.length > 0 ? dbFreeWeights : FREE_WEIGHTS)
    .filter(fw => matchesMuscle(fw.targetMuscle));
  const MACHINE_CARD_W2 = (SCREEN_W - 40) / 2;

  function handleCardPress(id: string) {
    setLocalSelectedId(prev => prev === id ? null : id);
  }

  return (
    <SafeAreaView style={s.safe}>
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

        {machines.length > 0 && (
          <>
            <Text style={s.sectionTitle}>머신</Text>
            <View style={s.machineCardGrid}>
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
                  {localSelectedId === m.id && (
                    <View style={s.cardSelectedOverlay}>
                      <View style={s.cardSelectedBadge}>
                        <Ionicons name="checkmark" size={14} color={C.bg} />
                      </View>
                    </View>
                  )}
                  {loggedIds.has(m.id) && (
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
                  {localSelectedId === fw.id && (
                    <View style={s.cardSelectedOverlay}>
                      <View style={s.cardSelectedBadge}>
                        <Ionicons name="checkmark" size={14} color={C.bg} />
                      </View>
                    </View>
                  )}
                  {loggedIds.has(fw.id) && (
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
            onPress={() => localSelectedId && onSelectExercise(localSelectedId)}
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

// --- Step 4: Log Sets (single exercise)

function SetCard({ ex, sets, onChange, onAdd, onCopyPrev, onRemove }: {
  ex: ExerciseInfo;
  sets: SetEntry[];
  onChange: (idx: number, field: keyof SetEntry, val: number) => void;
  onAdd: () => void;
  onCopyPrev: () => void;
  onRemove: (idx: number) => void;
}) {
  const col    = mp(ex.targetMuscle);
  const isFW   = ex.id.startsWith('fw');
  const curMax  = sets.length ? Math.max(...sets.map(s => s.weight)) : 0;
  const histPR  = HIST_PRS[ex.id]; // { weight, reps } | undefined
  const isNewPR = curMax > 0 && (histPR === undefined || curMax > histPR.weight);

  return (
    <View style={s.logCard}>
      <View style={s.logCardHead}>
        <View style={[s.logExIcon, { backgroundColor: col.bg }]}>
          <Ionicons name={isFW ? 'fitness-outline' : 'barbell'} size={18} color={col.fg} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.logExName}>{ex.name}</Text>
          <Text style={s.logExBrand}>{ex.brand}</Text>
        </View>
        {isNewPR && (
          <View style={s.newPRBadge}>
            <Text style={s.newPRBadgeTxt}>🔥 신기록</Text>
          </View>
        )}
        <View style={[s.logMusclePill, { backgroundColor: col.bg }]}>
          <Text style={[s.logMusclePillText, { color: col.fg }]}>{ex.targetMuscle}</Text>
        </View>
      </View>

      {/* Your PR reference */}
      {histPR && (
        <View style={s.yourPRRow}>
          <Text style={s.yourPRLabel}>내 PR</Text>
          <Text style={s.yourPRVal}>{histPR.weight} kg × {histPR.reps}</Text>
        </View>
      )}

      {sets.map((set, idx) => (
        <View key={idx} style={s.setBlock}>
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
            <Stepper value={set.weight} onChange={v => onChange(idx, 'weight', v)} step={2.5} />
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

      <View style={s.setActions}>
        <TouchableOpacity style={s.addSetBtn} onPress={onAdd} activeOpacity={0.75}>
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

function SetLoggingStep({ exercise, sets, note, onChange, onAdd, onCopyPrev, onRemove, onNoteChange, onSave, onFinish, onBack, onClose }: {
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
}) {
  const hasSets = sets.length > 0 && sets.some(s => s.weight > 0 || s.reps > 0);

  return (
    <SafeAreaView style={s.safe}>
      <NavHeader title="세트 기록" onBack={onBack} onClose={onClose} />
      <StepBar total={5} current={2} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.listPad}>
        <Text style={s.hint}>프리셋 또는 스테퍼로 입력하세요</Text>
        <SetCard
          ex={exercise}
          sets={sets}
          onChange={onChange}
          onAdd={onAdd}
          onCopyPrev={onCopyPrev}
          onRemove={onRemove}
        />

        {/* Optional exercise note */}
        <View style={s.noteCard}>
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
          onPress={onSave}
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

// --- Step 5: Photo

function WorkoutPhotoStep({ gym, exercises, logs, photoTaken, photoUri, nickname, onColorChange, onCapture, onCompositeUri, onSave, onBack, onClose }: {
  gym: GymWithMachines;
  exercises: ExerciseInfo[];
  logs: Record<string, SetEntry[]>;
  photoTaken: boolean;
  photoUri?: string;
  nickname?: string;
  onColorChange: (color: string) => void;
  onCapture: (aspect: [number, number]) => void;
  onCompositeUri: (uri: string) => void;
  onSave: (captured?: string) => void;
  onBack: () => void;
  onClose: () => void;
}) {
  const [textColor,    setTextColor]    = useState('#ffffff');
  const [saveSuccess,  setSaveSuccess]  = useState(false);
  const [photoAspect,  setPhotoAspect]  = useState<'4:3' | '16:9'>('4:3');
  const overlayRef = useRef<View>(null);

  const photoH = photoAspect === '4:3'
    ? Math.round(PHOTO_W * 4 / 3)
    : Math.round(PHOTO_W * 16 / 9);

  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const ENG_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const dateLabel = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}(${ENG_DAYS[now.getDay()]})`;
  const timestamp = `${dateLabel}_${pad(now.getHours())}:${pad(now.getMinutes())}`;
  const displayName = nickname ?? 'gympick_user';

  // Derive muscle label: "Chest Day" or "Chest + Triceps"
  const muscleCounts = exercises.reduce<Record<string, number>>((acc, ex) => {
    acc[ex.targetMuscle] = (acc[ex.targetMuscle] ?? 0) + 1;
    return acc;
  }, {});
  const sortedMuscles = Object.entries(muscleCounts)
    .sort(([, a], [, b]) => b - a)
    .map(([m]) => m);
  const muscleLabel = sortedMuscles.length > 1
    ? sortedMuscles.slice(0, 2).join(' + ')
    : `${sortedMuscles[0] ?? 'WORKOUT'} Day`;

  async function handleShare() {
    const lines: string[] = [`🏋️ ${muscleLabel.toUpperCase()}`, ''];
    for (const ex of exercises) {
      const exSets = logs[ex.id] ?? [];
      const setsLine = exSets.map(st => `${st.weight} x ${st.reps}`).join(' / ');
      lines.push(`[${ex.brand.toUpperCase()}] ${ex.name.toUpperCase()}`);
      if (setsLine) lines.push(setsLine);
    }
    lines.push('', `📍 ${gym.name}`, '', 'GymPick으로 기록됨');
    try {
      await Share.share({ message: lines.join('\n'), title: 'GymPick Workout' });
    } catch (_) {}
  }

  async function handleSaveImage() {
    if (!photoUri || !overlayRef.current) {
      Alert.alert('사진 없음', '먼저 사진을 찍어주세요.');
      return;
    }
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('권한 필요', '사진 저장을 위해 미디어 라이브러리 접근 권한이 필요합니다.');
        return;
      }
      await new Promise(resolve => requestAnimationFrame(resolve));
      await new Promise<void>(resolve => InteractionManager.runAfterInteractions(() => resolve()));
      if (!overlayRef.current) {
        Alert.alert('저장 실패', '저장에 실패했습니다.');
        return;
      }
      const capturedUri = await captureRef(overlayRef, { format: 'png', quality: 0.95, result: 'tmpfile' });
      onCompositeUri(capturedUri);
      await MediaLibrary.saveToLibraryAsync(capturedUri);
      Alert.alert('저장 완료', '이미지가 저장되었습니다.');
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
    } catch (error) {
      console.error('[GymPick] 이미지 저장 오류:', error);
      Alert.alert('저장에 실패했습니다', '다시 시도해 주세요.');
    }
  }

  const tc = textColor;

  // Logo strip positioning math (rotate around center):
  // Visual top-left of TL strip at (8, OVERLAY_PAD)
  const TL_VISUAL_X = 8;
  const TL_VISUAL_Y = OVERLAY_PAD;
  const logoTlLeft = Math.round(TL_VISUAL_X + LOGO_STRIP_H / 2 - LOGO_STRIP_W / 2);
  const logoTlTop  = Math.round(TL_VISUAL_Y + LOGO_STRIP_W / 2 - LOGO_STRIP_H / 2);

  // Visual bottom-right of BR strip — uses dynamic photoH
  const BR_VISUAL_X = PHOTO_W - 8 - LOGO_STRIP_H;
  const BR_VISUAL_Y = photoH - OVERLAY_PAD - LOGO_STRIP_W;
  const logoBrLeft = Math.round(BR_VISUAL_X + LOGO_STRIP_H / 2 - LOGO_STRIP_W / 2);
  const logoBrTop  = Math.round(BR_VISUAL_Y + LOGO_STRIP_W / 2 - LOGO_STRIP_H / 2);

  return (
    <SafeAreaView style={s.safe}>
      <NavHeader title="운동 사진" onBack={onBack} onClose={onClose} />
      <StepBar total={5} current={3} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.listPad}>
        <Text style={s.hint}>운동 후 사진을 찍어보세요 (선택)</Text>

        {/* Aspect ratio selector */}
        {!photoTaken && (
          <View style={s.aspectRow}>
            <Text style={s.aspectLabel}>사진 비율</Text>
            {(['4:3', '16:9'] as const).map(asp => (
              <TouchableOpacity
                key={asp}
                style={[s.aspectChip, photoAspect === asp && s.aspectChipActive]}
                onPress={() => setPhotoAspect(asp)}
                activeOpacity={0.75}
              >
                <Text style={[s.aspectChipText, photoAspect === asp && s.aspectChipTextActive]}>{asp}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* No photo: show camera CTA as TouchableOpacity */}
        {!photoTaken && (
          <TouchableOpacity
            style={[s.photoFrame, { height: photoH }]}
            activeOpacity={0.85}
            onPress={() => onCapture(photoAspect === '4:3' ? [3, 4] : [9, 16])}
          >
            <View style={s.photoCta}>
              <View style={s.photoCtaIcon}>
                <Ionicons name="camera" size={30} color={C.textSub} />
              </View>
              <Text style={s.photoCtaTitle}>탭하여 사진 찍기</Text>
              <Text style={s.photoCtaSub}>사진 없이 저장하기</Text>
            </View>
          </TouchableOpacity>
        )}

        {/* Photo taken: overlay View separated from TouchableOpacity for captureRef */}
        {photoTaken && (
          <View
            ref={overlayRef}
            style={[s.photoFrame, s.photoFrameActive, { height: photoH, backgroundColor: 'transparent', borderColor: tc }]}
            collapsable={false}
          >
            {/* Background photo */}
            {photoUri ? (
              <Image
                source={{ uri: photoUri }}
                style={StyleSheet.absoluteFill}
                resizeMode="cover"
              />
            ) : null}

            {/* Top-left logo: rotated 90° CW */}
            <View style={[s.overlayLogoAbsolute, { left: logoTlLeft, top: logoTlTop, transform: [{ rotate: '90deg' }] }]}>
              <GymPickLogo color={tc} width={LOGO_STRIP_W} height={LOGO_STRIP_H} />
            </View>

            {/* Bottom-right logo: rotated 270° CW */}
            <View style={[s.overlayLogoAbsolute, { left: logoBrLeft, top: logoBrTop, transform: [{ rotate: '270deg' }] }]}>
              <GymPickLogo color={tc} width={LOGO_STRIP_W} height={LOGO_STRIP_H} />
            </View>

            {/* Top-right: nickname + timestamp */}
            <View style={s.overlayTopRight}>
              <Text style={[s.overlayUsername, { color: tc }]}>{displayName}</Text>
              <Text style={[s.overlayTimestamp, { color: tc }]}>{timestamp}</Text>
            </View>

            {/* Lower-left: muscle label + exercise list (View, not ScrollView — capture safe) */}
            <View style={s.overlayBottomLeft}>
              <Text style={[s.overlayMuscleTitle, { color: tc }]}>{muscleLabel}</Text>
              <View style={s.sessionScroll}>
                {exercises.map(ex => {
                  const sets = logs[ex.id] ?? [];
                  const setsLine = sets.map(st => `${st.weight} x ${st.reps}`).join(' / ');
                  return (
                    <View key={ex.id} style={s.overlayExBlock}>
                      <Text style={[s.overlayExName, { color: tc }]} numberOfLines={1}>
                        {`[${ex.brand.toUpperCase()}] ${ex.name.toUpperCase()}`}
                      </Text>
                      {setsLine ? (
                        <Text style={[s.overlayExSet, { color: tc }]} numberOfLines={2}>
                          {setsLine}
                        </Text>
                      ) : null}
                    </View>
                  );
                })}
              </View>
            </View>

          </View>
        )}

        {photoTaken && (
          <>
            <TouchableOpacity style={s.retakeRow} onPress={() => onCapture(photoAspect === '4:3' ? [3, 4] : [9, 16])} activeOpacity={0.75}>
              <Ionicons name="camera-reverse-outline" size={13} color={C.textSub} />
              <Text style={s.retakeText}>다시 찍기</Text>
            </TouchableOpacity>

            {/* Text colour selector */}
            <View style={s.colorPickerWrap}>
              <Text style={s.colorPickerLabel}>텍스트 색상</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.colorPickerRow}>
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

        {/* Share / Save Image row */}
        <View style={s.shareRow}>
          <TouchableOpacity style={s.shareBtn} activeOpacity={0.8} onPress={handleShare}>
            <Ionicons name="share-social-outline" size={16} color={C.accent} />
            <Text style={s.shareBtnTxt}>공유</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.shareBtn} activeOpacity={0.8} onPress={handleSaveImage}>
            <Ionicons name="image-outline" size={16} color={C.textSub} />
            <Text style={[s.shareBtnTxt, { color: C.textSub }]}>
              {saveSuccess ? '저장됨 ✓' : '이미지 저장'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>
      <View style={s.ctaBar}>
        <TouchableOpacity style={s.ctaBtn} activeOpacity={0.85} onPress={async () => {
          let captured: string | undefined;
          if (photoTaken && overlayRef.current) {
            try {
              await new Promise(resolve => requestAnimationFrame(resolve));
              await new Promise<void>(resolve => InteractionManager.runAfterInteractions(() => resolve()));
              if (overlayRef.current) {
                captured = await captureRef(overlayRef, { format: 'png', quality: 0.95, result: 'tmpfile' });
                onCompositeUri(captured);
              }
            } catch (_) {}
          }
          onSave(captured);
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

  function handleSaveTemplate() {
    const name = tplName.trim() || `Workout ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
    saveTemplate({
      name,
      exerciseIds: exercises.map(e => e.id),
      muscles:     [...selectedMuscles],
    });
    setTplSaved(true);
  }

  return (
    <SafeAreaView style={s.safe}>
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

  const [step,              setStep]              = useState<Step>('gym-select');
  const [selectedMuscles,   setSelectedMuscles]   = useState<Set<string>>(new Set());
  const [gym,               setGym]               = useState<GymWithMachines | null>(null);
  const [currentExerciseId, setCurrentExerciseId] = useState<string | null>(null);
  const [loggedIds,         setLoggedIds]         = useState<Set<string>>(new Set());
  const [logs,              setLogs]              = useState<Record<string, SetEntry[]>>({});
  const [notes,             setNotes]             = useState<Record<string, string>>({});
  const [photoTaken,        setPhotoTaken]        = useState(false);
  const [photoUri,          setPhotoUri]          = useState<string | null>(null);
  const [compositeUri,      setCompositeUri]      = useState<string | null>(null);
  const [detectedPRs,       setDetectedPRs]       = useState<{ name: string; weight: number; reps: number }[]>([]);
  const [prCelebration,     setPrCelebration]     = useState<{ name: string; weight: number; reps: number } | null>(null);
  // XP Popup
  const [xpPopupVisible,   setXpPopupVisible]    = useState(false);
  const [xpPopupData,      setXpPopupData]       = useState<{
    machineName: string;
    xpResult:   ReturnType<typeof calculateXP>;
    levelData:  MachineLevelData;
    leveledUp:  boolean;
    newLevel:   number;
  } | null>(null);
  // Overlay
  const [selectedColor,      setSelectedColor]      = useState('#ffffff');
  // Template loading
  const [showTemplates,       setShowTemplates]       = useState(false);
  const [templates,           setTemplates]           = useState<WorkoutTemplate[]>([]);
  const [preloadedIds,        setPreloadedIds]        = useState<Set<string>>(new Set());
  const [routineMachineIds,   setRoutineMachineIds]   = useState<string[]>([]);
  const [routineReadOnly,     setRoutineReadOnly]     = useState(false);
  const [routineExtraInfo,    setRoutineExtraInfo]    = useState<MachineExtraInfo | undefined>(undefined);

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
      setCompositeUri(null);
      setDetectedPRs([]);
      setPrCelebration(null);
      setSelectedColor('#ffffff');
      setShowTemplates(false);
      setTemplates(getTemplates());
      setPreloadedIds(new Set());
      setRoutineMachineIds([]);
      setRoutineReadOnly(false);
    }
  }, [visible]);

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
    setPreloadedIds(new Set(tpl.exerciseIds));
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

  function handleSelectExercise(id: string) {
    setCurrentExerciseId(id);
    setLogs(prev => ({
      ...prev,
      [id]: prev[id]?.length ? prev[id] : [{ weight: 60, reps: 10 }],
    }));
    setStep('log-sets');
  }

  function handleSaveExercise() {
    if (currentExerciseId) {
      setLoggedIds(prev => new Set([...prev, currentExerciseId]));

      const exSets  = logs[currentExerciseId] ?? [];

      // PR detection
      const curMax  = exSets.length ? Math.max(...exSets.map(s => s.weight)) : 0;
      const histPR  = HIST_PRS[currentExerciseId];
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
            exerciseId:   currentExerciseId,
            exerciseName: exInfo.name,
            weight:       curMax,
            reps:         bestSet.reps,
            date:         new Date().toISOString(),
          });
        }
      }

      // XP 계산 및 레벨 업데이트 (머신 운동만, 프리웨이트 제외)
      if (!currentExerciseId.startsWith('fw')) {
        const existingLevel = getMachineLevelData(currentExerciseId);
        const volume        = exSets.reduce((sum, s) => sum + s.weight * s.reps, 0);
        const xpResult      = calculateXP({
          volume,
          isPR,
          isFirstUse:       existingLevel === null,
          weeklyUsageCount: existingLevel?.weeklyUsageCount ?? 0,
        });

        if (xpResult.totalXP > 0) {
          const baseData: MachineLevelData = existingLevel ?? {
            machineId:        currentExerciseId,
            level:            1,
            currentXP:        0,
            totalXP:          0,
            lastUsedAt:       new Date().toISOString(),
            weeklyUsageCount: 0,
          };
          const { updatedData, leveledUp, newLevel } = addXP(baseData, xpResult.totalXP);
          if (user) {
            saveMachineLevelData(updatedData, user.id);
          } else {
            updateMachineLevelData(updatedData);
          }

          const machineName = currentExercise?.name ?? currentExerciseId;
          setXpPopupData({ machineName, xpResult, levelData: updatedData, leveledUp, newLevel });
          setXpPopupVisible(true);
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
    for (const id of loggedIds) {
      if (id.startsWith('fw')) {
        const fw = FREE_WEIGHTS.find(f => f.id === id);
        if (fw) result.push({ id: fw.id, name: fw.name, brand: fw.brand, targetMuscle: fw.targetMuscle });
      } else {
        const m = gym.machines.find(m => m.id === id);
        if (m) result.push({ id: m.id, name: m.name, brand: m.brand, targetMuscle: m.targetMuscle });
      }
    }
    return result;
  }, [loggedIds, gym]);

  // currentExercise object for SetLoggingStep
  const currentExercise: ExerciseInfo | null = useMemo(() => {
    if (!currentExerciseId || !gym) return null;
    if (currentExerciseId.startsWith('fw')) {
      const fw = FREE_WEIGHTS.find(f => f.id === currentExerciseId);
      if (fw) return { id: fw.id, name: fw.name, brand: fw.brand, targetMuscle: fw.targetMuscle };
    } else {
      const m = gym.machines.find(m => m.id === currentExerciseId);
      if (m) return { id: m.id, name: m.name, brand: m.brand, targetMuscle: m.targetMuscle };
    }
    return null;
  }, [currentExerciseId, gym]);

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

  async function handleSaveWorkout(passedCompositeUri?: string) {
    if (!gym) return;
    const effectiveCompositeUri = passedCompositeUri ?? compositeUri;
    const sessionId = `local-${Date.now()}`;
    const supabaseConfigured = !!(process.env.EXPO_PUBLIC_SUPABASE_URL);

    // 사진 업로드 (Supabase Storage)
    let finalPhotoUrl: string | undefined;
    const localUri = effectiveCompositeUri ?? photoUri ?? undefined;
    if (localUri && user && supabaseConfigured) {
      finalPhotoUrl = await uploadWorkoutPhoto(localUri, user.id, sessionId);
    }

    const workoutLog: WorkoutLog = {
      id:          sessionId,
      gymId:       gym.id,
      gymName:     gym.name,
      gymLocation: gym.location,
      date:        new Date().toISOString(),
      machines:    selectedExercises.map(ex => {
        const exSets = logs[ex.id] ?? [];
        const maxSet = exSets.reduce<{ weight: number; reps: number } | null>(
          (best, s) => (!best || s.weight > best.weight ? s : best), null
        );
        const note = notes[ex.id]?.trim();
        return {
          machineId:    ex.id,
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
    if (user && supabaseConfigured) {
      try {
        await insertWorkoutSession({
          id:     sessionId,
          userId: user.id,
          gymId:  gym.id,
          date:   workoutLog.date,
        });

        for (let i = 0; i < selectedExercises.length; i++) {
          const ex = selectedExercises[i];
          const entryId = `entry-${Date.now()}-${i}`;
          await insertWorkoutEntry({
            id:           entryId,
            sessionId,
            machineId:    ex.id,
            machineName:  ex.name,
            machineBrand: ex.brand,
            targetMuscle: ex.targetMuscle,
            exerciseKind: ex.id.startsWith('fw') ? 'freeweight' : 'machine',
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

      // 오운완 피드 포스트 저장
      if (effectiveCompositeUri ?? photoUri) {
        insertFeedPost({
          id:           `feed-${Date.now()}`,
          userId:       user.id,
          nickname:     user.nickname ?? user.name,
          gymId:        gym.id,
          gymName:      gym.name,
          photoUri:     finalPhotoUrl ?? photoUri ?? effectiveCompositeUri ?? '',
          compositeUri: finalPhotoUrl ?? effectiveCompositeUri ?? undefined,
          muscles:      Array.from(selectedMuscles),
          isPublic:     true,
        }).catch(err => {
          if (__DEV__) console.warn('[feed] insertFeedPost failed:', err);
        });
      }
    }

    setStep('done');
  }

  /** Called by WorkoutPhotoStep's "운동 저장" button */
  async function requestSaveWorkout(socialCapturedUri?: string) {
    if (socialCapturedUri) {
      setCompositeUri(socialCapturedUri);
      await handleSaveWorkout(socialCapturedUri);
      return;
    }
    await handleSaveWorkout(undefined);
  }

  async function handleCapture(aspect: [number, number] = [3, 4]) {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    Alert.alert(
      '사진 선택',
      '운동 사진을 추가하세요',
      [
        {
          text: '카메라로 찍기',
          onPress: async () => {
            const camStatus = await ImagePicker.requestCameraPermissionsAsync();
            if (camStatus.status !== 'granted') {
              Alert.alert('권한 필요', '카메라 접근 권한이 필요합니다.');
              return;
            }
            const result = await ImagePicker.launchCameraAsync({
              mediaTypes: ['images'],
              allowsEditing: false,
              quality: 0.9,
            });
            if (!result.canceled && result.assets[0]) {
              setPhotoUri(result.assets[0].uri);
              setPhotoTaken(true);
            }
          },
        },
        {
          text: '사진 선택',
          onPress: async () => {
            if (status !== 'granted') {
              Alert.alert('권한 필요', '사진 라이브러리 접근 권한이 필요합니다.');
              return;
            }
            const result = await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ['images'],
              allowsEditing: false,
              quality: 0.9,
            });
            if (!result.canceled && result.assets[0]) {
              setPhotoUri(result.assets[0].uri);
              setPhotoTaken(true);
            }
          },
        },
        { text: '취소', style: 'cancel' },
      ],
    );
  }

  function renderStep() {
    switch (step) {
      case 'gym-select':
        return (
          <GymSelectStep
            onSelect={handleSelectGym}
            onClose={() => onClose(false)}
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
          />
        );
      case 'routine-reference':
        return (
          <RoutineReferenceScreen
            gymId={gym!.id}
            gymName={gym!.name}
            selectedMuscles={Array.from(selectedMuscles)}
            pastSessions={MOCK_SESSIONS}
            onSelectMachineIds={(ids, extraInfo) => {
              if (ids.length === 0) {
                // Start Fresh: skip today-list, go directly to machine selection
                setStep('exercise-select');
              } else {
                // Routine-based: show pre-populated read-only list
                setRoutineMachineIds(ids);
                setRoutineReadOnly(true);
                setRoutineExtraInfo(extraInfo);
                setStep('today-list');
              }
            }}
            onBack={goBack}
            onClose={() => onClose(false)}
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
              setPreloadedIds(new Set(ids));
              setStep('exercise-select');
            }}
            onBack={goBack}
            onClose={() => onClose(false)}
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
          />
        );
      case 'log-sets':
        return currentExercise ? (
          <SetLoggingStep
            exercise={currentExercise}
            sets={logs[currentExercise.id] ?? []}
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
          />
        ) : null;
      case 'photo':
        return (
          <WorkoutPhotoStep
            gym={gym!}
            exercises={selectedExercises}
            logs={logs}
            photoTaken={photoTaken}
            photoUri={photoUri ?? undefined}
            nickname={user?.nickname ?? user?.name ?? undefined}
            onColorChange={setSelectedColor}
            onCapture={(aspect) => handleCapture(aspect)}
            onCompositeUri={(uri) => setCompositeUri(uri)}
            onSave={requestSaveWorkout}
            onBack={goBack}
            onClose={() => onClose(false)}
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
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        {renderStep()}

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

        {/* XP Gain Popup — absolute View (Modal 중첩 방지) */}
        {xpPopupData && (
          <XPGainPopup
            visible={xpPopupVisible}
            machineName={xpPopupData.machineName}
            xpResult={xpPopupData.xpResult}
            levelData={xpPopupData.levelData}
            leveledUp={xpPopupData.leveledUp}
            newLevel={xpPopupData.newLevel}
            onClose={() => setXpPopupVisible(false)}
          />
        )}
      </View>
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
  overlayBottomLeft: { position: 'absolute', left: Math.max(0, OVERLAY_PAD + LOGO_STRIP_H + 4 - Math.round(PHOTO_W * 0.05)), right: OVERLAY_PAD, bottom: OVERLAY_PAD, top: '50%', zIndex: 3, justifyContent: 'flex-end' },
  overlayMuscleTitle:{ fontSize: 24, fontWeight: '900', letterSpacing: -0.5, marginBottom: 8 },
  sessionScroll:     { maxHeight: 120 },
  overlayExBlock:    { marginBottom: 6 },
  overlayExName:     { fontSize: 9, fontWeight: '900', letterSpacing: 0.5 },
  overlayExSet:      { fontSize: 9, fontWeight: '500', opacity: 0.8, marginTop: 1 },

  // Text colour selector
  colorPickerWrap:   { marginBottom: 20 },
  colorPickerLabel:  { fontSize: 9, fontWeight: '700', color: C.textDim, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 10 },
  colorPickerRow:    { flexDirection: 'row' },
  colorChip:         { width: 36, height: 36, borderRadius: 18, borderWidth: 2, borderColor: 'rgba(255,255,255,0.15)', marginRight: 14 },
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
  prOverlay:     { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.75)', alignItems: 'center', justifyContent: 'center', zIndex: 99 },
  prOverlayCard: { backgroundColor: C.surface, borderRadius: R.card, padding: 32, alignItems: 'center', marginHorizontal: 32, borderWidth: 1, borderColor: C.accent + '40' },
  prOverlayEmoji:{ fontSize: 40, marginBottom: 12 },
  prOverlayTitle:{ fontSize: 18, fontWeight: '900', color: C.text, marginBottom: 8 },
  prOverlayExName:{ fontSize: 14, fontWeight: '700', color: C.textSub, marginBottom: 12 },
  prOverlayWeight:{ fontSize: 40, fontWeight: '900', color: C.accent, letterSpacing: -1 },
  prOverlayReps: { fontSize: 14, color: C.textSub, fontWeight: '600', marginBottom: 24 },
  prOverlayBtn:  { backgroundColor: C.accent, borderRadius: R.btn, paddingHorizontal: 32, paddingVertical: 14 },
  prOverlayBtnTxt:{ fontSize: 15, fontWeight: '900', color: C.bg },
});
