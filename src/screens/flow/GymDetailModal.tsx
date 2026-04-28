import React, { useState, useEffect, useMemo } from 'react';
import GymAllMachinesScreen from './GymAllMachinesScreen';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Dimensions,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { GymReportType } from '../../lib/db/gymReports';
import { addGymInfoReport } from '../../data/gymReportStore';
import { useAuth } from '../../context/AuthContext';
import { useNavigation } from '@react-navigation/native';
import { C, R, T } from '../../theme';
import { fetchGymWithMachines } from '../../lib/db/gyms';
import { GymWithMachines } from '../../data/types';
import { GYM_DETAILS, DayHours } from '../../data/gymDetails';
import MachineDetailModal from './MachineDetailModal';
import { isGymFavorite, toggleGymFavorite } from '../../data/gymFavoriteStore';
import GymCommunityTab from './community/GymCommunityTab';
import MachineCard from '../../components/MachineCard';
import MachineCardBorder from '../../components/MachineCardBorder';

const SCREEN_W = Dimensions.get('window').width;
const CARD_W   = (SCREEN_W - 32 - 8) / 2;

// --- Mock photo palette

const PHOTO_PALETTES = [
  { bg: '#1a1a2e', icon: 'barbell-outline',  fg: '#5ba4ff' },
  { bg: '#1a2e1a', icon: 'fitness-outline',  fg: '#c8ff57' },
  { bg: '#2e1a2e', icon: 'bicycle-outline',  fg: '#b36bff' },
  { bg: '#2e1a1a', icon: 'body-outline',     fg: '#ff7c47' },
];

// --- Today's day name

const TODAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][new Date().getDay()];

// --- Sub-components

function PhotoStrip({ gymId }: { gymId: string }) {
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
              <Text style={s.hoursClosed}>휴무</Text>
            ) : (
              <Text style={[s.hoursTime, isToday && s.hoursTimeToday]}>{row.hours}</Text>
            )}
          </View>
        );
      })}
    </View>
  );
}

// --- Props

interface Props {
  visible: boolean;
  gymId:   string | null;
  onClose: () => void;
}

// --- Tab type

type GymTab = '머신' | '정보' | '커뮤니티';

// --- Component

export default function GymDetailModal({ visible, gymId, onClose }: Props) {
  const [gym, setGym] = React.useState<GymWithMachines | undefined>(undefined);
  React.useEffect(() => {
    if (!gymId) return;
    fetchGymWithMachines(gymId).then(result => setGym(result ?? undefined));
  }, [gymId]);
  const details = gymId ? GYM_DETAILS[gymId] : undefined;

  const { user } = useAuth();
  const nav = useNavigation<any>();
  const [selectedMachineId,   setSelectedMachineId]   = useState<string | null>(null);
  const [isFav,               setIsFav]               = useState(false);
  const [activeTab,           setActiveTab]           = useState<GymTab>('정보');
  const [showAllMachines,     setShowAllMachines]     = useState(false);
  const [machineMuscleFilter, setMachineMuscleFilter] = useState('전체');
  const [machineBrandFilter,  setMachineBrandFilter]  = useState('전체');
  const [showReport,          setShowReport]          = useState(false);
  const [reportType,          setReportType]          = useState<GymReportType>('other');
  const [reportMsg,           setReportMsg]           = useState('');
  const [reportSent,          setReportSent]          = useState(false);
  const [reportLoading,       setReportLoading]       = useState(false);

  useEffect(() => {
    setIsFav(gymId ? isGymFavorite(gymId) : false);
    setActiveTab('정보');
    setMachineMuscleFilter('전체');
    setMachineBrandFilter('전체');
  }, [gymId]);

  const gymMachines = gym?.machines ?? [];

  const muscleOptions = useMemo(() => {
    const unique = [...new Set(gymMachines.map(m => m.targetMuscle).filter(Boolean))].sort();
    return ['전체', ...unique];
  }, [gymMachines]);

  const brandOptions = useMemo(() => {
    const unique = [...new Set(gymMachines.map(m => m.brand).filter(Boolean))].sort();
    return ['전체', ...unique];
  }, [gymMachines]);

  const filteredMachines = useMemo(() => {
    return gymMachines.filter(m => {
      const muscleOk = machineMuscleFilter === '전체' ||
        m.targetMuscle?.toLowerCase() === machineMuscleFilter.toLowerCase();
      const brandOk  = machineBrandFilter === '전체' ||
        m.brand?.toLowerCase() === machineBrandFilter.toLowerCase();
      return muscleOk && brandOk;
    });
  }, [gymMachines, machineMuscleFilter, machineBrandFilter]);

  if (!gymId || !gym) return null;

  const machineForDetail = selectedMachineId
    ? gym.machines.find(m => m.id === selectedMachineId) ?? null
    : null;

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
          <TouchableOpacity
            style={s.navBtn}
            activeOpacity={0.7}
            onPress={() => { if (!user) { onClose(); nav.navigate('Profile'); return; } const next = toggleGymFavorite(gym.id); setIsFav(next); }}
          >
            <Ionicons
              name={isFav ? 'bookmark' : 'bookmark-outline'}
              size={20}
              color={isFav ? C.accent : C.textSub}
            />
          </TouchableOpacity>
        </View>

        {/* ── Tab bar ── */}
        <View style={s.tabBar}>
          {(['머신', '정보', '커뮤니티'] as GymTab[]).map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[s.tabBtn, activeTab === tab && s.tabBtnActive]}
              onPress={() => setActiveTab(tab)}
              activeOpacity={0.8}
            >
              <Text style={[s.tabBtnText, activeTab === tab && s.tabBtnTextActive]}>
                {tab}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── 커뮤니티 tab ── */}
        {activeTab === '커뮤니티' && (
          <GymCommunityTab gymId={gymId} gymName={gym.name} />
        )}

        {/* ── 머신 tab ── */}
        {activeTab === '머신' && (
          <ScrollView showsVerticalScrollIndicator={false}>

            {/* 타겟부위 필터 */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={s.filterRow}
            >
              {muscleOptions.map(opt => (
                <TouchableOpacity
                  key={opt}
                  style={[s.filterChip, machineMuscleFilter === opt && s.filterChipActive]}
                  onPress={() => setMachineMuscleFilter(opt)}
                  activeOpacity={0.8}
                >
                  <Text style={[s.filterChipText, machineMuscleFilter === opt && s.filterChipTextActive]}>
                    {opt}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* 브랜드 필터 */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={s.filterRow}
            >
              {brandOptions.map(opt => (
                <TouchableOpacity
                  key={opt}
                  style={[s.filterChip, machineBrandFilter === opt && s.filterChipActive]}
                  onPress={() => setMachineBrandFilter(opt)}
                  activeOpacity={0.8}
                >
                  <Text style={[s.filterChipText, machineBrandFilter === opt && s.filterChipTextActive]}>
                    {opt}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* 머신 카드 그리드 */}
            {filteredMachines.length === 0 ? (
              <View style={s.emptyState}>
                <Ionicons name="barbell-outline" size={36} color={C.textDim} />
                <Text style={s.emptyText}>조건에 맞는 머신이 없어요</Text>
              </View>
            ) : (
              <View style={s.machineGrid}>
                {filteredMachines.map(machine => (
                  <TouchableOpacity
                    key={machine.id}
                    onPress={() => setSelectedMachineId(machine.id)}
                    activeOpacity={0.85}
                  >
                    <MachineCardBorder width={CARD_W}>
                      <MachineCard machine={machine} variant="grid" width={CARD_W} />
                    </MachineCardBorder>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </ScrollView>
        )}

        {/* ── 정보 tab ── */}
        {activeTab === '정보' && (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.content}>

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
                <Text style={s.infoText}>{details?.phone || '정보 없음'}</Text>
              </View>
              <View style={[s.infoRow, { marginTop: 12 }]}>
                <View style={s.infoIcon}>
                  <Ionicons name="location-outline" size={14} color={C.accent} />
                </View>
                <Text style={s.infoText}>{gym.location}, Seoul</Text>
              </View>
            </View>

            {/* ── Operating hours ── */}
            <Text style={s.sectionTitle}>영업 시간</Text>
            <View style={s.card}>
              {details?.hours ? (
                <HoursTable hours={details.hours} />
              ) : (
                <Text style={[s.infoText, { padding: 16 }]}>운영시간 정보 없음</Text>
              )}
            </View>

            {/* ── Notices ── */}
            {details?.notices && details.notices.length > 0 && (
              <React.Fragment>
                <Text style={s.sectionTitle}>공지사항</Text>
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
              </React.Fragment>
            )}

            {/* ── Pricing ── */}
            {details?.pricing && details.pricing.length > 0 ? (
              <React.Fragment>
                <Text style={s.sectionTitle}>이용 요금</Text>
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
              </React.Fragment>
            ) : null}



            {/* ── 정보 제보하기 ── */}
            <TouchableOpacity
              style={s.reportBtn}
              onPress={() => { setReportSent(false); setReportMsg(''); setReportType('other'); setShowReport(true); }}
              activeOpacity={0.8}
            >
              <Ionicons name="flag-outline" size={14} color={C.textDim} />
              <Text style={s.reportBtnText}>정보 제보하기</Text>
            </TouchableOpacity>

            <View style={{ height: 40 }} />
          </ScrollView>
        )}
      </SafeAreaView>

      <MachineDetailModal
        visible={selectedMachineId !== null}
        machine={machineForDetail}
        onClose={() => setSelectedMachineId(null)}
      />

      <GymAllMachinesScreen
        visible={showAllMachines}
        gymId={gym.id}
        gymName={gym.name}
        machines={gym.machines}
        onClose={() => setShowAllMachines(false)}
      />

      {/* ── 정보 제보 modal ── */}
      <Modal
        visible={showReport}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowReport(false)}
      >
        <SafeAreaView style={s.safe}>
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <View style={s.repHeader}>
              <TouchableOpacity style={s.repHeaderBtn} onPress={() => setShowReport(false)} activeOpacity={0.7}>
                <Ionicons name="close" size={20} color={C.text} />
              </TouchableOpacity>
              <Text style={s.repHeaderTitle}>정보 제보하기</Text>
              <View style={s.repHeaderBtn} />
            </View>

            {reportSent ? (
              <View style={s.repSentWrap}>
                <Ionicons name="checkmark-circle" size={60} color={C.accent} />
                <Text style={s.repSentTitle}>제보해 주셔서 감사해요!</Text>
                <Text style={s.repSentBody}>검토 후 정보를 업데이트할게요.</Text>
                <TouchableOpacity style={s.repSentBtn} onPress={() => setShowReport(false)} activeOpacity={0.85}>
                  <Text style={s.repSentBtnText}>확인</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <ScrollView contentContainerStyle={s.repScroll} keyboardShouldPersistTaps="handled">
                <Text style={s.repDesc}>잘못된 정보를 발견하셨나요? 제보해 주시면 검토 후 반영하겠습니다.</Text>

                <Text style={s.repFieldLabel}>제보 유형</Text>
                <View style={s.repTypeRow}>
                  {([
                    { key: 'wrong_hours',   label: '운영시간 오류' },
                    { key: 'wrong_address', label: '주소 오류' },
                    { key: 'wrong_phone',   label: '전화번호 오류' },
                    { key: 'closed',        label: '폐업' },
                    { key: 'other',         label: '기타' },
                  ] as { key: GymReportType; label: string }[]).map(t => (
                    <TouchableOpacity
                      key={t.key}
                      style={[s.repTypeChip, reportType === t.key && s.repTypeChipActive]}
                      onPress={() => setReportType(t.key)}
                      activeOpacity={0.8}
                    >
                      <Text style={[s.repTypeChipText, reportType === t.key && s.repTypeChipTextActive]}>
                        {t.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={s.repFieldLabel}>상세 내용</Text>
                <TextInput
                  style={s.repInput}
                  value={reportMsg}
                  onChangeText={v => setReportMsg(v)}
                  placeholder="정확한 정보를 알고 계신다면 알려주세요."
                  placeholderTextColor={C.textDim}
                  multiline
                  numberOfLines={4}
                  autoCorrect={false}
                  autoCapitalize="none"
                  spellCheck={false}
                  textAlignVertical="top"
                />

                <TouchableOpacity
                  style={[s.repSubmitBtn, reportLoading && { opacity: 0.6 }]}
                  activeOpacity={0.85}
                  disabled={reportLoading}
                  onPress={async () => {
                    setReportLoading(true);
                    addGymInfoReport({
                      gymId: gym.id,
                      gymName: gym.name,
                      reporterUserId: user?.id,
                      reportType,
                      content: reportMsg.trim() || reportType,
                    });
                    setReportLoading(false);
                    setReportSent(true);
                  }}
                >
                  <Text style={s.repSubmitBtnText}>{reportLoading ? '제출 중...' : '제보 보내기'}</Text>
                </TouchableOpacity>
              </ScrollView>
            )}
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </Modal>
  );
}

// --- Styles

const s = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: C.bg },
  content: { paddingHorizontal: 16, paddingBottom: 24 },

  // Report button
  reportBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    alignSelf: 'center', marginTop: 24, marginBottom: 4,
    paddingHorizontal: 16, paddingVertical: 8,
    borderRadius: R.pill,
    borderWidth: 1, borderColor: C.border,
  },
  reportBtnText: { fontSize: 12, color: C.textDim, fontWeight: '600' },

  // Report modal
  repHeader: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 8, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  repHeaderBtn:   { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  repHeaderTitle: { flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '700', color: C.text },

  repScroll: { padding: 20 },
  repDesc:   { fontSize: 13, color: C.textSub, lineHeight: 20, marginBottom: 20 },

  repFieldLabel: {
    fontSize: 11, fontWeight: '700', color: C.textDim,
    letterSpacing: 0.8, textTransform: 'uppercase',
    marginBottom: 10, marginTop: 4,
  },
  repTypeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  repTypeChip: {
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: R.pill,
    backgroundColor: C.surface,
    borderWidth: 1, borderColor: C.border,
  },
  repTypeChipActive:     { backgroundColor: C.accentBg, borderColor: C.accent },
  repTypeChipText:       { fontSize: 13, fontWeight: '600', color: C.textSub },
  repTypeChipTextActive: { color: C.accent },

  repInput: {
    backgroundColor: C.surface,
    borderRadius: R.inner,
    paddingHorizontal: 16, paddingVertical: 14,
    color: C.text, fontSize: 14,
    minHeight: 110,
    borderWidth: 1, borderColor: C.border,
    marginBottom: 20,
  },
  repSubmitBtn: {
    backgroundColor: C.accent,
    borderRadius: R.btn,
    paddingVertical: 15,
    alignItems: 'center',
  },
  repSubmitBtnText: { fontSize: 15, fontWeight: '800', color: C.bg },

  repSentWrap: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 32, gap: 12,
  },
  repSentTitle: { fontSize: 18, fontWeight: '800', color: C.text, textAlign: 'center' },
  repSentBody:  { fontSize: 14, color: C.textSub, textAlign: 'center' },
  repSentBtn: {
    marginTop: 24, backgroundColor: C.accent,
    borderRadius: R.btn, paddingVertical: 14, paddingHorizontal: 48,
  },
  repSentBtnText: { fontSize: 15, fontWeight: '800', color: C.bg },

  // Nav
  navHeader: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 8, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  navBtn:   { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  navTitle: { flex: 1, textAlign: 'center', ...T.section, color: C.text },

  // Tab bar
  tabBar: {
    flexDirection: 'row',
    backgroundColor: C.surface,
    borderRadius: R.pill,
    padding: 4,
    marginHorizontal: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: C.border,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: R.pill,
    alignItems: 'center',
  },
  tabBtnActive:     { backgroundColor: C.accent },
  tabBtnText:       { ...T.label, color: C.textSub, fontWeight: '600' },
  tabBtnTextActive: { color: C.bg, fontWeight: '700' },

  // Photo strip
  photoStrip: { flexDirection: 'row', gap: 8, marginTop: 16, marginBottom: 20 },
  photoCard:  {
    flex: 1, height: 110, borderRadius: R.card,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: C.border,
  },

  // Gym header
  gymHeader: { marginBottom: 18 },
  gymName:   { fontSize: 26, fontWeight: '900', color: C.text, letterSpacing: -0.6 },
  gymLocRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 5 },
  gymLoc:    { fontSize: 13, color: C.textSub },

  // Info card
  infoCard: {
    backgroundColor: C.surface, borderRadius: R.card,
    borderWidth: 1, borderColor: C.border,
    padding: 16, marginBottom: 20,
  },
  infoRow:  { flexDirection: 'row', alignItems: 'center', gap: 12 },
  infoIcon: {
    width: 28, height: 28, borderRadius: 8,
    backgroundColor: C.accentBg, alignItems: 'center', justifyContent: 'center',
  },
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
  hoursTable:    {},
  hoursRow:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
  hoursRowBorder:{ borderTopWidth: 1, borderTopColor: C.border },
  hoursDayWrap:  { flexDirection: 'row', alignItems: 'center', gap: 6 },
  todayDot:      { width: 6, height: 6, borderRadius: 3, backgroundColor: C.accent },
  hoursDay:      { fontSize: 14, fontWeight: '600', color: C.textSub, width: 40 },
  hoursDayToday: { color: C.text, fontWeight: '800' },
  hoursTime:     { fontSize: 14, color: C.textSub },
  hoursTimeToday:{ color: C.accent, fontWeight: '700' },
  hoursClosed:   { fontSize: 13, color: C.danger, fontWeight: '700' },

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

  // Equipment (정보 tab)
  equipCount:  { fontSize: 12, color: C.textDim, fontWeight: '600', paddingHorizontal: 16, paddingTop: 14, paddingBottom: 10 },
  equipRow:    { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 12 },
  equipBorder: { borderTopWidth: 1, borderTopColor: C.border },
  equipDot:    { width: 7, height: 7, borderRadius: 4 },
  equipName:   { fontSize: 13, fontWeight: '700', color: C.text },
  equipMeta:   { fontSize: 11, color: C.textSub, marginTop: 2 },
  equipCatPill:{ backgroundColor: C.surfaceHigh, borderRadius: R.pill, paddingHorizontal: 8, paddingVertical: 3 },
  equipCatText:{ fontSize: 10, fontWeight: '700', color: C.textSub },
  allMachinesBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4,
    borderTopWidth: 1, borderTopColor: C.border, paddingVertical: 14,
  },
  allMachinesBtnText: { fontSize: 13, fontWeight: '700', color: C.accent },

  // 머신 tab
  favFilterRow: {
    flexDirection: 'row', gap: 8,
    paddingHorizontal: 16, paddingVertical: 12,
    marginBottom: 4,
  },
  favChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: R.pill,
    backgroundColor: C.surface,
    borderWidth: 1, borderColor: C.border,
  },
  favChipActive:     { backgroundColor: C.accent, borderColor: C.accent },
  favChipText:       { fontSize: 13, fontWeight: '600', color: C.textSub },
  favChipTextActive: { color: C.bg },

  filterRow:            { paddingHorizontal: 12, paddingVertical: 6, gap: 4 },
  filterChip:           { paddingHorizontal: 12, paddingVertical: 7, borderRadius: R.pill, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, marginHorizontal: 4 },
  filterChipActive:     { backgroundColor: C.accentBg, borderColor: C.accent },
  filterChipText:       { fontSize: 12, fontWeight: '600', color: C.textSub },
  filterChipTextActive: { color: C.accent },

  machineGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 16, paddingBottom: 32 },
  emptyState:  { alignItems: 'center', paddingVertical: 48 },
  emptyText:   { fontSize: 14, color: C.textDim, marginTop: 12 },
});
