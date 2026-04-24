import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { C, R, T } from '../../theme';
import { GYMS_WITH_MACHINES } from '../../data';
import { GYM_DETAILS, DayHours } from '../../data/gymDetails';

// ─── Mock photo palette ───────────────────────────────────────────────────────

const PHOTO_PALETTES = [
  { bg: '#1a1a2e', icon: 'barbell-outline',        fg: '#5ba4ff' },
  { bg: '#1a2e1a', icon: 'fitness-outline',         fg: '#c8ff57' },
  { bg: '#2e1a2e', icon: 'bicycle-outline',         fg: '#b36bff' },
  { bg: '#2e1a1a', icon: 'body-outline',            fg: '#ff7c47' },
];

// ─── Today's day name ─────────────────────────────────────────────────────────

const TODAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][new Date().getDay()];

// ─── Sub-components ───────────────────────────────────────────────────────────

function PhotoStrip({ gymId }: { gymId: string }) {
  // Deterministic palette offset
  const offset = gymId.charCodeAt(gymId.length - 1) % PHOTO_PALETTES.length;
  const photos = [0, 1, 2].map(i => PHOTO_PALETTES[(offset + i) % PHOTO_PALETTES.length]);

  return (
    <View style={s.photoStrip}>
      {photos.map((p, i) => (
        <View key={i} style={[s.photoCard, { backgroundColor: p.bg }]}>
          <Ionicons name={p.icon as any} size={28} color={p.fg} style={{ opacity: 0.7 }} />
        </View>
      ))}
    </View>
  );
}

function HoursTable({ hours }: { hours: DayHours[] }) {
  return (
    <View style={s.hoursTable}>
      {hours.map((row, i) => {
        const isToday  = row.day === TODAY;
        const isClosed = !!row.closed;
        return (
          <View key={row.day} style={[s.hoursRow, i > 0 && s.hoursRowBorder]}>
            <View style={s.hoursDayWrap}>
              {isToday && <View style={s.todayDot} />}
              <Text style={[s.hoursDay, isToday && s.hoursDayToday]}>{row.day}</Text>
            </View>
            {isClosed ? (
              <Text style={s.hoursClosed}>Closed</Text>
            ) : (
              <Text style={[s.hoursTime, isToday && s.hoursTimeToday]}>{row.hours}</Text>
            )}
          </View>
        );
      })}
    </View>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  visible: boolean;
  gymId:   string | null;
  onClose: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function GymDetailModal({ visible, gymId, onClose }: Props) {
  if (!gymId) return null;

  const gym     = GYMS_WITH_MACHINES.find(g => g.id === gymId);
  const details = GYM_DETAILS[gymId];

  if (!gym || !details) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <SafeAreaView style={s.safe}>

        {/* Nav header */}
        <View style={s.navHeader}>
          <TouchableOpacity style={s.navBtn} onPress={onClose} activeOpacity={0.7}>
            <Ionicons name="chevron-back" size={20} color={C.text} />
          </TouchableOpacity>
          <Text style={s.navTitle} numberOfLines={1}>{gym.name}</Text>
          <View style={s.navBtn} />
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.content}>

          {/* ── Photo strip ── */}
          <PhotoStrip gymId={gymId} />

          {/* ── Gym name + location ── */}
          <View style={s.gymHeader}>
            <Text style={s.gymName}>{gym.name}</Text>
            <View style={s.gymLocRow}>
              <Ionicons name="location-outline" size={13} color={C.textSub} />
              <Text style={s.gymLoc}>{gym.location}</Text>
            </View>
          </View>

          {/* ── Info card ── */}
          <View style={s.infoCard}>
            <View style={s.infoRow}>
              <View style={s.infoIcon}>
                <Ionicons name="call-outline" size={14} color={C.accent} />
              </View>
              <Text style={s.infoText}>{details.phone}</Text>
            </View>
            <View style={[s.infoRow, { marginTop: 12 }]}>
              <View style={s.infoIcon}>
                <Ionicons name="location-outline" size={14} color={C.accent} />
              </View>
              <Text style={s.infoText}>{gym.location}, Seoul</Text>
            </View>
          </View>

          {/* ── Operating hours ── */}
          <Text style={s.sectionTitle}>Hours</Text>
          <View style={s.card}>
            <HoursTable hours={details.hours} />
          </View>

          {/* ── Notices ── */}
          {details.notices.length > 0 && (
            <>
              <Text style={s.sectionTitle}>Notices</Text>
              <View style={s.card}>
                {details.notices.map((n, i) => (
                  <View key={i} style={[s.noticeRow, i > 0 && s.noticeBorder]}>
                    <View style={s.noticeTitleRow}>
                      <Ionicons name="megaphone-outline" size={13} color={C.accent} />
                      <Text style={s.noticeTitle}>{n.title}</Text>
                      <Text style={s.noticeDate}>{n.date}</Text>
                    </View>
                    <Text style={s.noticeBody}>{n.body}</Text>
                  </View>
                ))}
              </View>
            </>
          )}

          {/* ── Pricing ── */}
          <Text style={s.sectionTitle}>Pricing</Text>
          <View style={s.card}>
            {details.pricing.map((tier, i) => (
              <View key={i} style={[s.priceRow, i > 0 && s.priceBorder]}>
                <View style={{ flex: 1 }}>
                  <Text style={s.priceLabel}>{tier.label}</Text>
                  {tier.note && <Text style={s.priceNote}>{tier.note}</Text>}
                </View>
                <Text style={s.priceValue}>{tier.price}</Text>
              </View>
            ))}
          </View>

          {/* ── Machine inventory ── */}
          <Text style={s.sectionTitle}>Equipment</Text>
          <View style={s.card}>
            <Text style={s.equipCount}>{gym.machines.length} machines available</Text>
            {gym.machines.map((m, i) => (
              <View key={m.id} style={[s.equipRow, i > 0 && s.equipBorder]}>
                <View style={[s.equipDot, { backgroundColor: C.accent }]} />
                <View style={{ flex: 1 }}>
                  <Text style={s.equipName}>{m.name}</Text>
                  <Text style={s.equipMeta}>{m.brand} · {m.targetMuscle}</Text>
                </View>
                <View style={s.equipCatPill}>
                  <Text style={s.equipCatText}>{m.category}</Text>
                </View>
              </View>
            ))}
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: C.bg },
  content: { paddingHorizontal: 16, paddingBottom: 24 },

  // Nav
  navHeader: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 8, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  navBtn:   { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  navTitle: { flex: 1, textAlign: 'center', ...T.section, color: C.text },

  // Photo strip
  photoStrip: {
    flexDirection: 'row', gap: 8,
    marginTop: 16, marginBottom: 20,
  },
  photoCard: {
    flex: 1, height: 110,
    borderRadius: R.card,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: C.border,
  },

  // Gym header
  gymHeader:  { marginBottom: 18 },
  gymName:    { fontSize: 26, fontWeight: '900', color: C.text, letterSpacing: -0.6 },
  gymLocRow:  { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 5 },
  gymLoc:     { fontSize: 13, color: C.textSub },

  // Info card
  infoCard: {
    backgroundColor: C.surface, borderRadius: R.card,
    borderWidth: 1, borderColor: C.border,
    padding: 16, marginBottom: 20,
  },
  infoRow:  { flexDirection: 'row', alignItems: 'center', gap: 12 },
  infoIcon: { width: 28, height: 28, borderRadius: 8, backgroundColor: C.accentBg, alignItems: 'center', justifyContent: 'center' },
  infoText: { fontSize: 14, color: C.text },

  // Section title
  sectionTitle: { ...T.section, color: C.text, marginBottom: 10 },

  // Generic card
  card: {
    backgroundColor: C.surface, borderRadius: R.card,
    borderWidth: 1, borderColor: C.border,
    overflow: 'hidden', marginBottom: 20,
  },

  // Hours
  hoursTable:   { },
  hoursRow:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
  hoursRowBorder:{ borderTopWidth: 1, borderTopColor: C.border },
  hoursDayWrap: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  todayDot:     { width: 6, height: 6, borderRadius: 3, backgroundColor: C.accent },
  hoursDay:     { fontSize: 14, fontWeight: '600', color: C.textSub, width: 40 },
  hoursDayToday:{ color: C.text, fontWeight: '800' },
  hoursTime:    { fontSize: 14, color: C.textSub },
  hoursTimeToday:{ color: C.accent, fontWeight: '700' },
  hoursClosed:  { fontSize: 13, color: C.danger, fontWeight: '700' },

  // Notices
  noticeRow:      { padding: 14 },
  noticeBorder:   { borderTopWidth: 1, borderTopColor: C.border },
  noticeTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  noticeTitle:    { flex: 1, fontSize: 13, fontWeight: '800', color: C.text },
  noticeDate:     { fontSize: 10, color: C.textDim, fontWeight: '600' },
  noticeBody:     { fontSize: 13, color: C.textSub, lineHeight: 20 },

  // Pricing
  priceRow:   { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14 },
  priceBorder:{ borderTopWidth: 1, borderTopColor: C.border },
  priceLabel: { fontSize: 14, fontWeight: '700', color: C.text },
  priceNote:  { fontSize: 11, color: C.textDim, marginTop: 2 },
  priceValue: { fontSize: 16, fontWeight: '900', color: C.accent },

  // Equipment
  equipCount:  { fontSize: 12, color: C.textDim, fontWeight: '600', paddingHorizontal: 16, paddingTop: 14, paddingBottom: 10 },
  equipRow:    { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 12 },
  equipBorder: { borderTopWidth: 1, borderTopColor: C.border },
  equipDot:    { width: 7, height: 7, borderRadius: 4 },
  equipName:   { fontSize: 13, fontWeight: '700', color: C.text },
  equipMeta:   { fontSize: 11, color: C.textSub, marginTop: 2 },
  equipCatPill:{ backgroundColor: C.surfaceHigh, borderRadius: R.pill, paddingHorizontal: 8, paddingVertical: 3 },
  equipCatText:{ fontSize: 10, fontWeight: '700', color: C.textSub },
});
