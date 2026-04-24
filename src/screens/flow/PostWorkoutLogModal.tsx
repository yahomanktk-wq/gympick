import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
  TextInput,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { C, R, T } from '../../theme';
import { GYMS_WITH_MACHINES, GymWithMachines, Machine } from '../../data';

// ─── Types ────────────────────────────────────────────────────────────────────

type Step = 'gym-select' | 'muscle-select' | 'machine-select' | 'log-sets' | 'photo' | 'done';

interface SetEntry { weight: string; reps: string; }

// ─── Constants ────────────────────────────────────────────────────────────────

const CARD_W = (Dimensions.get('window').width - 48) / 2; // two columns, 16+16 padding + 16 gap

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

function getDist(id: string) {
  return MOCK_DIST[id] ?? { dist: '? km', distNum: 99 };
}

const GYM_LIST = [...GYMS_WITH_MACHINES].sort(
  (a, b) => getDist(a.id).distNum - getDist(b.id).distNum,
);

// ─── Muscle palette ───────────────────────────────────────────────────────────

const MUSCLE_COLORS: Record<string, { fg: string; bg: string }> = {
  Chest:       C.tagMachine,
  Back:        C.tagBrand,
  Legs:        C.tagMuscle,
  Shoulders:   { fg: '#ffd166', bg: '#ffd16618' },
  Arms:        C.tagCategory,
  Core:        { fg: '#06d6a0', bg: '#06d6a018' },
  'Full Body': { fg: '#a8dadc', bg: '#a8dadc18' },
  Glutes:      { fg: '#ff9ecd', bg: '#ff9ecd18' },
};

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

const MUSCLE_GROUPS: { name: string; icon: IoniconName }[] = [
  { name: 'Chest',     icon: 'body-outline'      },
  { name: 'Back',      icon: 'barbell-outline'   },
  { name: 'Legs',      icon: 'walk-outline'      },
  { name: 'Shoulders', icon: 'person-outline'    },
  { name: 'Arms',      icon: 'fitness-outline'   },
  { name: 'Core',      icon: 'radio-button-on-outline' },
  { name: 'Full Body', icon: 'people-outline'    },
  { name: 'Glutes',    icon: 'trail-sign-outline'},
];

function mpStyle(muscle: string) {
  return MUSCLE_COLORS[muscle] ?? { fg: C.textSub, bg: C.border };
}

// ─── Shared atoms ─────────────────────────────────────────────────────────────

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

// ─── Step 1: Gym Select ───────────────────────────────────────────────────────

function GymSelectView({ onSelect, onClose }: {
  onSelect: (gym: GymWithMachines) => void;
  onClose: () => void;
}) {
  return (
    <SafeAreaView style={s.safe}>
      <NavHeader title="Where did you train?" onClose={onClose} />
      <StepBar total={5} current={0} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.listPad}>
        <Text style={s.hint}>Select the gym from your recent session</Text>
        {GYM_LIST.map(gym => (
          <TouchableOpacity key={gym.id} style={s.gymCard} activeOpacity={0.8} onPress={() => onSelect(gym)}>
            <View style={s.gymCardBar} />
            <View style={{ flex: 1, paddingLeft: 14 }}>
              <Text style={s.gymCardName}>{gym.name}</Text>
              <View style={s.gymMeta}>
                <Ionicons name="location-outline" size={12} color={C.textSub} />
                <Text style={s.gymMetaLoc}>{gym.location}</Text>
                <Text style={s.dot}>·</Text>
                <Ionicons name="navigate-outline" size={11} color={C.accent} />
                <Text style={s.gymMetaDist}>{getDist(gym.id).dist}</Text>
              </View>
              <Text style={s.gymMachineCount}>{gym.machines.length} machines available</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={C.textDim} style={{ alignSelf: 'center' }} />
          </TouchableOpacity>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Step 2: Muscle Select ────────────────────────────────────────────────────

function MuscleSelectView({ gym, selected, onToggle, onNext, onBack, onClose }: {
  gym: GymWithMachines;
  selected: Set<string>;
  onToggle: (m: string) => void;
  onNext: () => void;
  onBack: () => void;
  onClose: () => void;
}) {
  // Only show muscles that the gym actually covers
  const availableMuscles = new Set(gym.machines.map(m => m.targetMuscle));
  const groups = MUSCLE_GROUPS.filter(g => availableMuscles.has(g.name));

  return (
    <SafeAreaView style={s.safe}>
      <NavHeader title="Target muscles" onBack={onBack} onClose={onClose} />
      <StepBar total={5} current={1} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.listPad}>
        <Text style={s.hint}>Select all muscle groups you trained at {gym.name}</Text>
        <View style={s.muscleGrid}>
          {groups.map(g => {
            const on = selected.has(g.name);
            const mp = mpStyle(g.name);
            return (
              <TouchableOpacity
                key={g.name}
                style={[s.muscleTile, on && { borderColor: mp.fg, backgroundColor: mp.bg }]}
                onPress={() => onToggle(g.name)}
                activeOpacity={0.75}
              >
                {on && (
                  <View style={[s.muscleTileCheck, { backgroundColor: mp.fg }]}>
                    <Ionicons name="checkmark" size={10} color={C.bg} />
                  </View>
                )}
                <View style={[s.muscleTileIcon, { backgroundColor: on ? mp.fg + '22' : C.surfaceHigh }]}>
                  <Ionicons name={g.icon} size={24} color={on ? mp.fg : C.textSub} />
                </View>
                <Text style={[s.muscleTileName, on && { color: mp.fg }]}>{g.name}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <View style={{ height: 100 }} />
      </ScrollView>
      <View style={s.ctaBar}>
        <TouchableOpacity
          style={[s.ctaBtn, selected.size === 0 && s.ctaDisabled]}
          activeOpacity={0.85}
          onPress={onNext}
          disabled={selected.size === 0}
        >
          <Text style={s.ctaTxt}>
            {selected.size === 0 ? 'Select at least one muscle' : `Show Machines (${selected.size} group${selected.size > 1 ? 's' : ''})`}
          </Text>
          <Ionicons name="chevron-forward" size={18} color={C.bg} />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

// ─── Step 3: Machine Select (image cards) ─────────────────────────────────────

function MachineCard({ machine, selected, onToggle }: {
  machine: Machine;
  selected: boolean;
  onToggle: () => void;
}) {
  const mp = mpStyle(machine.targetMuscle);
  return (
    <TouchableOpacity
      style={[s.machineCard, { width: CARD_W }, selected && s.machineCardOn]}
      activeOpacity={0.8}
      onPress={onToggle}
    >
      {/* Sports-card photo area */}
      <View style={[s.machineCardImg, { backgroundColor: mp.bg }]}>
        {/* Decorative large icon */}
        <Ionicons name="barbell" size={56} color={mp.fg} style={{ opacity: 0.25 }} />
        {/* Centred icon */}
        <View style={[s.machineCardIconBadge, { backgroundColor: mp.fg + '22' }]}>
          <Ionicons name="barbell-outline" size={26} color={mp.fg} />
        </View>
        {/* Muscle tag top-right */}
        <View style={[s.machineCardMuscleTag, { backgroundColor: mp.fg + 'cc' }]}>
          <Text style={s.machineCardMuscleTagText}>{machine.targetMuscle}</Text>
        </View>
        {/* Selection overlay */}
        {selected && (
          <View style={s.machineCardCheckOverlay}>
            <View style={[s.machineCardCheckCircle, { backgroundColor: C.accent }]}>
              <Ionicons name="checkmark" size={16} color={C.bg} />
            </View>
          </View>
        )}
      </View>
      {/* Info bar */}
      <View style={s.machineCardInfo}>
        <Text style={s.machineCardName} numberOfLines={2}>{machine.name}</Text>
        <Text style={s.machineCardBrand} numberOfLines={1}>{machine.brand}</Text>
      </View>
    </TouchableOpacity>
  );
}

function MachineSelectView({ gym, selectedMuscles, selected, onToggle, onNext, onBack, onClose }: {
  gym: GymWithMachines;
  selectedMuscles: Set<string>;
  selected: Set<string>;
  onToggle: (id: string) => void;
  onNext: () => void;
  onBack: () => void;
  onClose: () => void;
}) {
  const machines = gym.machines.filter(m => selectedMuscles.has(m.targetMuscle));

  return (
    <SafeAreaView style={s.safe}>
      <NavHeader title="Select machines used" onBack={onBack} onClose={onClose} />
      <StepBar total={5} current={2} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.listPad}>
        <Text style={s.hint}>Tap each machine you trained on · {machines.length} available</Text>
        <View style={s.machineGrid}>
          {machines.map(machine => (
            <MachineCard
              key={machine.id}
              machine={machine}
              selected={selected.has(machine.id)}
              onToggle={() => onToggle(machine.id)}
            />
          ))}
        </View>
        <View style={{ height: 100 }} />
      </ScrollView>
      <View style={s.ctaBar}>
        <TouchableOpacity
          style={[s.ctaBtn, selected.size === 0 && s.ctaDisabled]}
          activeOpacity={0.85}
          onPress={onNext}
          disabled={selected.size === 0}
        >
          <Text style={s.ctaTxt}>
            {selected.size === 0 ? 'Select machines' : `Log ${selected.size} machine${selected.size > 1 ? 's' : ''}`}
          </Text>
          <Ionicons name="chevron-forward" size={18} color={C.bg} />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

// ─── Step 4: Log Sets ─────────────────────────────────────────────────────────

function LogSetsView({ machines, logs, onChangeSet, onAddSet, onRemoveSet, onNext, onBack, onClose }: {
  machines: Machine[];
  logs: Record<string, SetEntry[]>;
  onChangeSet: (machineId: string, idx: number, field: keyof SetEntry, val: string) => void;
  onAddSet: (machineId: string) => void;
  onRemoveSet: (machineId: string, idx: number) => void;
  onNext: () => void;
  onBack: () => void;
  onClose: () => void;
}) {
  const allFilled = machines.every(m => {
    const sets = logs[m.id] ?? [];
    return sets.length > 0 && sets.some(s => s.weight || s.reps);
  });

  return (
    <SafeAreaView style={s.safe}>
      <NavHeader title="Log your sets" onBack={onBack} onClose={onClose} />
      <StepBar total={5} current={3} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.listPad}>
          <Text style={s.hint}>Log each set you performed — weight and reps are independent</Text>

          {machines.map(machine => {
            const mp   = mpStyle(machine.targetMuscle);
            const sets = logs[machine.id] ?? [];
            return (
              <View key={machine.id} style={s.logCard}>
                {/* Machine header */}
                <View style={s.logCardHead}>
                  <View style={[s.logMachineIcon, { backgroundColor: mp.bg }]}>
                    <Ionicons name="barbell" size={18} color={mp.fg} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.logMachineName}>{machine.name}</Text>
                    <Text style={s.logMachineBrand}>{machine.brand}</Text>
                  </View>
                  <View style={[s.logMusclePill, { backgroundColor: mp.bg }]}>
                    <Text style={[s.logMusclePillText, { color: mp.fg }]}>{machine.targetMuscle}</Text>
                  </View>
                </View>

                {/* Column labels */}
                <View style={s.setColHeader}>
                  <Text style={[s.setColLabel, { width: 30 }]}>SET</Text>
                  <Text style={[s.setColLabel, { flex: 1, textAlign: 'center' }]}>WEIGHT (kg)</Text>
                  <Text style={[s.setColLabel, { flex: 1, textAlign: 'center' }]}>REPS</Text>
                  <View style={{ width: 28 }} />
                </View>

                {/* Set rows */}
                {sets.map((set, idx) => (
                  <View key={idx} style={s.setRow}>
                    <Text style={s.setIdx}>{idx + 1}</Text>
                    <TextInput
                      style={s.setInput}
                      value={set.weight}
                      onChangeText={v => onChangeSet(machine.id, idx, 'weight', v)}
                      keyboardType="decimal-pad"
                      placeholder="—"
                      placeholderTextColor={C.textDim}
                      selectTextOnFocus
                    />
                    <TextInput
                      style={s.setInput}
                      value={set.reps}
                      onChangeText={v => onChangeSet(machine.id, idx, 'reps', v)}
                      keyboardType="number-pad"
                      placeholder="—"
                      placeholderTextColor={C.textDim}
                      selectTextOnFocus
                    />
                    {sets.length > 1 ? (
                      <TouchableOpacity
                        style={s.setRemoveBtn}
                        onPress={() => onRemoveSet(machine.id, idx)}
                      >
                        <Ionicons name="remove-circle-outline" size={18} color={C.textDim} />
                      </TouchableOpacity>
                    ) : (
                      <View style={{ width: 28 }} />
                    )}
                  </View>
                ))}

                {/* Add set */}
                <TouchableOpacity style={s.addSetBtn} onPress={() => onAddSet(machine.id)} activeOpacity={0.75}>
                  <Ionicons name="add" size={14} color={C.accent} />
                  <Text style={s.addSetText}>Add Set</Text>
                </TouchableOpacity>
              </View>
            );
          })}

          <View style={{ height: 100 }} />
        </ScrollView>
      </KeyboardAvoidingView>
      <View style={s.ctaBar}>
        <TouchableOpacity
          style={[s.ctaBtn, !allFilled && s.ctaDisabled]}
          activeOpacity={0.85}
          onPress={onNext}
          disabled={!allFilled}
        >
          <Ionicons name="checkmark-done" size={18} color={C.bg} />
          <Text style={s.ctaTxt}>Finish Workout Log</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

// ─── Step 5: Photo ────────────────────────────────────────────────────────────

function PhotoView({ gym, machines, logs, bodyWeight, onChangeBodyWeight, photoTaken, onCapture, onSave, onBack, onClose }: {
  gym: GymWithMachines;
  machines: Machine[];
  logs: Record<string, SetEntry[]>;
  bodyWeight: string;
  onChangeBodyWeight: (v: string) => void;
  photoTaken: boolean;
  onCapture: () => void;
  onSave: () => void;
  onBack: () => void;
  onClose: () => void;
}) {
  const now     = new Date();
  const dateStr = now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

  return (
    <SafeAreaView style={s.safe}>
      <NavHeader title="Workout Photo" onBack={onBack} onClose={onClose} />
      <StepBar total={5} current={4} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.listPad}>
          <Text style={s.hint}>Capture a post-workout photo — the overlay is added automatically</Text>

          {/* Photo frame */}
          <TouchableOpacity
            style={[s.photoFrame, photoTaken && s.photoFrameActive]}
            activeOpacity={0.85}
            onPress={onCapture}
          >
            {!photoTaken ? (
              <View style={s.photoCta}>
                <View style={s.photoCtaIcon}>
                  <Ionicons name="camera" size={30} color={C.textSub} />
                </View>
                <Text style={s.photoCtaTitle}>Tap to take photo</Text>
                <Text style={s.photoCtaSub}>Optional · skip to save without photo</Text>
              </View>
            ) : (
              <View style={s.overlayWrap}>
                <View style={s.overlayBg}>
                  <Ionicons name="person" size={72} color={C.textDim} style={{ opacity: 0.15 }} />
                </View>
                <View style={s.overlayContent}>
                  <View style={s.overlayTopRow}>
                    <Text style={s.overlayLogo}>GymPick</Text>
                    <Text style={s.overlayDateTime}>{dateStr}  {timeStr}</Text>
                  </View>
                  <View>
                    <Text style={s.overlayGymName}>{gym.name}</Text>
                    <Text style={s.overlayGymSub}>{gym.location}</Text>
                    <View style={s.overlaySummary}>
                      {machines.slice(0, 3).map(m => {
                        const sets = logs[m.id] ?? [];
                        const best = sets.find(s => s.weight) ?? sets[0];
                        return (
                          <Text key={m.id} style={s.overlaySummaryLine}>
                            {m.name}  {best?.weight ? `${best.weight} kg` : '—'} × {best?.reps || '—'} reps · {sets.length} set{sets.length !== 1 ? 's' : ''}
                          </Text>
                        );
                      })}
                      {machines.length > 3 && (
                        <Text style={s.overlaySummaryLine}>+{machines.length - 3} more</Text>
                      )}
                    </View>
                  </View>
                  <View style={s.overlayBottomRow}>
                    {bodyWeight ? (
                      <View style={s.overlayBwBadge}>
                        <Text style={s.overlayBwLabel}>BW</Text>
                        <Text style={s.overlayBwVal}>{bodyWeight} kg</Text>
                      </View>
                    ) : <View />}
                    <View style={s.overlayBrand}>
                      <Ionicons name="barbell" size={9} color={C.accent} />
                      <Text style={s.overlayBrandText}>gympick.app</Text>
                    </View>
                  </View>
                </View>
              </View>
            )}
          </TouchableOpacity>

          {photoTaken && (
            <TouchableOpacity style={s.retakeRow} onPress={onCapture} activeOpacity={0.75}>
              <Ionicons name="camera-reverse-outline" size={13} color={C.textSub} />
              <Text style={s.retakeText}>Retake photo</Text>
            </TouchableOpacity>
          )}

          {/* Body weight */}
          <Text style={s.sectionTitle}>Body Weight (optional)</Text>
          <View style={s.bwCard}>
            <Ionicons name="body-outline" size={18} color={C.accent} />
            <TextInput
              style={s.bwInput}
              value={bodyWeight}
              onChangeText={onChangeBodyWeight}
              keyboardType="decimal-pad"
              placeholder="e.g. 78.5"
              placeholderTextColor={C.textDim}
              selectTextOnFocus
            />
            <Text style={s.bwUnit}>kg</Text>
          </View>

          <View style={{ height: 100 }} />
        </ScrollView>
      </KeyboardAvoidingView>
      <View style={s.ctaBar}>
        <TouchableOpacity style={s.ctaBtn} activeOpacity={0.85} onPress={onSave}>
          <Ionicons name="checkmark-done" size={18} color={C.bg} />
          <Text style={s.ctaTxt}>Save Workout</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

// ─── Step 6: Done ─────────────────────────────────────────────────────────────

function DoneView({ gym, machines, logs, onClose }: {
  gym: GymWithMachines;
  machines: Machine[];
  logs: Record<string, SetEntry[]>;
  onClose: () => void;
}) {
  const totalSets = machines.reduce((a, m) => a + (logs[m.id]?.length ?? 0), 0);
  const totalVol  = machines.reduce((a, m) => {
    return a + (logs[m.id] ?? []).reduce((sa, s) => {
      return sa + (parseFloat(s.weight) || 0) * (parseInt(s.reps) || 0);
    }, 0);
  }, 0);

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.listPad}>
        <View style={s.doneHero}>
          <View style={s.doneCheck}>
            <Ionicons name="checkmark" size={44} color={C.bg} />
          </View>
          <Text style={s.doneTitle}>Session Logged!</Text>
          <Text style={s.doneSub}>Great work at {gym.name}</Text>
        </View>

        <View style={s.doneStats}>
          <View style={s.doneStat}><Text style={s.doneStatVal}>{machines.length}</Text><Text style={s.doneStatLab}>Machines</Text></View>
          <View style={s.doneStatDiv} />
          <View style={s.doneStat}><Text style={s.doneStatVal}>{totalSets}</Text><Text style={s.doneStatLab}>Total Sets</Text></View>
          <View style={s.doneStatDiv} />
          <View style={s.doneStat}><Text style={s.doneStatVal}>{totalVol > 0 ? totalVol.toFixed(0) : '—'}</Text><Text style={s.doneStatLab}>kg Volume</Text></View>
        </View>

        <Text style={s.sectionTitle}>Session Summary</Text>
        <View style={s.summaryCard}>
          {machines.map((machine, i) => {
            const mp   = mpStyle(machine.targetMuscle);
            const sets = logs[machine.id] ?? [];
            return (
              <React.Fragment key={machine.id}>
                {i > 0 && <View style={s.divider} />}
                <View style={s.summaryRow}>
                  <View style={[s.summaryIcon, { backgroundColor: mp.bg }]}>
                    <Ionicons name="barbell-outline" size={14} color={mp.fg} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.summaryName}>{machine.name}</Text>
                    <Text style={s.summaryDetail}>{sets.length} set{sets.length !== 1 ? 's' : ''} logged</Text>
                  </View>
                </View>
              </React.Fragment>
            );
          })}
        </View>
        <View style={{ height: 40 }} />
      </ScrollView>
      <View style={s.ctaBar}>
        <TouchableOpacity style={s.ctaBtn} activeOpacity={0.85} onPress={onClose}>
          <Ionicons name="book-outline" size={18} color={C.bg} />
          <Text style={s.ctaTxt}>Back to Journal</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

// ─── Root modal ───────────────────────────────────────────────────────────────

interface PostWorkoutLogModalProps {
  visible: boolean;
  onClose: (saved: boolean) => void;
}

export default function PostWorkoutLogModal({ visible, onClose }: PostWorkoutLogModalProps) {
  const [step,           setStep]           = useState<Step>('gym-select');
  const [gym,            setGym]            = useState<GymWithMachines | null>(null);
  const [selectedMuscles, setSelectedMuscles] = useState<Set<string>>(new Set());
  const [selectedIds,    setSelectedIds]    = useState<Set<string>>(new Set());
  const [logs,           setLogs]           = useState<Record<string, SetEntry[]>>({});
  const [bodyWeight,     setBodyWeight]     = useState('');
  const [photoTaken,     setPhotoTaken]     = useState(false);

  React.useEffect(() => {
    if (visible) {
      setStep('gym-select');
      setGym(null);
      setSelectedMuscles(new Set());
      setSelectedIds(new Set());
      setLogs({});
      setBodyWeight('');
      setPhotoTaken(false);
    }
  }, [visible]);

  function handleSelectGym(g: GymWithMachines) {
    setGym(g);
    setSelectedMuscles(new Set());
    setStep('muscle-select');
  }

  function handleToggleMuscle(m: string) {
    setSelectedMuscles(prev => {
      const next = new Set(prev);
      next.has(m) ? next.delete(m) : next.add(m);
      return next;
    });
  }

  function handleGoToMachineSelect() {
    setSelectedIds(new Set());
    setStep('machine-select');
  }

  function handleToggleMachine(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function handleGoToLogSets() {
    const next: Record<string, SetEntry[]> = {};
    for (const id of selectedIds) {
      next[id] = logs[id]?.length ? logs[id] : [{ weight: '', reps: '' }];
    }
    setLogs(next);
    setStep('log-sets');
  }

  function handleChangeSet(machineId: string, idx: number, field: keyof SetEntry, val: string) {
    setLogs(prev => ({
      ...prev,
      [machineId]: prev[machineId].map((s, i) => i === idx ? { ...s, [field]: val } : s),
    }));
  }

  function handleAddSet(machineId: string) {
    setLogs(prev => ({
      ...prev,
      [machineId]: [...prev[machineId], { weight: '', reps: '' }],
    }));
  }

  function handleRemoveSet(machineId: string, idx: number) {
    setLogs(prev => ({
      ...prev,
      [machineId]: prev[machineId].filter((_, i) => i !== idx),
    }));
  }

  const selectedMachines = gym?.machines.filter(m => selectedIds.has(m.id)) ?? [];

  const ORDER: Step[] = ['gym-select', 'muscle-select', 'machine-select', 'log-sets', 'photo', 'done'];

  function goBack() {
    const i = ORDER.indexOf(step);
    if (i <= 0) onClose(false);
    else setStep(ORDER[i - 1]);
  }

  function renderStep() {
    switch (step) {
      case 'gym-select':
        return <GymSelectView onSelect={handleSelectGym} onClose={() => onClose(false)} />;

      case 'muscle-select':
        return (
          <MuscleSelectView
            gym={gym!}
            selected={selectedMuscles}
            onToggle={handleToggleMuscle}
            onNext={handleGoToMachineSelect}
            onBack={goBack}
            onClose={() => onClose(false)}
          />
        );

      case 'machine-select':
        return (
          <MachineSelectView
            gym={gym!}
            selectedMuscles={selectedMuscles}
            selected={selectedIds}
            onToggle={handleToggleMachine}
            onNext={handleGoToLogSets}
            onBack={goBack}
            onClose={() => onClose(false)}
          />
        );

      case 'log-sets':
        return (
          <LogSetsView
            machines={selectedMachines}
            logs={logs}
            onChangeSet={handleChangeSet}
            onAddSet={handleAddSet}
            onRemoveSet={handleRemoveSet}
            onNext={() => setStep('photo')}
            onBack={goBack}
            onClose={() => onClose(false)}
          />
        );

      case 'photo':
        return (
          <PhotoView
            gym={gym!}
            machines={selectedMachines}
            logs={logs}
            bodyWeight={bodyWeight}
            onChangeBodyWeight={setBodyWeight}
            photoTaken={photoTaken}
            onCapture={() => setPhotoTaken(true)}
            onSave={() => setStep('done')}
            onBack={goBack}
            onClose={() => onClose(false)}
          />
        );

      case 'done':
        return (
          <DoneView
            gym={gym!}
            machines={selectedMachines}
            logs={logs}
            onClose={() => onClose(true)}
          />
        );
    }
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={goBack}
    >
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        {renderStep()}
      </View>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },

  navHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.border },
  navBtn:    { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  navTitle:  { flex: 1, textAlign: 'center', ...T.section, color: C.text },

  stepBar: { flexDirection: 'row', gap: 4, paddingHorizontal: 16, paddingVertical: 10 },
  stepSeg: { flex: 1, height: 3, borderRadius: 2 },

  listPad:   { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 24 },
  hint:      { fontSize: 13, color: C.textSub, marginBottom: 16, lineHeight: 18 },
  sectionTitle: { ...T.section, color: C.text, marginBottom: 10, marginTop: 16 },

  // Gym card
  gymCard:        { flexDirection: 'row', alignItems: 'stretch', backgroundColor: C.surface, borderRadius: R.card, borderWidth: 1, borderColor: C.border, marginBottom: 10, overflow: 'hidden', paddingRight: 14, paddingVertical: 14 },
  gymCardBar:     { width: 4, backgroundColor: C.accent, borderRadius: 2 },
  gymCardName:    { fontSize: 15, fontWeight: '700', color: C.text, marginBottom: 4 },
  gymMeta:        { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 3 },
  gymMetaLoc:     { fontSize: 12, color: C.textSub },
  dot:            { fontSize: 12, color: C.textDim },
  gymMetaDist:    { fontSize: 11, fontWeight: '700', color: C.accent },
  gymMachineCount:{ fontSize: 11, color: C.textDim },

  // Muscle grid
  muscleGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  muscleTile: {
    width: CARD_W, aspectRatio: 1, borderRadius: R.card,
    borderWidth: 1.5, borderColor: C.border,
    backgroundColor: C.surface,
    alignItems: 'center', justifyContent: 'center', gap: 10,
    position: 'relative',
  },
  muscleTileCheck: {
    position: 'absolute', top: 10, right: 10,
    width: 18, height: 18, borderRadius: 9,
    alignItems: 'center', justifyContent: 'center',
  },
  muscleTileIcon: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  muscleTileName: { fontSize: 13, fontWeight: '700', color: C.textSub },

  // Machine image card grid
  machineGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  machineCard: {
    borderRadius: R.card, overflow: 'hidden',
    borderWidth: 1.5, borderColor: C.border,
    backgroundColor: C.surface,
  },
  machineCardOn:  { borderColor: C.accent },
  machineCardImg: {
    height: CARD_W * 1.15,
    alignItems: 'center', justifyContent: 'center',
    position: 'relative',
  },
  machineCardIconBadge: {
    width: 60, height: 60, borderRadius: 30,
    alignItems: 'center', justifyContent: 'center',
    position: 'absolute',
  },
  machineCardMuscleTag: {
    position: 'absolute', top: 10, right: 10,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: R.pill,
  },
  machineCardMuscleTagText: { fontSize: 9, fontWeight: '800', color: '#fff', letterSpacing: 0.3 },
  machineCardCheckOverlay: {
    position: 'absolute', top: 10, left: 10,
  },
  machineCardCheckCircle: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  machineCardInfo: { paddingHorizontal: 10, paddingVertical: 10, backgroundColor: C.surface },
  machineCardName: { fontSize: 12, fontWeight: '700', color: C.text, marginBottom: 2 },
  machineCardBrand:{ fontSize: 10, color: C.textSub },

  // Log sets card
  logCard:         { backgroundColor: C.surface, borderRadius: R.card, borderWidth: 1, borderColor: C.border, padding: 14, marginBottom: 12 },
  logCardHead:     { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  logMachineIcon:  { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  logMachineName:  { fontSize: 14, fontWeight: '800', color: C.text },
  logMachineBrand: { fontSize: 11, color: C.textSub, marginTop: 1 },
  logMusclePill:   { paddingHorizontal: 8, paddingVertical: 3, borderRadius: R.pill },
  logMusclePillText:{ fontSize: 10, fontWeight: '700' },

  setColHeader: { flexDirection: 'row', alignItems: 'center', paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: C.border, marginBottom: 8 },
  setColLabel:  { fontSize: 9, fontWeight: '700', color: C.textDim, letterSpacing: 1, textTransform: 'uppercase' },

  setRow:      { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  setIdx:      { width: 30, fontSize: 12, fontWeight: '700', color: C.textDim, textAlign: 'center' },
  setInput:    {
    flex: 1, height: 44, fontSize: 22, fontWeight: '900', color: C.text,
    textAlign: 'center', letterSpacing: -0.5, fontVariant: ['tabular-nums'],
    backgroundColor: C.surfaceHigh, borderRadius: R.inner,
    borderWidth: 1, borderColor: C.border, padding: 0,
  },
  setRemoveBtn: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },

  addSetBtn:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 8, paddingVertical: 10, borderRadius: R.inner, borderWidth: 1.5, borderColor: C.accent + '40', borderStyle: 'dashed' },
  addSetText: { fontSize: 13, fontWeight: '700', color: C.accent },

  // CTA
  ctaBar:    { padding: 16, borderTopWidth: 1, borderTopColor: C.border, backgroundColor: C.bg },
  ctaBtn:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: C.accent, borderRadius: R.btn, paddingVertical: 16 },
  ctaDisabled:{ opacity: 0.35 },
  ctaTxt:    { fontSize: 15, fontWeight: '800', color: C.bg },

  // Photo
  photoFrame:      { height: 290, borderRadius: R.card, borderWidth: 1.5, borderColor: C.border, borderStyle: 'dashed', overflow: 'hidden', marginBottom: 10, backgroundColor: C.surface, alignItems: 'center', justifyContent: 'center' },
  photoFrameActive:{ borderStyle: 'solid', borderColor: C.accent + '50', backgroundColor: '#07070f' },
  photoCta:        { alignItems: 'center', gap: 10 },
  photoCtaIcon:    { width: 64, height: 64, borderRadius: 32, backgroundColor: C.surfaceHigh, alignItems: 'center', justifyContent: 'center' },
  photoCtaTitle:   { fontSize: 15, fontWeight: '700', color: C.textSub },
  photoCtaSub:     { fontSize: 12, color: C.textDim },
  retakeRow:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 6 },
  retakeText:      { fontSize: 12, color: C.textSub },

  overlayWrap:     { flex: 1, width: '100%' },
  overlayBg:       { ...StyleSheet.absoluteFillObject, backgroundColor: '#07070f', alignItems: 'center', justifyContent: 'center' },
  overlayContent:  { flex: 1, padding: 16, justifyContent: 'space-between' },
  overlayTopRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  overlayLogo:     { fontSize: 15, fontWeight: '900', color: C.accent, letterSpacing: -0.3 },
  overlayDateTime: { fontSize: 9,  color: 'rgba(255,255,255,0.45)', fontWeight: '600' },
  overlayGymName:  { fontSize: 17, fontWeight: '900', color: '#fff', letterSpacing: -0.5, marginBottom: 2 },
  overlayGymSub:   { fontSize: 10, color: 'rgba(255,255,255,0.4)', marginBottom: 10 },
  overlaySummary:  { gap: 3 },
  overlaySummaryLine: { fontSize: 10, color: 'rgba(255,255,255,0.65)', fontWeight: '600' },
  overlayBottomRow:{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  overlayBwBadge:  { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(200,255,87,0.12)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: R.pill },
  overlayBwLabel:  { fontSize: 8, fontWeight: '700', color: C.accent, letterSpacing: 1 },
  overlayBwVal:    { fontSize: 13, fontWeight: '900', color: C.accent },
  overlayBrand:    { flexDirection: 'row', alignItems: 'center', gap: 4 },
  overlayBrandText:{ fontSize: 8, color: C.accent, fontWeight: '700', letterSpacing: 0.5 },

  bwCard:  { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.surface, borderRadius: R.card, borderWidth: 1, borderColor: C.border, paddingHorizontal: 16, paddingVertical: 14 },
  bwInput: { flex: 1, fontSize: 22, fontWeight: '800', color: C.text, fontVariant: ['tabular-nums'], padding: 0 },
  bwUnit:  { fontSize: 14, color: C.textSub, fontWeight: '600' },

  // Done
  doneHero:    { alignItems: 'center', paddingVertical: 40 },
  doneCheck:   { width: 84, height: 84, borderRadius: 42, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center', marginBottom: 18 },
  doneTitle:   { ...T.title, color: C.text, marginBottom: 6 },
  doneSub:     { fontSize: 14, color: C.textSub },
  doneStats:   { flexDirection: 'row', backgroundColor: C.surface, borderRadius: R.card, borderWidth: 1, borderColor: C.border, marginBottom: 24, paddingVertical: 16 },
  doneStat:    { flex: 1, alignItems: 'center' },
  doneStatVal: { fontSize: 22, fontWeight: '900', color: C.accent },
  doneStatLab: { fontSize: 11, color: C.textSub, fontWeight: '600', marginTop: 4 },
  doneStatDiv: { width: 1, backgroundColor: C.border },

  summaryCard:   { backgroundColor: C.surface, borderRadius: R.card, borderWidth: 1, borderColor: C.border, overflow: 'hidden', marginBottom: 20 },
  divider:       { height: 1, backgroundColor: C.border },
  summaryRow:    { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12 },
  summaryIcon:   { width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  summaryName:   { fontSize: 13, fontWeight: '700', color: C.text },
  summaryDetail: { fontSize: 11, color: C.textSub, marginTop: 2 },
});
