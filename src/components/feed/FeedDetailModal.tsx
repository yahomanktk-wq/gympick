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
import { fetchWorkoutSessionById, fetchWorkoutSessionByUserAndDate } from '../../lib/db/feedPosts';
import { brandLogos } from '../../constants/brandLogos';
import { getMachineImageUrl } from '../../lib/machineImageUrl';
import { getTransformedImageUrl } from '../../lib/photoImageUrl';
import GymPickLogo from '../GymPickLogo';
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
  const [sessionData,    setSessionData]    = useState<any>(null);
  const [sessionLoading, setSessionLoading] = useState(false);

  useEffect(() => {
    if (__DEV__) console.log('[FeedDetailModal] mount - sessionId:', post.sessionId, 'userId:', post.userId, 'createdAt:', post.createdAt);
    setSessionLoading(true);

    const load = async () => {
      try {
        if (post.sessionId) {
          const data = await fetchWorkoutSessionById(post.sessionId);
          setSessionData(data);
        } else {
          const data = await fetchWorkoutSessionByUserAndDate(
            post.userId,
            post.createdAt,
          );
          setSessionData(data);
        }
      } catch (e) {
        if (__DEV__) console.warn('[FeedDetailModal] session load error:', e);
        setSessionData(null);
      } finally {
        setSessionLoading(false);
      }
    };

    load();
  }, [post.sessionId, post.userId, post.createdAt]);

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

          {/* 운동 루틴 섹션 */}
          <View style={{ paddingTop: 16 }}>
            <Text style={{
              fontSize: 12, fontWeight: '700', color: C.textDim,
              letterSpacing: 0.8, marginBottom: 10, paddingHorizontal: 16,
            }}>운동 루틴</Text>

            {sessionLoading ? (
              <View style={{ paddingVertical: 24, alignItems: 'center' }}>
                <ActivityIndicator size="small" color={C.accent} />
              </View>
            ) : sessionData ? (
              <View style={{
                marginHorizontal: 16,
                backgroundColor: '#FFFFFF',
                borderRadius: R.card,
                borderWidth: 2,
                borderColor: C.border,
                overflow: 'hidden',
              }}>
                {/* 헬스장 헤더 */}
                <TouchableOpacity
                  style={{
                    paddingHorizontal: 16, paddingVertical: 12,
                    borderBottomWidth: StyleSheet.hairlineWidth,
                    borderBottomColor: '#E5E5E5',
                    flexDirection: 'row', alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                  onPress={() => onPressGym(post.gymId)}
                  activeOpacity={0.75}
                >
                  <View>
                    <Text style={{ fontSize: 15, fontWeight: '900', color: '#111111', marginBottom: 2 }}>
                      {sessionData.gymName}
                    </Text>
                    <Text style={{ fontSize: 11, color: '#888888' }}>
                      {new Date(sessionData.date).toLocaleString('ko-KR', {
                        year: 'numeric', month: '2-digit', day: '2-digit',
                        hour: '2-digit', minute: '2-digit',
                      })}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color="#000000" />
                </TouchableOpacity>

                {/* 머신 목록 */}
                {sessionData.machines.map((m: any, idx: number) => {
                  const imageUrl   = getMachineImageUrl(m.machineId, { width: 112 });
                  const allSets    = m.allSets ?? [];
                  const brandKey   = (m.machineBrand ?? '').toUpperCase().replace(/\s+/g, '_');
                  const brandLogo  = brandLogos[brandKey];
                  return (
                    <TouchableOpacity
                      key={`${m.machineId}-${idx}`}
                      style={{
                        flexDirection: 'row', alignItems: 'flex-start',
                        padding: 12, gap: 10,
                        borderTopWidth: idx > 0 ? StyleSheet.hairlineWidth : 0,
                        borderTopColor: '#E5E5E5',
                      }}
                      onPress={() => onPressMachine(m.machineId)}
                      activeOpacity={0.75}
                    >
                      {/* 머신 이미지 */}
                      <View style={{
                        width: 56, height: 56, borderRadius: 8,
                        overflow: 'hidden', backgroundColor: '#F5F5F5',
                        borderWidth: 1, borderColor: '#E5E5E5',
                        flexShrink: 0,
                      }}>
                        <Image
                          source={{ uri: imageUrl }}
                          style={{ width: '100%', height: '100%' }}
                          contentFit="contain"
                        />
                      </View>

                      {/* 머신명 + 브랜드 로고 */}
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 12, fontWeight: '700', color: '#111111', marginBottom: 6 }} numberOfLines={2}>
                          {m.machineName.toUpperCase()}
                        </Text>
                        {brandLogo ? (
                          <Image
                            source={brandLogo}
                            style={{ width: 56, height: 18 }}
                            contentFit="contain"
                          />
                        ) : (
                          <Text style={{ fontSize: 10, color: '#666666' }}>{m.machineBrand}</Text>
                        )}
                      </View>

                      {/* 세트 목록 — 상단 정렬 */}
                      <View style={{ alignItems: 'flex-end', justifyContent: 'flex-start' }}>
                        {allSets.map((s: any, si: number) => (
                          <Text key={si} style={{ fontSize: 11, fontWeight: '600', color: '#111111', lineHeight: 18 }}>
                            {Number(s.weight) > 0 ? `${s.weight}kg` : '--'} × {s.reps}
                          </Text>
                        ))}
                      </View>
                    </TouchableOpacity>
                  );
                })}

                {/* 푸터 — GymPick 로고 */}
                <View style={{ paddingHorizontal: 16, paddingVertical: 8, alignItems: 'flex-end', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#E5E5E5' }}>
                  <GymPickLogo color="#000000" width={60} height={12} />
                </View>
              </View>
            ) : (
              <View style={{ paddingHorizontal: 16 }}>
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
          </View>

        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
