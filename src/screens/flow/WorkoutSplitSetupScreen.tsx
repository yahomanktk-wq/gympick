import React, { useState, useEffect } from 'react';
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
import { SplitType, WeekdaySplit, WorkoutSplit, UserSplitConfig } from '../../data/types';
import { fetchSplitConfig, saveSplitConfig, updateSplitIndex } from '../../lib/db/splitRoutine';

// ── Constants ─────────────────────────────────────────────────────────────────

const SPLIT_MUSCLES = ['가슴', '등', '하체', '어깨', '팔', '휴식'];

const DAY_LABELS: { key: keyof WeekdaySplit; label: string }[] = [
  { key: 'mon', label: '월' },
  { key: 'tue', label: '화' },
  { key: 'wed', label: '수' },
  { key: 'thu', label: '목' },
  { key: 'fri', label: '금' },
  { key: 'sat', label: '토' },
  { key: 'sun', label: '일' },
];

const EMPTY_WEEKDAY: WeekdaySplit = {
  mon: [], tue: [], wed: [], thu: [], fri: [], sat: [], sun: [],
};

// ── CurrentSplitDisplay (Step 0 — 기존 설정 표시) ────────────────────────────

const CurrentSplitDisplay = React.memo(({
  splitType, workoutSplit, currentIndex,
}: {
  splitType:    SplitType;
  workoutSplit: WorkoutSplit;
  currentIndex: number;
}) => {
  if (splitType === 'sequential') {
    const split    = workoutSplit as string[];
    const activeIdx = split.length > 0 ? currentIndex % split.length : 0;
    return (
      <View style={csd.container}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={csd.seqRow}
        >
          {split.map((item, idx) => (
            <React.Fragment key={idx}>
              {idx > 0 && <Text style={csd.arrow}>→</Text>}
              <View style={[csd.seqChip, idx === activeIdx && csd.seqChipActive]}>
                <Text style={[csd.seqChipText, idx === activeIdx && csd.seqChipTextActive]}>
                  {item}
                </Text>
              </View>
            </React.Fragment>
          ))}
        </ScrollView>
      </View>
    );
  }

  const split = workoutSplit as WeekdaySplit;
  return (
    <View style={csd.container}>
      {DAY_LABELS.map(({ key, label }) => {
        const muscles = (split[key] ?? []) as string[];
        return (
          <View key={key} style={csd.weekRow}>
            <Text style={csd.weekLabel}>{label}</Text>
            <Text style={csd.weekMuscles}>
              {muscles.length > 0 ? muscles.join(' · ') : '휴식'}
            </Text>
          </View>
        );
      })}
    </View>
  );
});

// ── TypeCard ──────────────────────────────────────────────────────────────────

function TypeCard({
  title, desc, example, selected, onPress,
}: {
  title:    string;
  desc:     string;
  example:  string;
  selected: boolean;
  onPress:  () => void;
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
        <Text style={s.typeCardExample}>{example}</Text>
      </View>
    </TouchableOpacity>
  );
}

// ── MuscleChip ────────────────────────────────────────────────────────────────

function MuscleChip({
  label, selected, onPress,
}: {
  label:    string;
  selected: boolean;
  onPress:  () => void;
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

// ── WeekdayRow ────────────────────────────────────────────────────────────────

function WeekdayRow({
  dayLabel, selected, onToggle,
}: {
  dayLabel: string;
  selected: string[];
  onToggle: (muscle: string) => void;
}) {
  const displayMuscles = selected.filter(m => m !== '휴식');
  const hasRest        = selected.includes('휴식');
  const displayLabel   = displayMuscles.length > 0
    ? displayMuscles.join('·')
    : hasRest ? '휴식' : '';

  return (
    <View style={s.weekdayRow}>
      <View style={s.weekdayLabelWrap}>
        <Text style={s.weekdayLabel}>{dayLabel}</Text>
        {displayLabel ? (
          <Text style={s.weekdaySelected} numberOfLines={1}>{displayLabel}</Text>
        ) : null}
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 6, paddingRight: 8 }}
      >
        {SPLIT_MUSCLES.map(m => (
          <MuscleChip
            key={m}
            label={m}
            selected={selected.includes(m)}
            onPress={() => onToggle(m)}
          />
        ))}
      </ScrollView>
    </View>
  );
}

// ── SequentialItem ────────────────────────────────────────────────────────────

function SequentialItem({
  name, index, total, onRemove, onMoveUp, onMoveDown,
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

// ── StartPositionItem (Step 3) ────────────────────────────────────────────────

const StartPositionItem = React.memo(({
  name, selected, onPress,
}: {
  name:     string;
  selected: boolean;
  onPress:  () => void;
}) => (
  <TouchableOpacity
    style={[s.startItem, selected && s.startItemSelected]}
    onPress={onPress}
    activeOpacity={0.8}
  >
    <View style={[s.startRadio, selected && s.startRadioSelected]}>
      {selected && <View style={s.startRadioDot} />}
    </View>
    <Text style={[s.startName, selected && s.startNameSelected]}>{name}</Text>
    {selected && <Text style={s.startFromHere}>오늘부터 시작</Text>}
  </TouchableOpacity>
));

// ── Props ─────────────────────────────────────────────────────────────────────

interface WorkoutSplitSetupScreenProps {
  userId:     string;
  onComplete: () => void;
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function WorkoutSplitSetupScreen({ userId, onComplete }: WorkoutSplitSetupScreenProps) {
  // null = 로딩 중, 0 = 기존설정확인, 1 = 타입선택, 2 = 설정, 3 = 시작부위선택
  const [step,           setStep]           = useState<0 | 1 | 2 | 3 | null>(null);
  const [existingConfig, setExistingConfig] = useState<UserSplitConfig | null>(null);
  const [type,           setType]           = useState<SplitType>('sequential');
  const [weekday,        setWeekday]        = useState<WeekdaySplit>(EMPTY_WEEKDAY);
  const [seqList,        setSeqList]        = useState<string[]>([]);
  const [startIndex,     setStartIndex]     = useState(0);
  const [saving,         setSaving]         = useState(false);

  // 마운트 시 기존 설정 조회
  useEffect(() => {
    fetchSplitConfig(userId)
      .then(config => {
        const isEmpty =
          !config ||
          (Array.isArray(config.workoutSplit) && config.workoutSplit.length === 0);
        if (isEmpty) {
          setStep(1);
        } else {
          setExistingConfig(config);
          setStep(0);
        }
      })
      .catch(() => setStep(1));
  }, [userId]);

  function toggleWeekdayMuscle(key: keyof WeekdaySplit, muscle: string) {
    setWeekday(prev => {
      const current = prev[key] as string[];
      const newArr  = current.includes(muscle)
        ? current.filter(m => m !== muscle)
        : [...current, muscle];
      return { ...prev, [key]: newArr };
    });
  }

  function addToSeq(muscle: string) {
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
    try { await saveSplitConfig(userId, 'sequential', []); } catch {}
    setSaving(false);
    onComplete();
  }

  async function handleComplete() {
    if (step === 0) {
      // 변경하기: Step 1으로
      setWeekday(EMPTY_WEEKDAY);
      setSeqList([]);
      setStartIndex(0);
      setStep(1);
      return;
    }
    if (step === 1) {
      setStep(2);
      return;
    }
    if (step === 2) {
      if (!canProceed) return;
      setSaving(true);
      try {
        const split = type === 'weekday' ? weekday : seqList;
        await saveSplitConfig(userId, type, split);
      } catch {}
      setSaving(false);
      if (type === 'sequential') {
        setStartIndex(0);
        setStep(3);
      } else {
        onComplete();
      }
      return;
    }
    if (step === 3) {
      setSaving(true);
      try { await updateSplitIndex(userId, startIndex); } catch {}
      setSaving(false);
      onComplete();
    }
  }

  const canProceed = step === 1
    ? true
    : step === 2
    ? type === 'weekday'
      ? Object.values(weekday).some((arr: any) => arr.length > 0)
      : seqList.length > 0
    : true;

  // 로딩 중
  if (step === null) {
    return (
      <SafeAreaView style={s.safe}>
        <StatusBar barStyle="light-content" backgroundColor={C.bg} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={C.accent} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.scroll}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Header ── */}
        <View style={s.header}>
          {step === 2 && (
            <TouchableOpacity onPress={() => setStep(1)} style={s.backBtn} activeOpacity={0.7}>
              <Ionicons name="chevron-back" size={20} color={C.textSub} />
            </TouchableOpacity>
          )}
          <View style={{ flex: 1 }}>
            <Text style={s.title}>운동 분할 설정</Text>
            <Text style={s.subtitle}>
              {step === 0
                ? '현재 설정된 분할법이에요'
                : step === 3
                ? '오늘 어디서 시작할까요?'
                : '나중에 프로필에서 변경할 수 있어요'}
            </Text>
          </View>
        </View>

        {/* Step dots (Step 1, 2만 표시) */}
        {(step === 1 || step === 2) && (
          <View style={s.stepRow}>
            {[1, 2].map(n => (
              <View key={n} style={[s.stepDot, step >= n && s.stepDotActive]} />
            ))}
          </View>
        )}

        {/* ── Step 0: 현재 설정 확인 ── */}
        {step === 0 && existingConfig && (
          <View style={s.section}>
            <View style={s.existingTypeTag}>
              <Ionicons
                name={existingConfig.splitType === 'sequential' ? 'git-branch-outline' : 'calendar-outline'}
                size={14}
                color={C.accent}
              />
              <Text style={s.existingTypeText}>
                {existingConfig.splitType === 'sequential' ? '순서 기반' : '요일 기반'}
              </Text>
            </View>
            <CurrentSplitDisplay
              splitType={existingConfig.splitType}
              workoutSplit={existingConfig.workoutSplit}
              currentIndex={existingConfig.splitCurrentIndex}
            />
          </View>
        )}

        {/* ── Step 1: 타입 선택 ── */}
        {step === 1 && (
          <View style={s.section}>
            <TypeCard
              title="순서 기반"
              desc="운동한 날 기준으로 다음 부위로 자동 이동"
              example="예) 가슴 → 등 → 하체 → 휴식 → 어깨 → 팔 → 휴식"
              selected={type === 'sequential'}
              onPress={() => setType('sequential')}
            />
            <TypeCard
              title="요일 기반"
              desc="월~일 요일별로 운동 부위 설정"
              example="예) 월 가슴·등 / 화 하체 / 수 휴식 / 목 어깨·팔"
              selected={type === 'weekday'}
              onPress={() => setType('weekday')}
            />
          </View>
        )}

        {/* ── Step 2a: 순서 기반 설정 ── */}
        {step === 2 && type === 'sequential' && (
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
            <Text style={[s.sectionLabel, { marginTop: 20 }]}>부위 추가 (중복 허용)</Text>
            <View style={s.chipRow}>
              {SPLIT_MUSCLES.map(m => (
                <MuscleChip
                  key={m}
                  label={m}
                  selected={false}
                  onPress={() => addToSeq(m)}
                />
              ))}
            </View>
          </View>
        )}

        {/* ── Step 2b: 요일 기반 설정 ── */}
        {step === 2 && type === 'weekday' && (
          <View style={s.section}>
            <Text style={s.sectionLabel}>요일별 운동 부위</Text>
            {DAY_LABELS.map(({ key, label }) => (
              <WeekdayRow
                key={key}
                dayLabel={label}
                selected={weekday[key] as string[]}
                onToggle={(muscle) => toggleWeekdayMuscle(key, muscle)}
              />
            ))}
          </View>
        )}

        {/* ── Step 3: 시작 부위 선택 ── */}
        {step === 3 && (
          <View style={s.section}>
            <Text style={s.sectionLabel}>시작할 부위를 선택하세요</Text>
            <View style={s.startList}>
              {seqList.map((name, idx) => (
                <StartPositionItem
                  key={`${name}-${idx}`}
                  name={name}
                  selected={startIndex === idx}
                  onPress={() => setStartIndex(idx)}
                />
              ))}
            </View>
          </View>
        )}
      </ScrollView>

      {/* ── CTA bar ── */}
      <View style={s.ctaBar}>
        {/* Step 0: 유지 / 변경하기 */}
        {step === 0 ? (
          <>
            <TouchableOpacity
              style={s.skipBtn}
              onPress={onComplete}
              disabled={saving}
              activeOpacity={0.75}
            >
              <Text style={s.skipTxt}>유지</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={s.doneBtn}
              onPress={handleComplete}
              disabled={saving}
              activeOpacity={0.85}
            >
              <Text style={s.doneTxt}>변경하기</Text>
            </TouchableOpacity>
          </>
        ) : step === 3 ? (
          /* Step 3: 완료만 */
          <TouchableOpacity
            style={[s.doneBtn, { flex: 1 }]}
            onPress={handleComplete}
            disabled={saving}
            activeOpacity={0.85}
          >
            {saving ? (
              <ActivityIndicator size="small" color={C.bg} />
            ) : (
              <Text style={s.doneTxt}>완료</Text>
            )}
          </TouchableOpacity>
        ) : (
          /* Step 1, 2: 설정 안함 / 다음·완료 */
          <>
            <TouchableOpacity
              style={s.skipBtn}
              onPress={handleSkip}
              disabled={saving}
              activeOpacity={0.75}
            >
              <Text style={s.skipTxt}>설정 안함</Text>
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
                <Text style={s.doneTxt}>
                  {step === 1 ? '다음' : '완료'}
                </Text>
              )}
            </TouchableOpacity>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

// ── CurrentSplitDisplay styles ────────────────────────────────────────────────

const csd = StyleSheet.create({
  container: {
    backgroundColor: C.surface,
    borderRadius:    R.card,
    overflow:        'hidden',
    borderWidth:     1,
    borderColor:     C.border,
  },
  seqRow: {
    flexDirection:  'row',
    alignItems:     'center',
    padding:        16,
    gap:            6,
  },
  seqChip: {
    paddingHorizontal: 12,
    paddingVertical:   7,
    borderRadius:      R.pill,
    backgroundColor:   C.surfaceHigh,
    borderWidth:       1.5,
    borderColor:       C.border,
  },
  seqChipActive: {
    borderColor:     C.accent,
    backgroundColor: C.accentBg,
  },
  seqChipText:       { fontSize: 13, fontWeight: '600', color: C.textSub },
  seqChipTextActive: { color: C.accent, fontWeight: '800' },
  arrow:             { fontSize: 12, color: C.textDim },
  weekRow: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal: 16,
    paddingVertical:   11,
    borderTopWidth:    StyleSheet.hairlineWidth,
    borderTopColor:    C.border,
    gap:               12,
  },
  weekLabel:   { width: 24, fontSize: 13, fontWeight: '700', color: C.text },
  weekMuscles: { flex: 1, fontSize: 13, color: C.textSub, fontWeight: '500' },
});

// ── Main styles ───────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: C.bg },
  scroll: { paddingHorizontal: 20, paddingBottom: 32 },

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
  title:    { ...T.title, fontSize: 22, color: C.text, marginBottom: 6 },
  subtitle: { fontSize: 13, color: C.textSub },

  stepRow: {
    flexDirection: 'row',
    gap:           6,
    marginBottom:  28,
  },
  stepDot: {
    width:           20,
    height:          4,
    borderRadius:    2,
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

  // 기존 설정 타입 태그
  existingTypeTag: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             6,
    alignSelf:       'flex-start',
    backgroundColor: C.accentBg,
    paddingHorizontal: 12,
    paddingVertical:   6,
    borderRadius:    R.pill,
    borderWidth:     1,
    borderColor:     C.accent + '50',
  },
  existingTypeText: { fontSize: 13, fontWeight: '700', color: C.accent },

  // Type cards
  typeCard: {
    flexDirection:   'row',
    alignItems:      'flex-start',
    gap:             14,
    backgroundColor: C.surface,
    borderRadius:    R.card,
    padding:         18,
    borderWidth:     1.5,
    borderColor:     C.border,
  },
  typeCardSelected:      { borderColor: C.accent, backgroundColor: C.accentBg },
  typeCardRadio:         {
    width: 20, height: 20, borderRadius: 10,
    borderWidth: 2, borderColor: C.border,
    alignItems: 'center', justifyContent: 'center',
    marginTop: 1,
  },
  typeCardRadioSelected: { borderColor: C.accent },
  typeCardRadioDot:      { width: 10, height: 10, borderRadius: 5, backgroundColor: C.accent },
  typeCardTitle:         { fontSize: 15, fontWeight: '700', color: C.text, marginBottom: 4 },
  typeCardTitleSelected: { color: C.accent },
  typeCardDesc:          { fontSize: 12, color: C.textSub, lineHeight: 18, marginBottom: 4 },
  typeCardExample:       { fontSize: 11, color: C.textDim, fontStyle: 'italic', lineHeight: 16 },

  // Chips — FIX 1: 크기 확대
  chip: {
    paddingHorizontal: 20,
    paddingVertical:   12,
    borderRadius:      R.pill,
    backgroundColor:   C.surface,
    borderWidth:       1,
    borderColor:       C.border,
  },
  chipSelected:     { backgroundColor: C.accent, borderColor: C.accent },
  chipText:         { fontSize: 15, fontWeight: '600', color: C.textSub },
  chipTextSelected: { color: C.bg, fontWeight: '700' },

  chipRow: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    gap:           8,
  },

  // Weekday rows
  weekdayRow: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             8,
    paddingVertical: 6,
  },
  weekdayLabelWrap: {
    width:      46,
    alignItems: 'center',
    gap:        2,
  },
  weekdayLabel:    { fontSize: 14, fontWeight: '700', color: C.text },
  weekdaySelected: { fontSize: 9, color: C.accent, fontWeight: '700', textAlign: 'center' },

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
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal: 14,
    paddingVertical:   12,
    gap:               12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.border,
  },
  seqIndex: {
    width:           28,
    height:          28,
    borderRadius:    14,
    backgroundColor: C.accentBg,
    alignItems:      'center',
    justifyContent:  'center',
  },
  seqIndexText:   { fontSize: 12, fontWeight: '800', color: C.accent },
  seqName:        { flex: 1, fontSize: 14, fontWeight: '600', color: C.text },
  seqActions:     { flexDirection: 'row', gap: 4 },
  seqBtn:         {
    width: 28, height: 28, borderRadius: 8,
    backgroundColor: C.surfaceHigh,
    alignItems: 'center', justifyContent: 'center',
  },
  seqBtnDisabled: { opacity: 0.4 },
  seqRemoveBtn:   {
    width: 28, height: 28, borderRadius: 8,
    backgroundColor: '#ff4d6d18',
    alignItems: 'center', justifyContent: 'center',
  },

  // Start position list (Step 3)
  startList: {
    backgroundColor: C.surface,
    borderRadius:    R.card,
    overflow:        'hidden',
  },
  startItem: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal: 16,
    paddingVertical:   15,
    gap:               14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.border,
  },
  startItemSelected:  { backgroundColor: C.accentBg },
  startRadio:         {
    width: 22, height: 22, borderRadius: 11,
    borderWidth: 2, borderColor: C.border,
    alignItems: 'center', justifyContent: 'center',
  },
  startRadioSelected: { borderColor: C.accent },
  startRadioDot:      { width: 11, height: 11, borderRadius: 6, backgroundColor: C.accent },
  startName:          { flex: 1, fontSize: 15, fontWeight: '600', color: C.text },
  startNameSelected:  { color: C.accent },
  startFromHere:      { fontSize: 12, fontWeight: '600', color: C.accent },

  // CTA bar
  ctaBar: {
    flexDirection:     'row',
    gap:               12,
    paddingHorizontal: 20,
    paddingVertical:   16,
    borderTopWidth:    StyleSheet.hairlineWidth,
    borderTopColor:    C.border,
    backgroundColor:   C.bg,
  },
  skipBtn: {
    flex:            1,
    paddingVertical: 15,
    borderRadius:    R.btn,
    backgroundColor: C.surfaceHigh,
    alignItems:      'center',
  },
  skipTxt:  { fontSize: 15, fontWeight: '700', color: C.textSub },
  doneBtn:  {
    flex:            2,
    paddingVertical: 15,
    borderRadius:    R.btn,
    backgroundColor: C.accent,
    alignItems:      'center',
  },
  doneBtnDisabled: { opacity: 0.4 },
  doneTxt: { fontSize: 15, fontWeight: '800', color: C.bg },
});
