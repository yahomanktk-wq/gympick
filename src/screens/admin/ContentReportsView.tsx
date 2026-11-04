import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, RefreshControl,
} from 'react-native';
import { Image } from 'expo-image';
import { C, R } from '../../theme';
import {
  fetchContentReports, fetchReportTargetPreview, resolveContentReport, adminRemoveReportTarget,
  ContentReport, ReportTargetPreview, REPORT_TARGET_LABEL, reportReasonLabel,
} from '../../lib/db/moderation';
import { getTransformedImageUrl } from '../../lib/photoImageUrl';

// 2026-11-04: 어드민 > 콘텐츠 신고 관리 (오운완 · 댓글 · 헬스장 후기)
// 자동 숨김 없이 어드민이 직접 확인하고 처리한다.
// - 삭제(댓글·후기) / 비공개 처리(오운완) → 같은 대상의 신고를 모두 처리 완료로
// - 문제 없음 → 이 신고만 처리 완료로

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

interface CardProps {
  report:    ContentReport;
  preview?:  ReportTargetPreview;
  sameCount: number;
  busy:      boolean;
  onRemove:  (r: ContentReport) => void;
  onDismiss: (r: ContentReport) => void;
}

function ReportCard({ report, preview, sameCount, busy, onRemove, onDismiss }: CardProps) {
  const pending = report.status === 'pending';
  const thumb = preview?.imageUri
    ? getTransformedImageUrl(preview.imageUri, { width: 160, height: 213 })
    : undefined;
  return (
    <View style={[s.card, !pending && { opacity: 0.55 }]}>
      <View style={s.cardHead}>
        <Text style={s.badge}>{REPORT_TARGET_LABEL[report.targetType]}</Text>
        <Text style={s.reason}>{reportReasonLabel(report.reason)}</Text>
        {sameCount > 1 && <Text style={s.count}>누적 {sameCount}건</Text>}
        <Text style={s.date}>{formatDate(report.createdAt)}</Text>
      </View>
      {report.detail ? <Text style={s.detail}>“{report.detail}”</Text> : null}

      <View style={s.preview}>
        {thumb ? <Image source={{ uri: thumb }} style={s.thumb} contentFit="cover" /> : null}
        <View style={{ flex: 1, gap: 2 }}>
          {preview ? (
            <>
              {preview.nickname ? <Text style={s.previewNick}>{preview.nickname}</Text> : null}
              <Text style={[s.previewText, preview.gone && { color: C.textSub }]} numberOfLines={4}>
                {preview.text}
              </Text>
            </>
          ) : (
            <ActivityIndicator size="small" color={C.accent} />
          )}
        </View>
      </View>

      {pending ? (
        <View style={s.actions}>
          <TouchableOpacity
            style={[s.btn, s.btnDanger]}
            disabled={busy || preview?.gone}
            onPress={() => onRemove(report)}
            activeOpacity={0.8}
          >
            <Text style={[s.btnText, { color: C.danger }]}>
              {report.targetType === 'ounwan' ? '비공개 처리' : '삭제'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.btn} disabled={busy} onPress={() => onDismiss(report)} activeOpacity={0.8}>
            <Text style={s.btnText}>{preview?.gone ? '처리 완료' : '문제 없음'}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <Text style={s.resolved}>처리됨 · {report.resolution ?? ''}</Text>
      )}
    </View>
  );
}

export default function ContentReportsView() {
  const [reports,  setReports]  = useState<ContentReport[]>([]);
  const [previews, setPreviews] = useState<Record<string, ReportTargetPreview>>({});
  const [loading,  setLoading]  = useState(true);
  const [busyId,   setBusyId]   = useState<string | null>(null);

  const key = (r: ContentReport) => `${r.targetType}:${r.targetId}`;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await fetchContentReports();
      setReports(list);
      const uniq = Array.from(new Map(list.map(r => [key(r), r])).values());
      const entries = await Promise.all(
        uniq.map(async r => [key(r), await fetchReportTargetPreview(r.targetType, r.targetId)] as const),
      );
      setPreviews(Object.fromEntries(entries));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function resolveAllFor(r: ContentReport, resolution: string) {
    const same = reports.filter(x => key(x) === key(r) && x.status === 'pending');
    await Promise.all(same.map(x => resolveContentReport(x.id, resolution)));
    const now = new Date().toISOString();
    setReports(prev => prev.map(x =>
      key(x) === key(r) && x.status === 'pending' ? { ...x, status: 'resolved', resolution, resolvedAt: now } : x,
    ));
  }

  function handleRemove(r: ContentReport) {
    const action = r.targetType === 'ounwan' ? '비공개 처리' : '삭제';
    Alert.alert(`${REPORT_TARGET_LABEL[r.targetType]}${r.targetType === 'gym_review' ? '를' : '을'} ${action}할까요?`, '같은 대상의 신고가 모두 처리 완료로 바뀌어요.', [
      { text: '취소', style: 'cancel' },
      {
        text: action, style: 'destructive',
        onPress: async () => {
          setBusyId(r.id);
          try {
            await adminRemoveReportTarget(r.targetType, r.targetId);
            await resolveAllFor(r, action);
            setPreviews(prev => ({
              ...prev,
              [key(r)]: { ...(prev[key(r)] ?? { nickname: '', text: '' }), text: `${action}됨`, gone: true },
            }));
          } catch {
            Alert.alert('오류', `${action}하지 못했어요.`);
          } finally {
            setBusyId(null);
          }
        },
      },
    ]);
  }

  async function handleDismiss(r: ContentReport) {
    setBusyId(r.id);
    try {
      const resolution = previews[key(r)]?.gone ? '이미 삭제됨' : '문제 없음';
      await resolveContentReport(r.id, resolution);
      setReports(prev => prev.map(x => x.id === r.id ? { ...x, status: 'resolved', resolution } : x));
    } catch {
      Alert.alert('오류', '처리하지 못했어요.');
    } finally {
      setBusyId(null);
    }
  }

  const pending  = reports.filter(r => r.status === 'pending');
  const resolved = reports.filter(r => r.status === 'resolved');
  const countFor = (r: ContentReport) => reports.filter(x => key(x) === key(r)).length;

  if (loading && reports.length === 0) {
    return <View style={s.center}><ActivityIndicator color={C.accent} /></View>;
  }

  return (
    <ScrollView
      contentContainerStyle={s.scroll}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={C.accent} />}
    >
      <Text style={s.section}>처리 대기 ({pending.length})</Text>
      {pending.length === 0 && <Text style={s.empty}>처리할 신고가 없어요</Text>}
      {pending.map(r => (
        <ReportCard
          key={r.id} report={r} preview={previews[key(r)]} sameCount={countFor(r)}
          busy={busyId === r.id} onRemove={handleRemove} onDismiss={handleDismiss}
        />
      ))}
      {resolved.length > 0 && <Text style={[s.section, { marginTop: 12 }]}>처리 완료 ({resolved.length})</Text>}
      {resolved.map(r => (
        <ReportCard
          key={r.id} report={r} preview={previews[key(r)]} sameCount={countFor(r)}
          busy={false} onRemove={handleRemove} onDismiss={handleDismiss}
        />
      ))}
      <View style={{ height: 32 }} />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  scroll:      { padding: 16, gap: 10 },
  center:      { flex: 1, alignItems: 'center', justifyContent: 'center' },
  section:     { fontSize: 12, fontWeight: '700', color: C.textDim, letterSpacing: 1 },
  empty:       { fontSize: 13, color: C.textSub, paddingVertical: 8 },
  card:        { backgroundColor: C.surface, borderRadius: R.card, padding: 14, gap: 10 },
  cardHead:    { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  badge:       {
    fontSize: 11, fontWeight: '800', color: C.bg, backgroundColor: C.accent,
    paddingHorizontal: 8, paddingVertical: 2, borderRadius: R.pill, overflow: 'hidden',
  },
  reason:      { fontSize: 13, fontWeight: '700', color: C.text },
  count:       { fontSize: 11, fontWeight: '700', color: C.danger },
  date:        { fontSize: 11, color: C.textSub, marginLeft: 'auto' },
  detail:      { fontSize: 12, color: C.textSub },
  preview:     { flexDirection: 'row', gap: 10, backgroundColor: C.surfaceHigh, borderRadius: R.inner, padding: 10 },
  thumb:       { width: 60, height: 80, borderRadius: 8, backgroundColor: C.bg },
  previewNick: { fontSize: 12, fontWeight: '800', color: C.text },
  previewText: { fontSize: 13, color: C.text, lineHeight: 18 },
  actions:     { flexDirection: 'row', gap: 8 },
  btn:         { flex: 1, paddingVertical: 10, borderRadius: R.inner, borderWidth: 1, borderColor: C.border, alignItems: 'center' },
  btnDanger:   { borderColor: C.danger + '60', backgroundColor: C.dangerBg },
  btnText:     { fontSize: 13, fontWeight: '700', color: C.text },
  resolved:    { fontSize: 12, color: C.textSub },
});
