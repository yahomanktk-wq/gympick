import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { C, R } from '../theme';
import { WorkoutFeedPost } from '../data/types';

const SCREEN_W = Dimensions.get('window').width;
const CARD_W   = SCREEN_W - 32;

const EMOJI_MAP: Record<keyof WorkoutFeedPost['reactions'], string> = {
  muscle: '💪',
  fire:   '🔥',
  clap:   '👏',
  trophy: '🏆',
  flex:   '😤',
};

const REACTION_KEYS: (keyof WorkoutFeedPost['reactions'])[] = [
  'muscle', 'fire', 'clap', 'trophy', 'flex',
];

// ── Sub-components (module-level — IME 버그 방지) ─────────────────────────────

function MuscleBadge({ label }: { label: string }) {
  return (
    <View style={s.muscleBadge}>
      <Text style={s.muscleBadgeText}>{label}</Text>
    </View>
  );
}

function TimeLabel({ createdAt }: { createdAt: string }) {
  const diffMs  = Date.now() - new Date(createdAt).getTime();
  const diffH   = Math.floor(diffMs / (1000 * 60 * 60));
  const diffMin = Math.floor(diffMs / (1000 * 60));
  let label: string;
  if (diffMin < 1)      label = '방금 전';
  else if (diffH < 1)   label = `${diffMin}분 후 사라져요`;
  else if (diffH < 24)  label = `${24 - diffH}시간 후 사라져요`;
  else                  label = '곧 사라져요';
  return <Text style={s.timeLabel}>{label}</Text>;
}

function ReactionButton({
  emoji,
  count,
  active,
  onPress,
}: {
  emoji: string;
  count: number;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={[s.reactionBtn, active && s.reactionBtnActive]} onPress={onPress} activeOpacity={0.7}>
      <Text style={s.reactionEmoji}>{emoji}</Text>
      <Text style={[s.reactionCount, active && s.reactionCountActive]}>{count}</Text>
    </TouchableOpacity>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

type Props = {
  post:     WorkoutFeedPost;
  onReact:  (postId: string, key: keyof WorkoutFeedPost['reactions']) => void;
};

export default function WorkoutFeedCard({ post, onReact }: Props) {
  const [imgRatio, setImgRatio] = useState(3 / 4); // default 4:3 → height/width = 3/4 → wait, 4:3 means w:h=4:3 so h/w = 3/4
  const displayUri = post.compositeUri ?? post.photoUri;

  return (
    <View style={s.card}>

      {/* ── Photo area ── */}
      <View style={[s.photoWrap, { height: Math.round(CARD_W * imgRatio) }]}>
        <Image
          source={{ uri: displayUri }}
          style={s.photo}
          contentFit="cover"
          onLoad={(e) => {
            const { width, height } = e.source;
            if (width && height) setImgRatio(height / width);
          }}
        />

        {/* 좌상단: 내 오운완 배지 또는 근육 배지 */}
        <View style={s.badgeRow}>
          {post.isMyPost && (
            <View style={s.myPostBadge}>
              <Text style={s.myPostBadgeText}>내 오운완</Text>
            </View>
          )}
          {post.muscles.map(m => (
            <MuscleBadge key={m} label={m} />
          ))}
        </View>

        {/* 우상단: 남은 시간 */}
        <View style={s.timeLabelWrap}>
          <TimeLabel createdAt={post.createdAt} />
        </View>

        {/* 하단 오버레이: 닉네임 + 헬스장명 */}
        <View style={s.bottomOverlay}>
          <Text style={s.nickname}>{post.nickname}</Text>
          <Text style={s.gymName} numberOfLines={1}>{post.gymName}</Text>
        </View>
      </View>

      {/* ── Reaction bar ── */}
      <View style={[s.reactionBar, post.isMyPost && { opacity: 0.4 }]}>
        {REACTION_KEYS.map(key => (
          <ReactionButton
            key={key}
            emoji={EMOJI_MAP[key]}
            count={post.reactions[key]}
            active={post.myReaction === key}
            onPress={() => !post.isMyPost && onReact(post.id, key)}
          />
        ))}
      </View>

    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  card: {
    width:           CARD_W,
    backgroundColor: C.surface,
    borderRadius:    R.card,
    overflow:        'hidden',
  },

  // Photo
  photoWrap: {
    width:        CARD_W,
    borderRadius: 12,
    overflow:     'hidden',
  },
  photo: {
    width:  '100%',
    height: '100%',
  },

  // Muscle badges — top-left
  badgeRow: {
    position:       'absolute',
    top:            10,
    left:           10,
    flexDirection:  'row',
    flexWrap:       'wrap',
    gap:            4,
  },
  muscleBadge: {
    backgroundColor:   C.accent,
    borderRadius:      R.pill,
    paddingHorizontal: 8,
    paddingVertical:   3,
  },
  muscleBadgeText: {
    fontSize:      10,
    fontWeight:    '800',
    color:         C.bg,
    letterSpacing: 0.5,
  },

  // Time label — top-right
  timeLabelWrap: {
    position:          'absolute',
    top:               10,
    right:             10,
    backgroundColor:   'rgba(0,0,0,0.55)',
    borderRadius:      R.pill,
    paddingHorizontal: 8,
    paddingVertical:   3,
  },
  timeLabel: {
    fontSize:   10,
    color:      '#CCCCCC',
    fontWeight: '500',
  },

  // Bottom overlay
  bottomOverlay: {
    position:          'absolute',
    bottom:            0,
    left:              0,
    right:             0,
    paddingHorizontal: 12,
    paddingVertical:   10,
    backgroundColor:   'rgba(0,0,0,0.35)',
  },
  nickname: {
    fontSize:   15,
    fontWeight: '800',
    color:      '#FFFFFF',
    textShadowColor:  'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  gymName: {
    fontSize:   12,
    color:      'rgba(255,255,255,0.8)',
    fontWeight: '500',
    textShadowColor:  'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },

  // Reaction bar
  reactionBar: {
    flexDirection:     'row',
    justifyContent:    'space-around',
    alignItems:        'center',
    paddingHorizontal: 8,
    paddingVertical:   10,
  },
  reactionBtn: {
    flex:           1,
    alignItems:     'center',
    justifyContent: 'center',
    paddingVertical: 6,
    borderRadius:   R.inner,
    gap:            2,
  },
  reactionBtnActive: {
    backgroundColor: C.accentBg,
  },
  reactionEmoji: {
    fontSize: 20,
  },
  reactionCount: {
    fontSize:   11,
    fontWeight: '700',
    color:      C.textSub,
  },
  reactionCountActive: {
    color: C.accent,
  },

  myPostBadge: {
    backgroundColor:   '#000000',
    borderRadius:      6,
    paddingHorizontal: 8,
    paddingVertical:   3,
    zIndex:            10,
  },
  myPostBadgeText: {
    fontSize:   10,
    fontWeight: '800',
    color:      C.accent,
  },
});
