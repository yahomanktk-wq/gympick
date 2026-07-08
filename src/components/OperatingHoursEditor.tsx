import React from 'react';
import { View, Text, TextInput, Switch, TouchableOpacity, StyleSheet } from 'react-native';
import { C } from '../theme';

// ─── 타입 ───
export type DayHours = { enabled: boolean; open: string; close: string };
export type OperatingHours = {
  mon: DayHours; tue: DayHours; wed: DayHours; thu: DayHours;
  fri: DayHours; sat: DayHours; sun: DayHours;
};

export const DEFAULT_HOURS: OperatingHours = {
  mon: { enabled: true, open: '09:00', close: '22:00' },
  tue: { enabled: true, open: '09:00', close: '22:00' },
  wed: { enabled: true, open: '09:00', close: '22:00' },
  thu: { enabled: true, open: '09:00', close: '22:00' },
  fri: { enabled: true, open: '09:00', close: '22:00' },
  sat: { enabled: true, open: '10:00', close: '20:00' },
  sun: { enabled: false, open: '10:00', close: '20:00' },
};

export const DAY_KEYS: (keyof OperatingHours)[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
export const DAY_LABELS: Record<keyof OperatingHours, string> = {
  mon: '월', tue: '화', wed: '수', thu: '목', fri: '금', sat: '토', sun: '일',
};
export const NOTICE_CHIPS = ['24시간 오픈', '연중무휴', '시설 공사 중', '임시 휴무'];

// ─── 직렬화/역직렬화 ───
// OperatingHours → "월 09:00~22:00, 화 ..." (enabled 요일만)
export function serializeHours(h: OperatingHours): string {
  return DAY_KEYS.filter(d => h[d].enabled)
    .map(d => `${DAY_LABELS[d]} ${h[d].open}~${h[d].close}`)
    .join(', ');
}

// "월 09:00~22:00, ..." → OperatingHours (없는 요일=휴무, 실패 시 DEFAULT)
export function parseHours(raw?: string | null): OperatingHours {
  if (!raw || !raw.trim()) return DEFAULT_HOURS;
  try {
    const labelToKey: Record<string, keyof OperatingHours> = {} as any;
    (Object.keys(DAY_LABELS) as (keyof OperatingHours)[]).forEach(k => {
      labelToKey[DAY_LABELS[k]] = k;
    });
    const result = {} as OperatingHours;
    (Object.keys(DEFAULT_HOURS) as (keyof OperatingHours)[]).forEach(k => {
      result[k] = { ...DEFAULT_HOURS[k], enabled: false };
    });
    let matched = 0;
    raw.split(',').forEach(part => {
      const seg = part.trim();
      if (!seg) return;
      const sp = seg.indexOf(' ');
      if (sp < 0) return;
      const label = seg.slice(0, sp).trim();
      const time  = seg.slice(sp + 1).trim();
      const key = labelToKey[label];
      if (!key) return;
      const [open, close] = time.split('~').map(t => t.trim());
      if (!open || !close) return;
      result[key] = { enabled: true, open, close };
      matched += 1;
    });
    return matched > 0 ? result : DEFAULT_HOURS;
  } catch {
    return DEFAULT_HOURS;
  }
}

// 추가안내 칩 토글 → hours 빠른설정 + notices 배열 토글
// (24시간 오픈/연중무휴는 hours를 바꾸고, 나머지는 배열만 토글)
export function applyNoticeToggle(
  chip: string,
  prevNotices: string[],
  setHours: React.Dispatch<React.SetStateAction<OperatingHours>>,
): string[] {
  const active = prevNotices.includes(chip);
  if (!active && chip === '24시간 오픈') {
    setHours(h => { const u = { ...h }; DAY_KEYS.forEach(d => { u[d] = { ...u[d], open: '00:00', close: '24:00' }; }); return u; });
  }
  if (!active && chip === '연중무휴') {
    setHours(h => { const u = { ...h }; DAY_KEYS.forEach(d => { u[d] = { ...u[d], enabled: true }; }); return u; });
  }
  return active ? prevNotices.filter(c => c !== chip) : [...prevNotices, chip];
}

// ─── 컴포넌트 ───
export function OperatingHoursEditor({ hours, updateDay, notices, toggleNotice, hoursNote, setHoursNote }: {
  hours: OperatingHours;
  updateDay: (day: keyof OperatingHours, field: keyof DayHours, value: any) => void;
  notices: string[];
  toggleNotice: (chip: string) => void;
  hoursNote: string;
  setHoursNote: (v: string) => void;
}) {
  return (
    <View>
      <Text style={styles.fieldLabel}>운영시간</Text>
      <View style={styles.hoursCard}>
        {DAY_KEYS.map((day) => {
          const dh = hours[day];
          return (
            <View key={day} style={styles.dayRow}>
              <Switch
                value={dh.enabled}
                onValueChange={(v) => updateDay(day, 'enabled', v)}
                thumbColor={dh.enabled ? C.accent : C.textDim}
                trackColor={{ false: C.surfaceHigh, true: C.accentBg }}
              />
              <Text style={[styles.dayLabel, !dh.enabled && { color: C.textDim }]}>
                {DAY_LABELS[day]}
              </Text>
              {dh.enabled ? (
                <View style={styles.timeRow}>
                  <TextInput
                    style={styles.timeInput}
                    value={dh.open}
                    onChangeText={(t) => updateDay(day, 'open', t)}
                    placeholder="09:00"
                    placeholderTextColor={C.textDim}
                    selectionColor={C.accent}
                    keyboardType="numbers-and-punctuation"
                    maxLength={5}
                    autoCorrect={false}
                    autoCapitalize="none"
                    spellCheck={false}
                  />
                  <Text style={styles.timeSep}>~</Text>
                  <TextInput
                    style={styles.timeInput}
                    value={dh.close}
                    onChangeText={(t) => updateDay(day, 'close', t)}
                    placeholder="22:00"
                    placeholderTextColor={C.textDim}
                    selectionColor={C.accent}
                    keyboardType="numbers-and-punctuation"
                    maxLength={5}
                    autoCorrect={false}
                    autoCapitalize="none"
                    spellCheck={false}
                  />
                </View>
              ) : (
                <Text style={styles.closedLabel}>휴무</Text>
              )}
            </View>
          );
        })}
      </View>
      <Text style={[styles.fieldLabel, { marginTop: 14 }]}>추가 안내</Text>
      <View style={styles.noticeChipsRow}>
        {NOTICE_CHIPS.map((chip) => {
          const active = notices.includes(chip);
          return (
            <TouchableOpacity key={chip} style={[styles.noticeChip, active && styles.noticeChipActive]} onPress={() => toggleNotice(chip)} activeOpacity={0.8}>
              <Text style={[styles.noticeChipText, active && styles.noticeChipTextActive]}>{chip}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <View style={{ marginTop: 14 }}>
        <Text style={styles.fieldLabel}>운영시간 메모 (선택)</Text>
        <TextInput
          style={styles.hoursNoteInput}
          value={hoursNote}
          onChangeText={setHoursNote}
          placeholder="예: 매월 2·4번째 일요일 휴무, 설·추석 당일 휴무"
          placeholderTextColor={C.textDim}
          multiline
          maxLength={200}
          autoCorrect={false}
          spellCheck={false}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fieldLabel:    { fontSize: 13, fontWeight: '700', color: C.textSub, marginBottom: 6 },
  hoursCard:     { backgroundColor: C.surface, borderRadius: 12, padding: 12, gap: 8 },
  dayRow:        { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dayLabel:      { fontSize: 14, fontWeight: '700', color: C.text, width: 20 },
  timeRow:       { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
  timeInput:     { flex: 1, backgroundColor: C.surfaceHigh, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, fontSize: 14, color: C.text, textAlign: 'center' },
  timeSep:       { fontSize: 14, color: C.textDim },
  closedLabel:   { flex: 1, fontSize: 13, color: C.textDim, textAlign: 'center' },
  noticeChipsRow:{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  noticeChip:    { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border },
  noticeChipActive:{ backgroundColor: C.accentBg, borderColor: C.accent },
  noticeChipText:{ fontSize: 12, fontWeight: '600', color: C.textSub },
  noticeChipTextActive:{ color: C.accent },
  hoursNoteInput:{ backgroundColor: C.surface, borderRadius: 12, padding: 12, fontSize: 14, color: C.text, minHeight: 60, textAlignVertical: 'top' },
});
