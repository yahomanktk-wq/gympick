// 헬스장 영어 이름(slug) 편집 — gympick.kr/{slug} 짧은 주소.
// 어드민 헬스장 수정 화면과 매니저 헬스장 정보 수정 화면에서 함께 쓴다.
// 입력을 멈추면(500ms) 형식 → 예약어 → 중복 순으로 자동 확인하고,
// 저장은 이 블록의 버튼으로 따로 한다 (다른 필드의 저장 흐름과 분리).
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import * as Haptics from 'expo-haptics';
import { C, R } from '../theme';
import {
  normalizeGymSlugInput, validateGymSlug,
  GYM_SLUG_FORMAT_MESSAGE, GYM_SLUG_RESERVED_MESSAGE, GYM_SLUG_TAKEN_MESSAGE,
} from '../lib/gymSlug';
import { checkGymSlugAvailable, updateGymSlug } from '../lib/db/gyms';

const DEBOUNCE_MS = 500;

type Status =
  | 'same'            // 저장된 값과 같음 (안내 없음, 저장 비활성)
  | 'typing'          // 입력 중 (debounce 대기)
  | 'empty'           // 비움 → 저장하면 해제
  | 'invalid_format'
  | 'reserved'
  | 'checking'
  | 'taken'
  | 'available'
  | 'check_error';

const STATUS_TEXT: Partial<Record<Status, { text: string; color: string }>> = {
  invalid_format: { text: GYM_SLUG_FORMAT_MESSAGE,          color: C.danger },
  reserved:       { text: GYM_SLUG_RESERVED_MESSAGE,        color: C.danger },
  checking:       { text: '확인 중...',                      color: C.textSub },
  taken:          { text: GYM_SLUG_TAKEN_MESSAGE,           color: C.danger },
  available:      { text: '사용할 수 있는 이름이에요',          color: C.accent },
  check_error:    { text: '확인하지 못했어요. 잠시 후 다시 시도해 주세요.', color: C.warning },
};

interface Props {
  gymId:       string;
  currentSlug: string | null | undefined;
  shortCode:   string | null | undefined;
  onSaved:     (newSlug: string | null) => void;
}

export default function GymSlugEditor({ gymId, currentSlug, shortCode, onSaved }: Props) {
  const saved = currentSlug ?? '';
  const [input,   setInput]   = useState(saved);
  const [status,  setStatus]  = useState<Status>('same');
  const [saving,  setSaving]  = useState(false);
  const [message, setMessage] = useState<{ text: string; color: string } | null>(null);
  const [focused, setFocused] = useState(false);
  // 마지막 입력에 대한 응답만 반영하기 위한 요청 번호
  const requestSeq = useRef(0);

  // 다른 헬스장으로 바뀌거나 저장된 값이 바뀌면 입력을 맞춘다
  useEffect(() => {
    requestSeq.current++;
    setInput(saved);
    setStatus('same');
  }, [gymId, saved]);

  useEffect(() => {
    if (input === saved) { setStatus('same'); return; }
    const seq = ++requestSeq.current;
    setStatus('typing');
    const timer = setTimeout(async () => {
      const v = validateGymSlug(input);
      if (v !== 'ok') { setStatus(v); return; }
      setStatus('checking');
      try {
        const available = await checkGymSlugAvailable(input, gymId);
        if (seq === requestSeq.current) setStatus(available ? 'available' : 'taken');
      } catch {
        if (seq === requestSeq.current) setStatus('check_error');
      }
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [input, saved, gymId]);

  const canSave = !saving && input !== saved && (status === 'available' || input === '');

  async function handleSave() {
    if (!canSave) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSaving(true);
    const next = input === '' ? null : input;
    const result = await updateGymSlug(gymId, next);
    setSaving(false);
    if (result.ok) {
      setMessage({ text: '저장되었어요', color: C.accent });
      onSaved(next);
    } else {
      setMessage({ text: result.message, color: C.danger });
      if (result.reason === 'taken') setStatus('taken');
    }
  }

  const statusInfo = STATUS_TEXT[status];
  const showSlugPreview = input !== '' && validateGymSlug(input) === 'ok';

  return (
    <View style={{
      backgroundColor: C.surface, borderRadius: R.card, borderWidth: 1, borderColor: C.border,
      padding: 16, marginBottom: 14,
    }}>
      <Text style={{ fontSize: 13, fontWeight: '700', color: C.textSub, letterSpacing: 0.2 }}>
        영어 이름 (짧은 주소)
      </Text>
      <Text style={{ fontSize: 12, color: C.textSub, marginTop: 4, marginBottom: 12 }}>
        네이버 지도 등에 등록할 짧은 주소로 사용돼요
      </Text>

      <View style={{ flexDirection: 'row', gap: 8 }}>
        <TextInput
          style={{
            flex: 1,
            backgroundColor: C.surfaceHigh, borderRadius: R.inner, borderWidth: 1.5,
            borderColor: focused ? C.accent : C.border,
            paddingHorizontal: 13, paddingVertical: 11, fontSize: 15, color: C.text,
          }}
          value={input}
          onChangeText={t => { setMessage(null); setInput(normalizeGymSlugInput(t)); }}
          placeholder="예: gymmoot_songcheon"
          placeholderTextColor={C.textDim}
          selectionColor={C.accent}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          autoCapitalize="none"
          autoCorrect={false}
          spellCheck={false}
          keyboardType="ascii-capable"
          maxLength={30}
        />
        <TouchableOpacity
          style={{
            paddingHorizontal: 16, borderRadius: R.inner, justifyContent: 'center', alignItems: 'center',
            minWidth: 64,
            backgroundColor: canSave ? C.accent : C.surfaceHigh,
          }}
          onPress={handleSave}
          disabled={!canSave}
          activeOpacity={0.85}
        >
          {saving
            ? <ActivityIndicator size="small" color={C.bg} />
            : <Text style={{ fontSize: 14, fontWeight: '700', color: canSave ? C.bg : C.textDim }}>저장</Text>}
        </TouchableOpacity>
      </View>

      {message
        ? <Text style={{ fontSize: 12, color: message.color, marginTop: 8 }}>{message.text}</Text>
        : statusInfo && <Text style={{ fontSize: 12, color: statusInfo.color, marginTop: 8 }}>{statusInfo.text}</Text>}

      <Text style={{ fontSize: 12, color: C.textSub, marginTop: 6 }}>
        {input === ''
          ? `비워두면 gympick.kr/g/${shortCode ?? ''} 주소가 사용돼요`
          : showSlugPreview ? `gympick.kr/${input}` : ' '}
      </Text>
    </View>
  );
}
