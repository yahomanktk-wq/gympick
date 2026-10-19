import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, PixelRatio,
  StyleProp, TextStyle,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { C, R } from '../../theme';
import { WorkoutFeedPost } from '../../data/types';
import { fetchGymOunwanPosts } from '../../lib/db/feedPosts';
import { toggleReaction } from '../../lib/feedUtils';
import { getTransformedImageUrl } from '../../lib/photoImageUrl';
import FeedDetailModal from '../feed/FeedDetailModal';

// 헬스장 상세 정보 탭의 최근 오운완 썸네일 줄 (F1-4).
// 최근 5개 + 끝에 '더보기' 타일(→ 커뮤니티 탭). 0건이거나 첫 로딩 중이면
// 타이틀까지 통째로 렌더하지 않는다(레이아웃 튐 방지).
// 상세 열기/리액션/머신 이동 동작은 GymOunwanGrid와 동일.

const LIMIT   = 5;
const TILE    = 76;
const TILE_PX = Math.round(TILE * PixelRatio.get());

interface Props {
  gymId: string;
  onPressMore: () => void;                          // → setActiveTab('커뮤니티')
  onPressMachine?: (machineId: string) => void;     // → setSelectedMachineId
  titleStyle?: StyleProp<TextStyle>;                // GymDetailModal passes s.sectionTitle
}

interface StripTileProps {
  post:    WorkoutFeedPost;
  onPress: (post: WorkoutFeedPost) => void;
}

const StripTile = React.memo(({ post, onPress }: StripTileProps) => {
  const uri = getTransformedImageUrl(post.thumbnailUri ?? post.compositeUri ?? post.photoUri, {
    width:  TILE_PX,
    height: TILE_PX,
  });
  return (
    <TouchableOpacity
      style={{
        width: TILE, height: TILE, borderRadius: R.inner,
        overflow: 'hidden', backgroundColor: C.surfaceHigh,
      }}
      onPress={() => onPress(post)}
      activeOpacity={0.85}
    >
      <Image
        source={{ uri }}
        style={{ width: TILE, height: TILE }}
        contentFit="cover"
        placeholder={post.blurhash ? { blurhash: post.blurhash } : undefined}
        cachePolicy="memory-disk"
      />
    </TouchableOpacity>
  );
});

function MoreTile({ onPress }: { onPress: () => void }) {
  return (
    <TouchableOpacity
      style={{
        width: TILE, height: TILE, borderRadius: R.inner,
        borderWidth: 1, borderColor: C.border, backgroundColor: C.surface,
        alignItems: 'center', justifyContent: 'center',
      }}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Ionicons name="chevron-forward" size={18} color={C.textSub} />
      <Text style={{ fontSize: 12, color: C.textSub }}>더보기</Text>
    </TouchableOpacity>
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
      <Text style={titleStyle}>오운완</Text>
      <View style={{ marginBottom: 20 }}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8 }}
        >
          {posts.map(post => (
            <StripTile key={post.id} post={post} onPress={setSelectedPost} />
          ))}
          <MoreTile onPress={onPressMore} />
        </ScrollView>
      </View>

      {selectedPost && (
        <FeedDetailModal
          post={selectedPost}
          onClose={() => setSelectedPost(null)}
          onReact={handleReact}
          onPressGym={() => setSelectedPost(null)}
          onPressMachine={handlePressMachine}
        />
      )}
    </>
  );
}
