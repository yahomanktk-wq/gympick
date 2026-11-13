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
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { C, R } from '../../theme';
import { WorkoutFeedPost } from '../../data/types';
import { fetchOunwanRoutine, OunwanRoutine } from '../../lib/db/ounwanRoutine';
import OunwanRoutineSection from './OunwanRoutineSection';
import { getOunwanImageSources } from '../../lib/photoImageUrl';
import FallbackImage from '../common/FallbackImage';
import OwnerVisibilityButton from './OwnerVisibilityButton';
import { useAuth } from '../../context/AuthContext';
import ContentMenuButton from '../moderation/ContentMenuButton';
import { useOunwanComments } from './comments/useOunwanComments';
import OunwanCommentList from './comments/OunwanCommentList';
import CommentInput from './comments/CommentInput';
import { COMMENT_MAX_LENGTH } from '../../lib/db/ounwanComments';
import OunwanLikeButton from './likes/OunwanLikeBar';
import { toFeedVisibility, type FeedVisibility } from '../../lib/feedVisibility';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useKeyboardHeight } from '../../lib/useKeyboardHeight';

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
  // 상세 화면은 긴 변 2048px 변형(고해상도 폰 전체 폭 기준)을 쓰고, 없으면 원본으로 대체.
  // 목록에서 이미 받아 둔 썸네일을 placeholder로 깔아 사진이 바로 보이게 한다.
  const sources = getOunwanImageSources({ original: rawUri }, 'full');
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
  // 2026-11-13: pageSheet 모달에서 KeyboardAvoidingView가 키보드 높이를 잘못 계산해 댓글 입력칸이 가려졌다.
  // 키보드 높이를 직접 받아 아래 여백으로 쓴다 (SafeAreaView가 이미 하단 여백만큼 띄워 두므로 그만큼 뺀다).
  const insets = useSafeAreaInsets();
  const kbHeight = useKeyboardHeight();
  const kbPad = kbHeight > 0 ? Math.max(0, kbHeight - insets.bottom) : 0;

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
       <View style={{ flex: 1, paddingBottom: kbPad }}>
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
          <FallbackImage
            sources={sources}
            style={{ width: MODAL_W, aspectRatio: 3 / 4 }}
            contentFit="cover"
            placeholder={
              post.thumbnailUri ? { uri: post.thumbnailUri }
              : post.blurhash ? { blurhash: post.blurhash } : undefined
            }
            placeholderContentFit="cover"
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
       </View>
      </SafeAreaView>
    </Modal>
  );
}
