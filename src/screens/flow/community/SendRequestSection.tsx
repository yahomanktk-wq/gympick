/**
 * SendRequestSection
 * GymCommunityTab 내 익명 요청 전송 섹션.
 * 완전 익명 — user_id 저장 없음, 다른 유저에게 비공개.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { C, R, T } from '../../../theme';
import { sendRequest } from '../../../data/gymRequestStore';

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const MAX_LEN = 300;

const QUICK_TEMPLATES = [
  '새 머신 추가 요청드립니다',
  '기구 점검이 필요해 보입니다',
  '샤워실 청결 개선을 부탁드립니다',
  '운영 시간 연장을 요청드립니다',
];

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────

interface Props {
  gymId: string;
  gymName: string;
  onSent: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export default function SendRequestSection({ gymId, gymName, onSent }: Props) {
  const [message, setMessage]   = useState('');
  const [sent, setSent]         = useState(false);

  function handleSend() {
    const trimmed = message.trim();
    if (!trimmed) return;
    sendRequest(gymId, trimmed);
    setSent(true);
    setTimeout(onSent, 1800); // 잠깐 완료 상태 보여준 후 부모에서 리셋
  }

  return (
    <View style={s.section}>
      {/* Section header */}
      <View style={s.sectionHeader}>
        <Ionicons name="paper-plane-outline" size={15} color={C.accent} />
        <Text style={s.sectionLabel}>SEND REQUEST</Text>
      </View>

      <View style={s.card}>
        {sent ? (
          /* ── 전송 완료 상태 ── */
          <View style={s.sentBox}>
            <View style={s.sentIconWrap}>
              <Ionicons name="checkmark-circle" size={32} color={C.accent} />
            </View>
            <Text style={s.sentTitle}>요청이 전송되었어요</Text>
            <Text style={s.sentSub}>
              {gymName} 운영진에게 익명으로 전달됩니다.
            </Text>
          </View>
        ) : (
          <>
            {/* ── 안내 문구 ── */}
            <View style={s.infoRow}>
              <Ionicons name="lock-closed-outline" size={13} color={C.textDim} />
              <Text style={s.infoText}>
                완전 익명 · 다른 회원에게 공개되지 않습니다
              </Text>
            </View>

            {/* ── 빠른 선택 템플릿 ── */}
            <View style={s.templateRow}>
              {QUICK_TEMPLATES.map((tpl) => (
                <TouchableOpacity
                  key={tpl}
                  style={s.tplChip}
                  onPress={() => setMessage(tpl)}
                  activeOpacity={0.75}
                >
                  <Text style={s.tplChipText} numberOfLines={1}>{tpl}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* ── 텍스트 입력 ── */}
            <TextInput
              style={s.input}
              value={message}
              onChangeText={(t) => setMessage(t.slice(0, MAX_LEN))}
              placeholder="헬스장에 전하고 싶은 내용을 입력하세요…"
              placeholderTextColor={C.textDim}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
            <Text style={s.charCount}>
              {message.length} / {MAX_LEN}
            </Text>

            {/* ── 전송 버튼 ── */}
            <TouchableOpacity
              style={[s.sendBtn, !message.trim() && s.sendBtnDisabled]}
              onPress={handleSend}
              disabled={!message.trim()}
              activeOpacity={0.85}
            >
              <Ionicons name="paper-plane-outline" size={16} color={C.bg} />
              <Text style={s.sendBtnText}>익명으로 전송</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  section: {
    marginBottom: 28,
  },

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  sectionLabel: {
    ...T.label,
    color: C.textSub,
    letterSpacing: 0.8,
  },

  card: {
    backgroundColor: C.surface,
    borderRadius: R.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.border,
    padding: 16,
  },

  // Info row
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 12,
  },
  infoText: {
    ...T.micro,
    color: C.textDim,
  },

  // Quick templates
  templateRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12,
  },
  tplChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: R.pill,
    backgroundColor: C.surfaceHigh,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.border,
    maxWidth: '100%',
  },
  tplChipText: {
    ...T.label,
    color: C.textSub,
  },

  // Text input
  input: {
    backgroundColor: C.surfaceHigh,
    borderRadius: R.inner,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.border,
    padding: 12,
    ...T.body,
    color: C.text,
    minHeight: 96,
    marginBottom: 6,
  },
  charCount: {
    ...T.micro,
    color: C.textDim,
    textAlign: 'right',
    marginBottom: 14,
  },

  // Send button
  sendBtn: {
    backgroundColor: C.accent,
    borderRadius: R.btn,
    height: 46,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  sendBtnDisabled: {
    opacity: 0.4,
  },
  sendBtnText: {
    ...T.body,
    color: C.bg,
    fontWeight: '700',
  },

  // Sent state
  sentBox: {
    alignItems: 'center',
    paddingVertical: 20,
    gap: 10,
  },
  sentIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: C.accent + '18',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sentTitle: {
    ...T.section,
    color: C.text,
    fontWeight: '700',
  },
  sentSub: {
    ...T.label,
    color: C.textSub,
    textAlign: 'center',
  },
});
