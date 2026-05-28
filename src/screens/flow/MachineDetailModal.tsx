import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { C, R, T } from '../../theme';
import { Machine } from '../../data';
import { MachineComment } from '../../data/gymDetails';
import GymDetailModal from './GymDetailModal';
import { isFavoriteMachine, addFavoriteMachine, removeFavoriteMachine } from '../../data/favoritesStore';
import { useAuth } from '../../context/AuthContext';
import { useNavigation } from '@react-navigation/native';
import MachineCard from '../../components/MachineCard';
import MachineCardBorder from '../../components/MachineCardBorder';
import GymMapView from '../../components/GymMapView';
import * as Location from 'expo-location';
import { calcDistanceKm, formatDistance } from '../../lib/geocoding';
import { fetchGymsWithMachines } from '../../lib/db/gyms';
import { GymWithMachines } from '../../data/types';

// --- Star rating

function StarRow({ rating }: { rating: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 2 }}>
      {[1, 2, 3, 4, 5].map(i => (
        <Ionicons
          key={i}
          name={i <= rating ? 'star' : 'star-outline'}
          size={11}
          color={i <= rating ? '#ffd166' : C.textDim}
        />
      ))}
    </View>
  );
}

// --- Comment card

function CommentCard({
  comment,
  last,
  currentUserId,
  onDelete,
}: {
  comment:        MachineComment;
  last:           boolean;
  currentUserId?: string;
  onDelete?:      (id: string) => void;
}) {
  const isMyReview = !!comment.userId && comment.userId === currentUserId;

  return (
    <View style={[s.commentRow, !last && s.commentBorder]}>
      <View style={s.commentAvatar}>
        {comment.profileImageUrl ? (
          <Image
            source={{ uri: comment.profileImageUrl }}
            style={s.commentAvatarImage}
            contentFit="cover"
          />
        ) : (
          <Text style={s.commentInitials}>{comment.initials}</Text>
        )}
      </View>
      <View style={{ flex: 1 }}>
        <View style={s.commentMeta}>
          <Text style={s.commentUser}>{comment.user}</Text>
          <StarRow rating={comment.rating} />
          <Text style={s.commentDate}>{comment.date}</Text>
          {isMyReview && onDelete && (
            <TouchableOpacity
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
                Alert.alert(
                  '리뷰 삭제',
                  '이 리뷰를 삭제할까요?',
                  [
                    { text: '취소', style: 'cancel' },
                    { text: '삭제', style: 'destructive', onPress: () => onDelete(comment.id) },
                  ]
                );
              }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              activeOpacity={0.7}
              style={{ marginLeft: 'auto' }}
            >
              <Ionicons name="trash-outline" size={13} color={C.danger} />
            </TouchableOpacity>
          )}
        </View>
        <Text style={s.commentText}>{comment.text}</Text>
      </View>
    </View>
  );
}

// --- Props

interface Props {
  visible:           boolean;
  machine:           Machine | null;
  onClose:           () => void;
  favorites?:        Set<string>;  // kept for backward compat, ignored (global store used)
  onToggleFavorite?: (id: string) => void;
  onSelectGym?:      (gymId: string) => void;
}

// --- Component

export default function MachineDetailModal({ visible, machine, onClose, onToggleFavorite, onSelectGym }: Props) {
  const { user } = useAuth();
  const nav = useNavigation<any>();
  const [isFav,             setIsFav]             = useState(false);
  const [gymDetailId,       setGymDetailId]       = useState<string | null>(null);
  const [gymDetailVisible,  setGymDetailVisible]  = useState(false);
  const [reviewText,        setReviewText]        = useState('');
  const [reviewRating,      setReviewRating]      = useState(5);
  const [userReviews,       setUserReviews]       = useState<MachineComment[]>([]);
  const [userLocation,      setUserLocation]      = useState<{ latitude: number; longitude: number } | null>(null);
  const [mapSelectedId,     setMapSelectedId]     = useState<string | null>(null);
  const [gymsWithCoords,    setGymsWithCoords]    = useState<GymWithMachines[]>([]);
  const [allAvailableGyms,  setAllAvailableGyms]  = useState<GymWithMachines[]>([]);

  React.useEffect(() => {
    if (machine) setIsFav(isFavoriteMachine(machine.id));
  }, [machine?.id]);

  React.useEffect(() => {
    if (!machine) return;
    setUserReviews([]); // 머신 변경 시 리뷰 초기화 (다른 머신 리뷰 섞임 방지)
    const machineId = machine.id;
    async function loadData() {
      // GPS
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          setUserLocation({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
        }
      } catch {}
      // 헬스장 목록 (Supabase)
      try {
        const allGyms = await fetchGymsWithMachines();
        const filtered = allGyms.filter(g => g.machineIds.includes(machineId));
        setAllAvailableGyms(filtered);
        setGymsWithCoords(filtered.filter(g => g.latitude != null && g.longitude != null));
      } catch {}
      // 리뷰 불러오기 (Supabase)
      try {
        const { supabase } = await import('../../lib/supabase');
        const { data: reviews } = await supabase
          .from('machine_reviews')
          .select('*')
          .eq('machine_id', machineId)
          .order('created_at', { ascending: false });

        if (reviews?.length) {
          setUserReviews(reviews.map(r => ({
            id:              r.id,
            user:            r.user_name,
            userId:          r.user_id,
            initials:        r.user_initials,
            profileImageUrl: r.profile_image_url ?? null,
            rating:          r.rating,
            text:            r.text,
            date:            new Date(r.created_at).toLocaleDateString('en-US', {
              month: 'short', day: 'numeric', year: 'numeric',
            }),
          })));
        }
      } catch (e) {
        if (__DEV__) console.warn('[MachineDetailModal] review load error:', e);
      }
    }
    loadData();
  }, [machine?.id]);

  if (!machine) return null;

  const allReviews  = [...userReviews];
  const isFavorited = isFav;

  function handleToggleFavorite() {
    if (!machine) return;
    if (!user) {
      onClose();
      nav.navigate('Profile');
      return;
    }
    if (isFav) {
      removeFavoriteMachine(machine.id);
    } else {
      addFavoriteMachine(machine.id);
    }
    setIsFav(!isFav);
    onToggleFavorite?.(machine.id);
  }

  async function submitReview() {
    if (!user) {
      Alert.alert(
        '로그인 필요',
        '리뷰를 작성하려면 로그인이 필요해요.',
        [
          { text: '취소', style: 'cancel' },
          { text: '로그인하기', onPress: () => { onClose(); nav.navigate('Profile'); } },
        ]
      );
      return;
    }
    if (!reviewText.trim()) return;

    const displayName     = user?.nickname ?? user?.name ?? 'GymPick User';
    const initials        = displayName.slice(0, 2).toUpperCase();
    const profileImageUrl = user?.profileImageUrl ?? null;
    const id              = `review-${Date.now()}`;
    const reviewTextVal   = reviewText.trim();
    const ratingVal       = reviewRating;

    // 로컬 state 즉시 반영 (낙관적 업데이트)
    const r: MachineComment = {
      id,
      user:             displayName,
      userId:           user.id,
      initials,
      profileImageUrl,
      rating:           ratingVal,
      text:             reviewTextVal,
      date:             new Date().toLocaleDateString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric',
      }),
    };
    setUserReviews(prev => [r, ...prev]);
    setReviewText('');
    setReviewRating(5);

    // Supabase 저장
    try {
      const { supabase } = await import('../../lib/supabase');
      const { error } = await supabase.from('machine_reviews').insert({
        id,
        machine_id:        machine?.id ?? '',
        user_id:           user.id,
        user_name:         displayName,
        user_initials:     initials,
        profile_image_url: profileImageUrl,
        rating:            ratingVal,
        text:              reviewTextVal,
      });
      if (error && __DEV__) console.warn('[submitReview] Supabase error:', error.message);
    } catch (e) {
      if (__DEV__) console.warn('[submitReview] error:', e);
    }
  }

  async function handleDeleteReview(reviewId: string) {
    setUserReviews(prev => prev.filter(r => r.id !== reviewId));

    try {
      const { supabase } = await import('../../lib/supabase');
      const { error } = await supabase
        .from('machine_reviews')
        .delete()
        .eq('id', reviewId)
        .eq('user_id', user?.id ?? '');
      if (error && __DEV__) console.warn('[deleteReview] error:', error.message);
    } catch (e) {
      if (__DEV__) console.warn('[deleteReview] error:', e);
    }
  }

  const availableGyms = allAvailableGyms.sort((a, b) => {
    if (!userLocation) return 0;
    const distA = (a.latitude != null && a.longitude != null)
      ? calcDistanceKm(userLocation.latitude, userLocation.longitude, a.latitude, a.longitude)
      : 9999;
    const distB = (b.latitude != null && b.longitude != null)
      ? calcDistanceKm(userLocation.latitude, userLocation.longitude, b.latitude, b.longitude)
      : 9999;
    return distA - distB;
  });

  const openCount = availableGyms.length;
  const closestDist = (() => {
    const g = availableGyms[0];
    if (!g || !userLocation || g.latitude == null || g.longitude == null) return '—';
    return formatDistance(calcDistanceKm(userLocation.latitude, userLocation.longitude, g.latitude, g.longitude));
  })();

  function openGymDetail(gymId: string) {
    if (onSelectGym) {
      onSelectGym(gymId);
    } else {
      setGymDetailId(gymId);
      setGymDetailVisible(true);
    }
  }

  return (
    <>
      <Modal
        visible={visible}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={onClose}
      >
        <SafeAreaView style={s.safe}>

          {/* Nav header */}
          <View style={s.navHeader}>
            <TouchableOpacity style={s.navBtn} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onClose(); }} activeOpacity={0.7}>
              <Ionicons name="chevron-back" size={20} color={C.text} />
            </TouchableOpacity>
            <Text style={s.navTitle} numberOfLines={1}>{machine.displayName ?? machine.name}</Text>
            <TouchableOpacity
              style={s.navBtn}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); handleToggleFavorite(); }}
              activeOpacity={0.7}
            >
              <Ionicons
                name={isFavorited ? 'heart' : 'heart-outline'}
                size={22}
                color={isFavorited ? '#ff4d6d' : C.textSub}
              />
            </TouchableOpacity>
          </View>

          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.content}>

            {/* ── Poster hero card ── */}
            <MachineCardBorder>
              <MachineCard machine={machine} variant="detail" />
            </MachineCardBorder>

            {/* ── Stats row ── */}
            <View style={s.statsCard}>
              <View style={s.statCell}>
                <Text style={s.statVal}>{availableGyms.length}</Text>
                <Text style={s.statLab}>헬스장</Text>
              </View>
              <View style={s.statDiv} />
              <View style={s.statCell}>
                <Text style={s.statVal}>{openCount}</Text>
                <Text style={s.statLab}>지금 영업</Text>
              </View>
              <View style={s.statDiv} />
              <View style={s.statCell}>
                <Text style={s.statVal}>{closestDist}</Text>
                <Text style={s.statLab}>가장 가까운</Text>
              </View>
              <View style={s.statDiv} />
              <View style={s.statCell}>
                <Text style={s.statVal}>{machine.category}</Text>
                <Text style={s.statLab}>타입</Text>
              </View>
            </View>

            {/* ── 기록 분석 버튼 ── */}
            {user && (
              <TouchableOpacity
                style={s.historyBtn}
                activeOpacity={0.85}
                onPress={() => {
                  onClose();
                  nav.navigate('MachineHistory', {
                    machineId:    machine.id,
                    machineName:  machine.displayName ?? machine.name,
                    machineBrand: machine.brand,
                  });
                }}
              >
                <Ionicons name="bar-chart-outline" size={16} color={C.bg} />
                <Text style={s.historyBtnTxt}>기록 분석</Text>
              </TouchableOpacity>
            )}

            {/* ── About ── */}
            <Text style={s.sectionTitle}>머신 정보</Text>
            <View style={s.descCard}>
              <View style={s.infoRow}>
                <Text style={s.infoLabel}>머신 이름</Text>
                <Text style={s.infoValue}>{machine.name}</Text>
              </View>
              <View style={s.infoRow}>
                <Text style={s.infoLabel}>브랜드</Text>
                <Text style={s.infoValue}>{machine.brand}</Text>
              </View>
              <View style={[s.infoRow, { borderBottomWidth: 0 }]}>
                <Text style={s.infoLabel}>타겟 부위</Text>
                <Text style={s.infoValue}>{machine.targetMuscle}</Text>
              </View>
            </View>

            {/* ── User reviews ── */}
            <Text style={s.sectionTitle}>리뷰</Text>
            <View style={s.commentsCard}>
              {allReviews.map((c, i) => (
                <CommentCard
                  key={c.id}
                  comment={c}
                  last={i === allReviews.length - 1}
                  currentUserId={user?.id}
                  onDelete={handleDeleteReview}
                />
              ))}
            </View>

            {/* ── Write a review ── */}
            <Text style={s.sectionTitle}>리뷰 작성</Text>
            {user ? (
              <View style={s.reviewCard}>
                <View style={s.reviewStarRow}>
                  {[1, 2, 3, 4, 5].map(n => (
                    <TouchableOpacity
                      key={n}
                      onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setReviewRating(n); }}
                      hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
                    >
                      <Ionicons
                        name={n <= reviewRating ? 'star' : 'star-outline'}
                        size={26}
                        color={n <= reviewRating ? '#ffd166' : C.textDim}
                      />
                    </TouchableOpacity>
                  ))}
                  <Text style={s.reviewRatingLabel}>{reviewRating}.0</Text>
                </View>
                <TextInput
                  style={s.reviewInput}
                  placeholder="이 머신에 대한 경험을 공유해보세요…"
                  placeholderTextColor={C.textDim}
                  multiline
                  numberOfLines={3}
                  value={reviewText}
                  onChangeText={setReviewText}
                  textAlignVertical="top"
                />
                <TouchableOpacity
                  style={[s.reviewSubmitBtn, !reviewText.trim() && { opacity: 0.35 }]}
                  activeOpacity={0.85}
                  disabled={!reviewText.trim()}
                  onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); submitReview(); }}
                >
                  <Ionicons name="send" size={15} color={C.bg} />
                  <Text style={s.reviewSubmitTxt}>리뷰 등록</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={s.loginPromptCard}
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onClose(); nav.navigate('Profile'); }}
                activeOpacity={0.85}
              >
                <Ionicons name="lock-closed-outline" size={18} color={C.textDim} />
                <Text style={s.loginPromptText}>로그인하면 리뷰를 작성할 수 있어요</Text>
                <Text style={s.loginPromptLink}>로그인하기 →</Text>
              </TouchableOpacity>
            )}

            {/* ── Available at ── */}
            <Text style={s.sectionTitle}>보유 헬스장</Text>

            {/* 지도 */}
            {gymsWithCoords.length > 0 && (
              <View style={{ borderRadius: R.card, overflow: 'hidden', marginBottom: 12, borderWidth: 1, borderColor: C.border }}>
                <GymMapView
                  gyms={gymsWithCoords}
                  userLocation={userLocation}
                  selectedGymId={mapSelectedId}
                  height={220}
                  onSelectGym={gym => {
                    if (mapSelectedId === gym.id) {
                      openGymDetail(gym.id);
                      setMapSelectedId(null);
                    } else {
                      setMapSelectedId(gym.id);
                    }
                  }}
                />
              </View>
            )}

            <View style={s.gymList}>
              {availableGyms.map((gym, i) => {
                const distLabel = userLocation && gym.latitude != null && gym.longitude != null
                  ? formatDistance(calcDistanceKm(userLocation.latitude, userLocation.longitude, gym.latitude, gym.longitude))
                  : '';
                return (
                  <React.Fragment key={gym.id}>
                    {i > 0 && <View style={s.divider} />}
                    <TouchableOpacity
                      style={s.gymRow}
                      activeOpacity={0.75}
                      onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); openGymDetail(gym.id); }}
                    >
                      <View style={[s.gymDot, { backgroundColor: C.accent }]} />
                      <View style={{ flex: 1 }}>
                        <Text style={s.gymRowName}>{gym.name}</Text>
                        <View style={s.gymRowMeta}>
                          <Ionicons name="location-outline" size={11} color={C.textSub} />
                          <Text style={s.gymRowLoc}>{gym.location}</Text>
                        </View>
                      </View>
                      <View style={{ alignItems: 'flex-end', gap: 5 }}>
                        <View style={[s.openBadge, { backgroundColor: C.accentBg }]}>
                          <Text style={[s.openBadgeText, { color: C.accent }]}>영업 중</Text>
                        </View>
                        {distLabel ? (
                          <View style={s.distBadge}>
                            <Ionicons name="navigate-outline" size={10} color={C.accent} />
                            <Text style={s.distText}>{distLabel}</Text>
                          </View>
                        ) : null}
                      </View>
                    </TouchableOpacity>
                  </React.Fragment>
                );
              })}
            </View>

            <View style={{ height: 100 }} />
          </ScrollView>
          </KeyboardAvoidingView>

        </SafeAreaView>
      </Modal>

      {/* Gym detail — Modal 바깥에 렌더링 (iOS Modal 중첩 문제 해결) */}
      <GymDetailModal
        visible={gymDetailVisible}
        gymId={gymDetailId}
        onClose={() => setGymDetailVisible(false)}
      />
    </>
  );
}

// --- Styles

const s = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: C.bg },
  content: { paddingHorizontal: 16, paddingTop: 0, paddingBottom: 24 },

  historyBtn: {
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'center',
    gap:             8,
    backgroundColor: C.accent,
    borderRadius:    R.btn,
    paddingVertical: 13,
    marginBottom:    24,
  },
  historyBtnTxt: {
    fontSize:   14,
    fontWeight: '800',
    color:      C.bg,
  },

  // Nav
  navHeader: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 8, paddingVertical: 12,
  },
  navBtn:   { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  navTitle: { flex: 1, textAlign: 'center', ...T.section, color: C.text },

  // Stats card
  statsCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: C.surface,
    borderRadius: R.card,
    paddingVertical: 14,
    marginTop: 16,
    marginBottom: 24,
  },
  statCell: { flex: 1, alignItems: 'center' },
  statVal:  { fontSize: 12, fontWeight: '800', color: C.text, marginBottom: 2, textAlign: 'center' },
  statLab:  { fontSize: 9, color: C.textSub, fontWeight: '600' },
  statDiv:  { width: 1, height: 28, backgroundColor: C.border },

  // Section titles + About card
  sectionTitle: { ...T.section, color: C.text, marginBottom: 10, marginTop: 4 },
  descCard: {
    backgroundColor: C.surface, borderRadius: R.card,
    overflow: 'hidden', marginBottom: 24,
  },
  infoRow: {
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'space-between',
    paddingHorizontal: 16,
    paddingVertical:   14,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  infoLabel: { fontSize: 13, color: C.textSub },
  infoValue: { fontSize: 14, fontWeight: '700', color: C.text, flexShrink: 1, textAlign: 'right', marginLeft: 12 },

  // Comments
  commentsCard: {
    backgroundColor: C.surface, borderRadius: R.card,
    overflow: 'hidden', marginBottom: 24,
  },
  commentRow:    { flexDirection: 'row', gap: 12, padding: 14 },
  commentBorder: { borderBottomWidth: 1, borderBottomColor: C.border },
  commentAvatar: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: C.accentBg,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  commentAvatarImage: { width: 36, height: 36, borderRadius: 18 },
  commentInitials: { fontSize: 11, fontWeight: '800', color: C.accent },
  commentMeta:     { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  commentUser:     { fontSize: 13, fontWeight: '700', color: C.text },
  commentDate:     { fontSize: 10, color: C.textDim, marginLeft: 'auto' },
  commentText:     { fontSize: 13, color: C.textSub, lineHeight: 19 },

  // Gym list
  gymList: {
    backgroundColor: C.surface, borderRadius: R.card,
    overflow: 'hidden', marginBottom: 24,
  },
  divider:    { height: 1, backgroundColor: C.border },
  gymRow:     { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 12 },
  gymDot:     { width: 8, height: 8, borderRadius: 4 },
  gymRowName: { fontSize: 14, fontWeight: '700', color: C.text },
  gymRowMeta: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 3 },
  gymRowLoc:  { fontSize: 12, color: C.textSub },

  openBadge:     { paddingHorizontal: 7, paddingVertical: 3, borderRadius: R.pill },
  openBadgeText: { fontSize: 10, fontWeight: '700' },
  distBadge:     { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: C.accentBg, paddingHorizontal: 7, paddingVertical: 3, borderRadius: R.pill },
  distText:      { fontSize: 10, fontWeight: '700', color: C.accent },

  // Review input
  reviewCard: {
    backgroundColor: C.surface, borderRadius: R.card,
    padding: 16, marginBottom: 24, gap: 14,
  },
  reviewStarRow:    { flexDirection: 'row', alignItems: 'center', gap: 8 },
  reviewRatingLabel:{ fontSize: 13, fontWeight: '700', color: C.textSub, marginLeft: 4 },
  reviewInput: {
    backgroundColor: C.surfaceHigh, borderRadius: R.inner,
    padding: 12, fontSize: 14, color: C.text,
    minHeight: 80,
  },
  reviewSubmitBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: C.accent, borderRadius: R.btn, paddingVertical: 13,
  },
  reviewSubmitTxt: { fontSize: 14, fontWeight: '800', color: C.bg },

  loginPromptCard: {
    backgroundColor: C.surface,
    borderRadius:    R.card,
    borderWidth:     1,
    borderColor:     C.border,
    padding:         20,
    alignItems:      'center',
    gap:             8,
    marginBottom:    12,
  },
  loginPromptText: {
    fontSize:   14,
    color:      C.textSub,
    fontWeight: '600',
    textAlign:  'center',
  },
  loginPromptLink: {
    fontSize:   13,
    color:      C.accent,
    fontWeight: '700',
  },
});
