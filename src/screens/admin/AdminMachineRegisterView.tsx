import React, { useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Image,
  Alert,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { captureRef } from 'react-native-view-shot';
import { Ionicons } from '@expo/vector-icons';
import { C, R, T } from '../../theme';
import type { MachineWithGyms, ExerciseKind } from '../../data/types';
import { insertMachine, updateMachine } from '../../lib/db/machines';
import { parseMuscles } from '../../lib/splitUtils';

// 타겟부위 7종 — Supabase machines 테이블에 실제로 쓰이고 있는 표기(Title
// Case, Leg/Shoulder는 단수)와 맞춘다. 프로젝트 문서의 "CHEST, BACK, LEGS..."
// 표기는 화면(부위 이름) 전용이고, DB target_muscle 컬럼은 이 표기를 쓰지
// 않아서 그대로 저장하면 기존 데이터와 값이 어긋난다.
const TARGET_MUSCLES = ['Chest', 'Back', 'Leg', 'Shoulder', 'Arms', 'Glutes', 'Other'];

const EXERCISE_KINDS: { value: ExerciseKind; label: string }[] = [
  { value: 'machine',    label: '머신' },
  { value: 'freeweight', label: '프리웨이트' },
];

// 이미지 미리보기/합성 박스의 화면상 크기(dp). 실제 캡처 픽셀 크기는
// captureRef 호출 시 width/height를 800으로 강제해서 이 dp 크기와 무관하게
// 항상 800×800으로 저장된다(기존 오운완 캡처 기능과 동일한 패턴).
const PREVIEW_SIZE = 160;

const MAX_SEARCH_RESULTS = 30;

type Mode = 'create' | 'edit';

interface Props {
  machines:     MachineWithGyms[];
  /** 등록/수정 성공 후 부모가 머신 목록을 다시 불러오도록 알려준다. */
  onRegistered?: () => void;
}

export default function AdminMachineRegisterView({ machines, onRegistered }: Props) {
  const [mode, setMode] = useState<Mode>('create');

  // 수정 모드 전용 — 검색어 & 선택된 대상 머신(선택 전까지는 폼을 숨긴다)
  const [searchQuery,     setSearchQuery]     = useState('');
  const [editingMachine,  setEditingMachine]  = useState<MachineWithGyms | null>(null);

  // 두 모드가 공유하는 폼 상태
  const [name,         setName]         = useState('');
  const [displayName,  setDisplayName]  = useState('');
  const [brand,        setBrand]        = useState('');
  const [targetMuscle, setTargetMuscle] = useState<string | null>(null);
  const [category,     setCategory]     = useState<string | null>(null);
  const [line,         setLine]         = useState('');
  const [exerciseKind, setExerciseKind] = useState<ExerciseKind>('machine');
  const [imageUri,     setImageUri]     = useState<string | null>(null); // 새로 고른 로컬 이미지(교체용)
  const [submitting,   setSubmitting]   = useState(false);

  const previewRef = useRef<View>(null);

  const isEditing = mode === 'edit' && !!editingMachine;

  // 노브랜드(NONE) 카탈로그는 브랜드 제안 목록에서 제외
  const existingBrands = useMemo(
    () => Array.from(new Set(machines.map(m => m.brand))).filter(b => b !== 'NONE').sort(),
    [machines],
  );

  const brandSuggestions = useMemo(() => {
    const q = brand.trim().toLowerCase();
    if (!q) return [];
    return existingBrands
      .filter(b => b.toLowerCase() !== q && b.toLowerCase().includes(q))
      .slice(0, 6);
  }, [brand, existingBrands]);

  // 카테고리 후보 계산에 쓸 "현재 대상 부위" — 신규 등록은 선택한 부위 1개,
  // 수정은 대상 머신의 부위(여러 개일 수 있음)를 그대로 쓴다(부위 자체는 잠금).
  const activeMuscles = useMemo(() => {
    if (isEditing && editingMachine) return parseMuscles(editingMachine.targetMuscle);
    return targetMuscle ? [targetMuscle] : [];
  }, [isEditing, editingMachine, targetMuscle]);

  // 선택한 타겟부위에 실제로 쓰이고 있는 카테고리만 우선 보여주고,
  // 아직 그 부위로 등록된 카테고리가 없으면 전체 카테고리 중에서 고르게 한다.
  const categoryOptions = useMemo(() => {
    if (activeMuscles.length === 0) return [];
    const forMuscle = Array.from(
      new Set(
        machines
          .filter(m => parseMuscles(m.targetMuscle).some(mu => activeMuscles.includes(mu)))
          .map(m => m.category),
      ),
    ).sort();
    if (forMuscle.length > 0) return forMuscle;
    return Array.from(new Set(machines.map(m => m.category))).sort();
  }, [activeMuscles, machines]);

  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    return machines
      .filter(m =>
        m.name.toLowerCase().includes(q) ||
        m.brand.toLowerCase().includes(q) ||
        m.id.toLowerCase().includes(q),
      )
      .slice(0, MAX_SEARCH_RESULTS);
  }, [searchQuery, machines]);

  function resetForm() {
    setName('');
    setDisplayName('');
    setBrand('');
    setTargetMuscle(null);
    setCategory(null);
    setLine('');
    setExerciseKind('machine');
    setImageUri(null);
  }

  function switchMode(next: Mode) {
    if (next === mode) return;
    setMode(next);
    setEditingMachine(null);
    setSearchQuery('');
    resetForm();
  }

  function selectForEdit(m: MachineWithGyms) {
    setEditingMachine(m);
    setName(m.name);
    setDisplayName(m.displayName ?? '');
    setBrand(m.brand);
    setTargetMuscle(m.targetMuscle);
    setCategory(m.category);
    setLine(m.line ?? '');
    setExerciseKind(m.exerciseKind ?? 'machine');
    setImageUri(null); // 새로 고른 이미지 없음 — 기존 이미지는 미리보기에서 별도로 보여줌
  }

  function handleSelectMuscle(muscle: string) {
    setTargetMuscle(muscle);
    setCategory(null); // 부위가 바뀌면 카테고리 목록도 바뀌므로 선택 초기화
  }

  function pickImage() {
    Alert.alert('머신 이미지 추가', '이미지를 선택하세요', [
      {
        text: '카메라로 찍기',
        onPress: async () => {
          const { status } = await ImagePicker.requestCameraPermissionsAsync();
          if (status !== 'granted') {
            Alert.alert('권한 필요', '카메라 접근 권한이 필요합니다.');
            return;
          }
          // allowsEditing: false — 강제 정사각형 크롭 없이 원본 그대로 받아서
          // 아래 미리보기/합성 단계에서 잘림 없이 흰 배경 정사각형으로 패딩한다.
          const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], allowsEditing: false, quality: 1 });
          if (!result.canceled && result.assets[0]) setImageUri(result.assets[0].uri);
        },
      },
      {
        text: '앨범에서 선택',
        onPress: async () => {
          let result: ImagePicker.ImagePickerResult;
          try {
            result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: false, quality: 1 });
          } catch (e) {
            Alert.alert('권한 필요', '사진 라이브러리 접근 권한이 필요합니다.');
            return;
          }
          if (!result.canceled && result.assets[0]) setImageUri(result.assets[0].uri);
        },
      },
      { text: '취소', style: 'cancel' },
    ]);
  }

  const canSubmit = !submitting && (
    isEditing
      ? name.trim().length > 0 && !!category
      : mode === 'create' && name.trim().length > 0 && brand.trim().length > 0 && !!targetMuscle && !!category
  );

  async function composeSquareImageIfPicked(): Promise<string | undefined> {
    if (!imageUri || !previewRef.current) return undefined;
    await new Promise(resolve => requestAnimationFrame(resolve));
    return await captureRef(previewRef, {
      format: 'png', quality: 1, result: 'tmpfile',
      width: 800, height: 800,
    });
  }

  async function handleCreate() {
    if (!targetMuscle || !category) return;
    const squareImageLocalUri = await composeSquareImageIfPicked();

    const inserted = await insertMachine({
      name:  name.trim(),
      displayName: displayName.trim() || undefined,
      brand: brand.trim(),
      targetMuscle,
      category,
      line: line.trim() || undefined,
      exerciseKind,
      squareImageLocalUri,
    });

    if ('error' in inserted) {
      Alert.alert('등록 실패', inserted.error);
      return;
    }

    Alert.alert('등록 완료', `${name.trim()} (${inserted.id}) 머신이 등록됐어요.`);
    resetForm();
    onRegistered?.();
  }

  async function handleUpdate() {
    if (!editingMachine || !category) return;
    const squareImageLocalUri = await composeSquareImageIfPicked();

    const result = await updateMachine({
      id: editingMachine.id,
      name: name.trim(),
      displayName: displayName.trim() || undefined,
      category,
      line: line.trim() || undefined,
      exerciseKind,
      squareImageLocalUri,
    });

    if ('error' in result) {
      Alert.alert('수정 실패', result.error);
      return;
    }

    Alert.alert('수정 완료', `${name.trim()} 정보가 수정됐어요.`);
    setEditingMachine(null);
    setSearchQuery('');
    resetForm();
    onRegistered?.();
  }

  async function handleSubmit() {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      if (isEditing) {
        await handleUpdate();
      } else {
        await handleCreate();
      }
    } catch (e) {
      console.warn('[AdminMachineRegisterView] submit failed:', e);
      Alert.alert(isEditing ? '수정 실패' : '등록 실패', '알 수 없는 오류가 발생했습니다.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      <Text style={styles.sectionTitle}>{mode === 'create' ? '신규 머신 등록' : '기존 머신 수정'}</Text>
      <Text style={styles.sectionSub}>
        {mode === 'create'
          ? '브랜드 머신을 카탈로그에 바로 등록해요 (승인 절차 없음)'
          : '기존 머신 정보를 바로 수정해요 (승인 절차 없음)'}
      </Text>

      {/* 모드 전환 탭 */}
      <View style={styles.modeTabRow}>
        <TouchableOpacity
          style={[styles.modeTab, mode === 'create' && styles.modeTabActive]}
          onPress={() => switchMode('create')}
          activeOpacity={0.85}
        >
          <Text style={[styles.modeTabText, mode === 'create' && styles.modeTabTextActive]}>신규 등록</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.modeTab, mode === 'edit' && styles.modeTabActive]}
          onPress={() => switchMode('edit')}
          activeOpacity={0.85}
        >
          <Text style={[styles.modeTabText, mode === 'edit' && styles.modeTabTextActive]}>기존 수정</Text>
        </TouchableOpacity>
      </View>

      {/* 수정 모드: 대상 검색 */}
      {mode === 'edit' && !editingMachine && (
        <>
          <Text style={styles.label}>머신 검색</Text>
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="머신명, 브랜드, id로 검색"
            placeholderTextColor={C.textDim}
            style={styles.input}
            autoCorrect={false}
          />
          {searchQuery.trim().length === 0 && (
            <Text style={styles.helperText}>검색어를 입력하면 결과가 나와요</Text>
          )}
          {searchQuery.trim().length > 0 && searchResults.length === 0 && (
            <Text style={styles.helperText}>검색 결과가 없어요</Text>
          )}
          {searchResults.map(m => (
            <TouchableOpacity
              key={m.id}
              style={styles.searchResultRow}
              onPress={() => selectForEdit(m)}
              activeOpacity={0.8}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.searchResultName} numberOfLines={1}>{m.name}</Text>
                <Text style={styles.searchResultSub} numberOfLines={1}>{m.brand} · {m.id}</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={C.textDim} />
            </TouchableOpacity>
          ))}
        </>
      )}

      {/* 폼 — 신규 등록 모드이거나, 수정 모드에서 대상이 선택된 경우 */}
      {(mode === 'create' || isEditing) && (
        <>
          {isEditing && (
            <TouchableOpacity
              style={styles.changeSelectionRow}
              onPress={() => { setEditingMachine(null); resetForm(); }}
              activeOpacity={0.8}
            >
              <Ionicons name="arrow-back" size={14} color={C.accent} />
              <Text style={styles.changeSelectionText}>다른 머신 선택</Text>
            </TouchableOpacity>
          )}

          {/* 머신명 */}
          <Text style={styles.label}>머신명</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="예: Chest Press"
            placeholderTextColor={C.textDim}
            style={styles.input}
            autoCorrect={false}
          />

          {/* 표시 이름 (선택) */}
          <Text style={styles.label}>표시 이름 (선택)</Text>
          <TextInput
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="비워두면 머신명이 그대로 표시돼요"
            placeholderTextColor={C.textDim}
            style={styles.input}
            autoCorrect={false}
          />

          {/* 브랜드 */}
          <Text style={styles.label}>브랜드</Text>
          {isEditing ? (
            <View style={styles.lockedField}>
              <Text style={styles.lockedFieldText}>{brand}</Text>
              <Ionicons name="lock-closed-outline" size={14} color={C.textDim} />
            </View>
          ) : (
            <>
              <TextInput
                value={brand}
                onChangeText={setBrand}
                placeholder="예: Life Fitness"
                placeholderTextColor={C.textDim}
                style={styles.input}
                autoCorrect={false}
                autoCapitalize="words"
              />
              {brandSuggestions.length > 0 && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRowContent}>
                  {brandSuggestions.map(b => (
                    <TouchableOpacity key={b} style={styles.suggestChip} onPress={() => setBrand(b)} activeOpacity={0.8}>
                      <Text style={styles.suggestChipText}>{b}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}
            </>
          )}

          {/* 타겟부위 */}
          <Text style={styles.label}>타겟부위</Text>
          {isEditing ? (
            <View style={styles.lockedField}>
              <Text style={styles.lockedFieldText}>{targetMuscle}</Text>
              <Ionicons name="lock-closed-outline" size={14} color={C.textDim} />
            </View>
          ) : (
            <View style={styles.chipWrap}>
              {TARGET_MUSCLES.map(m => (
                <TouchableOpacity
                  key={m}
                  style={[styles.chip, targetMuscle === m && styles.chipActive]}
                  onPress={() => handleSelectMuscle(m)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.chipText, targetMuscle === m && styles.chipTextActive]}>{m}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
          {isEditing && (
            <Text style={styles.helperText}>브랜드·타겟부위는 머신 id에 쓰여서 수정할 수 없어요</Text>
          )}

          {/* 카테고리 */}
          <Text style={styles.label}>카테고리</Text>
          {activeMuscles.length === 0 ? (
            <Text style={styles.helperText}>먼저 타겟부위를 선택하세요</Text>
          ) : (
            <View style={styles.chipWrap}>
              {categoryOptions.map(cat => (
                <TouchableOpacity
                  key={cat}
                  style={[styles.chip, category === cat && styles.chipActive]}
                  onPress={() => setCategory(cat)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.chipText, category === cat && styles.chipTextActive]}>{cat}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* 라인 (선택) */}
          <Text style={styles.label}>라인 (선택)</Text>
          <TextInput
            value={line}
            onChangeText={setLine}
            placeholder="예: Signature Series"
            placeholderTextColor={C.textDim}
            style={styles.input}
            autoCorrect={false}
          />
          <Text style={styles.helperText}>값이 있으면 머신 카드에 작은 뱃지로 표시돼요</Text>

          {/* 종류 */}
          <Text style={styles.label}>종류</Text>
          <View style={styles.chipWrap}>
            {EXERCISE_KINDS.map(k => (
              <TouchableOpacity
                key={k.value}
                style={[styles.chip, exerciseKind === k.value && styles.chipActive]}
                onPress={() => setExerciseKind(k.value)}
                activeOpacity={0.8}
              >
                <Text style={[styles.chipText, exerciseKind === k.value && styles.chipTextActive]}>{k.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* 이미지 */}
          <Text style={styles.label}>머신 이미지 (선택)</Text>
          <View style={styles.imageRow}>
            <View style={styles.previewBox}>
              <View ref={previewRef} collapsable={false} style={styles.previewInner}>
                {imageUri ? (
                  <Image source={{ uri: imageUri }} style={styles.previewImage} resizeMode="contain" />
                ) : isEditing && editingMachine?.imageUrl ? (
                  <Image source={{ uri: editingMachine.imageUrl }} style={styles.previewImage} resizeMode="contain" />
                ) : (
                  <Ionicons name="image-outline" size={28} color={C.textDim} />
                )}
              </View>
            </View>
            <TouchableOpacity style={styles.imageButton} onPress={pickImage} activeOpacity={0.85}>
              <Ionicons name="camera-outline" size={16} color={C.text} />
              <Text style={styles.imageButtonText}>
                {imageUri || (isEditing && editingMachine?.imageUrl) ? '이미지 변경' : '이미지 선택'}
              </Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.helperText}>
            {isEditing
              ? '새 이미지를 고르지 않으면 기존 이미지가 그대로 유지돼요'
              : '흰 배경 800×800 정사각형으로 자동 변환·저장돼요(자르지 않고 여백만 채움)'}
          </Text>

          {/* 등록/수정 버튼 */}
          <TouchableOpacity
            style={[styles.submitButton, !canSubmit && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={!canSubmit}
            activeOpacity={0.85}
          >
            {submitting ? (
              <ActivityIndicator color={C.bg} />
            ) : (
              <Text style={styles.submitButtonText}>{isEditing ? '수정 저장' : '머신 등록'}</Text>
            )}
          </TouchableOpacity>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    padding: 20,
    paddingBottom: 60,
  },
  sectionTitle: {
    ...T.section,
    color: C.text,
    marginBottom: 4,
  },
  sectionSub: {
    ...T.body,
    fontSize: 13,
    color: C.textSub,
    marginBottom: 20,
  },
  modeTabRow: {
    flexDirection: 'row',
    backgroundColor: C.surfaceHigh,
    borderRadius: R.pill,
    padding: 4,
    marginBottom: 8,
  },
  modeTab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: R.pill,
    alignItems: 'center',
  },
  modeTabActive: {
    backgroundColor: C.accentBg,
  },
  modeTabText: {
    fontSize: 13,
    fontWeight: '700',
    color: C.textSub,
  },
  modeTabTextActive: {
    color: C.accent,
  },
  label: {
    ...T.label,
    color: C.textSub,
    marginTop: 18,
    marginBottom: 8,
  },
  input: {
    backgroundColor: C.surfaceHigh,
    borderRadius: R.inner,
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: C.text,
    fontSize: 15,
  },
  helperText: {
    fontSize: 12,
    color: C.textDim,
    marginTop: 6,
  },
  chipRowContent: {
    gap: 8,
    paddingTop: 8,
  },
  suggestChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: R.pill,
    backgroundColor: C.surfaceHigh,
    borderWidth: 1,
    borderColor: C.border,
  },
  suggestChipText: {
    fontSize: 12,
    color: C.textSub,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: R.pill,
    backgroundColor: C.surfaceHigh,
    borderWidth: 1,
    borderColor: C.border,
  },
  chipActive: {
    backgroundColor: C.accentBg,
    borderColor: C.accent,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
    color: C.textSub,
  },
  chipTextActive: {
    color: C.accent,
  },
  lockedField: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: C.surface,
    borderRadius: R.inner,
    borderWidth: 1,
    borderColor: C.borderSub,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  lockedFieldText: {
    fontSize: 15,
    color: C.textSub,
  },
  searchResultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: C.surfaceHigh,
    borderRadius: R.inner,
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginTop: 8,
  },
  searchResultName: {
    fontSize: 14,
    fontWeight: '700',
    color: C.text,
  },
  searchResultSub: {
    fontSize: 12,
    color: C.textSub,
    marginTop: 2,
  },
  changeSelectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  changeSelectionText: {
    fontSize: 13,
    fontWeight: '700',
    color: C.accent,
  },
  imageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  previewBox: {
    width: PREVIEW_SIZE,
    height: PREVIEW_SIZE,
    borderRadius: R.inner,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: C.border,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  // captureRef가 실제로 캡처하는 대상 — previewBox의 테두리/모서리 곡률이
  // 캡처된 이미지 픽셀에 그대로 구워지는 걸 막기 위해 테두리 없는 순수 흰
  // 배경만 가진 내부 View를 따로 둔다(화면에는 previewBox의 테두리가 여전히
  // 보이지만, 저장되는 이미지에는 포함되지 않는다).
  previewInner: {
    width: '100%',
    height: '100%',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  imageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: R.btn,
    backgroundColor: C.surfaceHigh,
    borderWidth: 1,
    borderColor: C.border,
  },
  imageButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: C.text,
  },
  submitButton: {
    marginTop: 28,
    paddingVertical: 15,
    borderRadius: R.btn,
    backgroundColor: C.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.4,
  },
  submitButtonText: {
    fontSize: 15,
    fontWeight: '800',
    color: C.bg,
  },
});
