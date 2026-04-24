import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
  TextInput,
  SafeAreaView,
  Animated,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { C, R, T } from '../../theme';
import { GYMS_WITH_MACHINES, GymWithMachines, Machine } from '../../data';

// ─── Types ────────────────────────────────────────────────────────────────────

type ViewName =
  | 'nearby'
  | 'gym-detail'
  | 'machine-list'
  | 'exercise-log'
  | 'summary';

interface StackEntry {
  view: ViewName;
  gymId?: string;
  machineId?: string;
}

interface LoggedSet {
  weight: string;
  reps: string;
  done: boolean;
}

interface LoggedExercise {
  machine: Machine;
  sets: LoggedSet[];
}

// ─── Mock distances ───────────────────────────────────────────────────────────

const MOCK_DIST: Record<string, { dist: string; distNum: number; open: boolean }> = {
  g01: { dist: '0.3 km', distNum: 0.3, open: true  },
  g02: { dist: '0.9 km', distNum: 0.9, open: true  },
  g03: { dist: '1.1 km', distNum: 1.1, open: true  },
  g04: { dist: '1.4 km', distNum: 1.4, open: false },
  g05: { dist: '2.0 km', distNum: 2.0, open: true  },
  g06: { dist: '2.3 km', distNum: 2.3, open: false },
  g07: { dist: '3.1 km', distNum: 3.1, open: true  },
  g08: { dist: '4.5 km', distNum: 4.5, open: true  },
};

function getDist(id: string) {
  return MOCK_DIST[id] ?? { dist: '? km', distNum: 99, open: true };
}

const NEARBY_SORTED = [...GYMS_WITH_MACHINES].sort(
  (a, b) => getDist(a.id).distNum - getDist(b.id).distNum,
);

// ─── Muscle tag colour ────────────────────────────────────────────────────────

const MUSCLE_COLORS: Record<string, { fg: string; bg: string }> = {
  Chest:     C.tagMachine,
  Back:      C.tagBrand,
  Legs:      C.tagMuscle,
  Shoulders: { fg: '#ffd166', bg: '#ffd16618' },
  Arms:      C.tagCategory,
  Core:      { fg: '#06d6a0', bg: '#06d6a018' },
  Cardio:    { fg: '#ef476f', bg: '#ef476f18' },
  'Full Body': { fg: '#a8dadc', bg: '#a8dadc18' },
};

function musclePillStyle(muscle: string) {
  const m = MUSCLE_COLORS[muscle] ?? { fg: C.textSub, bg: C.border };
  return { fg: m.fg, bg: m.bg };
}

// ─── Shared UI atoms ──────────────────────────────────────────────────────────

function NavHeader({
  title,
  onBack,
  onClose,
}: {
  title: string;
  onBack?: () => void;
  onClose?: () => void;
}) {
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
      {onClose ? (
        <TouchableOpacity style={s.navBtn} onPress={onClose} activeOpacity={0.7}>
          <Ionicons name="close" size={20} color={C.textSub} />
        </TouchableOpacity>
      ) : (
        <View style={s.navBtn} />
      )}
    </View>
  );
}

function Pill({ label, fg, bg }: { label: string; fg: string; bg: string }) {
  return (
    <View style={[s.pill, { backgroundColor: bg }]}>
      <Text style={[s.pillText, { color: fg }]}>{label}</Text>
    </View>
  );
}

// ─── NearbyGymsView ───────────────────────────────────────────────────────────

function NearbyGymsView({
  onSelect,
  onClose,
}: {
  onSelect: (gymId: string) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');

  const filtered = query.trim()
    ? NEARBY_SORTED.filter(g =>
        g.name.toLowerCase().includes(query.toLowerCase()) ||
        g.location.toLowerCase().includes(query.toLowerCase()),
      )
    : NEARBY_SORTED;

  return (
    <SafeAreaView style={s.safe}>
      <NavHeader title="Nearby Gyms" onClose={onClose} />

      {/* Search */}
      <View style={s.searchWrap}>
        <Ionicons name="search" size={16} color={C.textSub} style={{ marginRight: 8 }} />
        <TextInput
          style={s.searchInput}
          placeholder="Search gyms..."
          placeholderTextColor={C.textSub}
          value={query}
          onChangeText={setQuery}
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => setQuery('')}>
            <Ionicons name="close-circle" size={16} color={C.textSub} />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.listContent}>
        <Text style={s.resultCount}>{filtered.length} gyms near you</Text>

        {filtered.map(gym => {
          const meta = getDist(gym.id);
          return (
            <TouchableOpacity
              key={gym.id}
              style={s.gymCard}
              activeOpacity={0.8}
              onPress={() => onSelect(gym.id)}
            >
              {/* Accent left bar */}
              <View style={[s.gymCardBar, { backgroundColor: meta.open ? C.accent : C.textDim }]} />

              <View style={{ flex: 1, paddingLeft: 14 }}>
                <View style={s.gymCardTop}>
                  <Text style={s.gymCardName}>{gym.name}</Text>
                  <View style={[s.openBadge, { backgroundColor: meta.open ? C.accentBg : C.border }]}>
                    <Text style={[s.openBadgeText, { color: meta.open ? C.accent : C.textSub }]}>
                      {meta.open ? 'Open' : 'Closed'}
                    </Text>
                  </View>
                </View>

                <View style={s.gymCardMeta}>
                  <Ionicons name="location-outline" size={12} color={C.textSub} />
                  <Text style={s.gymCardLoc}>{gym.location}</Text>
                </View>

                <View style={s.gymCardFooter}>
                  <View style={s.distBadge}>
                    <Ionicons name="navigate-outline" size={11} color={C.accent} />
                    <Text style={s.distText}>{meta.dist}</Text>
                  </View>
                  <Text style={s.machineCount}>{gym.machines.length} machines</Text>
                </View>
              </View>

              <Ionicons name="chevron-forward" size={16} color={C.textDim} style={{ alignSelf: 'center' }} />
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── GymDetailView ────────────────────────────────────────────────────────────

function GymDetailView({
  gym,
  onStartWorkout,
  onBack,
  onClose,
}: {
  gym: GymWithMachines;
  onStartWorkout: () => void;
  onBack: () => void;
  onClose: () => void;
}) {
  const meta = getDist(gym.id);

  // Group machines by muscle for preview
  const byMuscle: Record<string, Machine[]> = {};
  for (const m of gym.machines) {
    (byMuscle[m.targetMuscle] ??= []).push(m);
  }
  const muscleGroups = Object.entries(byMuscle);

  const categories = [...new Set(gym.machines.map(m => m.category))];
  const brands = [...new Set(gym.machines.map(m => m.brand))];

  return (
    <SafeAreaView style={s.safe}>
      <NavHeader title={gym.name} onBack={onBack} onClose={onClose} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.listContent}>

        {/* Hero card */}
        <View style={s.heroCard}>
          <View style={s.heroTop}>
            <View style={{ flex: 1 }}>
              <Text style={s.heroName}>{gym.name}</Text>
              <View style={s.heroMeta}>
                <Ionicons name="location-outline" size={13} color={C.textSub} />
                <Text style={s.heroLoc}>{gym.location}</Text>
              </View>
            </View>
            <View style={[s.openBadge, { backgroundColor: meta.open ? C.accentBg : C.border }]}>
              <Text style={[s.openBadgeText, { color: meta.open ? C.accent : C.textSub }]}>
                {meta.open ? 'Open' : 'Closed'}
              </Text>
            </View>
          </View>
          <Text style={s.heroDesc}>{gym.description}</Text>

          {/* Stat row */}
          <View style={s.heroStats}>
            <View style={s.heroStat}>
              <Text style={s.heroStatVal}>{gym.machines.length}</Text>
              <Text style={s.heroStatLab}>Machines</Text>
            </View>
            <View style={s.heroStatDiv} />
            <View style={s.heroStat}>
              <Text style={s.heroStatVal}>{categories.length}</Text>
              <Text style={s.heroStatLab}>Categories</Text>
            </View>
            <View style={s.heroStatDiv} />
            <View style={s.heroStat}>
              <Text style={s.heroStatVal}>{brands.length}</Text>
              <Text style={s.heroStatLab}>Brands</Text>
            </View>
            <View style={s.heroStatDiv} />
            <View style={s.heroStat}>
              <Text style={s.heroStatVal}>{meta.dist}</Text>
              <Text style={s.heroStatLab}>Distance</Text>
            </View>
          </View>
        </View>

        {/* Muscle breakdown */}
        <Text style={s.sectionTitle}>Equipment by Muscle</Text>
        <View style={s.card}>
          {muscleGroups.map(([muscle, machines], i) => {
            const mp = musclePillStyle(muscle);
            return (
              <React.Fragment key={muscle}>
                {i > 0 && <View style={s.divider} />}
                <View style={s.muscleRow}>
                  <View style={[s.musclePillInline, { backgroundColor: mp.bg }]}>
                    <Text style={[s.musclePillInlineText, { color: mp.fg }]}>{muscle}</Text>
                  </View>
                  <Text style={s.muscleRowMachines}>
                    {machines.slice(0, 2).map(m => m.name).join(', ')}
                    {machines.length > 2 ? ` +${machines.length - 2}` : ''}
                  </Text>
                  <Text style={s.muscleRowCount}>{machines.length}</Text>
                </View>
              </React.Fragment>
            );
          })}
        </View>

        {/* Brand chips */}
        <Text style={s.sectionTitle}>Brands Available</Text>
        <View style={s.brandRow}>
          {brands.map(b => (
            <Pill key={b} label={b} fg={C.tagBrand.fg} bg={C.tagBrand.bg} />
          ))}
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* CTA */}
      <View style={s.ctaBar}>
        <TouchableOpacity style={s.ctaButton} activeOpacity={0.85} onPress={onStartWorkout}>
          <Ionicons name="barbell" size={18} color={C.bg} />
          <Text style={s.ctaButtonText}>Start Workout Here</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

// ─── MachineListView ──────────────────────────────────────────────────────────

function MachineListView({
  gym,
  onSelectMachine,
  onBack,
  onClose,
}: {
  gym: GymWithMachines;
  onSelectMachine: (machineId: string) => void;
  onBack: () => void;
  onClose: () => void;
}) {
  const [activeFilter, setActiveFilter] = useState<string>('All');

  const muscles = ['All', ...Object.keys(
    gym.machines.reduce((acc, m) => { acc[m.targetMuscle] = true; return acc; }, {} as Record<string, boolean>)
  )];

  const visible = activeFilter === 'All'
    ? gym.machines
    : gym.machines.filter(m => m.targetMuscle === activeFilter);

  // Group by muscle
  const byMuscle: Record<string, Machine[]> = {};
  for (const m of visible) {
    (byMuscle[m.targetMuscle] ??= []).push(m);
  }

  return (
    <SafeAreaView style={s.safe}>
      <NavHeader title="Machines" onBack={onBack} onClose={onClose} />

      {/* Filter chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.filterRow}
      >
        {muscles.map(muscle => (
          <TouchableOpacity
            key={muscle}
            style={[s.filterChip, activeFilter === muscle && s.filterChipActive]}
            onPress={() => setActiveFilter(muscle)}
            activeOpacity={0.7}
          >
            <Text style={[s.filterChipText, activeFilter === muscle && s.filterChipTextActive]}>
              {muscle}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.listContent}>
        {Object.entries(byMuscle).map(([muscle, machines]) => {
          const mp = musclePillStyle(muscle);
          return (
            <View key={muscle}>
              <View style={s.muscleSectionHeader}>
                <View style={[s.muscleSectionDot, { backgroundColor: mp.fg }]} />
                <Text style={s.muscleSectionTitle}>{muscle}</Text>
                <Text style={s.muscleSectionCount}>{machines.length}</Text>
              </View>
              <View style={s.card}>
                {machines.map((machine, i) => (
                  <React.Fragment key={machine.id}>
                    {i > 0 && <View style={s.divider} />}
                    <TouchableOpacity
                      style={s.machineRow}
                      activeOpacity={0.75}
                      onPress={() => onSelectMachine(machine.id)}
                    >
                      <View style={[s.machineIcon, { backgroundColor: mp.bg }]}>
                        <Ionicons name="barbell-outline" size={16} color={mp.fg} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={s.machineName}>{machine.name}</Text>
                        <Text style={s.machineBrand}>{machine.brand}</Text>
                      </View>
                      <View style={s.categoryPill}>
                        <Text style={s.categoryPillText}>{machine.category}</Text>
                      </View>
                      <Ionicons name="chevron-forward" size={14} color={C.textDim} style={{ marginLeft: 6 }} />
                    </TouchableOpacity>
                  </React.Fragment>
                ))}
              </View>
            </View>
          );
        })}
        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── ExerciseLogView ──────────────────────────────────────────────────────────

function ExerciseLogView({
  machine,
  gym,
  onFinish,
  onBack,
  onClose,
}: {
  machine: Machine;
  gym: GymWithMachines;
  onFinish: (sets: LoggedSet[]) => void;
  onBack: () => void;
  onClose: () => void;
}) {
  const [sets, setSets] = useState<LoggedSet[]>([
    { weight: '60', reps: '10', done: false },
  ]);
  const scaleAnims = useRef<Animated.Value[]>([new Animated.Value(1)]).current;

  const mp = musclePillStyle(machine.targetMuscle);

  function addSet() {
    const last = sets[sets.length - 1];
    setSets(prev => [...prev, { weight: last.weight, reps: last.reps, done: false }]);
    scaleAnims.push(new Animated.Value(1));
  }

  function removeSet(index: number) {
    if (sets.length <= 1) return;
    setSets(prev => prev.filter((_, i) => i !== index));
    scaleAnims.splice(index, 1);
  }

  function toggleDone(index: number) {
    const anim = scaleAnims[index];
    Animated.sequence([
      Animated.spring(anim, { toValue: 1.25, useNativeDriver: true, speed: 40, bounciness: 12 }),
      Animated.spring(anim, { toValue: 1,    useNativeDriver: true, speed: 40 }),
    ]).start();
    setSets(prev => prev.map((s, i) => i === index ? { ...s, done: !s.done } : s));
  }

  function updateSet(index: number, field: 'weight' | 'reps', val: string) {
    setSets(prev => prev.map((s, i) => i === index ? { ...s, [field]: val } : s));
  }

  const doneSets = sets.filter(s => s.done).length;

  return (
    <SafeAreaView style={s.safe}>
      <NavHeader title="Log Exercise" onBack={onBack} onClose={onClose} />

      {/* Machine header */}
      <View style={s.exerciseHeader}>
        <View style={[s.exHeaderIcon, { backgroundColor: mp.bg }]}>
          <Ionicons name="barbell" size={22} color={mp.fg} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.exHeaderName}>{machine.name}</Text>
          <Text style={s.exHeaderMeta}>{gym.name} · {machine.brand}</Text>
        </View>
        <Pill label={machine.targetMuscle} fg={mp.fg} bg={mp.bg} />
      </View>

      {/* Progress */}
      <View style={s.progressWrap}>
        <View style={s.progressBar}>
          <View style={[s.progressFill, { width: sets.length > 0 ? `${(doneSets / sets.length) * 100}%` : '0%' }]} />
        </View>
        <Text style={s.progressText}>{doneSets}/{sets.length} sets done</Text>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.listContent}>
          {/* Column labels */}
          <View style={s.setHeader}>
            <Text style={[s.setHeaderCell, { width: 36 }]}>Set</Text>
            <Text style={[s.setHeaderCell, { flex: 1, textAlign: 'center' }]}>kg</Text>
            <Text style={[s.setHeaderCell, { flex: 1, textAlign: 'center' }]}>Reps</Text>
            <View style={{ width: 60 }} />
          </View>

          {sets.map((set, i) => (
            <Animated.View
              key={i}
              style={[s.setRow, set.done && s.setRowDone, { transform: [{ scale: scaleAnims[i] }] }]}
            >
              <Text style={s.setNum}>{i + 1}</Text>
              <TextInput
                style={[s.setInput, set.done && s.setInputDone]}
                value={set.weight}
                onChangeText={v => updateSet(i, 'weight', v)}
                keyboardType="numeric"
                selectTextOnFocus
              />
              <TextInput
                style={[s.setInput, set.done && s.setInputDone]}
                value={set.reps}
                onChangeText={v => updateSet(i, 'reps', v)}
                keyboardType="numeric"
                selectTextOnFocus
              />
              <View style={s.setActions}>
                <TouchableOpacity
                  style={[s.checkBtn, set.done && s.checkBtnDone]}
                  onPress={() => toggleDone(i)}
                  activeOpacity={0.75}
                >
                  <Ionicons name="checkmark" size={16} color={set.done ? C.bg : C.textDim} />
                </TouchableOpacity>
                {sets.length > 1 && (
                  <TouchableOpacity onPress={() => removeSet(i)} style={s.deleteBtn}>
                    <Ionicons name="close" size={14} color={C.textDim} />
                  </TouchableOpacity>
                )}
              </View>
            </Animated.View>
          ))}

          <TouchableOpacity style={s.addSetBtn} onPress={addSet} activeOpacity={0.8}>
            <Ionicons name="add" size={16} color={C.accent} />
            <Text style={s.addSetText}>Add Set</Text>
          </TouchableOpacity>

          <View style={{ height: 100 }} />
        </ScrollView>
      </KeyboardAvoidingView>

      <View style={s.ctaBar}>
        <TouchableOpacity
          style={[s.ctaButton, doneSets === 0 && s.ctaButtonDisabled]}
          activeOpacity={0.85}
          onPress={() => onFinish(sets.filter(s => s.done))}
          disabled={doneSets === 0}
        >
          <Ionicons name="checkmark-done" size={18} color={C.bg} />
          <Text style={s.ctaButtonText}>Finish Workout</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

// ─── WorkoutSummaryView ───────────────────────────────────────────────────────

function WorkoutSummaryView({
  machine,
  gym,
  sets,
  onDone,
}: {
  machine: Machine;
  gym: GymWithMachines;
  sets: LoggedSet[];
  onDone: () => void;
}) {
  const totalVolume = sets.reduce((acc, s) => {
    const w = parseFloat(s.weight) || 0;
    const r = parseInt(s.reps) || 0;
    return acc + w * r;
  }, 0);
  const topSet = [...sets].sort((a, b) => (parseFloat(b.weight) || 0) - (parseFloat(a.weight) || 0))[0];
  const mp = musclePillStyle(machine.targetMuscle);

  return (
    <SafeAreaView style={s.safe}>
      <NavHeader title="Workout Summary" onClose={onDone} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.listContent}>

        {/* Confetti-like hero */}
        <View style={s.summaryHero}>
          <View style={s.summaryCheck}>
            <Ionicons name="checkmark" size={36} color={C.bg} />
          </View>
          <Text style={s.summaryTitle}>Workout Complete!</Text>
          <Text style={s.summarySub}>Great session at {gym.name}</Text>
        </View>

        {/* Stats */}
        <View style={s.summaryStatsRow}>
          <View style={s.summaryStat}>
            <Text style={s.summaryStatVal}>{sets.length}</Text>
            <Text style={s.summaryStatLab}>Sets</Text>
          </View>
          <View style={s.summaryStatDiv} />
          <View style={s.summaryStat}>
            <Text style={s.summaryStatVal}>{totalVolume.toFixed(0)}</Text>
            <Text style={s.summaryStatLab}>kg Volume</Text>
          </View>
          <View style={s.summaryStatDiv} />
          <View style={s.summaryStat}>
            <Text style={s.summaryStatVal}>{topSet?.weight ?? '—'}</Text>
            <Text style={s.summaryStatLab}>Top Weight</Text>
          </View>
        </View>

        {/* Exercise recap */}
        <Text style={s.sectionTitle}>Exercise</Text>
        <View style={s.heroCard}>
          <View style={s.heroTop}>
            <View style={[s.machineIcon, { backgroundColor: mp.bg }]}>
              <Ionicons name="barbell" size={18} color={mp.fg} />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={s.gymCardName}>{machine.name}</Text>
              <Text style={s.gymCardLoc}>{machine.brand}</Text>
            </View>
            <Pill label={machine.targetMuscle} fg={mp.fg} bg={mp.bg} />
          </View>
        </View>

        {/* Set breakdown */}
        <Text style={s.sectionTitle}>Set Breakdown</Text>
        <View style={s.card}>
          {sets.map((set, i) => (
            <React.Fragment key={i}>
              {i > 0 && <View style={s.divider} />}
              <View style={s.summarySetRow}>
                <View style={s.summarySetNum}>
                  <Text style={s.summarySetNumText}>{i + 1}</Text>
                </View>
                <Text style={s.summarySetWeight}>{set.weight} kg</Text>
                <Text style={s.summarySetX}>×</Text>
                <Text style={s.summarySetReps}>{set.reps} reps</Text>
                <Text style={s.summarySetVol}>
                  {((parseFloat(set.weight) || 0) * (parseInt(set.reps) || 0)).toFixed(0)} kg
                </Text>
              </View>
            </React.Fragment>
          ))}
        </View>

        {/* Personal best notice */}
        <View style={s.pbBanner}>
          <Ionicons name="trophy" size={16} color={C.accent} />
          <Text style={s.pbText}>New session logged — keep the momentum!</Text>
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>

      <View style={s.ctaBar}>
        <TouchableOpacity style={s.ctaButton} activeOpacity={0.85} onPress={onDone}>
          <Ionicons name="home" size={18} color={C.bg} />
          <Text style={s.ctaButtonText}>Back to Home</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

// ─── GymFlowModal (root) ──────────────────────────────────────────────────────

interface GymFlowModalProps {
  visible: boolean;
  onClose: () => void;
  initialGymId?: string;
}

export default function GymFlowModal({ visible, onClose, initialGymId }: GymFlowModalProps) {
  const [stack, setStack] = useState<StackEntry[]>([
    initialGymId
      ? { view: 'gym-detail', gymId: initialGymId }
      : { view: 'nearby' },
  ]);
  const [loggedSets, setLoggedSets] = useState<LoggedSet[]>([]);

  // Reset stack when modal opens
  React.useEffect(() => {
    if (visible) {
      setStack([
        initialGymId
          ? { view: 'gym-detail', gymId: initialGymId }
          : { view: 'nearby' },
      ]);
      setLoggedSets([]);
    }
  }, [visible, initialGymId]);

  const current = stack[stack.length - 1];

  function push(entry: StackEntry) {
    setStack(prev => [...prev, entry]);
  }

  function pop() {
    if (stack.length <= 1) {
      onClose();
    } else {
      setStack(prev => prev.slice(0, -1));
    }
  }

  const gym = current.gymId
    ? GYMS_WITH_MACHINES.find(g => g.id === current.gymId)
    : undefined;
  const machine = current.machineId && gym
    ? gym.machines.find(m => m.id === current.machineId)
    : undefined;

  function renderView() {
    if (current.view === 'nearby') {
      return (
        <NearbyGymsView
          onSelect={gymId => push({ view: 'gym-detail', gymId })}
          onClose={onClose}
        />
      );
    }

    if (current.view === 'gym-detail' && gym) {
      return (
        <GymDetailView
          gym={gym}
          onStartWorkout={() => push({ view: 'machine-list', gymId: gym.id })}
          onBack={pop}
          onClose={onClose}
        />
      );
    }

    if (current.view === 'machine-list' && gym) {
      return (
        <MachineListView
          gym={gym}
          onSelectMachine={machineId => push({ view: 'exercise-log', gymId: gym.id, machineId })}
          onBack={pop}
          onClose={onClose}
        />
      );
    }

    if (current.view === 'exercise-log' && gym && machine) {
      return (
        <ExerciseLogView
          machine={machine}
          gym={gym}
          onFinish={doneSets => {
            setLoggedSets(doneSets);
            push({ view: 'summary', gymId: gym.id, machineId: machine.id });
          }}
          onBack={pop}
          onClose={onClose}
        />
      );
    }

    if (current.view === 'summary' && gym && machine) {
      return (
        <WorkoutSummaryView
          machine={machine}
          gym={gym}
          sets={loggedSets}
          onDone={onClose}
        />
      );
    }

    return null;
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={pop}
    >
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        {renderView()}
      </View>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },

  // Nav header
  navHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  navBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navTitle: {
    flex: 1,
    textAlign: 'center',
    ...T.section,
    color: C.text,
  },

  // Search
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.surface,
    marginHorizontal: 16,
    marginVertical: 12,
    borderRadius: R.inner,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: C.border,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: C.text,
  },

  // List content
  listContent: { paddingHorizontal: 16, paddingBottom: 24 },
  resultCount: { fontSize: 12, color: C.textSub, fontWeight: '600', marginBottom: 12 },

  // Gym card (nearby)
  gymCard: {
    flexDirection: 'row',
    alignItems: 'stretch',
    backgroundColor: C.surface,
    borderRadius: R.card,
    borderWidth: 1,
    borderColor: C.border,
    marginBottom: 10,
    overflow: 'hidden',
    paddingRight: 14,
    paddingVertical: 14,
  },
  gymCardBar: { width: 4, borderRadius: 2 },
  gymCardTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  gymCardName: { flex: 1, fontSize: 15, fontWeight: '700', color: C.text },
  gymCardMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 8 },
  gymCardLoc: { fontSize: 12, color: C.textSub },
  gymCardFooter: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  distBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: C.accentBg,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: R.pill,
  },
  distText: { fontSize: 11, fontWeight: '700', color: C.accent },
  machineCount: { fontSize: 12, color: C.textSub, fontWeight: '500' },

  openBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: R.pill,
  },
  openBadgeText: { fontSize: 11, fontWeight: '700' },

  // Hero card (gym detail)
  heroCard: {
    backgroundColor: C.surface,
    borderRadius: R.card,
    borderWidth: 1,
    borderColor: C.border,
    padding: 16,
    marginBottom: 20,
  },
  heroTop: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 },
  heroName: { fontSize: 20, fontWeight: '800', color: C.text, letterSpacing: -0.5 },
  heroMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  heroLoc: { fontSize: 13, color: C.textSub },
  heroDesc: { fontSize: 14, color: C.textSub, lineHeight: 20, marginBottom: 14 },
  heroStats: { flexDirection: 'row', alignItems: 'center' },
  heroStat: { flex: 1, alignItems: 'center' },
  heroStatVal: { fontSize: 20, fontWeight: '800', color: C.text },
  heroStatLab: { fontSize: 10, color: C.textSub, fontWeight: '600', marginTop: 2 },
  heroStatDiv: { width: 1, height: 32, backgroundColor: C.border },

  // Muscle rows
  muscleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 11,
    gap: 10,
  },
  musclePillInline: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: R.pill,
    minWidth: 72,
    alignItems: 'center',
  },
  musclePillInlineText: { fontSize: 11, fontWeight: '700' },
  muscleRowMachines: { flex: 1, fontSize: 12, color: C.textSub },
  muscleRowCount: { fontSize: 13, fontWeight: '700', color: C.text },

  // Brand row
  brandRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: R.pill,
  },
  pillText: { fontSize: 12, fontWeight: '700' },

  // Section heading
  sectionTitle: {
    ...T.section,
    color: C.text,
    marginBottom: 10,
    marginTop: 4,
  },

  // Shared card + divider
  card: {
    backgroundColor: C.surface,
    borderRadius: R.card,
    borderWidth: 1,
    borderColor: C.border,
    overflow: 'hidden',
    marginBottom: 20,
  },
  divider: { height: 1, backgroundColor: C.border },

  // Machine list filter
  filterRow: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: R.pill,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
  },
  filterChipActive: {
    backgroundColor: C.accent,
    borderColor: C.accent,
  },
  filterChipText: { fontSize: 13, fontWeight: '600', color: C.textSub },
  filterChipTextActive: { color: C.bg },

  // Muscle section header
  muscleSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
    marginTop: 4,
  },
  muscleSectionDot: { width: 8, height: 8, borderRadius: 4 },
  muscleSectionTitle: { flex: 1, fontSize: 14, fontWeight: '700', color: C.text },
  muscleSectionCount: {
    fontSize: 12,
    fontWeight: '600',
    color: C.textSub,
    backgroundColor: C.surface,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: R.pill,
    borderWidth: 1,
    borderColor: C.border,
  },

  // Machine row
  machineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 12,
  },
  machineIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  machineName: { fontSize: 14, fontWeight: '700', color: C.text },
  machineBrand: { fontSize: 12, color: C.textSub, marginTop: 2 },
  categoryPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: R.pill,
    backgroundColor: C.tagCategory.bg,
  },
  categoryPillText: { fontSize: 11, fontWeight: '600', color: C.tagCategory.fg },

  // Exercise log header
  exerciseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  exHeaderIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  exHeaderName: { fontSize: 16, fontWeight: '800', color: C.text },
  exHeaderMeta: { fontSize: 12, color: C.textSub, marginTop: 2 },

  // Progress
  progressWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  progressBar: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: C.border,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: C.accent,
    borderRadius: 2,
  },
  progressText: { fontSize: 12, fontWeight: '700', color: C.accent, minWidth: 60, textAlign: 'right' },

  // Set rows
  setHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 8,
  },
  setHeaderCell: { fontSize: 11, fontWeight: '700', color: C.textSub, letterSpacing: 0.5, textTransform: 'uppercase' },

  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.surface,
    borderRadius: R.inner,
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
    gap: 10,
  },
  setRowDone: {
    borderColor: C.accent + '60',
    backgroundColor: C.accentBg,
  },
  setNum: {
    width: 26,
    fontSize: 13,
    fontWeight: '700',
    color: C.textSub,
    textAlign: 'center',
  },
  setInput: {
    flex: 1,
    fontSize: 26,
    fontWeight: '900',
    color: C.text,
    textAlign: 'center',
    letterSpacing: -0.5,
    fontVariant: ['tabular-nums'],
    padding: 0,
  },
  setInputDone: { color: C.accent },
  setActions: { flexDirection: 'row', alignItems: 'center', gap: 6, width: 60, justifyContent: 'flex-end' },
  checkBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: C.surface,
    borderWidth: 1.5,
    borderColor: C.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkBtnDone: { backgroundColor: C.accent, borderColor: C.accent },
  deleteBtn: {
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Add set
  addSetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: C.surface,
    borderRadius: R.inner,
    borderWidth: 1,
    borderColor: C.border,
    borderStyle: 'dashed',
    paddingVertical: 14,
    marginTop: 4,
  },
  addSetText: { fontSize: 14, fontWeight: '700', color: C.accent },

  // CTA bar
  ctaBar: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: C.border,
    backgroundColor: C.bg,
  },
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: C.accent,
    borderRadius: R.btn,
    paddingVertical: 16,
  },
  ctaButtonDisabled: { opacity: 0.4 },
  ctaButtonText: { fontSize: 15, fontWeight: '800', color: C.bg },

  // Summary
  summaryHero: { alignItems: 'center', paddingVertical: 32 },
  summaryCheck: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: C.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  summaryTitle: { ...T.title, color: C.text, marginBottom: 6 },
  summarySub: { fontSize: 14, color: C.textSub },

  summaryStatsRow: {
    flexDirection: 'row',
    backgroundColor: C.surface,
    borderRadius: R.card,
    borderWidth: 1,
    borderColor: C.border,
    marginBottom: 20,
    paddingVertical: 16,
  },
  summaryStat: { flex: 1, alignItems: 'center' },
  summaryStatVal: { fontSize: 22, fontWeight: '900', color: C.accent },
  summaryStatLab: { fontSize: 11, color: C.textSub, fontWeight: '600', marginTop: 4 },
  summaryStatDiv: { width: 1, backgroundColor: C.border },

  summarySetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
  },
  summarySetNum: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: C.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summarySetNumText: { fontSize: 12, fontWeight: '700', color: C.textSub },
  summarySetWeight: { fontSize: 16, fontWeight: '800', color: C.text, flex: 1 },
  summarySetX: { fontSize: 14, color: C.textDim, fontWeight: '600' },
  summarySetReps: { fontSize: 16, fontWeight: '800', color: C.text, flex: 1, textAlign: 'center' },
  summarySetVol: { fontSize: 13, fontWeight: '600', color: C.accent, minWidth: 52, textAlign: 'right' },

  pbBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: C.accentBg,
    borderRadius: R.inner,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginTop: 4,
  },
  pbText: { fontSize: 13, fontWeight: '600', color: C.accent },
});
