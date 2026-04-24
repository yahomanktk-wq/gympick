import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  StatusBar,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { C, R, T } from '../../theme';
import { PendingGym, PendingEdit, FlaggedItem, ReviewStatus, FlagType } from '../../data/types';
import { PENDING_GYMS, PENDING_EDITS, FLAGGED_ITEMS } from '../../data/mockAdmin';

// ─── Types ────────────────────────────────────────────────────────────────────

type AdminView = 'home' | 'pending-gyms' | 'gym-detail' | 'pending-edits' | 'flagged';

// ─── Shared components ────────────────────────────────────────────────────────

function Header({
  title, onBack, right,
}: { title: string; onBack: () => void; right?: React.ReactNode }) {
  return (
    <View style={styles.header}>
      <TouchableOpacity onPress={onBack} style={styles.backBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
        <Ionicons name="chevron-back" size={22} color={C.text} />
      </TouchableOpacity>
      <Text style={styles.headerTitle}>{title}</Text>
      {right ?? <View style={{ width: 40 }} />}
    </View>
  );
}

function ReviewButtons({
  onApprove, onReject,
}: { onApprove: () => void; onReject: () => void }) {
  return (
    <View style={styles.reviewBtns}>
      <TouchableOpacity style={styles.rejectBtn} onPress={onReject} activeOpacity={0.8}>
        <Ionicons name="close" size={14} color={C.danger} />
        <Text style={styles.rejectBtnText}>Reject</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.approveBtn} onPress={onApprove} activeOpacity={0.85}>
        <Ionicons name="checkmark" size={14} color={C.bg} />
        <Text style={styles.approveBtnText}>Approve</Text>
      </TouchableOpacity>
    </View>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value || '—'}</Text>
    </View>
  );
}

const FLAG_META: Record<FlagType, { label: string; color: string; icon: React.ComponentProps<typeof Ionicons>['name'] }> = {
  duplicate:      { label: 'Duplicate',     color: '#ffb547', icon: 'copy-outline' },
  incorrect_info: { label: 'Incorrect Info', color: '#ff7c47', icon: 'alert-circle-outline' },
  closed:         { label: 'Closed',        color: C.danger,  icon: 'lock-closed-outline' },
};

// ─── Main component ───────────────────────────────────────────────────────────

export default function AdminDashboard({ onClose }: { onClose: () => void }) {
  // ── Navigation ──
  const [viewStack, setViewStack] = useState<AdminView[]>(['home']);
  const currentView = viewStack[viewStack.length - 1];
  const push = (v: AdminView) => setViewStack(p => [...p, v]);
  const pop  = () => {
    if (viewStack.length <= 1) { onClose(); return; }
    setViewStack(p => p.slice(0, -1));
  };

  // ── State ──
  const [pendingGyms,   setPendingGyms]   = useState<PendingGym[]>(PENDING_GYMS);
  const [pendingEdits,  setPendingEdits]  = useState<PendingEdit[]>(PENDING_EDITS);
  const [flaggedItems,  setFlaggedItems]  = useState<FlaggedItem[]>(FLAGGED_ITEMS);
  const [selectedGym,  setSelectedGym]   = useState<PendingGym | null>(null);

  // ── Counts ──
  const pendingGymCount  = pendingGyms.filter(g => g.status === 'pending').length;
  const pendingEditCount = pendingEdits.filter(e => e.status === 'pending').length;
  const openFlagCount    = flaggedItems.filter(f => f.status === 'open').length;

  // ── Actions ──

  const reviewGym = (gym: PendingGym, action: ReviewStatus) => {
    const verb = action === 'approved' ? 'approve' : 'reject';
    Alert.alert(
      `${verb === 'approve' ? 'Approve' : 'Reject'} gym?`,
      `"${gym.name}" will be ${action === 'approved' ? 'published to the app' : 'rejected and the manager notified'}.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: action === 'approved' ? 'Approve' : 'Reject',
          style: action === 'rejected' ? 'destructive' : 'default',
          onPress: () => {
            setPendingGyms(prev => prev.map(g => g.id === gym.id ? { ...g, status: action } : g));
            setViewStack(p => p.slice(0, -1)); // pop gym-detail
          },
        },
      ],
    );
  };

  const reviewEdit = (edit: PendingEdit, action: ReviewStatus) => {
    const verb = action === 'approved' ? 'Approve' : 'Reject';
    Alert.alert(
      `${verb} edit?`,
      `${verb} the change to "${edit.field}" for ${edit.gymName}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: verb,
          style: action === 'rejected' ? 'destructive' : 'default',
          onPress: () => setPendingEdits(prev => prev.map(e => e.id === edit.id ? { ...e, status: action } : e)),
        },
      ],
    );
  };

  const resolveFlag = (item: FlaggedItem, resolution: 'resolved' | 'delete' | 'merge') => {
    const labels: Record<string, string> = {
      resolved: 'Mark as Resolved',
      delete:   'Delete Gym',
      merge:    'Merge Gyms',
    };
    Alert.alert(`${labels[resolution]}?`, `Action taken on "${item.gymName}".`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: labels[resolution],
        style: resolution === 'delete' ? 'destructive' : 'default',
        onPress: () => setFlaggedItems(prev => prev.map(f => f.id === item.id ? { ...f, status: 'resolved' } : f)),
      },
    ]);
  };

  // ─── Home view ────────────────────────────────────────────────────────────

  const HomeView = () => (
    <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
      {/* Stats */}
      <Text style={styles.sectionTitle}>Admin Overview</Text>
      <View style={styles.statsRow}>
        {[
          { label: 'Gyms in DB',     value: '8',  icon: 'business' as const, color: C.accent },
          { label: 'Approved Today', value: '2',  icon: 'checkmark-circle' as const, color: '#3dd68c' },
          { label: 'Machines',       value: '23', icon: 'barbell' as const, color: '#5ba4ff' },
        ].map(s => (
          <View key={s.label} style={styles.statCard}>
            <Ionicons name={s.icon} size={20} color={s.color} />
            <Text style={[styles.statValue, { color: s.color }]}>{s.value}</Text>
            <Text style={styles.statLabel}>{s.label}</Text>
          </View>
        ))}
      </View>

      {/* Queues */}
      <Text style={[styles.sectionTitle, { marginTop: 8 }]}>Review Queues</Text>
      {[
        {
          icon: 'business-outline' as const,
          title: 'Pending Gym Registrations',
          count: pendingGymCount,
          sub: `${pendingGymCount} awaiting review`,
          onPress: () => push('pending-gyms'),
          color: '#ffb547',
        },
        {
          icon: 'create-outline' as const,
          title: 'Pending Profile Edits',
          count: pendingEditCount,
          sub: `${pendingEditCount} awaiting review`,
          onPress: () => push('pending-edits'),
          color: '#5ba4ff',
        },
        {
          icon: 'flag-outline' as const,
          title: 'Flagged Items',
          count: openFlagCount,
          sub: `${openFlagCount} open reports`,
          onPress: () => push('flagged'),
          color: C.danger,
        },
      ].map(q => (
        <TouchableOpacity key={q.title} style={styles.queueCard} onPress={q.onPress} activeOpacity={0.85}>
          <View style={[styles.queueIcon, { backgroundColor: q.color + '18' }]}>
            <Ionicons name={q.icon} size={20} color={q.color} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.queueTitle}>{q.title}</Text>
            <Text style={styles.queueSub}>{q.sub}</Text>
          </View>
          {q.count > 0 && (
            <View style={[styles.queueBadge, { backgroundColor: q.color }]}>
              <Text style={styles.queueBadgeText}>{q.count}</Text>
            </View>
          )}
          <Ionicons name="chevron-forward" size={16} color={C.textDim} style={{ marginLeft: 4 }} />
        </TouchableOpacity>
      ))}

      {/* Recent activity */}
      <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Recent Activity</Text>
      <View style={styles.activityCard}>
        {[
          { icon: 'checkmark-circle' as const, color: '#3dd68c', text: 'IronHub Fitness approved',  time: '2h ago' },
          { icon: 'checkmark-circle' as const, color: '#3dd68c', text: 'PulseZone Gym approved',    time: '5h ago' },
          { icon: 'close-circle'     as const, color: C.danger,  text: 'Duplicate gym rejected',   time: 'Yesterday' },
          { icon: 'flag'             as const, color: '#ffb547', text: 'UrbanSweat Gym flagged',    time: '2 days ago' },
        ].map((a, i) => (
          <React.Fragment key={i}>
            <View style={styles.activityRow}>
              <Ionicons name={a.icon} size={16} color={a.color} />
              <Text style={styles.activityText}>{a.text}</Text>
              <Text style={styles.activityTime}>{a.time}</Text>
            </View>
            {i < 3 && <View style={styles.divider} />}
          </React.Fragment>
        ))}
      </View>
    </ScrollView>
  );

  // ─── Pending gyms view ────────────────────────────────────────────────────

  const PendingGymsView = () => {
    const items = pendingGyms.filter(g => g.status === 'pending');
    return (
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionTitle}>Pending Registrations</Text>
        <Text style={styles.sectionSub}>{items.length} gyms waiting for review</Text>

        {items.length === 0 && <EmptyQueue label="All registrations reviewed" />}

        {items.map(gym => (
          <TouchableOpacity
            key={gym.id}
            style={styles.pendingCard}
            onPress={() => { setSelectedGym(gym); push('gym-detail'); }}
            activeOpacity={0.85}
          >
            <View style={styles.pendingCardTop}>
              <View style={{ flex: 1 }}>
                <Text style={styles.pendingName}>{gym.name}</Text>
                <View style={styles.locRow}>
                  <Ionicons name="location-outline" size={11} color={C.textSub} />
                  <Text style={styles.locText}>{gym.location}</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={16} color={C.textDim} />
            </View>
            <Text style={styles.pendingDesc} numberOfLines={2}>{gym.description}</Text>
            <View style={styles.submittedRow}>
              <Ionicons name="person-outline" size={11} color={C.textSub} />
              <Text style={styles.submittedText}>{gym.managerName} · submitted {gym.submittedAt}</Text>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    );
  };

  // ─── Gym detail view ──────────────────────────────────────────────────────

  const GymDetailView = () => {
    if (!selectedGym) return null;
    return (
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionTitle}>{selectedGym.name}</Text>
        <Text style={styles.sectionSub}>Submitted by {selectedGym.managerName} on {selectedGym.submittedAt}</Text>

        <View style={styles.detailCard}>
          <DetailRow label="Location"    value={selectedGym.location} />
          <View style={styles.detailDivider} />
          <DetailRow label="Phone"       value={selectedGym.phone} />
          <View style={styles.detailDivider} />
          <DetailRow label="Website"     value={selectedGym.website} />
          <View style={styles.detailDivider} />
          <DetailRow label="Hours"       value={selectedGym.hours} />
          <View style={styles.detailDivider} />
          <DetailRow label="Description" value={selectedGym.description} />
        </View>

        <View style={styles.detailNote}>
          <Ionicons name="person-circle-outline" size={14} color={C.textSub} />
          <Text style={styles.detailNoteText}>
            Manager ID: {selectedGym.managerId}  ·  {selectedGym.managerName}
          </Text>
        </View>

        <ReviewButtons
          onApprove={() => reviewGym(selectedGym, 'approved')}
          onReject={() => reviewGym(selectedGym, 'rejected')}
        />
      </ScrollView>
    );
  };

  // ─── Pending edits view ───────────────────────────────────────────────────

  const PendingEditsView = () => {
    const items = pendingEdits.filter(e => e.status === 'pending');
    return (
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionTitle}>Pending Edits</Text>
        <Text style={styles.sectionSub}>{items.length} edits waiting for review</Text>

        {items.length === 0 && <EmptyQueue label="All edits reviewed" />}

        {items.map(edit => (
          <View key={edit.id} style={styles.editCard}>
            <View style={styles.editCardTop}>
              <Text style={styles.editGymName}>{edit.gymName}</Text>
              <View style={styles.editFieldBadge}>
                <Text style={styles.editFieldBadgeText}>{edit.field}</Text>
              </View>
            </View>

            <View style={styles.diffBlock}>
              <View style={styles.diffRow}>
                <View style={styles.diffOldDot} />
                <Text style={styles.diffOldText} numberOfLines={2}>{edit.oldValue}</Text>
              </View>
              <View style={styles.diffArrow}>
                <Ionicons name="arrow-down" size={12} color={C.textDim} />
              </View>
              <View style={styles.diffRow}>
                <View style={styles.diffNewDot} />
                <Text style={styles.diffNewText} numberOfLines={2}>{edit.newValue}</Text>
              </View>
            </View>

            <View style={styles.submittedRow}>
              <Ionicons name="person-outline" size={11} color={C.textSub} />
              <Text style={styles.submittedText}>{edit.managerName} · {edit.submittedAt}</Text>
            </View>

            <ReviewButtons
              onApprove={() => reviewEdit(edit, 'approved')}
              onReject={() => reviewEdit(edit, 'rejected')}
            />
          </View>
        ))}
      </ScrollView>
    );
  };

  // ─── Flagged items view ───────────────────────────────────────────────────

  const FlaggedView = () => {
    const items = flaggedItems.filter(f => f.status === 'open');
    return (
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionTitle}>Flagged Items</Text>
        <Text style={styles.sectionSub}>{items.length} open reports</Text>

        {items.length === 0 && <EmptyQueue label="No open flags — all clear!" />}

        {items.map(item => {
          const meta = FLAG_META[item.type];
          return (
            <View key={item.id} style={styles.flagCard}>
              <View style={styles.flagCardTop}>
                <View style={[styles.flagTypeIcon, { backgroundColor: meta.color + '18' }]}>
                  <Ionicons name={meta.icon} size={16} color={meta.color} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.flagGymName}>{item.gymName}</Text>
                  <View style={[styles.flagTypeBadge, { backgroundColor: meta.color + '18' }]}>
                    <Text style={[styles.flagTypeBadgeText, { color: meta.color }]}>{meta.label}</Text>
                  </View>
                </View>
              </View>

              <Text style={styles.flagDesc}>{item.description}</Text>

              <View style={styles.submittedRow}>
                <Ionicons name="flag-outline" size={11} color={C.textSub} />
                <Text style={styles.submittedText}>Reported by {item.reportedBy} · {item.reportedAt}</Text>
              </View>

              {/* Context-aware actions */}
              <View style={styles.flagActions}>
                {item.type === 'duplicate' && (
                  <TouchableOpacity style={styles.flagActionBtn} onPress={() => resolveFlag(item, 'merge')} activeOpacity={0.8}>
                    <Ionicons name="git-merge-outline" size={13} color='#ffb547' />
                    <Text style={[styles.flagActionText, { color: '#ffb547' }]}>Merge</Text>
                  </TouchableOpacity>
                )}
                {item.type === 'closed' && (
                  <TouchableOpacity style={styles.flagActionBtn} onPress={() => resolveFlag(item, 'delete')} activeOpacity={0.8}>
                    <Ionicons name="trash-outline" size={13} color={C.danger} />
                    <Text style={[styles.flagActionText, { color: C.danger }]}>Delete Gym</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity style={[styles.flagActionBtn, styles.flagResolveBtn]} onPress={() => resolveFlag(item, 'resolved')} activeOpacity={0.8}>
                  <Ionicons name="checkmark" size={13} color={C.bg} />
                  <Text style={[styles.flagActionText, { color: C.bg }]}>Mark Resolved</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })}
      </ScrollView>
    );
  };

  // ─── Empty state ──────────────────────────────────────────────────────────

  const EmptyQueue = ({ label }: { label: string }) => (
    <View style={styles.emptyQueue}>
      <Ionicons name="checkmark-circle" size={44} color={C.accentDim} />
      <Text style={styles.emptyQueueText}>{label}</Text>
    </View>
  );

  // ─── View titles ──────────────────────────────────────────────────────────

  const VIEW_TITLES: Record<AdminView, string> = {
    'home':          'Admin Panel',
    'pending-gyms':  'Pending Gyms',
    'gym-detail':    selectedGym?.name ?? 'Gym Detail',
    'pending-edits': 'Pending Edits',
    'flagged':       'Flagged Items',
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />

      <Header
        title={VIEW_TITLES[currentView]}
        onBack={pop}
        right={
          currentView === 'home' ? (
            <View style={styles.adminBadge}>
              <Ionicons name="shield-checkmark" size={11} color={C.danger} />
              <Text style={styles.adminBadgeText}>Admin</Text>
            </View>
          ) : undefined
        }
      />

      {currentView === 'home'          && <HomeView />}
      {currentView === 'pending-gyms'  && <PendingGymsView />}
      {currentView === 'gym-detail'    && <GymDetailView />}
      {currentView === 'pending-edits' && <PendingEditsView />}
      {currentView === 'flagged'       && <FlaggedView />}
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: C.bg },
  scroll: { padding: 20, paddingBottom: 48 },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    backgroundColor: C.bg,
  },
  backBtn:     { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, ...T.section, color: C.text, textAlign: 'center' },
  adminBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: R.pill,
    backgroundColor: C.dangerBg,
    borderWidth: 1,
    borderColor: C.danger + '50',
  },
  adminBadgeText: { fontSize: 11, fontWeight: '700', color: C.danger },

  // Sections
  sectionTitle: { ...T.section, color: C.text, marginBottom: 4 },
  sectionSub:   { fontSize: 13, color: C.textSub, marginBottom: 16 },

  // Stats
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 24 },
  statCard: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: C.surface,
    borderRadius: R.card,
    padding: 14,
    borderWidth: 1,
    borderColor: C.border,
    gap: 6,
  },
  statValue: { fontSize: 22, fontWeight: '900', letterSpacing: -0.5 },
  statLabel: { fontSize: 10, fontWeight: '600', color: C.textSub, textAlign: 'center' },

  // Queue cards
  queueCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.surface,
    borderRadius: R.card,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: C.border,
    gap: 12,
  },
  queueIcon:  { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  queueTitle: { fontSize: 15, fontWeight: '700', color: C.text, marginBottom: 2 },
  queueSub:   { fontSize: 12, color: C.textSub },
  queueBadge: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  queueBadgeText: { fontSize: 11, fontWeight: '800', color: '#fff' },

  // Activity
  activityCard: {
    backgroundColor: C.surface,
    borderRadius: R.card,
    borderWidth: 1,
    borderColor: C.border,
    overflow: 'hidden',
  },
  activityRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14 },
  activityText:{ flex: 1, fontSize: 13, color: C.text },
  activityTime:{ fontSize: 11, color: C.textDim, fontWeight: '600' },
  divider:     { height: 1, backgroundColor: C.border, marginLeft: 44 },

  // Pending gym card
  pendingCard: {
    backgroundColor: C.surface,
    borderRadius: R.card,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: C.border,
  },
  pendingCardTop: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 },
  pendingName:    { fontSize: 15, fontWeight: '700', color: C.text, marginBottom: 4 },
  locRow:         { flexDirection: 'row', alignItems: 'center', gap: 3 },
  locText:        { fontSize: 12, color: C.textSub },
  pendingDesc:    { fontSize: 13, color: C.textSub, lineHeight: 18, marginBottom: 10 },
  submittedRow:   { flexDirection: 'row', alignItems: 'center', gap: 5 },
  submittedText:  { fontSize: 11, color: C.textDim, fontWeight: '600' },

  // Gym detail card
  detailCard: {
    backgroundColor: C.surface,
    borderRadius: R.card,
    borderWidth: 1,
    borderColor: C.border,
    overflow: 'hidden',
    marginBottom: 12,
  },
  detailRow:     { paddingHorizontal: 16, paddingVertical: 12 },
  detailLabel:   { fontSize: 10, fontWeight: '700', color: C.textSub, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 4 },
  detailValue:   { fontSize: 14, color: C.text },
  detailDivider: { height: 1, backgroundColor: C.border },
  detailNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: C.surface,
    borderRadius: R.inner,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: C.border,
  },
  detailNoteText: { fontSize: 12, color: C.textSub },

  // Review buttons
  reviewBtns:   { flexDirection: 'row', gap: 10, marginTop: 4 },
  rejectBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 13,
    borderRadius: R.btn,
    borderWidth: 1.5,
    borderColor: C.danger + '60',
  },
  rejectBtnText:  { fontSize: 14, fontWeight: '700', color: C.danger },
  approveBtn: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 13,
    borderRadius: R.btn,
    backgroundColor: C.accent,
  },
  approveBtnText: { fontSize: 14, fontWeight: '800', color: C.bg },

  // Edit card (pending edits)
  editCard: {
    backgroundColor: C.surface,
    borderRadius: R.card,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: C.border,
  },
  editCardTop:      { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 10 },
  editGymName:      { flex: 1, fontSize: 15, fontWeight: '700', color: C.text },
  editFieldBadge:   { paddingHorizontal: 10, paddingVertical: 4, borderRadius: R.pill, backgroundColor: '#5ba4ff18' },
  editFieldBadgeText:{ fontSize: 11, fontWeight: '700', color: '#5ba4ff' },

  diffBlock:   { backgroundColor: C.surfaceHigh, borderRadius: R.inner, padding: 12, marginBottom: 12, gap: 6 },
  diffRow:     { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  diffOldDot:  { width: 8, height: 8, borderRadius: 4, backgroundColor: C.danger, marginTop: 4 },
  diffNewDot:  { width: 8, height: 8, borderRadius: 4, backgroundColor: C.accent, marginTop: 4 },
  diffOldText: { flex: 1, fontSize: 13, color: C.textSub, lineHeight: 18, textDecorationLine: 'line-through' },
  diffNewText: { flex: 1, fontSize: 13, color: C.text, lineHeight: 18 },
  diffArrow:   { paddingLeft: 8 },

  // Flagged card
  flagCard: {
    backgroundColor: C.surface,
    borderRadius: R.card,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: C.border,
  },
  flagCardTop:      { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 10 },
  flagTypeIcon:     { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  flagGymName:      { fontSize: 15, fontWeight: '700', color: C.text, marginBottom: 5 },
  flagTypeBadge:    { alignSelf: 'flex-start', paddingHorizontal: 9, paddingVertical: 3, borderRadius: R.pill },
  flagTypeBadgeText:{ fontSize: 10, fontWeight: '700' },
  flagDesc:         { fontSize: 13, color: C.textSub, lineHeight: 18, marginBottom: 10 },
  flagActions:      { flexDirection: 'row', gap: 8, marginTop: 4, flexWrap: 'wrap' },
  flagActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: R.pill,
    borderWidth: 1.5,
    borderColor: C.border,
  },
  flagResolveBtn: { backgroundColor: C.accent, borderColor: C.accent },
  flagActionText: { fontSize: 12, fontWeight: '700' },

  // Empty queue
  emptyQueue:     { alignItems: 'center', gap: 10, paddingVertical: 48 },
  emptyQueueText: { fontSize: 14, fontWeight: '600', color: C.textSub },
});
