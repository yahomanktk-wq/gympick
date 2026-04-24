import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  Switch,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { C, R, T } from '../theme';
import { UserRole } from '../data/types';
import { useAuth } from '../context/AuthContext';
import { MANAGED_GYMS, PENDING_GYMS, PENDING_EDITS, FLAGGED_ITEMS } from '../data/mockAdmin';
import ManagerDashboard from './manager/ManagerDashboard';
import AdminDashboard from './admin/AdminDashboard';

// ─── Types ────────────────────────────────────────────────────────────────────

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

// ─── Static mock data ─────────────────────────────────────────────────────────

const PERSONAL_STATS = [
  { label: 'Workouts', value: '48' },
  { label: 'PRs Set',  value: '12' },
  { label: 'Streak',   value: '12d' },
  { label: 'Volume',   value: '12t' },
];

const ACHIEVEMENTS = [
  { id: '1', icon: 'flame',   label: '10-Day Streak', earned: true  },
  { id: '2', icon: 'barbell', label: 'First PR',      earned: true  },
  { id: '3', icon: 'trophy',  label: '50 Workouts',   earned: false },
  { id: '4', icon: 'flash',   label: 'Speed Lifter',  earned: false },
  { id: '5', icon: 'fitness', label: 'Iron Will',     earned: true  },
  { id: '6', icon: 'medal',   label: 'Century Club',  earned: false },
];

const RECENT_PRS = [
  { id: '1', exercise: 'Back Squat',  value: '110 kg × 3', date: 'Mar 4'   },
  { id: '2', exercise: 'Deadlift',    value: '130 kg × 1', date: 'Feb 28'  },
  { id: '3', exercise: 'Bench Press', value: '90 kg × 5',  date: 'Feb 20'  },
];

const SETTINGS_LIST: { icon: IoniconName; label: string; toggle?: boolean; danger?: boolean }[] = [
  { icon: 'notifications-outline', label: 'Notifications',     toggle: true  },
  { icon: 'barbell-outline',       label: 'Units (kg / lbs)'               },
  { icon: 'heart-outline',         label: 'Connected Health'               },
  { icon: 'shield-outline',        label: 'Privacy'                        },
  { icon: 'help-circle-outline',   label: 'Help & Feedback'               },
  { icon: 'log-out-outline',       label: 'Sign Out',          danger: true },
];

// ─── Role palette ─────────────────────────────────────────────────────────────

const ROLE_META: Record<UserRole, { label: string; color: string; bg: string; icon: IoniconName }> = {
  user:    { label: 'Member',  color: C.textSub, bg: C.surfaceHigh, icon: 'person-outline'           },
  manager: { label: 'Manager', color: C.accent,  bg: C.accentBg,   icon: 'business-outline'          },
  admin:   { label: 'Admin',   color: C.danger,  bg: C.dangerBg,   icon: 'shield-checkmark-outline'  },
};

// ─── Small re-usable pieces ───────────────────────────────────────────────────

function SectionLabel({ text }: { text: string }) {
  return <Text style={styles.sectionLabel}>{text}</Text>;
}

function Divider() {
  return <View style={styles.divider} />;
}

function CardDivider() {
  return <View style={styles.cardDivider} />;
}

function SettingRow({
  icon, label, toggle, danger,
}: { icon: IoniconName; label: string; toggle?: boolean; danger?: boolean }) {
  const [on, setOn] = useState(false);
  return (
    <TouchableOpacity style={styles.settingRow} activeOpacity={0.7}>
      <View style={[styles.settingIcon, danger && { backgroundColor: C.dangerBg }]}>
        <Ionicons name={icon} size={16} color={danger ? C.danger : C.textSub} />
      </View>
      <Text style={[styles.settingLabel, danger && { color: C.danger }]}>{label}</Text>
      {toggle
        ? <Switch
            value={on}
            onValueChange={setOn}
            thumbColor={on ? C.accent : C.textDim}
            trackColor={{ false: C.border, true: C.accentBg }}
          />
        : <Ionicons name="chevron-forward" size={15} color={C.textDim} />
      }
    </TouchableOpacity>
  );
}

function AchievementBadge({ icon, label, earned }: { icon: string; label: string; earned: boolean }) {
  return (
    <View style={[styles.badge, !earned && { opacity: 0.4 }]}>
      <View style={[styles.badgeIcon, earned && { backgroundColor: C.accent }]}>
        <Ionicons name={icon as IoniconName} size={18} color={earned ? C.bg : C.textDim} />
      </View>
      {!earned && (
        <View style={styles.badgeLock}>
          <Ionicons name="lock-closed" size={9} color={C.textDim} />
        </View>
      )}
      <Text style={[styles.badgeLabel, !earned && { color: C.textDim }]} numberOfLines={2}>
        {label}
      </Text>
    </View>
  );
}

// ─── Manager section ──────────────────────────────────────────────────────────

function ManagerSection({ onOpen }: { onOpen: () => void }) {
  const approvedGyms = MANAGED_GYMS.filter(g => g.status === 'approved');
  const pendingGyms  = MANAGED_GYMS.filter(g => g.status === 'pending');

  return (
    <View style={styles.roleSection}>
      {/* Section header */}
      <View style={styles.roleSectionHeader}>
        <View style={styles.roleSectionHeaderLeft}>
          <View style={[styles.roleSectionIcon, { backgroundColor: C.accentBg }]}>
            <Ionicons name="business" size={18} color={C.accent} />
          </View>
          <View>
            <Text style={styles.roleSectionTitle}>Manage Your Gyms</Text>
            <Text style={styles.roleSectionSub}>
              {MANAGED_GYMS.length} gym{MANAGED_GYMS.length !== 1 ? 's' : ''} registered
            </Text>
          </View>
        </View>
        <TouchableOpacity style={styles.openPanelBtn} onPress={onOpen} activeOpacity={0.85}>
          <Text style={styles.openPanelBtnText}>Open</Text>
          <Ionicons name="chevron-forward" size={13} color={C.bg} />
        </TouchableOpacity>
      </View>

      {/* Gym quick-status rows */}
      {MANAGED_GYMS.map((gym, i) => (
        <React.Fragment key={gym.id}>
          {i > 0 && <CardDivider />}
          <TouchableOpacity style={styles.gymSummaryRow} onPress={onOpen} activeOpacity={0.75}>
            <View style={[
              styles.gymSummaryDot,
              { backgroundColor: gym.status === 'approved' ? C.accent : gym.status === 'pending' ? '#ffb547' : C.danger },
            ]} />
            <View style={{ flex: 1 }}>
              <Text style={styles.gymSummaryName}>{gym.name}</Text>
              <Text style={styles.gymSummaryLoc}>{gym.location}</Text>
            </View>
            <View style={styles.gymSummaryMeta}>
              <Text style={styles.gymSummaryMetaText}>{gym.machineIds.length} machines</Text>
            </View>
          </TouchableOpacity>
        </React.Fragment>
      ))}

      {/* Status summary chips */}
      <View style={styles.roleSummaryChips}>
        <View style={styles.summaryChip}>
          <View style={[styles.summaryChipDot, { backgroundColor: C.accent }]} />
          <Text style={styles.summaryChipText}>{approvedGyms.length} live</Text>
        </View>
        {pendingGyms.length > 0 && (
          <View style={styles.summaryChip}>
            <View style={[styles.summaryChipDot, { backgroundColor: '#ffb547' }]} />
            <Text style={styles.summaryChipText}>{pendingGyms.length} pending</Text>
          </View>
        )}
        <TouchableOpacity style={styles.registerGymChip} onPress={onOpen} activeOpacity={0.8}>
          <Ionicons name="add" size={12} color={C.accent} />
          <Text style={styles.registerGymChipText}>Register gym</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Admin section ────────────────────────────────────────────────────────────

function AdminSection({ onOpen }: { onOpen: () => void }) {
  const pendingGyms  = PENDING_GYMS.filter(g => g.status === 'pending').length;
  const pendingEdits = PENDING_EDITS.filter(e => e.status === 'pending').length;
  const openFlags    = FLAGGED_ITEMS.filter(f => f.status === 'open').length;

  const queues = [
    { label: 'Gyms',   count: pendingGyms,  color: '#ffb547' },
    { label: 'Edits',  count: pendingEdits, color: '#5ba4ff' },
    { label: 'Flagged',count: openFlags,    color: C.danger  },
  ];

  return (
    <View style={[styles.roleSection, { borderColor: C.danger + '40' }]}>
      {/* Header */}
      <View style={styles.roleSectionHeader}>
        <View style={styles.roleSectionHeaderLeft}>
          <View style={[styles.roleSectionIcon, { backgroundColor: C.dangerBg }]}>
            <Ionicons name="shield-checkmark" size={18} color={C.danger} />
          </View>
          <View>
            <Text style={styles.roleSectionTitle}>Admin Panel</Text>
            <Text style={styles.roleSectionSub}>Review queues · Manage data</Text>
          </View>
        </View>
        <TouchableOpacity style={[styles.openPanelBtn, { backgroundColor: C.danger }]} onPress={onOpen} activeOpacity={0.85}>
          <Text style={styles.openPanelBtnText}>Open</Text>
          <Ionicons name="chevron-forward" size={13} color={C.bg} />
        </TouchableOpacity>
      </View>

      <CardDivider />

      {/* Queue counts */}
      <View style={styles.adminQueues}>
        {queues.map(q => (
          <TouchableOpacity key={q.label} style={styles.adminQueueCell} onPress={onOpen} activeOpacity={0.75}>
            <Text style={[styles.adminQueueCount, { color: q.color }]}>{q.count}</Text>
            <Text style={styles.adminQueueLabel}>{q.label}</Text>
            {q.count > 0 && <View style={[styles.adminQueueDot, { backgroundColor: q.color }]} />}
          </TouchableOpacity>
        ))}
      </View>

      {/* Alert if anything pending */}
      {(pendingGyms + pendingEdits + openFlags) > 0 && (
        <>
          <CardDivider />
          <TouchableOpacity style={styles.adminAlertRow} onPress={onOpen} activeOpacity={0.75}>
            <Ionicons name="alert-circle" size={14} color='#ffb547' />
            <Text style={styles.adminAlertText}>
              {pendingGyms + pendingEdits + openFlags} items need your attention
            </Text>
            <Ionicons name="chevron-forward" size={13} color={C.textDim} />
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}

// ─── Dev role switcher ────────────────────────────────────────────────────────

function DevRoleSwitcher({ currentRole, onSwitch }: { currentRole: UserRole; onSwitch: (r: UserRole) => void }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <View style={styles.devWrap}>
      <TouchableOpacity style={styles.devToggle} onPress={() => setExpanded(e => !e)} activeOpacity={0.75}>
        <View style={styles.devBadge}>
          <Ionicons name="flask" size={11} color={C.textDim} />
          <Text style={styles.devBadgeText}>DEV</Text>
        </View>
        <Text style={styles.devToggleText}>Role Switcher</Text>
        <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={14} color={C.textDim} />
      </TouchableOpacity>

      {expanded && (
        <View style={styles.devBtnRow}>
          {(['user', 'manager', 'admin'] as UserRole[]).map(role => {
            const m      = ROLE_META[role];
            const active = currentRole === role;
            return (
              <TouchableOpacity
                key={role}
                style={[styles.devRoleBtn, { borderColor: m.color + '60' }, active && { backgroundColor: m.color }]}
                onPress={() => onSwitch(role)}
                activeOpacity={0.8}
              >
                <Ionicons name={m.icon} size={13} color={active ? C.bg : m.color} />
                <Text style={[styles.devRoleBtnText, { color: active ? C.bg : m.color }]}>{m.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function ProfileScreen() {
  const { user, switchRole } = useAuth();
  const [showManager, setShowManager] = useState(false);
  const [showAdmin,   setShowAdmin]   = useState(false);

  const roleMeta = ROLE_META[user.role];

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        {/* ── Hero ── */}
        <View style={styles.hero}>
          <View style={styles.avatarWrap}>
            <Text style={styles.avatarInitial}>{user.name.charAt(0)}</Text>
            <View style={[styles.rolePip, { backgroundColor: roleMeta.bg, borderColor: roleMeta.color + '80' }]}>
              <Ionicons name={roleMeta.icon} size={9} color={roleMeta.color} />
              <Text style={[styles.rolePipText, { color: roleMeta.color }]}>{roleMeta.label}</Text>
            </View>
          </View>
          <Text style={styles.userName}>{user.name}</Text>
          <Text style={styles.userEmail}>{user.email}</Text>
        </View>

        {/* ── Role-specific panel (manager / admin) ── */}
        {user.role === 'manager' && (
          <>
            <SectionLabel text="GYM MANAGEMENT" />
            <ManagerSection onOpen={() => setShowManager(true)} />
            <View style={{ height: 28 }} />
          </>
        )}

        {user.role === 'admin' && (
          <>
            <SectionLabel text="ADMINISTRATION" />
            <AdminSection onOpen={() => setShowAdmin(true)} />
            <View style={{ height: 28 }} />
          </>
        )}

        {/* ── Personal stats ── */}
        <SectionLabel text="YOUR STATS" />
        <View style={styles.statsGrid}>
          {PERSONAL_STATS.map((s, i) => (
            <React.Fragment key={s.label}>
              <View style={styles.statCell}>
                <Text style={styles.statValue}>{s.value}</Text>
                <Text style={styles.statLabel}>{s.label}</Text>
              </View>
              {i < PERSONAL_STATS.length - 1 && <View style={styles.statDivider} />}
            </React.Fragment>
          ))}
        </View>

        {/* ── Achievements ── */}
        <View style={styles.sectionRow}>
          <SectionLabel text="ACHIEVEMENTS" />
          <Text style={styles.sectionSub}>
            {ACHIEVEMENTS.filter(a => a.earned).length}/{ACHIEVEMENTS.length} earned
          </Text>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.badgeRow}
        >
          {ACHIEVEMENTS.map(a => <AchievementBadge key={a.id} {...a} />)}
        </ScrollView>

        {/* ── Personal records ── */}
        <View style={styles.sectionRow}>
          <SectionLabel text="PERSONAL RECORDS" />
          <TouchableOpacity>
            <Text style={styles.seeAll}>See all</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.card}>
          {RECENT_PRS.map((pr, i) => (
            <React.Fragment key={pr.id}>
              <View style={styles.prRow}>
                <View style={styles.prIcon}>
                  <Ionicons name="trophy-outline" size={14} color={C.accent} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.prExercise}>{pr.exercise}</Text>
                  <Text style={styles.prValue}>{pr.value}</Text>
                </View>
                <Text style={styles.prDate}>{pr.date}</Text>
              </View>
              {i < RECENT_PRS.length - 1 && <Divider />}
            </React.Fragment>
          ))}
        </View>

        {/* ── Settings ── */}
        <SectionLabel text="SETTINGS" />
        <View style={styles.card}>
          {SETTINGS_LIST.map((s, i) => (
            <React.Fragment key={s.label}>
              <SettingRow {...s} />
              {i < SETTINGS_LIST.length - 1 && <Divider />}
            </React.Fragment>
          ))}
        </View>

        {/* ── Dev tool ── */}
        <DevRoleSwitcher currentRole={user.role} onSwitch={switchRole} />

        <Text style={styles.version}>GymPick v1.0.0</Text>
      </ScrollView>

      {/* ── Modals ── */}
      <Modal visible={showManager} animationType="slide" onRequestClose={() => setShowManager(false)}>
        <ManagerDashboard onClose={() => setShowManager(false)} />
      </Modal>
      <Modal visible={showAdmin} animationType="slide" onRequestClose={() => setShowAdmin(false)}>
        <AdminDashboard onClose={() => setShowAdmin(false)} />
      </Modal>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: C.bg },
  scroll: { paddingBottom: 48 },

  // ── Hero ──
  hero: {
    alignItems: 'center',
    paddingTop: 28,
    paddingBottom: 24,
    paddingHorizontal: 20,
  },
  avatarWrap: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: C.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  avatarInitial: { fontSize: 34, fontWeight: '900', color: C.bg },
  rolePip: {
    position: 'absolute',
    bottom: -2,
    right: -6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: R.pill,
    borderWidth: 2,
    borderColor: C.border,
  },
  rolePipText: { fontSize: 9, fontWeight: '800', letterSpacing: 0.3 },
  userName:    { ...T.title, color: C.text, marginBottom: 4 },
  userEmail:   { fontSize: 13, color: C.textSub },

  // ── Section labels ──
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: C.textDim,
    letterSpacing: 1.2,
    marginHorizontal: 20,
    marginBottom: 10,
    marginTop: 4,
  },
  sectionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: 20,
    marginBottom: 10,
  },
  sectionSub: { fontSize: 12, color: C.textSub },
  seeAll:     { fontSize: 12, fontWeight: '600', color: C.accent },

  // ── Role section card ──
  roleSection: {
    marginHorizontal: 20,
    backgroundColor: C.surface,
    borderRadius: R.card,
    borderWidth: 1,
    borderColor: C.accent + '35',
    overflow: 'hidden',
  },
  roleSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
  },
  roleSectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  roleSectionIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleSectionTitle: { fontSize: 15, fontWeight: '700', color: C.text },
  roleSectionSub:   { fontSize: 12, color: C.textSub, marginTop: 2 },
  openPanelBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: C.accent,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: R.pill,
  },
  openPanelBtnText: { fontSize: 12, fontWeight: '800', color: C.bg },

  // Gym summary rows inside manager section
  gymSummaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 11,
    gap: 12,
  },
  gymSummaryDot:     { width: 8, height: 8, borderRadius: 4 },
  gymSummaryName:    { fontSize: 13, fontWeight: '600', color: C.text },
  gymSummaryLoc:     { fontSize: 11, color: C.textSub, marginTop: 1 },
  gymSummaryMeta:    { alignItems: 'flex-end' },
  gymSummaryMetaText:{ fontSize: 11, color: C.textDim, fontWeight: '600' },

  // Status summary chips
  roleSummaryChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 14,
    paddingBottom: 14,
  },
  summaryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: C.surfaceHigh,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: R.pill,
  },
  summaryChipDot:  { width: 6, height: 6, borderRadius: 3 },
  summaryChipText: { fontSize: 11, fontWeight: '600', color: C.textSub },
  registerGymChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: C.accentBg,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: R.pill,
    borderWidth: 1,
    borderColor: C.accent + '50',
  },
  registerGymChipText: { fontSize: 11, fontWeight: '700', color: C.accent },

  // Admin queue cells
  adminQueues: {
    flexDirection: 'row',
    paddingHorizontal: 8,
    paddingVertical: 12,
  },
  adminQueueCell: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
  },
  adminQueueCount: { fontSize: 28, fontWeight: '900', letterSpacing: -1 },
  adminQueueLabel: { fontSize: 10, fontWeight: '600', color: C.textSub, letterSpacing: 0.3 },
  adminQueueDot:   { width: 6, height: 6, borderRadius: 3, marginTop: 2 },
  adminAlertRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  adminAlertText: { flex: 1, fontSize: 13, color: C.textSub },

  // ── Stats grid ──
  statsGrid: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginBottom: 28,
    backgroundColor: C.surface,
    borderRadius: R.card,
    borderWidth: 1,
    borderColor: C.border,
    overflow: 'hidden',
  },
  statCell:    { flex: 1, alignItems: 'center', paddingVertical: 18 },
  statValue:   { fontSize: 22, fontWeight: '800', color: C.text, letterSpacing: -0.5 },
  statLabel:   { fontSize: 10, color: C.textSub, marginTop: 3, fontWeight: '600' },
  statDivider: { width: 1, backgroundColor: C.border, marginVertical: 12 },

  // ── Achievements ──
  badgeRow: { paddingHorizontal: 20, gap: 10, paddingBottom: 4, marginBottom: 28 },
  badge: {
    width: 84,
    alignItems: 'center',
    backgroundColor: C.surface,
    borderRadius: R.card,
    padding: 12,
    borderWidth: 1,
    borderColor: C.border,
    gap: 6,
  },
  badgeIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: C.surfaceHigh,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeLock:  { position: 'absolute', top: 8, right: 8 },
  badgeLabel: { fontSize: 10, fontWeight: '700', color: C.text, textAlign: 'center', lineHeight: 14 },

  // ── Card ──
  card: {
    backgroundColor: C.surface,
    borderRadius: R.card,
    marginHorizontal: 20,
    marginBottom: 28,
    borderWidth: 1,
    borderColor: C.border,
    overflow: 'hidden',
  },
  divider:     { height: 1, backgroundColor: C.border, marginLeft: 54 },
  cardDivider: { height: 1, backgroundColor: C.border },

  // ── Personal Records ──
  prRow:      { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  prIcon:     { width: 34, height: 34, borderRadius: 10, backgroundColor: C.accentBg, alignItems: 'center', justifyContent: 'center' },
  prExercise: { fontSize: 14, fontWeight: '700', color: C.text },
  prValue:    { fontSize: 12, color: C.accent, fontWeight: '600', marginTop: 2 },
  prDate:     { fontSize: 11, color: C.textDim, fontWeight: '600' },

  // ── Settings ──
  settingRow:  { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  settingIcon: { width: 34, height: 34, borderRadius: 9, backgroundColor: C.surfaceHigh, alignItems: 'center', justifyContent: 'center' },
  settingLabel:{ flex: 1, fontSize: 15, color: C.text, fontWeight: '500' },

  // ── Dev role switcher ──
  devWrap: {
    marginHorizontal: 20,
    marginTop: 12,
    marginBottom: 8,
    backgroundColor: C.surface,
    borderRadius: R.card,
    borderWidth: 1,
    borderColor: C.border,
    overflow: 'hidden',
  },
  devToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 10,
  },
  devBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: C.surfaceHigh,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 5,
  },
  devBadgeText:   { fontSize: 9, fontWeight: '800', color: C.textDim, letterSpacing: 0.8 },
  devToggleText:  { flex: 1, fontSize: 13, fontWeight: '600', color: C.textDim },
  devBtnRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 14,
    paddingBottom: 14,
  },
  devRoleBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 9,
    borderRadius: R.inner,
    borderWidth: 1.5,
    borderColor: C.border,
  },
  devRoleBtnText: { fontSize: 12, fontWeight: '700' },

  version: { textAlign: 'center', fontSize: 11, color: C.textDim, marginTop: 16, marginBottom: 4, fontWeight: '500' },
});
