import React, { useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import * as Haptics from 'expo-haptics';
import { C } from '../../theme';
import type { WorkoutFeedPost } from '../../data/types';
import { getOunwanImageSources } from '../../lib/photoImageUrl';
import FallbackImage from '../common/FallbackImage';
import { DAY_LABELS, addDays, countWeeksSince, getISOWeekNumber, getWeekStart, isSameDay } from './weekUtils';

// 남의 운동일지 — 본인 운동일지(JournalScreen의 주별 줄)와 같은 모양.
// 날짜 칸에는 그날의 오운완 사진(내가 볼 수 있는 것만), 없으면 날짜·요일만.

const SCREEN_W = Dimensions.get('window').width;
const CELL_W   = Math.floor((SCREEN_W - 32) / 3.5);
const CELL_H   = Math.round(CELL_W * 4 / 3);
const MIN_WEEKS = 4;

interface Props {
  posts:      WorkoutFeedPost[];
  onOpenPost: (post: WorkoutFeedPost) => void;
}

export default function UserWeeklyGrid({ posts, onOpenPost }: Props) {
  const today = useMemo(() => new Date(), []);
  const oldest = posts.length > 0 ? posts[posts.length - 1].createdAt : undefined;
  const numWeeks = countWeeksSince(oldest, MIN_WEEKS);

  const weeks = useMemo(() => {
    const thisWeek = getWeekStart(today);
    return Array.from({ length: numWeeks }, (_, i) => {
      const ws = addDays(thisWeek, -i * 7);
      return { weekStart: ws, weekEnd: addDays(ws, 6), weekNum: getISOWeekNumber(ws), key: ws.toISOString() };
    });
  }, [numWeeks, today]);

  return (
    <View style={{ paddingBottom: 16 }}>
      {weeks.map(({ weekStart, weekEnd, weekNum, key }) => {
        const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
        return (
          <View key={key} style={s.weekSection}>
            <View style={s.weekHeader}>
              <Text style={s.weekNum}>{weekNum}주</Text>
              <Text style={s.weekRange}>
                {weekStart.getMonth() + 1}월 {weekStart.getDate()}일 ~ {weekEnd.getMonth() + 1}월 {weekEnd.getDate()}일
              </Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.dayRow}>
              {days.map((day, i) => {
                // 같은 날 여러 개면 가장 최근 것 (posts는 최신순)
                const post     = posts.find(p => isSameDay(new Date(p.createdAt), day));
                const isToday  = isSameDay(day, today);
                const isFuture = day > today;
                const sources  = post
                  ? getOunwanImageSources({ original: post.compositeUri ?? post.photoUri, thumbnail: post.thumbnailUri }, 'grid')
                  : [];
                return (
                  <TouchableOpacity
                    key={i}
                    style={[s.dayCell, isToday && s.dayToday, isFuture && s.dayFuture]}
                    activeOpacity={post ? 0.75 : 1}
                    disabled={!post}
                    onPress={() => {
                      if (!post) return;
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      onOpenPost(post);
                    }}
                  >
                    {sources.length > 0 ? (
                      <FallbackImage
                        sources={sources}
                        style={StyleSheet.absoluteFill}
                        contentFit="cover"
                        cachePolicy="memory-disk"
                        placeholder={post?.blurhash ? { blurhash: post.blurhash } : undefined}
                      />
                    ) : (
                      <View style={s.empty}>
                        <Text style={[s.emptyDate, isToday && { color: C.accent }]}>{day.getDate()}</Text>
                        <Text style={s.emptyDay}>{DAY_LABELS[i]}</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  weekSection: { marginBottom: 28 },
  weekHeader:  { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, marginBottom: 10 },
  weekNum:     { fontSize: 16, fontWeight: '700', color: C.text, marginRight: 10 },
  weekRange:   { flex: 1, fontSize: 12, color: C.textSub, textAlign: 'center', marginRight: 26 },
  dayRow:      { paddingHorizontal: 16, gap: 3 },
  dayCell:     { width: CELL_W, height: CELL_H, borderRadius: 10, overflow: 'hidden', backgroundColor: C.surface },
  dayToday:    { borderWidth: 2, borderColor: C.accent },
  dayFuture:   { opacity: 0.3 },
  empty:       { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3 },
  emptyDate:   { fontSize: 18, fontWeight: '700', color: C.textDim },
  emptyDay:    { fontSize: 10, color: C.textDim },
});
