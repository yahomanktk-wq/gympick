/**
 * AnnouncementsSection
 * GymCommunityTab 내 공지사항 섹션.
 * gymAnnouncementStore에서 최신순으로 불러와 표시.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { C, R, T } from '../../../theme';
import { getAnnouncements, GymAnnouncement } from '../../../data/gymAnnouncementStore';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ─────────────────────────────────────────────────────────────────────────────
// Single announcement card
// ─────────────────────────────────────────────────────────────────────────────

function AnnouncementCard({ item }: { item: GymAnnouncement }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <TouchableOpacity
      style={s.card}
      onPress={() => setExpanded((v) => !v)}
      activeOpacity={0.85}
    >
      <View style={s.cardHeader}>
        <View style={s.iconWrap}>
          <Ionicons name="megaphone-outline" size={15} color={C.accent} />
        </View>
        <View style={s.cardMeta}>
          <Text style={s.cardTitle} numberOfLines={expanded ? undefined : 1}>
            {item.title}
          </Text>
          <Text style={s.cardDate}>{fmtDate(item.createdAt)}</Text>
        </View>
        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={15}
          color={C.textDim}
        />
      </View>

      {expanded && (
        <Text style={s.cardBody}>{item.content}</Text>
      )}
    </TouchableOpacity>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Section
// ─────────────────────────────────────────────────────────────────────────────

interface Props {
  gymId: string;
}

export default function AnnouncementsSection({ gymId }: Props) {
  const items = getAnnouncements(gymId);

  return (
    <View style={s.section}>
      {/* Section header */}
      <View style={s.sectionHeader}>
        <Ionicons name="notifications-outline" size={15} color={C.accent} />
        <Text style={s.sectionLabel}>ANNOUNCEMENTS</Text>
        {items.length > 0 && (
          <View style={s.countBadge}>
            <Text style={s.countText}>{items.length}</Text>
          </View>
        )}
      </View>

      {items.length === 0 ? (
        <View style={s.emptyBox}>
          <Text style={s.emptyText}>등록된 공지사항이 없어요</Text>
        </View>
      ) : (
        items.map((item) => (
          <AnnouncementCard key={item.id} item={item} />
        ))
      )}
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
    flex: 1,
  },
  countBadge: {
    backgroundColor: C.accent,
    borderRadius: R.pill,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  countText: {
    ...T.micro,
    color: C.bg,
    fontWeight: '700',
  },

  // Card
  card: {
    backgroundColor: C.surface,
    borderRadius: R.inner,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.border,
    padding: 14,
    marginBottom: 8,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  iconWrap: {
    width: 30,
    height: 30,
    borderRadius: R.inner,
    backgroundColor: C.accent + '18',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 1,
  },
  cardMeta: {
    flex: 1,
    gap: 3,
  },
  cardTitle: {
    ...T.body,
    color: C.text,
    fontWeight: '600',
  },
  cardDate: {
    ...T.micro,
    color: C.textDim,
  },
  cardBody: {
    ...T.label,
    color: C.textSub,
    marginTop: 10,
    lineHeight: 20,
  },

  // Empty
  emptyBox: {
    backgroundColor: C.surface,
    borderRadius: R.inner,
    paddingVertical: 20,
    alignItems: 'center',
  },
  emptyText: {
    ...T.label,
    color: C.textDim,
  },
});
