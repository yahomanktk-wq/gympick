import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { C, R, T } from '../../theme';
import { Machine, GYMS_WITH_MACHINES } from '../../data';
import { getMachineComments, MachineComment } from '../../data/gymDetails';
import PostWorkoutLogModal from './PostWorkoutLogModal';
import GymDetailModal from './GymDetailModal';

const SCREEN_W = Dimensions.get('window').width;

// ─── Mock distances ───────────────────────────────────────────────────────────

const MOCK_DIST: Record<string, { dist: string; distNum: number; open: boolean }> = {
  g01: { dist: '0.3 km', distNum: 0.3, open: true  },
  g02: { dist: '0.9 km', distNum: 0.9, open: true  },
  g03: { dist: '1.1 km', distNum: 1.1, open: true  },
  g04: { dist: '1.4 km', distNum: 1.4, open: false },
  g05: { dist: '2.0 km', distNum: 2.0, open: true  },
  g06: { dist: '2.3 km', distNum: 2.3, open: false },
  g07: { dist: '3.1 km', distNum: 3.1, open: true  },
  g08: { dist: '4.5 km', distNum: 4.5, open: true  },
};

function getDist(id: string) {
  return MOCK_DIST[id] ?? { dist: '? km', distNum: 99, open: true };
}

// ─── Muscle colour palette ────────────────────────────────────────────────────

const MUSCLE_COLORS: Record<string, { fg: string; bg: string }> = {
  Chest:       C.tagMachine,
  Back:        C.tagBrand,
  Legs:        C.tagMuscle,
  Shoulders:   { fg: '#ffd166', bg: '#ffd16618' },
  Arms:        C.tagCategory,
  Core:        { fg: '#06d6a0', bg: '#06d6a018' },
  'Full Body': { fg: '#a8dadc', bg: '#a8dadc18' },
  Glutes:      { fg: '#ff9ecd', bg: '#ff9ecd18' },
};

function mpStyle(muscle: string) {
  return MUSCLE_COLORS[muscle] ?? { fg: C.textSub, bg: C.border };
}

// ─── Category descriptions ────────────────────────────────────────────────────

const CATEGORY_DESC: Record<string, string> = {
  Strength:     'Plate-loaded or selectorized strength machine designed for guided, isolated muscle loading along a fixed movement path. Ideal for progressive overload and hypertrophy.',
  Cardio:       'Low-impact cardiovascular machine suited for building aerobic base, burning calories, and improving endurance with joint-friendly, rhythmic movement.',
  HIIT:         'High-intensity conditioning tool designed for full-body metabolic output, power development, and anaerobic capacity in short, explosive efforts.',
  Powerlifting: 'Heavy-duty free-weight equipment purpose-built for the core compound lifts — squat, bench, and deadlift — supporting maximum load and safe progression.',
  CrossFit:     'Versatile functional fitness equipment suited to high-rep, full-body conditioning protocols and skill-based athletic movements.',
  Pilates:      'Resistance-spring equipment that emphasises precise, controlled movement patterns for core stability, mobility, and postural alignment.',
};

// ─── Star rating ──────────────────────────────────────────────────────────────

function StarRow({ rating }: { rating: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 2 }}>
      {[1, 2, 3, 4, 5].map(i => (
        <Ionicons
          key={i}
          name={i <= rating ? 'star' : 'star-outline'}
          size={11}
          color={i <= rating ? '#ffd166' : C.textDim}
        />
      ))}
    </View>
  );
}

// ─── Comment card ─────────────────────────────────────────────────────────────

function CommentCard({ comment, last }: { comment: MachineComment; last: boolean }) {
  return (
    <View style={[s.commentRow, !last && s.commentBorder]}>
      <View style={s.commentAvatar}>
        <Text style={s.commentInitials}>{comment.initials}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <View style={s.commentMeta}>
          <Text style={s.commentUser}>{comment.user}</Text>
          <StarRow rating={comment.rating} />
          <Text style={s.commentDate}>{comment.date}</Text>
        </View>
        <Text style={s.commentText}>{comment.text}</Text>
      </View>
    </View>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  visible:  boolean;
  machine:  Machine | null;
  onClose:  () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function MachineDetailModal({ visible, machine, onClose }: Props) {
  const [logVisible,      setLogVisible]      = useState(false);
  const [gymDetailId,     setGymDetailId]     = useState<string | null>(null);
  const [gymDetailVisible, setGymDetailVisible] = useState(false);

  if (!machine) return null;

  const mp       = mpStyle(machine.targetMuscle);
  const desc     = CATEGORY_DESC[machine.category]
    ?? 'Versatile gym equipment for effective, targeted muscle training.';
  const comments = getMachineComments(machine.id);

  const availableGyms = GYMS_WITH_MACHINES
    .filter(gym => gym.machines.some(m => m.id === machine.id))
    .sort((a, b) => getDist(a.id).distNum - getDist(b.id).distNum);

  const openCount   = availableGyms.filter(g => getDist(g.id).open).length;
  const closestDist = availableGyms.length > 0 ? getDist(availableGyms[0].id).dist : '—';

  function openGymDetail(gymId: string) {
    setGymDetailId(gymId);
    setGymDetailVisible(true);
  }

  return (
    <>
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
            <Text style={s.navTitle} numberOfLines={1}>{machine.name}</Text>
            <View style={s.navBtn} />
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.content}>

            {/* ── Sports-card hero ── */}
            <View style={[s.heroCard, { backgroundColor: mp.bg }]}>
              {/* Large faded background icon */}
              <Ionicons
                name="barbell"
                size={180}
                color={mp.fg}
                style={s.heroBgIcon}
              />
              {/* Overlay content */}
              <View style={s.heroOverlay}>
                {/* Category pill top-left */}
                <View style={[s.heroCatPill, { backgroundColor: mp.fg + '22' }]}>
                  <Text style={[s.heroCatText, { color: mp.fg }]}>{machine.category}</Text>
                </View>
                {/* Muscle pill top-right */}
                <View style={[s.heroMusclePill, { backgroundColor: mp.fg + '22' }]}>
                  <Text style={[s.heroMuscleText, { color: mp.fg }]}>{machine.targetMuscle}</Text>
                </View>
              </View>
              {/* Center icon badge */}
              <View style={[s.heroCenterBadge, { backgroundColor: mp.fg + '22', borderColor: mp.fg + '44' }]}>
                <Ionicons name="barbell" size={36} color={mp.fg} />
              </View>
              {/* Bottom name strip */}
              <View style={s.heroBottom}>
                <Text style={s.heroName}>{machine.name}</Text>
                <Text style={s.heroBrand}>{machine.brand}</Text>
              </View>
            </View>

            {/* ── Stats row ── */}
            <View style={s.statsCard}>
              <View style={s.statCell}>
                <Text style={s.statVal}>{availableGyms.length}</Text>
                <Text style={s.statLab}>Gyms</Text>
              </View>
              <View style={s.statDiv} />
              <View style={s.statCell}>
                <Text style={s.statVal}>{openCount}</Text>
                <Text style={s.statLab}>Open now</Text>
              </View>
              <View style={s.statDiv} />
              <View style={s.statCell}>
                <Text style={s.statVal}>{closestDist}</Text>
                <Text style={s.statLab}>Closest</Text>
              </View>
              <View style={s.statDiv} />
              <View style={s.statCell}>
                <Text style={s.statVal}>{machine.category}</Text>
                <Text style={s.statLab}>Type</Text>
              </View>
            </View>

            {/* ── About ── */}
            <Text style={s.sectionTitle}>About This Machine</Text>
            <View style={s.descCard}>
              <View style={s.descIconRow}>
                <Ionicons name="information-circle-outline" size={16} color={C.accent} />
                <Text style={s.descLabel}>{machine.category.toUpperCase()}</Text>
              </View>
              <Text style={s.descText}>{desc}</Text>
            </View>

            {/* ── Tips ── */}
            <Text style={s.sectionTitle}>Training Tips</Text>
            <View style={s.tipsCard}>
              {getTips(machine.category).map((tip, i) => (
                <View key={i} style={s.tipRow}>
                  <View style={s.tipDot} />
                  <Text style={s.tipText}>{tip}</Text>
                </View>
              ))}
            </View>

            {/* ── User comments ── */}
            <Text style={s.sectionTitle}>User Reviews</Text>
            <View style={s.commentsCard}>
              {comments.map((c, i) => (
                <CommentCard key={c.id} comment={c} last={i === comments.length - 1} />
              ))}
            </View>

            {/* ── Available at ── */}
            <Text style={s.sectionTitle}>Available At</Text>
            <View style={s.gymList}>
              {availableGyms.map((gym, i) => {
                const meta = getDist(gym.id);
                return (
                  <React.Fragment key={gym.id}>
                    {i > 0 && <View style={s.divider} />}
                    <TouchableOpacity
                      style={s.gymRow}
                      activeOpacity={0.75}
                      onPress={() => openGymDetail(gym.id)}
                    >
                      <View style={[s.gymDot, { backgroundColor: meta.open ? C.accent : C.textDim }]} />
                      <View style={{ flex: 1 }}>
                        <Text style={s.gymRowName}>{gym.name}</Text>
                        <View style={s.gymRowMeta}>
                          <Ionicons name="location-outline" size={11} color={C.textSub} />
                          <Text style={s.gymRowLoc}>{gym.location}</Text>
                        </View>
                      </View>
                      <View style={{ alignItems: 'flex-end', gap: 5 }}>
                        <View style={[s.openBadge, { backgroundColor: meta.open ? C.accentBg : C.border }]}>
                          <Text style={[s.openBadgeText, { color: meta.open ? C.accent : C.textSub }]}>
                            {meta.open ? 'Open' : 'Closed'}
                          </Text>
                        </View>
                        <View style={s.distBadge}>
                          <Ionicons name="navigate-outline" size={10} color={C.accent} />
                          <Text style={s.distText}>{meta.dist}</Text>
                        </View>
                      </View>
                      <Ionicons name="chevron-forward" size={14} color={C.textDim} style={{ marginLeft: 4 }} />
                    </TouchableOpacity>
                  </React.Fragment>
                );
              })}
            </View>

            <View style={{ height: 100 }} />
          </ScrollView>

          {/* ── CTA bar ── */}
          <View style={s.ctaBar}>
            <TouchableOpacity
              style={s.ctaButton}
              activeOpacity={0.85}
              onPress={() => setLogVisible(true)}
            >
              <Ionicons name="create-outline" size={18} color={C.bg} />
              <Text style={s.ctaText}>Log This Machine</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>

      {/* Post-workout log */}
      <PostWorkoutLogModal
        visible={logVisible}
        onClose={saved => {
          setLogVisible(false);
          if (saved) onClose();
        }}
      />

      {/* Gym detail */}
      <GymDetailModal
        visible={gymDetailVisible}
        gymId={gymDetailId}
        onClose={() => setGymDetailVisible(false)}
      />
    </>
  );
}

// ─── Training tips per category ───────────────────────────────────────────────

function getTips(category: string): string[] {
  const tips: Record<string, string[]> = {
    Strength: [
      'Start with a lighter warm-up set before loading to working weight.',
      'Control the eccentric (lowering) phase for maximum muscle activation.',
      'Rest 60–90 seconds between sets for hypertrophy, 2–3 min for strength.',
    ],
    Cardio: [
      'Maintain an even pace for steady-state cardio, or vary intensity for intervals.',
      'Keep your posture upright and core engaged throughout the session.',
      'Stay hydrated and track heart rate to stay within your target zone.',
    ],
    HIIT: [
      'Keep effort maximum during work intervals — hold nothing back.',
      'Full recovery during rest periods improves quality of the next interval.',
      'Limit HIIT sessions to 2–3 per week to allow adequate recovery.',
    ],
    Powerlifting: [
      'Warm up progressively to your working weight across multiple sets.',
      'Brace your core before every rep — treat every lift as a max effort.',
      'Film your sets from the side to check depth, bar path, and technique.',
    ],
    CrossFit: [
      'Scale the workout to your current fitness level without ego.',
      'Prioritise movement quality over speed, especially when fatigued.',
      'Log your scores to track improvement across repeated workouts.',
    ],
    Pilates: [
      'Breathe deliberately — exhale on exertion, inhale on release.',
      'Focus on precision and control rather than range of motion.',
      'Engage the deep core muscles before initiating any movement.',
    ],
  };
  return tips[category] ?? [
    'Warm up properly before your working sets.',
    'Log your performance after each session to track progress.',
  ];
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: C.bg },
  content: { paddingHorizontal: 16, paddingTop: 0, paddingBottom: 24 },

  // Nav
  navHeader: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 8, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  navBtn:   { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  navTitle: { flex: 1, textAlign: 'center', ...T.section, color: C.text },

  // Sports-card hero
  heroCard: {
    width: SCREEN_W,
    height: 280,
    marginLeft: -16,
    marginBottom: 0,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroBgIcon: {
    position: 'absolute',
    opacity: 0.08,
    transform: [{ rotate: '-15deg' }],
  },
  heroOverlay: {
    position: 'absolute',
    top: 16, left: 16, right: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  heroCatPill:   { paddingHorizontal: 10, paddingVertical: 5, borderRadius: R.pill },
  heroCatText:   { fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  heroMusclePill:{ paddingHorizontal: 10, paddingVertical: 5, borderRadius: R.pill },
  heroMuscleText:{ fontSize: 11, fontWeight: '800' },
  heroCenterBadge: {
    width: 72, height: 72, borderRadius: 20,
    borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center',
  },
  heroBottom: {
    position: 'absolute',
    bottom: 18, left: 16, right: 16,
  },
  heroName:  { fontSize: 22, fontWeight: '900', color: C.text, letterSpacing: -0.4 },
  heroBrand: { fontSize: 13, color: C.textSub, marginTop: 3 },

  // Stats card
  statsCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: C.surface,
    borderWidth: 1, borderColor: C.border,
    borderBottomLeftRadius: R.card, borderBottomRightRadius: R.card,
    paddingVertical: 14,
    marginBottom: 20,
  },
  statCell: { flex: 1, alignItems: 'center' },
  statVal:  { fontSize: 12, fontWeight: '800', color: C.text, marginBottom: 2, textAlign: 'center' },
  statLab:  { fontSize: 9, color: C.textSub, fontWeight: '600' },
  statDiv:  { width: 1, height: 28, backgroundColor: C.border },

  // About / desc
  sectionTitle: { ...T.section, color: C.text, marginBottom: 10, marginTop: 4 },
  descCard: {
    backgroundColor: C.surface, borderRadius: R.card,
    borderWidth: 1, borderColor: C.border,
    padding: 16, marginBottom: 20,
  },
  descIconRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  descLabel:   { fontSize: 11, fontWeight: '700', color: C.accent, letterSpacing: 0.5 },
  descText:    { fontSize: 14, color: C.textSub, lineHeight: 21 },

  // Tips
  tipsCard: {
    backgroundColor: C.surface, borderRadius: R.card,
    borderWidth: 1, borderColor: C.border,
    padding: 16, marginBottom: 20, gap: 12,
  },
  tipRow:  { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  tipDot:  { width: 5, height: 5, borderRadius: 3, backgroundColor: C.accent, marginTop: 6 },
  tipText: { flex: 1, fontSize: 13, color: C.textSub, lineHeight: 20 },

  // Comments
  commentsCard: {
    backgroundColor: C.surface, borderRadius: R.card,
    borderWidth: 1, borderColor: C.border,
    overflow: 'hidden', marginBottom: 20,
  },
  commentRow:    { flexDirection: 'row', gap: 12, padding: 14 },
  commentBorder: { borderBottomWidth: 1, borderBottomColor: C.border },
  commentAvatar: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: C.accentBg,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  commentInitials: { fontSize: 11, fontWeight: '800', color: C.accent },
  commentMeta:     { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  commentUser:     { fontSize: 13, fontWeight: '700', color: C.text },
  commentDate:     { fontSize: 10, color: C.textDim, marginLeft: 'auto' },
  commentText:     { fontSize: 13, color: C.textSub, lineHeight: 19 },

  // Gym list
  gymList: {
    backgroundColor: C.surface, borderRadius: R.card,
    borderWidth: 1, borderColor: C.border,
    overflow: 'hidden', marginBottom: 20,
  },
  divider:    { height: 1, backgroundColor: C.border },
  gymRow:     { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 13, gap: 12 },
  gymDot:     { width: 8, height: 8, borderRadius: 4 },
  gymRowName: { fontSize: 14, fontWeight: '700', color: C.text },
  gymRowMeta: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 3 },
  gymRowLoc:  { fontSize: 12, color: C.textSub },

  openBadge:     { paddingHorizontal: 7, paddingVertical: 3, borderRadius: R.pill },
  openBadgeText: { fontSize: 10, fontWeight: '700' },
  distBadge:     { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: C.accentBg, paddingHorizontal: 7, paddingVertical: 3, borderRadius: R.pill },
  distText:      { fontSize: 10, fontWeight: '700', color: C.accent },

  // CTA
  ctaBar:    { padding: 16, borderTopWidth: 1, borderTopColor: C.border, backgroundColor: C.bg },
  ctaButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: C.accent, borderRadius: R.btn, paddingVertical: 16 },
  ctaText:   { fontSize: 15, fontWeight: '800', color: C.bg },
});
