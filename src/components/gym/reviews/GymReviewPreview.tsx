import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleProp, TextStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { C, R } from '../../../theme';
import { useAuth } from '../../../context/AuthContext';
import { fetchGymReviews, GymReview } from '../../../lib/db/gymReviews';
import GymReviewItem from './GymReviewItem';

// 2026-11-04: 헬스장 상세 > 정보 탭의 최근 후기 미리보기 (최근 3개).
// 0건이면 렌더하지 않는다. 제목 오른쪽 '더보기' → 커뮤니티 탭.

const LIMIT = 3;

interface Props {
  gymId:        string;
  version?:     number;
  onPressMore:  () => void;
  titleStyle?:  StyleProp<TextStyle>;
}

export default function GymReviewPreview({ gymId, version = 0, onPressMore, titleStyle }: Props) {
  const { user } = useAuth();
  const [reviews, setReviews] = useState<GymReview[]>([]);

  useEffect(() => {
    let alive = true;
    fetchGymReviews(gymId, LIMIT).then(list => { if (alive) setReviews(list); });
    return () => { alive = false; };
  }, [gymId, version]);

  if (reviews.length === 0) return null;

  return (
    <View style={{ marginBottom: 24 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={[titleStyle, { marginBottom: 0 }]}>후기</Text>
        <TouchableOpacity
          onPress={onPressMore}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}
        >
          <Text style={{ fontSize: 13, fontWeight: '600', color: C.textSub }}>더보기</Text>
          <Ionicons name="chevron-forward" size={14} color={C.textSub} />
        </TouchableOpacity>
      </View>
      <View style={{ backgroundColor: C.surface, borderRadius: R.card, paddingHorizontal: 14, marginTop: 10 }}>
        {reviews.map(r => (
          <GymReviewItem
            key={r.id}
            review={r}
            myUserId={user?.id}
            isAdmin={false}
            isManager={false}
            compact
          />
        ))}
      </View>
    </View>
  );
}
