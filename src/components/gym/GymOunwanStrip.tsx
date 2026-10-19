import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, PixelRatio, Dimensions,
  StyleProp, TextStyle,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { C } from '../../theme';
import { WorkoutFeedPost } from '../../data/types';
import { fetchGymOunwanPosts } from '../../lib/db/feedPosts';
import { toggleReaction } from '../../lib/feedUtils';
import { getTransformedImageUrl } from '../../lib/photoImageUrl';
import FeedDetailModal from '../feed/FeedDetailModal';

// 헬스장 상세 정보 탭의 '다른 사람들은 이렇게 운동해요' 섹션 (F1-4 → 2026-10-20 개편).
// 최근 오운완 6개를 3열 × 2줄 그리드로 보여준다. 사진 비율(3:4)을 그대로 살리고
// 모서리는 둥글리지 않는다. 제목 오른쪽 '더보기' → 커뮤니티 탭.
// 0건이거나 첫 로딩 중이면 제목까지 통째로 렌더하지 않는다(레이아웃 튐 방지).
// 상세 열기/리액션/머신 이동 동작은 GymOunwanGrid와 동일.

const LIMIT   = 6;
const COLS    = 3;
const GAP     = 4;
// GymDetailModal 정보 탭 contentContainer 좌우 padding 16
const TILE_W  = Math.floor((Dimensions.get('window').width - 32 - GAP * (COLS - 1)) / COLS);
const TILE_H  = Math.round(TILE_W * 4 / 3);
const TILE_PX_W = Math.round(TILE_W * PixelRatio.get());
const TILE_PX_H = Math.round(TILE_H * PixelRatio.get());

interface Props {
  gymId: string;
  onPressMore: () => void;                          // → 커뮤니티 탭
  onPressMachine?: (machineId: string) => void;     // → setSelectedMachineId
  titleStyle?: StyleProp<TextStyle>;                // GymDetailModal passes s.sectionTitle
}

interface GridTileProps {
  post:    WorkoutFeedPost;
  onPress: (post: WorkoutFeedPost) => void;
}

const GridTile = React.memo(({ post, onPress }: GridTileProps) => {
  const uri = getTransformedImageUrl(post.thumbnailUri ?? post.compositeUri ?? post.photoUri, {
    width:  TILE_PX_W,
    height: TILE_PX_H,
  });
  return (
    <TouchableOpacity
      style={{ width: TILE_W, height: TILE_H, backgroundColor: C.surfaceHigh }}
      onPress={() => onPress(post)}
      activeOpacity={0.85}
    >
      <Image
        source={{ uri }}
        style={{ width: TILE_W, height: TILE_H }}
        contentFit="cover"
        placeholder={post.blurhash ? { blurhash: post.blurhash } : undefined}
        cachePolicy="memory-disk"
      />
    </TouchableOpacity>
  );
});

function SectionHeader({ titleStyle, onPressMore }: { titleStyle?: StyleProp<TextStyle>; onPressMore: () => void }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      <Text style={[titleStyle, { flex: 1 }]} numberOfLines={1}>다른 사람들은 이렇게 운동해요</Text>
      <TouchableOpacity
        onPress={onPressMore}
        hitSlop={8}
        activeOpacity={0.7}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 2, marginBottom: 10, marginLeft: 8 }}
      >
        <Text style={{ fontSize: 13, color: C.textSub }}>더보기</Text>
        <Ionicons name="chevron-forward" size={14} color={C.textSub} />
      </TouchableOpacity>
    </View>
  );
}

export default function GymOunwanStrip({ gymId, onPressMore, onPressMachine, titleStyle }: Props) {
  const [posts,        setPosts]        = useState<WorkoutFeedPost[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [selectedPost, setSelectedPost] = useState<WorkoutFeedPost | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setPosts([]);
    fetchGymOunwanPosts(gymId, { limit: LIMIT }).then(result => {
      if (!alive) return;
      setPosts(result);
      setLoading(false);
    });
    return () => { alive = false; };
  }, [gymId]);

  const handleReact = useCallback((postId: string, key: keyof WorkoutFeedPost['reactions']) => {
    setSelectedPost(prev => (prev && prev.id === postId ? toggleReaction(prev, key) : prev));
    setPosts(prev => prev.map(p => (p.id === postId ? toggleReaction(p, key) : p)));
  }, []);

  const handlePressMachine = useCallback((machineId: string) => {
    setSelectedPost(null);
    setTimeout(() => onPressMachine?.(machineId), 350);
  }, [onPressMachine]);

  if (loading || posts.length === 0) return null;

  return (
    <>
      <SectionHeader titleStyle={titleStyle} onPressMore={onPressMore} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: GAP, marginBottom: 20 }}>
        {posts.map(post => (
          <GridTile key={post.id} post={post} onPress={setSelectedPost} />
        ))}
      </View>

      {selectedPost && (
        <FeedDetailModal
          post={selectedPost}
          onClose={() => setSelectedPost(null)}
          onReact={handleReact}
          onPressGym={() => setSelectedPost(null)}
          onPressMachine={handlePressMachine}
          onVisibilityChanged={(postId, isPublic) => {
            // 2026-10-20: 내 오운완을 비공개로 바꾸면 이 목록에서 바로 뺀다
            if (!isPublic) setPosts(prev => prev.filter(p => p.id !== postId));
          }}
        />
      )}
    </>
  );
}
