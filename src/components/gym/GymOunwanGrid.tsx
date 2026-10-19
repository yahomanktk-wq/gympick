import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, TouchableOpacity, Dimensions, PixelRatio } from 'react-native';
import { Image } from 'expo-image';
import { C } from '../../theme';
import { WorkoutFeedPost } from '../../data/types';
import { fetchGymOunwanPosts } from '../../lib/db/feedPosts';
import { toggleReaction } from '../../lib/feedUtils';
import { getTransformedImageUrl } from '../../lib/photoImageUrl';
import FeedDetailModal from '../feed/FeedDetailModal';

// 헬스장 상세 커뮤니티 탭의 오운완 3열 사진 그리드 (F1-3).
// 부모가 ScrollView라 FlatList 대신 flexWrap View로 그린다(중첩 VirtualizedList 경고 방지).
// 게시물이 0건이거나 첫 로딩 중이면 아무것도 렌더하지 않는다.

const PAGE_SIZE = 30;
const GAP       = 2;
// 부모 ScrollView의 paddingHorizontal 16 × 2 = 32
const TILE      = Math.floor((Dimensions.get('window').width - 32 - GAP * 2) / 3);
const TILE_PX   = Math.round(TILE * PixelRatio.get());

interface Props {
  gymId: string;
  onPressMachine?: (machineId: string) => void;   // forwarded from GymDetailModal
}

interface GridTileProps {
  post:    WorkoutFeedPost;
  size:    number;
  onPress: (post: WorkoutFeedPost) => void;
}

const GridTile = React.memo(({ post, size, onPress }: GridTileProps) => {
  const uri = getTransformedImageUrl(post.thumbnailUri ?? post.compositeUri ?? post.photoUri, {
    width:  TILE_PX,
    height: TILE_PX,
  });
  return (
    <TouchableOpacity
      style={{ width: size, height: size, backgroundColor: C.surfaceHigh }}
      onPress={() => onPress(post)}
      activeOpacity={0.85}
    >
      <Image
        source={{ uri }}
        style={{ width: size, height: size }}
        contentFit="cover"
        placeholder={post.blurhash ? { blurhash: post.blurhash } : undefined}
        cachePolicy="memory-disk"
        transition={150}
      />
    </TouchableOpacity>
  );
});

export default function GymOunwanGrid({ gymId, onPressMachine }: Props) {
  const [posts,        setPosts]        = useState<WorkoutFeedPost[]>([]);
  const [initialLoad,  setInitialLoad]  = useState(true);
  const [hasMore,      setHasMore]      = useState(false);
  const [loadingMore,  setLoadingMore]  = useState(false);
  const [selectedPost, setSelectedPost] = useState<WorkoutFeedPost | null>(null);
  // '더 보기' 응답이 오는 사이 gymId가 바뀌었는지 판단하기 위한 최신 gymId
  const gymIdRef = useRef(gymId);
  gymIdRef.current = gymId;

  useEffect(() => {
    let alive = true;
    setInitialLoad(true);
    setPosts([]);
    setHasMore(false);
    fetchGymOunwanPosts(gymId, { limit: PAGE_SIZE }).then(result => {
      if (!alive) return;
      setPosts(result);
      setHasMore(result.length === PAGE_SIZE);
      setInitialLoad(false);
    });
    return () => { alive = false; };
  }, [gymId]);

  const loadMore = useCallback(async () => {
    if (loadingMore || posts.length === 0) return;
    setLoadingMore(true);
    const requestGymId = gymId;
    const lastPost = posts[posts.length - 1];
    const result = await fetchGymOunwanPosts(requestGymId, { limit: PAGE_SIZE, before: lastPost.createdAt });
    if (gymIdRef.current === requestGymId) {
      setPosts(prev => {
        const seen = new Set(prev.map(p => p.id));
        return [...prev, ...result.filter(p => !seen.has(p.id))];
      });
      setHasMore(result.length === PAGE_SIZE);
    }
    setLoadingMore(false);
  }, [gymId, posts, loadingMore]);

  const handleReact = useCallback((postId: string, key: keyof WorkoutFeedPost['reactions']) => {
    setSelectedPost(prev => (prev && prev.id === postId ? toggleReaction(prev, key) : prev));
    setPosts(prev => prev.map(p => (p.id === postId ? toggleReaction(p, key) : p)));
  }, []);

  const handlePressMachine = useCallback((machineId: string) => {
    setSelectedPost(null);
    setTimeout(() => onPressMachine?.(machineId), 350);
  }, [onPressMachine]);

  if (initialLoad || posts.length === 0) return null;

  return (
    <View style={{ marginBottom: 20 }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: GAP }}>
        {posts.map(post => (
          <GridTile key={post.id} post={post} size={TILE} onPress={setSelectedPost} />
        ))}
      </View>

      {hasMore && (
        <TouchableOpacity
          style={{ alignSelf: 'center' }}
          onPress={loadMore}
          disabled={loadingMore}
          activeOpacity={0.7}
        >
          <Text style={{ color: C.textSub, fontSize: 13, paddingVertical: 12 }}>더 보기</Text>
        </TouchableOpacity>
      )}

      {selectedPost && (
        <FeedDetailModal
          post={selectedPost}
          onClose={() => setSelectedPost(null)}
          onReact={handleReact}
          onPressGym={() => setSelectedPost(null)}
          onPressMachine={handlePressMachine}
        />
      )}
    </View>
  );
}
