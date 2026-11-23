// 2026-11-21: 홈 '오늘의 오운완' 3x3 그리드 (가로 자동 스크롤 대체)
// 최대 9개. 탭하면 오운완 피드로 이동(기존 동작과 같음).

import React from 'react';
import { Dimensions, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { C, R } from '../../theme';
import { screenPad } from '../../theme/responsive';
import type { WorkoutFeedPost } from '../../data/types';
import { getOunwanImageSources } from '../../lib/photoImageUrl';
import FallbackImage from '../common/FallbackImage';

const MAX_ITEMS = 9;
const COLS = 3;
const GAP = 6;
const PAD_H = 20;
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

function OunwanGrid({ posts, onPressPost }: { posts: WorkoutFeedPost[]; onPressPost: () => void }) {
  if (posts.length === 0) {
    return (
      <View style={st.empty}>
        <Text style={st.emptyText}>아직 오늘의 오운완이 없어요</Text>
      </View>
    );
  }
  return (
    <View style={st.grid}>
      {posts.slice(0, MAX_ITEMS).map(post => (
        <OunwanGridCell key={post.id} post={post} onPress={onPressPost} />
      ))}
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
  // 2026-11-23: 오운완 이미지에 둥근 테두리가 이미 그려져 있어서, 셀에서 다시 둥글게 자르면
  // 모서리 테두리가 잘려 보임 → 셀은 자르지 않고 배경도 투명(기존 가로 스크롤 카드와 같은 방식)
  cell: {
    width:  CELL_W,
    height: CELL_H,
  },
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
