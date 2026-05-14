import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { C, R, T } from '../../theme';
import { SplitType, WeekdaySplit } from '../../data/types';
import { saveSplitConfig } from '../../lib/db/splitRoutine';

// ── Constants ─────────────────────────────────────────────────────────────────

const SPLIT_MUSCLES = ['Chest', 'Back', 'Legs', 'Shoulders', 'Arms', 'Core', 'Cardio'];
const WEEKDAY_MUSCLES = [...SPLIT_MUSCLES, '휴식'];
const DAY_LABELS: { key: keyof WeekdaySplit; label: string }[] = [
  { key: 'mon', label: '월' },
  { key: 'tue', label: '화' },
  { key: 'wed', label: '수' },
  { key: 'thu', label: '목' },
  { key: 'fri', label: '금' },
  { key: 'sat', label: '토' },
  { key: 'sun', label: '일' },
];

// ── Sub-components ─────────────────────────────────────────────────────────────

function TypeCard({
  title,
  desc,
  selected,
  onPress,
}: {
  title: string;
  desc: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[s.typeCard, selected && s.typeCardSelected]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <View style={[s.typeCardRadio, selected && s.typeCardRadioSelected]}>
        {selected && <View style={s.typeCardRadioDot} />}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[s.typeCardTitle, selected && s.typeCardTitleSelected]}>{title}</Text>
        <Text style={s.typeCardDesc}>{desc}</Text>
      </View>
    </TouchableOpacity>
  );
}

function MuscleChip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[s.chip, selected && s.chipSelected]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <Text style={[s.chipText, selected && s.chipTextSelected]}>{label}</Text>
    </TouchableOpacity>
  );
}

function WeekdayRow({
  dayLabel,
  selected,
  onSelect,
}: {
  dayLabel: string;
  selected: string | null;
  onSelect: (muscle: string | null) => void;
}) {
  return (
    <View style={s.weekdayRow}>
      <Text style={s.weekdayLabel}>{dayLabel}</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 6, paddingRight: 8 }}
      >
        {WEEKDAY_MUSCLES.map(m => (
          <MuscleChip
            key={m}
            label={m}
            selected={m === '휴식' ? selected === null && false : selected === m}
            onPress={() => onSelect(m === '휴식' ? null : m)}
          />
        ))}
      </ScrollView>
    </View>
  );
}

function SequentialItem({
  name,
  index,
  total,
  onRemove,
  onMoveUp,
  onMoveDown,
}: {
  name:       string;
  index:      number;
  total:      number;
  onRemove:   () => void;
  onMoveUp:   () => void;
  onMoveDown: () => void;
}) {
  return (
    <View style={s.seqItem}>
      <View style={s.seqIndex}>
        <Text style={s.seqIndexText}>{index + 1}</Text>
      </View>
      <Text style={s.seqName}>{name}</Text>
      <View style={s.seqActions}>
        <TouchableOpacity
          style={[s.seqBtn, index === 0 && s.seqBtnDisabled]}
          onPress={onMoveUp}
          disabled={index === 0}
          activeOpacity={0.7}
        >
          <Ionicons name="chevron-up" size={14} color={index === 0 ? C.textDim : C.textSub} />
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.seqBtn, index === total - 1 && s.seqBtnDisabled]}
          onPress={onMoveDown}
          disabled={index === total - 1}
          activeOpacity={0.7}
        >
          <Ionicons name="chevron-down" size={14} color={index === total - 1 ? C.textDim : C.textSub} />
        </TouchableOpacity>
        <TouchableOpacity style={s.seqRemoveBtn} onPress={onRemove} activeOpacity={0.7}>
          <Ionicons name="close" size={14} color={C.danger} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface WorkoutSplitSetupScreenProps {
  userId:     string;
  onComplete: () => void;
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function WorkoutSplitSetupScreen({ userId, onComplete }: WorkoutSplitSetupScreenProps) {
  const [step,     setStep]     = useState<1 | 2>(1);
  const [type,     setType]     = useState<SplitType>('sequential');
  const [weekday,  setWeekday]  = useState<WeekdaySplit>({
    mon: null, tue: null, wed: null, thu: null, fri: null, sat: null, sun: null,
  });
  const [seqList,  setSeqList]  = useState<string[]>([]);
  const [saving,   setSaving]   = useState(false);

  function updateWeekday(key: keyof WeekdaySplit, value: string | null) {
    setWeekday(prev => ({ ...prev, [key]: value }));
  }

  function addToSeq(muscle: string) {
    if (seqList.includes(muscle)) return;
    setSeqList(prev => [...prev, muscle]);
  }

  function removeFromSeq(index: number) {
    setSeqList(prev => prev.filter((_, i) => i !== index));
  }

  function moveSeqUp(index: number) {
    if (index === 0) return;
    setSeqList(prev => {
      const next = [...prev];
      [next[index - 1], next[index]] = [next[index], next[index - 1]];
      return next;
    });
  }

  function moveSeqDown(index: number) {
    setSeqList(prev => {
      if (index >= prev.length - 1) return prev;
      const next = [...prev];
      [next[index], next[index + 1]] = [next[index + 1], next[index]];
      return next;
    });
  }

  async function handleSkip() {
    setSaving(true);
    try {
      await saveSplitConfig(userId, 'sequential', []);
    } catch {}
    setSaving(false);
    onComplete();
  }

  async function handleComplete() {
    if (step === 1) {
      setStep(2);
      return;
    }
    const canComplete = type === 'weekday'
      ? Object.values(weekday).some(v => v !== null)
      : seqList.length > 0;

    if (!canComplete) return;

    setSaving(true);
    try {
      const split = type === 'weekday' ? weekday : seqList;
      await saveSplitConfig(userId, type, split);
    } catch {}
    setSaving(false);
    onComplete();
  }

  const canProceed = step === 1
    ? true
    : type === 'weekday'
    ? Object.values(weekday).some(v => v !== null)
    : seqList.length > 0;

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.scroll}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={s.header}>
          {step === 2 && (
            <TouchableOpacity onPress={() => setStep(1)} style={s.backBtn} activeOpacity={0.7}>
              <Ionicons name="chevron-back" size={20} color={C.textSub} />
            </TouchableOpacity>
          )}
          <View style={{ flex: 1 }}>
            <Text style={s.title}>운동 분할법을 설정해주세요</Text>
            <Text style={s.subtitle}>나중에 프로필에서 변경할 수 있어요</Text>
          </View>
        </View>

        {/* Step indicator */}
        <View style={s.stepRow}>
          {[1, 2].map(n => (
            <View key={n} style={[s.stepDot, step >= n && s.stepDotActive]} />
          ))}
        </View>

        {step === 1 ? (
          /* ── Step 1: Type selection ── */
          <View style={s.section}>
            <TypeCard
              title="순서 기반"
              desc="운동한 날 기준으로 다음 부위로 자동 이동"
              selected={type === 'sequential'}
              onPress={() => setType('sequential')}
            />
            <TypeCard
              title="요일 기반"
              desc="월~일 요일별로 운동 부위 설정"
              selected={type === 'weekday'}
              onPress={() => setType('weekday')}
            />
          </View>
        ) : type === 'weekday' ? (
          /* ── Step 2a: Weekday config ── */
          <View style={s.section}>
            <Text style={s.sectionLabel}>요일별 운동 부위</Text>
            {DAY_LABELS.map(({ key, label }) => (
              <WeekdayRow
                key={key}
                dayLabel={label}
                selected={weekday[key]}
                onSelect={(muscle) => updateWeekday(key, muscle)}
              />
            ))}
          </View>
        ) : (
          /* ── Step 2b: Sequential config ── */
          <View style={s.section}>
            <Text style={s.sectionLabel}>운동 순서 목록</Text>

            {seqList.length === 0 ? (
              <View style={s.seqEmpty}>
                <Text style={s.seqEmptyText}>아래 부위를 탭해서 추가하세요</Text>
              </View>
            ) : (
              <View style={s.seqList}>
                {seqList.map((name, idx) => (
                  <SequentialItem
                    key={`${name}-${idx}`}
                    name={name}
                    index={idx}
                    total={seqList.length}
                    onRemove={() => removeFromSeq(idx)}
                    onMoveUp={() => moveSeqUp(idx)}
                    onMoveDown={() => moveSeqDown(idx)}
                  />
                ))}
              </View>
            )}

            <Text style={[s.sectionLabel, { marginTop: 20 }]}>부위 추가</Text>
            <View style={s.chipRow}>
              {SPLIT_MUSCLES.map(m => (
                <MuscleChip
                  key={m}
                  label={m}
                  selected={seqList.includes(m)}
                  onPress={() => addToSeq(m)}
                />
              ))}
            </View>
          </View>
        )}
      </ScrollView>

      {/* CTA bar */}
      <View style={s.ctaBar}>
        <TouchableOpacity
          style={s.skipBtn}
          onPress={handleSkip}
          disabled={saving}
          activeOpacity={0.75}
        >
          <Text style={s.skipTxt}>건너뛰기</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.doneBtn, !canProceed && s.doneBtnDisabled]}
          onPress={handleComplete}
          disabled={saving || !canProceed}
          activeOpacity={0.85}
        >
          {saving ? (
            <ActivityIndicator size="small" color={C.bg} />
          ) : (
            <Text style={s.doneTxt}>{step === 1 ? '다음' : '완료'}</Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe:     { flex: 1, backgroundColor: C.bg },
  scroll:   { paddingHorizontal: 20, paddingBottom: 32 },

  header: {
    flexDirection:  'row',
    alignItems:     'flex-start',
    paddingTop:     32,
    paddingBottom:  8,
    gap:            8,
  },
  backBtn: {
    width:           36,
    height:          36,
    alignItems:      'center',
    justifyContent:  'center',
    marginTop:       2,
  },
  title:    { ...T.hero, color: C.text, marginBottom: 6 },
  subtitle: { fontSize: 13, color: C.textSub },

  stepRow: {
    flexDirection: 'row',
    gap:           6,
    marginBottom:  28,
  },
  stepDot: {
    width:         20,
    height:        4,
    borderRadius:  2,
    backgroundColor: C.surfaceHigh,
  },
  stepDotActive: { backgroundColor: C.accent },

  section:      { gap: 12 },
  sectionLabel: {
    fontSize:      11,
    fontWeight:    '700',
    color:         C.textDim,
    letterSpacing: 1.1,
    marginBottom:  4,
  },

  // Type cards
  typeCard: {
    flexDirection:    'row',
    alignItems:       'flex-start',
    gap:              14,
    backgroundColor:  C.surface,
    borderRadius:     R.card,
    padding:          18,
    borderWidth:      1.5,
    borderColor:      C.border,
  },
  typeCardSelected:      { borderColor: C.accent, backgroundColor: C.accentBg },
  typeCardRadio:         { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: C.border, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  typeCardRadioSelected: { borderColor: C.accent },
  typeCardRadioDot:      { width: 10, height: 10, borderRadius: 5, backgroundColor: C.accent },
  typeCardTitle:         { fontSize: 15, fontWeight: '700', color: C.text, marginBottom: 4 },
  typeCardTitleSelected: { color: C.accent },
  typeCardDesc:          { fontSize: 12, color: C.textSub, lineHeight: 18 },

  // Chips
  chip: {
    paddingHorizontal: 12,
    paddingVertical:   6,
    borderRadius:      R.pill,
    backgroundColor:   C.surface,
    borderWidth:       1,
    borderColor:       C.border,
  },
  chipSelected:     { backgroundColor: C.accentBg, borderColor: C.accent },
  chipText:         { fontSize: 12, fontWeight: '600', color: C.textSub },
  chipTextSelected: { color: C.accent },

  chipRow: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    gap:           8,
  },

  // Weekday rows
  weekdayRow: {
    flexDirection:  'row',
    alignItems:     'center',
    gap:            10,
    paddingVertical: 6,
  },
  weekdayLabel: {
    width:      28,
    fontSize:   14,
    fontWeight: '700',
    color:      C.text,
    textAlign:  'center',
  },

  // Sequential list
  seqEmpty: {
    backgroundColor: C.surface,
    borderRadius:    R.inner,
    padding:         20,
    alignItems:      'center',
  },
  seqEmptyText: { fontSize: 13, color: C.textDim },

  seqList: {
    backgroundColor: C.surface,
    borderRadius:    R.card,
    overflow:        'hidden',
  },
  seqItem: {
    flexDirection:  'row',
    alignItems:     'center',
    paddingHorizontal: 14,
    paddingVertical:   12,
    gap:            12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.border,
  },
  seqIndex: {
    width:            28,
    height:           28,
    borderRadius:     14,
    backgroundColor:  C.accentBg,
    alignItems:       'center',
    justifyContent:   'center',
  },
  seqIndexText:  { fontSize: 12, fontWeight: '800', color: C.accent },
  seqName:       { flex: 1, fontSize: 14, fontWeight: '600', color: C.text },
  seqActions:    { flexDirection: 'row', gap: 4 },
  seqBtn:        { width: 28, height: 28, borderRadius: 8, backgroundColor: C.surfaceHigh, alignItems: 'center', justifyContent: 'center' },
  seqBtnDisabled: { opacity: 0.4 },
  seqRemoveBtn:  { width: 28, height: 28, borderRadius: 8, backgroundColor: '#ff4d6d18', alignItems: 'center', justifyContent: 'center' },

  // CTA bar
  ctaBar: {
    flexDirection:   'row',
    gap:             12,
    paddingHorizontal: 20,
    paddingVertical:   16,
    borderTopWidth:  StyleSheet.hairlineWidth,
    borderTopColor:  C.border,
    backgroundColor: C.bg,
  },
  skipBtn: {
    flex:          1,
    paddingVertical: 15,
    borderRadius:  R.btn,
    backgroundColor: C.surfaceHigh,
    alignItems:    'center',
  },
  skipTxt:  { fontSize: 15, fontWeight: '700', color: C.textSub },
  doneBtn:  {
    flex:          2,
    paddingVertical: 15,
    borderRadius:  R.btn,
    backgroundColor: C.accent,
    alignItems:    'center',
  },
  doneBtnDisabled: { opacity: 0.4 },
  doneTxt:  { fontSize: 15, fontWeight: '800', color: C.bg },
});
