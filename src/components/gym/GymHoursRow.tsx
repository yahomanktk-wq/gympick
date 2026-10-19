import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { C } from '../../theme';
import { DayHours } from '../../data/gymDetails';
import { kstWeekdayNow } from '../../lib/kstDate';

// 헬스장 상세 정보 카드의 '오늘 영업시간' 줄 (2026-10-20).
// 접힌 상태: 시계 아이콘 + "오늘(화) 09:00~22:00" + 펼치기 아이콘.
// 펼치면 월~일 전체와 운영시간 메모를 같은 카드 안에 보여준다.
// '오늘'은 렌더할 때마다 한국시간 기준으로 계산한다(앱을 켠 채 자정을 넘겨도 맞게).

const KO_DAYS_FROM_SUN = ['일', '월', '화', '수', '목', '금', '토'] as const;
const EN_DAYS_FROM_SUN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
const KO_WEEK          = ['월', '화', '수', '목', '금', '토', '일'] as const;

interface Row { label: string; time: string | null; isToday: boolean }

/** DB hours 문자열("월 09:00~22:00, 화 ...") → 월~일 7줄. 문자열에 없는 요일은 휴무. */
function rowsFromString(hours: string, todayKo: string): Row[] {
  const map: Record<string, string> = {};
  hours.split(',').map(s => s.trim()).filter(Boolean).forEach(seg => {
    const sp = seg.indexOf(' ');
    if (sp < 0) return;
    const label = seg.slice(0, sp).trim();
    const time  = seg.slice(sp + 1).trim();
    if (label) map[label] = time;
  });
  return KO_WEEK.map(d => ({ label: d, time: map[d] ?? null, isToday: d === todayKo }));
}

/** 예전 mock 상세 데이터(DayHours[], 요일이 'Mon' 형식) → 줄 목록 */
function rowsFromLegacy(hours: DayHours[], todayEn: string): Row[] {
  return hours.map(h => ({ label: h.day, time: h.closed ? null : h.hours, isToday: h.day === todayEn }));
}

interface Props {
  /** gyms.hours 문자열 (우선) */
  hours?:       string | null;
  /** DB 값이 없을 때 쓰는 예전 상세 데이터 */
  legacyHours?: DayHours[];
  /** gyms.hours_note — 펼쳤을 때 목록 아래에 표시 */
  note?:        string | null;
}

export default function GymHoursRow({ hours, legacyHours, note }: Props) {
  const [open, setOpen] = useState(false);

  const weekday = kstWeekdayNow();
  const todayKo = KO_DAYS_FROM_SUN[weekday];
  const todayEn = EN_DAYS_FROM_SUN[weekday];

  const rows: Row[] = hours && hours.trim()
    ? rowsFromString(hours, todayKo)
    : legacyHours && legacyHours.length > 0
      ? rowsFromLegacy(legacyHours, todayEn)
      : [];

  const todayRow   = rows.find(r => r.isToday);
  const hasNote    = !!note && !!note.trim();
  const expandable = rows.length > 0 || hasNote;

  let summary: React.ReactNode;
  if (rows.length === 0) {
    summary = <Text style={st.summary}>운영시간 정보 없음</Text>;
  } else if (!todayRow || !todayRow.time) {
    summary = (
      <Text style={st.summary}>
        오늘({todayKo}) <Text style={st.closed}>휴무</Text>
      </Text>
    );
  } else {
    summary = <Text style={st.summary}>오늘({todayKo}) {todayRow.time}</Text>;
  }

  return (
    <View>
      <TouchableOpacity
        style={st.row}
        onPress={() => {
          if (!expandable) return;
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          setOpen(v => !v);
        }}
        activeOpacity={expandable ? 0.7 : 1}
        disabled={!expandable}
      >
        <View style={st.icon}>
          <Ionicons name="time-outline" size={14} color={C.accent} />
        </View>
        <View style={{ flex: 1 }}>{summary}</View>
        {expandable && (
          <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={16} color={C.textSub} />
        )}
      </TouchableOpacity>

      {open && (
        <View style={st.expand}>
          {rows.map((r, i) => (
            <View key={`${r.label}-${i}`} style={st.dayRow}>
              <View style={st.dayWrap}>
                {r.isToday && <View style={st.todayDot} />}
                <Text style={[st.day, r.isToday && st.dayToday]}>{r.label}</Text>
              </View>
              {r.time ? (
                <Text style={[st.time, r.isToday && st.timeToday]}>{r.time}</Text>
              ) : (
                <Text style={st.closed}>휴무</Text>
              )}
            </View>
          ))}
          {hasNote && (
            <Text style={[st.note, rows.length > 0 && { marginTop: 8 }]}>{note}</Text>
          )}
        </View>
      )}
    </View>
  );
}

const st = StyleSheet.create({
  // GymDetailModal의 전화/주소 줄(infoRow/infoIcon/infoText)과 같은 모양
  row:     { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 12 },
  icon:    {
    width: 28, height: 28, borderRadius: 8,
    backgroundColor: C.accentBg, alignItems: 'center', justifyContent: 'center',
  },
  summary: { fontSize: 14, color: C.text },

  expand:  { marginTop: 10, marginLeft: 40, borderTopWidth: 1, borderTopColor: C.border, paddingTop: 4 },
  dayRow:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 7 },
  dayWrap: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  todayDot:{ width: 6, height: 6, borderRadius: 3, backgroundColor: C.accent },
  day:     { fontSize: 13, fontWeight: '600', color: C.textSub, width: 36 },
  dayToday:{ color: C.text, fontWeight: '800' },
  time:    { fontSize: 13, color: C.textSub },
  timeToday:{ color: C.accent, fontWeight: '700' },
  closed:  { fontSize: 13, color: C.danger, fontWeight: '700' },
  note:    { fontSize: 13, lineHeight: 19, color: C.textSub },
});
