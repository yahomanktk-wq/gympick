import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  Modal,
  Dimensions,
  ActivityIndicator,
  PixelRatio,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { C, R } from '../../theme';
import { WorkoutFeedPost } from '../../data/types';
import { fetchOunwanRoutine, OunwanRoutine } from '../../lib/db/ounwanRoutine';
import OunwanRoutineSection from './OunwanRoutineSection';
import { getTransformedImageUrl } from '../../lib/photoImageUrl';
import OwnerVisibilityButton from './OwnerVisibilityButton';
import { useAuth } from '../../context/AuthContext';

const IMAGE_PIXEL_RATIO = PixelRatio.get();

// ── 이모지 리액션 상수 ────────────────────────────────────────────────────────

const EMOJI_MAP: Record<keyof WorkoutFeedPost['reactions'], string> = {
  muscle: '💪', fire: '🔥', clap: '👏', trophy: '🏆', flex: '😤',
};
const REACTION_KEYS: (keyof WorkoutFeedPost['reactions'])[] = [
  'muscle', 'fire', 'clap', 'trophy', 'flex',
];

// ── 상세 모달 ─────────────────────────────────────────────────────────────────

export interface FeedDetailModalProps {
  post:           WorkoutFeedPost;
  onClose:        () => void;
  onReact:        (postId: string, key: keyof WorkoutFeedPost['reactions']) => void;
  onPressGym:     (gymId: string) => void;
  onPressMachine: (machineId: string) => void;
  /** 내 글을 비공개로 바꿨을 때 (목록에서 제거용). 넘기지 않으면 '공개중' 버튼을 숨긴다 */
  onVisibilityChanged?: (postId: string, isPublic: boolean) => void;
}

export default function FeedDetailModal({
  post,
  onClose,
  onReact,
  onPressGym,
  onPressMachine,
  onVisibilityChanged,
}: FeedDetailModalProps) {
  const { user } = useAuth();
  // 헬스장 페이지 목록은 isMyPost를 표시하지 않으므로 로그인 유저 id로도 판단한다
  const isMine = post.isMyPost === true || (!!user?.id && user.id === post.userId);
  const rawUri  = post.compositeUri ?? post.photoUri;
  const MODAL_W = Dimensions.get('window').width;
  // 화면에 보여줄 수 있는 실제 픽셀 수(화면 너비 × 기기 배율)로만 리사이즈 —
  // 핀치줌 등 확대 기능이 없는 고정 크기 이미지라 화질 손실 없이 전송량만
  // 줄어든다. 그리드 카드보다 화면에서 차지하는 비중이 큰 '메인' 사진이라
  // quality는 기본값(75)보다 높은 95로 지정.
  const displayUri = getTransformedImageUrl(rawUri, {
    width:  Math.round(MODAL_W * IMAGE_PIXEL_RATIO),
    height: Math.round(MODAL_W * (4 / 3) * IMAGE_PIXEL_RATIO),
    quality: 95,
  });
  // 2026-10-20: 다른 사람의 오운완도 루틴이 보이도록 get_ounwan_routine RPC로 불러온다
  const [routine,        setRoutine]        = useState<OunwanRoutine | null>(null);
  const [sessionLoading, setSessionLoading] = useState(false);

  useEffect(() => {
    let alive = true;
    setSessionLoading(true);
    setRoutine(null);
    fetchOunwanRoutine(post.id, post.sessionId, post.muscles ?? [])
      .then(r => { if (alive) setRoutine(r); })
      .finally(() => { if (alive) setSessionLoading(false); });
    return () => { alive = false; };
  }, [post.id, post.sessionId]);

  return (
    <Modal
      visible
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
        {/* 헤더 */}
        <View style={{
          flexDirection: 'row', alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 16, paddingVertical: 12,
          borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border,
        }}>
          <View style={{ gap: 6 }}>
            <Text style={{ fontSize: 15, fontWeight: '800', color: C.text }}>
              {post.nickname}
            </Text>
            <TouchableOpacity onPress={() => onPressGym(post.gymId)} activeOpacity={0.75}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Ionicons name="location-outline" size={12} color={C.accent} />
                <Text style={{ fontSize: 12, color: C.accent, fontWeight: '600' }}>
                  {post.gymName}
                </Text>
              </View>
            </TouchableOpacity>
          </View>
          <TouchableOpacity onPress={onClose} activeOpacity={0.7}>
            <Ionicons name="close" size={22} color={C.textSub} />
          </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>

          {/* 인증샷 */}
          <Image
            source={{ uri: displayUri }}
            style={{ width: MODAL_W, aspectRatio: 3 / 4 }}
            contentFit="cover"
            placeholder={post.blurhash ? { blurhash: post.blurhash } : undefined}
            transition={200}
          />

          {/* 내 오운완: 공개중 → 비공개 전환 (2026-10-20) */}
          {isMine && onVisibilityChanged && (
            <OwnerVisibilityButton
              postId={post.id}
              onChanged={(isPublic) => { onVisibilityChanged(post.id, isPublic); onClose(); }}
            />
          )}

          {/* 이모지 리액션 */}
          <View style={{
            flexDirection: 'row', justifyContent: 'space-around',
            paddingHorizontal: 8, paddingVertical: 16,
            borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border,
          }}>
            {REACTION_KEYS.map(key => {
              const active = post.myReaction === key;
              return (
                <TouchableOpacity
                  key={key}
                  style={{
                    flex: 1, alignItems: 'center', paddingVertical: 8,
                    borderRadius: R.inner,
                    backgroundColor: active ? C.accentBg : 'transparent',
                  }}
                  onPress={() => !post.isMyPost && onReact(post.id, key)}
                  activeOpacity={0.7}
                >
                  <Text style={{ fontSize: 24 }}>{EMOJI_MAP[key]}</Text>
                  <Text style={{
                    fontSize: 12, fontWeight: '700', marginTop: 2,
                    color: active ? C.accent : C.textSub,
                  }}>
                    {post.reactions[key]}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* 운동 루틴 섹션 — 운동일지 상세와 같은 레이아웃 (2026-10-20) */}
          {sessionLoading ? (
            <View style={{ paddingVertical: 24, alignItems: 'center' }}>
              <ActivityIndicator size="small" color={C.accent} />
            </View>
          ) : routine ? (
            <OunwanRoutineSection
              routine={routine}
              fallbackMuscles={post.muscles ?? []}
              onPressGym={() => onPressGym(post.gymId)}
              onPressMachine={onPressMachine}
            />
          ) : (
            <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {[...new Set(post.muscles)].map((m, idx) => (
                  <View key={`${m}-${idx}`} style={{
                    backgroundColor: C.accentBg, borderRadius: R.pill,
                    paddingHorizontal: 10, paddingVertical: 4,
                  }}>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: C.accent }}>{m}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
