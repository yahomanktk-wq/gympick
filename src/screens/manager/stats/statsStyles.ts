import { StyleSheet, Dimensions } from 'react-native';
import { C, R } from '../../../theme';

// 매니저 이용 통계 공용 스타일 (F5-2: GymStatsView에서 그대로 옮김)

const SCREEN_W = Dimensions.get('window').width;
export const CHART_W  = SCREEN_W - 32;
export const CHART_H  = 160;

export const bc = StyleSheet.create({
  wrap:   { marginBottom: 8 },
  chart:  { flexDirection: 'row', alignItems: 'flex-end', height: CHART_H - 20, paddingHorizontal: 8, gap: 2 },
  barCol: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  bar:    { borderRadius: 2 },
  xAxis:  { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 8, marginTop: 4 },
  xLabel: { fontSize: 10, color: C.textDim },
});

export const s = StyleSheet.create({
  periodRow: {
    flexDirection:     'row',
    gap:               8,
    paddingHorizontal: 16,
    paddingVertical:   8,
    backgroundColor:   C.bg,
    alignItems:        'center',
  },
  periodChip: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               4,
    paddingHorizontal: 12,
    paddingVertical:   5,
    borderRadius:      R.pill,
    backgroundColor:   C.surface,
    borderWidth:       1,
    borderColor:       C.border,
  },
  periodChipActive:     { backgroundColor: C.accent, borderColor: C.accent },
  periodChipText:       { fontSize: 12, fontWeight: '600', color: C.textSub },
  periodChipTextActive: { color: C.bg },

  tab: {
    height:            42,
    paddingHorizontal: 12,
    alignItems:        'center',
    justifyContent:    'center',
  },
  tabEven: { flex: 1 },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: C.accent,
  },
  tabText:       { fontSize: 12, fontWeight: '600', color: C.textDim },
  tabTextActive: { color: C.accent, fontWeight: '800' },

  customRow: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               8,
    paddingHorizontal: 16,
    paddingBottom:     8,
    backgroundColor:   C.bg,
  },
  customInput: {
    flex:              1,
    height:            34,
    backgroundColor:   C.surface,
    borderRadius:      R.inner,
    borderWidth:       1,
    borderColor:       C.border,
    paddingHorizontal: 10,
    fontSize:          12,
    color:             C.text,
  },
  customApplyBtn: {
    paddingHorizontal: 12,
    paddingVertical:   7,
    backgroundColor:   C.accent,
    borderRadius:      R.pill,
  },
  customApplyText: { fontSize: 12, fontWeight: '700', color: C.bg },

  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, paddingTop: 60 },
  loadingText: { fontSize: 13, color: C.textDim },

  scroll: { padding: 16, gap: 16 },

  summaryRow: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    marginBottom:   8,
  },
  summaryLabel: { fontSize: 13, color: C.textSub, fontWeight: '600' },
  summaryValue: { fontSize: 20, fontWeight: '900', color: C.accent },

  card: {
    backgroundColor: C.surface,
    borderRadius:    R.card,
    borderWidth:     1,
    borderColor:     C.border,
    overflow:        'hidden',
  },
  divider: { borderTopWidth: 1, borderTopColor: C.border },

  machineRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           10,
    padding:       14,
  },
  machineRankBadge: {
    width:           28,
    height:          28,
    borderRadius:    14,
    backgroundColor: C.surfaceHigh,
    alignItems:      'center',
    justifyContent:  'center',
  },
  machineRankBadgeTop: { backgroundColor: C.accent },
  machineRank:         { fontSize: 12, fontWeight: '800', color: C.textSub },
  machineRankTop:      { color: C.bg },
  machineImg:          { width: 48, height: 48, borderRadius: 8, backgroundColor: '#FFFFFF' },
  machineNameRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  machineName:    { flex: 1, fontSize: 14, fontWeight: '700', color: C.text },
  machineBrand:   { fontSize: 11, color: C.textDim },
  machineCount:   { fontSize: 14, fontWeight: '800', color: C.accent, marginLeft: 8 },

  usageBarBg:   { height: 4, backgroundColor: C.border, borderRadius: 2, marginTop: 2 },
  usageBarFill: { height: 4, backgroundColor: C.accent, borderRadius: 2 },

  chartTitle: { fontSize: 13, fontWeight: '700', color: C.text, padding: 14, paddingBottom: 8 },

  muscleHeader: { fontSize: 11, fontWeight: '800', color: C.textDim, letterSpacing: 1, marginBottom: 6 },

  emptyWrap: { alignItems: 'center', paddingVertical: 48, gap: 10 },
  emptyText: { fontSize: 13, color: C.textDim },

  peakRow:     { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, gap: 8 },
  peakLabel:   { width: 32, fontSize: 12, fontWeight: '600', color: C.textSub },
  peakBarWrap: { flex: 1, height: 6, backgroundColor: C.border, borderRadius: 3 },
  peakBar:     { height: 6, backgroundColor: C.accent, borderRadius: 3 },
  peakCount:   { width: 30, fontSize: 11, fontWeight: '700', color: C.text, textAlign: 'right' },

  kpiRow:   { flexDirection: 'row', padding: 16, gap: 8 },
  kpiCell:  { flex: 1, alignItems: 'center', gap: 4 },
  kpiValue: { fontSize: 22, fontWeight: '900', color: C.accent },
  kpiLabel: { fontSize: 10, color: C.textDim, fontWeight: '600', textAlign: 'center' },

  avgChip: { fontSize: 11, fontWeight: '700', color: C.accent },
});
