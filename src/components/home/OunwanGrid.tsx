// 2026-11-21: 홈 '오늘의 오운완' 3x3 그리드 (가로 자동 스크롤 대체)
// 2026-11-23: 제목 줄 삭제 → 더보기는 그리드 아래, 간격·좌우 여백을 줄여 화면을 꽉 채움
// 최대 9개. 사진을 탭하면 오운완 피드로 이동(기존 동작과 같음).

import React from 'react';
import { Dimensions, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { C, R } from '../../theme';
import { screenPad } from '../../theme/responsive';
import type { WorkoutFeedPost } from '../../data/types';
import { getOunwanImageSources } from '../../lib/photoImageUrl';
import FallbackImage from '../common/FallbackImage';

const MAX_ITEMS = 9;
const COLS = 3;
const GAP = 2;
const PAD_H = 4;
const { width: SCREEN_W } = Dimensions.get('window');
const CELL_W = Math.floor((SCREEN_W - PAD_H * 2 - GAP * (COLS - 1)) / COLS);
const CELL_H = Math.round(CELL_W * (4 / 3));

function cellSources(post: WorkoutFeedPost): string[] {
  return getOunwanImageSources(
    { original: post.photoUri ?? post.compositeUri, thumbnail: post.thumbnailUri },
    'grid',
  );
}

const OunwanGridCell = React.memo(({ post, onPress }: { post: WorkoutFeedPost; onPress: () => void }) => {
  const sources = cellSources(post);
  return (
    <TouchableOpacity style={st.cell} activeOpacity={0.85} onPress={onPress}>
      {sources.length > 0 ? (
        <FallbackImage
          sources={sources}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          cachePolicy="memory-disk"
          placeholder={post.blurhash ? { blurhash: post.blurhash } : undefined}
          transition={200}
        />
      ) : null}
    </TouchableOpacity>
  );
});

const MoreButton = React.memo(({ onPress }: { onPress: () => void }) => (
  <TouchableOpacity
    style={st.more}
    activeOpacity={0.7}
    onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onPress(); }}
  >
    <Text style={st.moreText}>오운완 더보기</Text>
    <Ionicons name="chevron-forward" size={14} color={C.accent} />
  </TouchableOpacity>
));

interface Props {
  posts:       WorkoutFeedPost[];
  onPressPost: () => void;
  onMorePress: () => void;
}

function OunwanGrid({ posts, onPressPost, onMorePress }: Props) {
  if (posts.length === 0) {
    return (
      <View style={st.empty}>
        <Text style={st.emptyText}>아직 오늘의 오운완이 없어요</Text>
      </View>
    );
  }
  return (
    <View>
      <View style={st.grid}>
        {posts.slice(0, MAX_ITEMS).map(post => (
          <OunwanGridCell key={post.id} post={post} onPress={onPressPost} />
        ))}
      </View>
      <MoreButton onPress={onMorePress} />
    </View>
  );
}

export default React.memo(OunwanGrid);

const st = StyleSheet.create({
  grid: {
    flexDirection:     'row',
    flexWrap:          'wrap',
    gap:               GAP,
    paddingHorizontal: PAD_H,
  },
  // 오운완 이미지에 둥근 테두리가 이미 그려져 있어서, 셀에서 다시 둥글게 자르지 않는다
  cell: {
    width:  CELL_W,
    height: CELL_H,
  },
  more: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'center',
    gap:            2,
    marginTop:      16,
    paddingVertical: 12,
  },
  moreText: { fontSize: 13, fontWeight: '700', color: C.accent },
  empty: {
    marginHorizontal: screenPad,
    marginBottom:     16,
    backgroundColor:  C.surface,
    borderRadius:     R.inner,
    paddingVertical:  20,
    alignItems:       'center',
  },
  emptyText: { fontSize: 13, color: C.textDim },
});
