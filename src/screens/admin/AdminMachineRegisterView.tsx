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
import type { MachineWithGyms } from '../../data/types';
import { insertMachine } from '../../lib/db/machines';
import { parseMuscles } from '../../lib/splitUtils';

// 짐픽 고유명사 규칙(프로젝트 지침)의 타겟부위 7종 고정.
const TARGET_MUSCLES = ['CHEST', 'BACK', 'LEGS', 'SHOULDERS', 'ARMS', 'GLUTES', 'OTHER'];

// 이미지 미리보기/합성 박스의 화면상 크기(dp). 실제 캡처 픽셀 크기는
// captureRef 호출 시 width/height를 800으로 강제해서 이 dp 크기와 무관하게
// 항상 800×800으로 저장된다(기존 오운완 캡처 기능과 동일한 패턴).
const PREVIEW_SIZE = 160;

interface Props {
  machines:     MachineWithGyms[];
  /** 등록 성공 후 부모가 머신 목록을 다시 불러오도록 알려준다. */
  onRegistered?: () => void;
}

export default function AdminMachineRegisterView({ machines, onRegistered }: Props) {
  const [name,         setName]         = useState('');
  const [brand,        setBrand]        = useState('');
  const [targetMuscle, setTargetMuscle] = useState<string | null>(null);
  const [category,     setCategory]     = useState<string | null>(null);
  const [imageUri,     setImageUri]     = useState<string | null>(null);
  const [submitting,   setSubmitting]   = useState(false);

  const previewRef = useRef<View>(null);

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

  // 선택한 타겟부위에 실제로 쓰이고 있는 카테고리만 우선 보여주고,
  // 아직 그 부위로 등록된 카테고리가 없으면 전체 카테고리 중에서 고르게 한다.
  const categoryOptions = useMemo(() => {
    if (!targetMuscle) return [];
    const forMuscle = Array.from(
      new Set(
        machines
          .filter(m => parseMuscles(m.targetMuscle).includes(targetMuscle))
          .map(m => m.category),
      ),
    ).sort();
    if (forMuscle.length > 0) return forMuscle;
    return Array.from(new Set(machines.map(m => m.category))).sort();
  }, [targetMuscle, machines]);

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

  const canSubmit = name.trim().length > 0 && brand.trim().length > 0 && !!targetMuscle && !!category && !submitting;

  async function handleSubmit() {
    if (!canSubmit || !targetMuscle || !category) return;
    setSubmitting(true);
    try {
      let squareImageLocalUri: string | undefined;

      if (imageUri && previewRef.current) {
        await new Promise(resolve => requestAnimationFrame(resolve));
        squareImageLocalUri = await captureRef(previewRef, {
          format: 'png', quality: 1, result: 'tmpfile',
          width: 800, height: 800,
        });
      }

      const inserted = await insertMachine({
        name:  name.trim(),
        brand: brand.trim(),
        targetMuscle,
        category,
        squareImageLocalUri,
      });

      if ('error' in inserted) {
        Alert.alert('등록 실패', inserted.error);
        return;
      }

      Alert.alert('등록 완료', `${name.trim()} (${inserted.id}) 머신이 등록됐어요.`);
      setName('');
      setBrand('');
      setTargetMuscle(null);
      setCategory(null);
      setImageUri(null);
      onRegistered?.();
    } catch (e) {
      console.warn('[AdminMachineRegisterView] submit failed:', e);
      Alert.alert('등록 실패', '알 수 없는 오류가 발생했습니다.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      <Text style={styles.sectionTitle}>신규 머신 등록</Text>
      <Text style={styles.sectionSub}>브랜드 머신을 카탈로그에 바로 등록해요 (승인 절차 없음)</Text>

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

      {/* 브랜드 (자유 입력 + 기존 브랜드 제안) */}
      <Text style={styles.label}>브랜드</Text>
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

      {/* 타겟부위 */}
      <Text style={styles.label}>타겟부위</Text>
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

      {/* 카테고리 (타겟부위 선택 후 노출) */}
      <Text style={styles.label}>카테고리</Text>
      {!targetMuscle ? (
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

      {/* 이미지 */}
      <Text style={styles.label}>머신 이미지 (선택)</Text>
      <View style={styles.imageRow}>
        <View ref={previewRef} collapsable={false} style={styles.previewBox}>
          {imageUri ? (
            <Image source={{ uri: imageUri }} style={styles.previewImage} resizeMode="contain" />
          ) : (
            <Ionicons name="image-outline" size={28} color={C.textDim} />
          )}
        </View>
        <TouchableOpacity style={styles.imageButton} onPress={pickImage} activeOpacity={0.85}>
          <Ionicons name="camera-outline" size={16} color={C.text} />
          <Text style={styles.imageButtonText}>{imageUri ? '이미지 변경' : '이미지 선택'}</Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.helperText}>흰 배경 800×800 정사각형으로 자동 변환·저장돼요(자르지 않고 여백만 채움)</Text>

      {/* 등록 버튼 */}
      <TouchableOpacity
        style={[styles.submitButton, !canSubmit && styles.submitButtonDisabled]}
        onPress={handleSubmit}
        disabled={!canSubmit}
        activeOpacity={0.85}
      >
        {submitting ? (
          <ActivityIndicator color={C.bg} />
        ) : (
          <Text style={styles.submitButtonText}>머신 등록</Text>
        )}
      </TouchableOpacity>
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
