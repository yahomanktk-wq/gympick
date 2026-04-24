import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Modal,
  Pressable,
  SafeAreaView,
  StatusBar,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { C, R, T } from '../../theme';
import { ManagedGym, Machine, GymStatus } from '../../data/types';
import { MANAGED_GYMS } from '../../data/mockAdmin';
import { MACHINES } from '../../data/machines';

// ─── Types ────────────────────────────────────────────────────────────────────

type ManagerView = 'home' | 'register' | 'edit' | 'machines';

interface MachineForm { name: string; brand: string; targetMuscle: string; category: string }
interface GymForm     { name: string; location: string; description: string; phone: string; website: string; hours: string }

const EMPTY_GYM_FORM:     GymForm     = { name: '', location: '', description: '', phone: '', website: '', hours: '' };
const EMPTY_MACHINE_FORM: MachineForm = { name: '', brand: '', targetMuscle: '', category: '' };

const { width: SCREEN_W } = Dimensions.get('window');
const PHOTO_SIZE = Math.floor((SCREEN_W - 40 - 16) / 3);

const STATUS_META: Record<GymStatus, { label: string; color: string; bg: string }> = {
  approved: { label: 'Live',     color: C.accent,  bg: C.accentBg  },
  pending:  { label: 'Pending',  color: '#ffb547', bg: '#ffb54718' },
  rejected: { label: 'Rejected', color: C.danger,  bg: C.dangerBg  },
  flagged:  { label: 'Flagged',  color: '#ff7c47', bg: '#ff7c4718' },
};

const MUSCLE_COLORS: Record<string, { fg: string; bg: string }> = {
  Back:      C.tagMachine,
  Chest:     C.tagMuscle,
  Legs:      C.tagCategory,
  Core:      C.tagBrand,
  Glutes:    C.tagMuscle,
  Shoulders: C.tagBrand,
  'Full Body': C.tagCategory,
};
function muscleColor(muscle: string) {
  return MUSCLE_COLORS[muscle] ?? { fg: C.textSub, bg: C.surfaceHigh };
}

function uid() { return Math.random().toString(36).slice(2, 9); }

// ─── Shared atoms ─────────────────────────────────────────────────────────────

function Header({ title, subtitle, onBack, right }: {
  title: string; subtitle?: string; onBack: () => void; right?: React.ReactNode;
}) {
  return (
    <View style={styles.header}>
      <TouchableOpacity onPress={onBack} style={styles.backBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
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

function Field({ label, value, onChangeText, placeholder, multiline = false, hint }: {
  label: string; value: string; onChangeText: (t: string) => void;
  placeholder?: string; multiline?: boolean; hint?: string;
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
      />
      {hint && <Text style={styles.fieldHint}>{hint}</Text>}
    </View>
  );
}

// ─── Step bar ─────────────────────────────────────────────────────────────────

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

// ─── Main component ───────────────────────────────────────────────────────────

export default function ManagerDashboard({ onClose }: { onClose: () => void }) {
  // Navigation
  const [viewStack, setViewStack] = useState<ManagerView[]>(['home']);
  const currentView = viewStack[viewStack.length - 1];
  const push = (v: ManagerView) => setViewStack(p => [...p, v]);
  const pop  = () => {
    if (viewStack.length <= 1) { onClose(); return; }
    setViewStack(p => p.slice(0, -1));
  };

  // Gyms
  const [gyms, setGyms]           = useState<ManagedGym[]>(MANAGED_GYMS);
  const [selectedGym, setSelectedGym] = useState<ManagedGym | null>(null);

  // Register form
  const [step, setStep]       = useState(1);
  const [regForm, setRegForm] = useState<GymForm>(EMPTY_GYM_FORM);
  const setReg = (key: keyof GymForm) => (t: string) => setRegForm(f => ({ ...f, [key]: t }));

  // Edit form
  const [editForm, setEditForm] = useState<GymForm>(EMPTY_GYM_FORM);
  const setEdit = (key: keyof GymForm) => (t: string) => setEditForm(f => ({ ...f, [key]: t }));
  const [photos, setPhotos]     = useState<string[]>([]);

  // Machines
  const [gymMachines, setGymMachines]         = useState<Machine[]>([]);
  const [machineModal, setMachineModal]         = useState(false);
  const [machineForm, setMachineForm]           = useState<MachineForm>(EMPTY_MACHINE_FORM);
  const setMF = (key: keyof MachineForm) => (t: string) => setMachineForm(f => ({ ...f, [key]: t }));
  const [editingMachineId, setEditingMachineId] = useState<string | null>(null);

  // Helpers
  const openEdit = (gym: ManagedGym) => {
    setSelectedGym(gym);
    setEditForm({ name: gym.name, location: gym.location, description: gym.description, phone: gym.phone, website: gym.website, hours: gym.hours });
    setPhotos(Array.from({ length: gym.photoCount }, (_, i) => `p_${gym.id}_${i}`));
    push('edit');
  };

  const openMachines = (gym: ManagedGym) => {
    setSelectedGym(gym);
    setGymMachines(MACHINES.filter(m => gym.machineIds.includes(m.id)));
    push('machines');
  };

  // ─── HOME VIEW ────────────────────────────────────────────────────────────

  const HomeView = () => (
    <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

      {/* Summary row */}
      <View style={styles.homeSummary}>
        {[
          { value: String(gyms.length),                                   label: 'Gyms'    },
          { value: String(gyms.filter(g => g.status === 'approved').length), label: 'Live'    },
          { value: String(gyms.filter(g => g.status === 'pending').length),  label: 'Pending' },
        ].map(s => (
          <View key={s.label} style={styles.summaryCell}>
            <Text style={styles.summaryCellValue}>{s.value}</Text>
            <Text style={styles.summaryCellLabel}>{s.label}</Text>
          </View>
        ))}
      </View>

      {/* Gym cards */}
      <Text style={styles.groupLabel}>MY GYMS</Text>
      {gyms.map(gym => (
        <View
          key={gym.id}
          style={[styles.gymCard, { borderLeftColor: STATUS_META[gym.status].color }]}
        >
          {/* Top row */}
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

          {/* Meta chips */}
          <View style={styles.gymCardMeta}>
            <View style={styles.metaChip}>
              <Ionicons name="barbell-outline" size={11} color={C.textSub} />
              <Text style={styles.metaChipText}>{gym.machineIds.length} machines</Text>
            </View>
            <View style={styles.metaChip}>
              <Ionicons name="image-outline" size={11} color={C.textSub} />
              <Text style={styles.metaChipText}>{gym.photoCount} photos</Text>
            </View>
            <View style={styles.metaChip}>
              <Ionicons name="time-outline" size={11} color={C.textSub} />
              <Text style={styles.metaChipText}>{gym.submittedAt}</Text>
            </View>
          </View>

          {/* Actions */}
          <View style={styles.gymCardActions}>
            <TouchableOpacity style={styles.gymActionBtn} onPress={() => openEdit(gym)} activeOpacity={0.8}>
              <Ionicons name="create-outline" size={14} color={C.accent} />
              <Text style={styles.gymActionBtnText}>Edit Profile</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.gymActionBtn} onPress={() => openMachines(gym)} activeOpacity={0.8}>
              <Ionicons name="barbell-outline" size={14} color={C.accent} />
              <Text style={styles.gymActionBtnText}>Machines</Text>
            </TouchableOpacity>
          </View>
        </View>
      ))}

      {/* Register CTA */}
      <TouchableOpacity
        style={styles.registerBtn}
        onPress={() => { setStep(1); setRegForm(EMPTY_GYM_FORM); push('register'); }}
        activeOpacity={0.88}
      >
        <Ionicons name="add-circle-outline" size={18} color={C.bg} />
        <Text style={styles.registerBtnText}>Register New Gym</Text>
      </TouchableOpacity>

      <View style={styles.infoNote}>
        <Ionicons name="information-circle-outline" size={15} color={C.textSub} style={{ marginTop: 1 }} />
        <Text style={styles.infoNoteText}>
          New gyms and profile edits go through admin review before going live. This usually takes 1–2 business days.
        </Text>
      </View>
    </ScrollView>
  );

  // ─── REGISTER VIEW ────────────────────────────────────────────────────────

  const submitRegistration = () => {
    if (!regForm.name.trim() || !regForm.location.trim()) {
      Alert.alert('Missing fields', 'Gym name and location are required.');
      return;
    }
    const newGym: ManagedGym = {
      id: uid(), ...regForm,
      machineIds: [], managerId: 'u2',
      status: 'pending',
      submittedAt: new Date().toISOString().split('T')[0],
      photoCount: 0,
    };
    setGyms(prev => [...prev, newGym]);
    Alert.alert('Gym Submitted', 'Your gym registration is now pending admin review.', [
      { text: 'Done', onPress: pop },
    ]);
  };

  const STEP_LABELS = ['Basic Info', 'Contact', 'Review'];

  const RegisterView = () => (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <StepBar current={step} labels={STEP_LABELS} />

        {step === 1 && (
          <SectionCard title="Tell us about your gym">
            <Field label="Gym Name *"    value={regForm.name}        onChangeText={setReg('name')}        placeholder="e.g. IronHub Fitness" />
            <Field label="Location *"    value={regForm.location}    onChangeText={setReg('location')}    placeholder="e.g. Gangnam-gu, Seoul" />
            <Field label="Description *" value={regForm.description} onChangeText={setReg('description')} placeholder="What makes your gym unique?" multiline hint="Shown on your gym's public listing" />
          </SectionCard>
        )}

        {step === 2 && (
          <SectionCard title="Help members find and reach you">
            <Field label="Phone"   value={regForm.phone}   onChangeText={setReg('phone')}   placeholder="e.g. 02-1234-5678" />
            <Field label="Website" value={regForm.website} onChangeText={setReg('website')} placeholder="e.g. mygym.kr" />
            <Field label="Hours"   value={regForm.hours}   onChangeText={setReg('hours')}   placeholder="e.g. Mon–Fri 06:00–23:00" multiline />
          </SectionCard>
        )}

        {step === 3 && (
          <View>
            <SectionCard title="Review your submission">
              {([
                ['Gym Name',     regForm.name],
                ['Location',     regForm.location],
                ['Description',  regForm.description],
                ['Phone',        regForm.phone    || '—'],
                ['Website',      regForm.website  || '—'],
                ['Hours',        regForm.hours    || '—'],
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
              <Ionicons name="shield-checkmark-outline" size={14} color={C.textSub} />
              <Text style={styles.reviewNoteText}>
                An admin will review your gym within 1–2 business days. You can continue adding machines after approval.
              </Text>
            </View>
          </View>
        )}

        <View style={styles.stepNav}>
          {step > 1 && (
            <TouchableOpacity style={styles.stepBack} onPress={() => setStep(s => s - 1)} activeOpacity={0.8}>
              <Text style={styles.stepBackText}>Back</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.stepNext, step > 1 && { flex: 1 }]}
            onPress={step < 3 ? () => setStep(s => s + 1) : submitRegistration}
            activeOpacity={0.88}
          >
            <Text style={styles.stepNextText}>{step < 3 ? 'Continue' : 'Submit for Review'}</Text>
            {step < 3 && <Ionicons name="arrow-forward" size={15} color={C.bg} />}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );

  // ─── EDIT VIEW ────────────────────────────────────────────────────────────

  const saveEdits = () =>
    Alert.alert(
      'Submit Changes?',
      'Your edits will be sent to an admin for review before going live.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Submit',
          onPress: () => {
            setGyms(prev => prev.map(g => g.id === selectedGym?.id ? { ...g, ...editForm } : g));
            Alert.alert('Changes Submitted', 'An admin will review your edits shortly.', [
              { text: 'Done', onPress: pop },
            ]);
          },
        },
      ],
    );

  const EditView = () => (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Profile fields */}
        <SectionCard title="Basic Info">
          <Field label="Gym Name"    value={editForm.name}        onChangeText={setEdit('name')} />
          <Field label="Location"    value={editForm.location}    onChangeText={setEdit('location')} />
          <Field label="Description" value={editForm.description} onChangeText={setEdit('description')} multiline />
        </SectionCard>

        <SectionCard title="Contact & Hours">
          <Field label="Phone"   value={editForm.phone}   onChangeText={setEdit('phone')} />
          <Field label="Website" value={editForm.website} onChangeText={setEdit('website')} />
          <Field label="Hours"   value={editForm.hours}   onChangeText={setEdit('hours')} multiline />
        </SectionCard>

        {/* Photos */}
        <View style={styles.sectionCard}>
          <View style={styles.photoSectionHeader}>
            <Text style={styles.sectionCardTitle}>Photos</Text>
            <Text style={styles.photoCount}>{photos.length} uploaded</Text>
          </View>
          <View style={styles.photoGrid}>
            {photos.map(id => (
              <View key={id} style={[styles.photoTile, { width: PHOTO_SIZE, height: PHOTO_SIZE }]}>
                <View style={styles.photoPlaceholder}>
                  <Ionicons name="image-outline" size={20} color={C.textDim} />
                </View>
                <TouchableOpacity
                  style={styles.photoRemoveBtn}
                  onPress={() => Alert.alert('Remove Photo', 'Remove this photo?', [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Remove', style: 'destructive', onPress: () => setPhotos(p => p.filter(x => x !== id)) },
                  ])}
                >
                  <Ionicons name="close" size={10} color="#fff" />
                </TouchableOpacity>
              </View>
            ))}
            <TouchableOpacity
              style={[styles.photoTile, styles.photoUploadBtn, { width: PHOTO_SIZE, height: PHOTO_SIZE }]}
              onPress={() => Alert.alert('Upload Photo', 'In the full app, this opens the camera or photo library.')}
              activeOpacity={0.75}
            >
              <Ionicons name="camera-outline" size={22} color={C.textSub} />
              <Text style={styles.photoUploadText}>Add Photo</Text>
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity style={styles.saveBtn} onPress={saveEdits} activeOpacity={0.88}>
          <Text style={styles.saveBtnText}>Submit Changes for Review</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );

  // ─── MACHINES VIEW ────────────────────────────────────────────────────────

  const openAddMachine = () => {
    setEditingMachineId(null);
    setMachineForm(EMPTY_MACHINE_FORM);
    setMachineModal(true);
  };

  const openEditMachine = (m: Machine) => {
    setEditingMachineId(m.id);
    setMachineForm({ name: m.name, brand: m.brand, targetMuscle: m.targetMuscle, category: m.category });
    setMachineModal(true);
  };

  const saveMachine = () => {
    if (!machineForm.name.trim() || !machineForm.brand.trim()) {
      Alert.alert('Missing fields', 'Name and brand are required.');
      return;
    }
    if (editingMachineId) {
      setGymMachines(prev => prev.map(m => m.id === editingMachineId ? { ...m, ...machineForm } : m));
    } else {
      setGymMachines(prev => [...prev, { id: uid(), ...machineForm, gymIds: [selectedGym?.id ?? ''] }]);
    }
    setMachineModal(false);
  };

  const deleteMachine = (id: string, name: string) =>
    Alert.alert(`Remove "${name}"?`, 'This will remove it from your gym listing.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => setGymMachines(prev => prev.filter(m => m.id !== id)) },
    ]);

  const MachinesView = () => {
    // Group by category
    const groups = gymMachines.reduce<Record<string, Machine[]>>((acc, m) => {
      (acc[m.category] ??= []).push(m);
      return acc;
    }, {});

    return (
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Header stats */}
        <View style={styles.machinesHeader}>
          <View style={styles.machinesStat}>
            <Text style={styles.machinesStatValue}>{gymMachines.length}</Text>
            <Text style={styles.machinesStatLabel}>Total machines</Text>
          </View>
          <View style={styles.machinesStat}>
            <Text style={styles.machinesStatValue}>{Object.keys(groups).length}</Text>
            <Text style={styles.machinesStatLabel}>Categories</Text>
          </View>
          <View style={styles.machinesStat}>
            <Text style={styles.machinesStatValue}>
              {[...new Set(gymMachines.map(m => m.brand))].length}
            </Text>
            <Text style={styles.machinesStatLabel}>Brands</Text>
          </View>
        </View>

        {gymMachines.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="barbell-outline" size={44} color={C.textDim} />
            <Text style={styles.emptyStateText}>No machines yet</Text>
            <Text style={styles.emptyStateSub}>Tap "Add Machine" below to get started.</Text>
          </View>
        )}

        {/* Grouped machine list */}
        {Object.entries(groups).map(([category, machines]) => (
          <View key={category}>
            <Text style={styles.groupLabel}>{category.toUpperCase()}</Text>
            <View style={styles.machineGroup}>
              {machines.map((machine, i) => {
                const mc = muscleColor(machine.targetMuscle);
                return (
                  <React.Fragment key={machine.id}>
                    {i > 0 && <View style={styles.machineDivider} />}
                    <View style={styles.machineRow}>
                      <View style={styles.machineIconWrap}>
                        <Ionicons name="barbell" size={14} color={C.accent} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.machineName}>{machine.name}</Text>
                        <Text style={styles.machineBrand}>{machine.brand}</Text>
                      </View>
                      <View style={[styles.musclePill, { backgroundColor: mc.bg }]}>
                        <Text style={[styles.musclePillText, { color: mc.fg }]}>{machine.targetMuscle}</Text>
                      </View>
                      <View style={styles.machineActions}>
                        <TouchableOpacity
                          onPress={() => openEditMachine(machine)}
                          style={styles.machineActionBtn}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <Ionicons name="create-outline" size={16} color={C.textSub} />
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => deleteMachine(machine.id, machine.name)}
                          style={styles.machineActionBtn}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <Ionicons name="trash-outline" size={15} color={C.danger} />
                        </TouchableOpacity>
                      </View>
                    </View>
                  </React.Fragment>
                );
              })}
            </View>
          </View>
        ))}

        <TouchableOpacity style={styles.addMachineBtn} onPress={openAddMachine} activeOpacity={0.8}>
          <Ionicons name="add" size={17} color={C.accent} />
          <Text style={styles.addMachineBtnText}>Add Machine</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  };

  // ─── MACHINE FORM MODAL ───────────────────────────────────────────────────

  const MachineFormModal = () => (
    <Modal visible={machineModal} transparent animationType="slide" onRequestClose={() => setMachineModal(false)}>
      <Pressable style={styles.backdrop} onPress={() => setMachineModal(false)} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <Text style={styles.sheetTitle}>
            {editingMachineId ? 'Edit Machine' : 'Add Machine'}
          </Text>
          <Text style={styles.sheetSub}>
            {editingMachineId ? 'Update the details below' : 'Fill in the machine details'}
          </Text>
          <Field label="Machine Name *" value={machineForm.name}         onChangeText={setMF('name')}         placeholder="e.g. Cable Machine" />
          <Field label="Brand *"        value={machineForm.brand}        onChangeText={setMF('brand')}        placeholder="e.g. Life Fitness" />
          <Field label="Target Muscle"  value={machineForm.targetMuscle} onChangeText={setMF('targetMuscle')} placeholder="e.g. Back, Chest, Legs" />
          <Field label="Category"       value={machineForm.category}     onChangeText={setMF('category')}     placeholder="e.g. Strength, Cardio" />
          <View style={styles.sheetActions}>
            <TouchableOpacity style={styles.sheetCancel} onPress={() => setMachineModal(false)} activeOpacity={0.8}>
              <Text style={styles.sheetCancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.sheetSave} onPress={saveMachine} activeOpacity={0.88}>
              <Text style={styles.sheetSaveText}>Save Machine</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );

  // ─── RENDER ───────────────────────────────────────────────────────────────

  const VIEW_META: Record<ManagerView, { title: string; subtitle?: string }> = {
    home:     { title: 'My Gyms',           subtitle: `${gyms.length} registered` },
    register: { title: 'Register Gym',      subtitle: `Step ${step} of 3` },
    edit:     { title: selectedGym?.name ?? 'Edit Gym', subtitle: 'Edit profile' },
    machines: { title: selectedGym?.name ?? 'Machines', subtitle: `${gymMachines.length} machines` },
  };

  const meta = VIEW_META[currentView];

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />

      <Header
        title={meta.title}
        subtitle={meta.subtitle}
        onBack={pop}
        right={
          currentView === 'home' ? (
            <View style={styles.managerBadge}>
              <Text style={styles.managerBadgeText}>Manager</Text>
            </View>
          ) : undefined
        }
      />

      {currentView === 'home'     && <HomeView />}
      {currentView === 'register' && <RegisterView />}
      {currentView === 'edit'     && <EditView />}
      {currentView === 'machines' && <MachinesView />}

      <MachineFormModal />
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: C.bg },
  scroll: { padding: 20, paddingBottom: 52 },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    backgroundColor: C.bg,
    gap: 4,
  },
  backBtn:      { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle:  { fontSize: 17, fontWeight: '700', color: C.text },
  headerSub:    { fontSize: 11, color: C.textSub, marginTop: 1 },
  managerBadge: {
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: R.pill,
    backgroundColor: C.accentBg,
    borderWidth: 1,
    borderColor: C.accent + '50',
  },
  managerBadgeText: { fontSize: 11, fontWeight: '700', color: C.accent },

  // Home summary
  homeSummary: {
    flexDirection: 'row',
    backgroundColor: C.surface,
    borderRadius: R.card,
    borderWidth: 1,
    borderColor: C.border,
    marginBottom: 24,
    overflow: 'hidden',
  },
  summaryCell: { flex: 1, alignItems: 'center', paddingVertical: 16 },
  summaryCellValue: { fontSize: 24, fontWeight: '900', color: C.text, letterSpacing: -0.5 },
  summaryCellLabel: { fontSize: 10, fontWeight: '600', color: C.textSub, marginTop: 3 },

  groupLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: C.textDim,
    letterSpacing: 1.2,
    marginBottom: 10,
    marginTop: 4,
  },

  // Gym card
  gymCard: {
    backgroundColor: C.surface,
    borderRadius: R.card,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: C.border,
    borderLeftWidth: 3,
  },
  gymCardHead:   { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12, gap: 8 },
  gymCardName:   { fontSize: 16, fontWeight: '700', color: C.text, marginBottom: 3 },
  gymCardLocRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  gymCardLoc:    { fontSize: 12, color: C.textSub },
  gymCardMeta:   { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 14 },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: C.surfaceHigh,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: R.pill,
  },
  metaChipText:  { fontSize: 11, fontWeight: '600', color: C.textSub },
  gymCardActions:{ flexDirection: 'row', gap: 8 },
  gymActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 9,
    borderRadius: R.inner,
    borderWidth: 1.5,
    borderColor: C.accent + '45',
    backgroundColor: C.accentBg,
  },
  gymActionBtnText: { fontSize: 13, fontWeight: '700', color: C.accent },

  // Status badge
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: R.pill,
  },
  statusDot:      { width: 6, height: 6, borderRadius: 3 },
  statusBadgeText:{ fontSize: 11, fontWeight: '700' },

  // Register / save buttons
  registerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: C.accent,
    paddingVertical: 15,
    borderRadius: R.btn,
    marginTop: 4,
    marginBottom: 14,
  },
  registerBtnText: { fontSize: 15, fontWeight: '800', color: C.bg },

  saveBtn:     { backgroundColor: C.accent, paddingVertical: 15, borderRadius: R.btn, alignItems: 'center', marginTop: 8 },
  saveBtnText: { fontSize: 15, fontWeight: '800', color: C.bg },

  infoNote: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: C.surface,
    borderRadius: R.inner,
    padding: 13,
    borderWidth: 1,
    borderColor: C.border,
  },
  infoNoteText: { flex: 1, fontSize: 12, color: C.textSub, lineHeight: 18 },

  // Section card
  sectionCard: {
    backgroundColor: C.surface,
    borderRadius: R.card,
    borderWidth: 1,
    borderColor: C.border,
    padding: 16,
    marginBottom: 14,
  },
  sectionCardTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: C.textSub,
    marginBottom: 16,
    letterSpacing: 0.2,
  },

  // Field
  field:      { marginBottom: 14 },
  fieldLabel: { fontSize: 10, fontWeight: '700', color: C.textSub, letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 6 },
  fieldInput: {
    backgroundColor: C.surfaceHigh,
    borderRadius: R.inner,
    borderWidth: 1.5,
    borderColor: C.border,
    paddingHorizontal: 13,
    paddingVertical: 11,
    fontSize: 15,
    color: C.text,
  },
  fieldHint: { fontSize: 11, color: C.textDim, marginTop: 5 },

  // Step bar
  stepBar: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'center',
    marginBottom: 24,
    gap: 0,
  },
  stepItem:      { alignItems: 'center', gap: 6, width: 72 },
  stepCircle:    { width: 28, height: 28, borderRadius: 14, backgroundColor: C.surfaceHigh, borderWidth: 1.5, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
  stepCircleActive:{ backgroundColor: C.accent, borderColor: C.accent },
  stepCircleDone:  { backgroundColor: C.accentDim, borderColor: C.accentDim },
  stepNum:       { fontSize: 12, fontWeight: '700', color: C.textDim },
  stepLabel:     { fontSize: 10, fontWeight: '600', color: C.textDim, textAlign: 'center' },
  stepConnector: { height: 1.5, flex: 1, backgroundColor: C.border, marginTop: 13, maxWidth: 28 },

  // Step navigation
  stepNav:      { flexDirection: 'row', gap: 10, marginTop: 8 },
  stepBack:     { paddingVertical: 14, paddingHorizontal: 20, borderRadius: R.btn, borderWidth: 1, borderColor: C.border, alignItems: 'center' },
  stepBackText: { fontSize: 15, fontWeight: '700', color: C.textSub },
  stepNext: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: C.accent,
    paddingVertical: 15,
    borderRadius: R.btn,
  },
  stepNextText: { fontSize: 15, fontWeight: '800', color: C.bg },

  // Review step
  reviewRow:      { flexDirection: 'row', gap: 12, paddingVertical: 11 },
  reviewDivider:  { height: 1, backgroundColor: C.border },
  reviewLabel:    { width: 88, fontSize: 12, fontWeight: '700', color: C.textSub },
  reviewValue:    { flex: 1, fontSize: 13, color: C.text, lineHeight: 19 },
  reviewNote: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: C.surface,
    borderRadius: R.inner,
    padding: 13,
    borderWidth: 1,
    borderColor: C.border,
    marginTop: 4,
  },
  reviewNoteText: { flex: 1, fontSize: 12, color: C.textSub, lineHeight: 18 },

  // Photos
  photoSectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  photoCount:         { fontSize: 12, color: C.textSub },
  photoGrid:          { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  photoTile:          { borderRadius: R.inner, overflow: 'hidden' },
  photoPlaceholder: {
    flex: 1,
    backgroundColor: C.surfaceHigh,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoRemoveBtn: {
    position: 'absolute',
    top: 5,
    right: 5,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#000000bb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoUploadBtn: {
    borderWidth: 1.5,
    borderColor: C.border,
    borderStyle: 'dashed',
    backgroundColor: C.surfaceHigh,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  photoUploadText: { fontSize: 10, fontWeight: '600', color: C.textSub },

  // Machines view
  machinesHeader: {
    flexDirection: 'row',
    backgroundColor: C.surface,
    borderRadius: R.card,
    borderWidth: 1,
    borderColor: C.border,
    marginBottom: 24,
    overflow: 'hidden',
  },
  machinesStat:      { flex: 1, alignItems: 'center', paddingVertical: 16 },
  machinesStatValue: { fontSize: 24, fontWeight: '900', color: C.text, letterSpacing: -0.5 },
  machinesStatLabel: { fontSize: 10, fontWeight: '600', color: C.textSub, marginTop: 3 },

  machineGroup: {
    backgroundColor: C.surface,
    borderRadius: R.card,
    borderWidth: 1,
    borderColor: C.border,
    overflow: 'hidden',
    marginBottom: 16,
  },
  machineDivider: { height: 1, backgroundColor: C.border, marginLeft: 54 },
  machineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 13,
    gap: 10,
  },
  machineIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 9,
    backgroundColor: C.accentBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  machineName:   { fontSize: 14, fontWeight: '700', color: C.text },
  machineBrand:  { fontSize: 11, color: C.textSub, marginTop: 2 },
  musclePill:    { paddingHorizontal: 9, paddingVertical: 4, borderRadius: R.pill },
  musclePillText:{ fontSize: 11, fontWeight: '700' },
  machineActions:    { flexDirection: 'row', gap: 2 },
  machineActionBtn:  { padding: 6 },

  addMachineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingVertical: 14,
    borderRadius: R.inner,
    borderWidth: 1.5,
    borderColor: C.accent + '50',
    borderStyle: 'dashed',
  },
  addMachineBtnText: { fontSize: 14, fontWeight: '700', color: C.accent },

  emptyState:     { alignItems: 'center', gap: 10, paddingVertical: 48 },
  emptyStateText: { fontSize: 16, fontWeight: '700', color: C.textSub },
  emptyStateSub:  { fontSize: 13, color: C.textDim, textAlign: 'center' },

  // Machine form sheet
  backdrop: { flex: 1, backgroundColor: '#000000b0' },
  sheet: {
    backgroundColor: C.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
    borderTopWidth: 1,
    borderTopColor: C.border,
  },
  sheetHandle:     { width: 40, height: 4, backgroundColor: C.border, borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  sheetTitle:      { fontSize: 18, fontWeight: '800', color: C.text, marginBottom: 3 },
  sheetSub:        { fontSize: 12, color: C.textSub, marginBottom: 20 },
  sheetActions:    { flexDirection: 'row', gap: 10, marginTop: 8 },
  sheetCancel:     { flex: 1, paddingVertical: 14, borderRadius: R.btn, borderWidth: 1, borderColor: C.border, alignItems: 'center' },
  sheetCancelText: { fontSize: 14, fontWeight: '700', color: C.textSub },
  sheetSave:       { flex: 2, paddingVertical: 14, borderRadius: R.btn, backgroundColor: C.accent, alignItems: 'center' },
  sheetSaveText:   { fontSize: 14, fontWeight: '800', color: C.bg },
});
