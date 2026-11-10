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
  KeyboardAvoidingView,
  Platform,
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
import ContentMenuButton from '../moderation/ContentMenuButton';
import { useOunwanComments } from './comments/useOunwanComments';
import OunwanCommentList from './comments/OunwanCommentList';
import CommentInput from './comments/CommentInput';
import { COMMENT_MAX_LENGTH } from '../../lib/db/ounwanComments';
import OunwanLikeButton from './likes/OunwanLikeBar';
import { toFeedVisibility, type FeedVisibility } from '../../lib/feedVisibility';

const IMAGE_PIXEL_RATIO = PixelRatio.get();

// ── 상세 모달 ─────────────────────────────────────────────────────────────────

export interface FeedDetailModalProps {
  post:           WorkoutFeedPost;
  onClose:        () => void;
  onPressGym:     (gymId: string) => void;
  onPressMachine: (machineId: string) => void;
  /** 내 글의 공개 범위를 바꿨을 때 (나만 보기면 목록에서 제거용). 넘기지 않으면 공개 범위 버튼을 숨긴다 */
  onVisibilityChanged?: (postId: string, visibility: FeedVisibility) => void;
  /** 2026-11-04: 이 오운완의 작성자를 차단했을 때 (목록에서 그 사람 글을 빼기용). 모달은 자동으로 닫힌다 */
  onAuthorBlocked?: (userId: string) => void;
}

export default function FeedDetailModal({
  post,
  onClose,
  onPressGym,
  onPressMachine,
  onVisibilityChanged,
  onAuthorBlocked,
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
  // 2026-11-04: 오운완 댓글 (비공개 오운완·차단한 사람 댓글은 DB에서 자동으로 숨겨짐)
  const comments = useOunwanComments(post.id);
  // 2026-11-09: 나만 보기 글에는 댓글·하트를 남길 수 없다
  const visibility = toFeedVisibility(post.visibility, post.isPublic);
  const canComment = !!user?.id && visibility !== 'private';

  function handleBlocked(userId: string) {
    if (userId === post.userId) {
      onAuthorBlocked?.(userId);
      onClose();
      return;
    }
    comments.removeByUser(userId);
  }
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
       <KeyboardAvoidingView
         style={{ flex: 1 }}
         behavior={Platform.OS === 'ios' ? 'padding' : undefined}
       >
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
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 18 }}>
            {/* 2026-11-04: 남의 오운완 신고 · 차단 */}
            <ContentMenuButton
              targetType="ounwan"
              targetId={post.id}
              authorId={post.userId}
              authorNickname={post.nickname}
              onBlocked={handleBlocked}
              size={20}
            />
            <TouchableOpacity onPress={onClose} activeOpacity={0.7}>
              <Ionicons name="close" size={22} color={C.textSub} />
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 24 }}>

          {/* 인증샷 */}
          <Image
            source={{ uri: displayUri }}
            style={{ width: MODAL_W, aspectRatio: 3 / 4 }}
            contentFit="cover"
            placeholder={post.blurhash ? { blurhash: post.blurhash } : undefined}
            transition={200}
          />

          {/* 내 오운완: 공개 범위 (전체 공개 / 우리 헬스장만 / 나만 보기). 하트는 아래 댓글 입력칸 왼쪽으로 이동 (2026-11-09) */}
          {isMine && onVisibilityChanged && (
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: 16, paddingTop: 12 }}>
              <OwnerVisibilityButton
                postId={post.id}
                gymId={post.gymId}
                value={visibility}
                onChanged={(v) => { onVisibilityChanged(post.id, v); onClose(); }}
              />
            </View>
          )}

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

          {/* 2026-11-04: 댓글 목록 */}
          <OunwanCommentList
            comments={comments.comments}
            loading={comments.loading}
            myUserId={user?.id}
            postOwnerId={post.userId}
            onDelete={comments.remove}
            onBlocked={handleBlocked}
            gymId={post.gymId}
          />

        </ScrollView>

        {/* 2026-11-04: 댓글 입력 (화면 아래 고정) */}
        <View style={{
          flexDirection: 'row', alignItems: 'center', gap: 8,
          paddingHorizontal: 12, paddingTop: 8, paddingBottom: 10,
          borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.border,
          backgroundColor: C.bg,
        }}>
          {/* 2026-11-09: 하트 — 댓글 입력칸 왼쪽 */}
          <OunwanLikeButton
            postId={post.id}
            likeCount={post.likeCount ?? 0}
            isMine={isMine}
            userId={user?.id}
            disabled={visibility === 'private'}
          />
          <View style={{ flex: 1 }}>
            {canComment ? (
              <CommentInput
                placeholder="댓글을 남겨보세요"
                maxLength={COMMENT_MAX_LENGTH}
                onSubmit={comments.add}
              />
            ) : (
              <Text style={{ fontSize: 13, color: C.textSub, textAlign: 'center', paddingVertical: 8 }}>
                {user?.id ? '나만 보기 오운완에는 댓글을 남길 수 없어요' : '로그인하면 댓글을 남길 수 있어요'}
              </Text>
            )}
          </View>
        </View>
       </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}
