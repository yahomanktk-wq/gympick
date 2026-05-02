import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { C, R } from '../theme';
import { GymWithMachines } from '../data/types';
import { fetchGymsWithMachines } from '../lib/db/gyms';
import { getFavoriteMachineIds } from '../data/favoritesStore';
import { calcDistanceKm, formatDistance } from '../lib/geocoding';
import GymMapView from './GymMapView';

interface RecommendedGym {
  gym:        GymWithMachines;
  matchCount: number;
  totalFavs:  number;
}

interface Props {
  userLocation: { latitude: number; longitude: number } | null;
  onSelectGym:  (gymId: string) => void;
}

export default function FavoriteGymRecommendation({ userLocation, onSelectGym }: Props) {
  const [recommended,   setRecommended]   = useState<RecommendedGym[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [mapSelectedId, setMapSelectedId] = useState<string | null>(null);
  const [showMap,       setShowMap]       = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const favMachineIds = getFavoriteMachineIds();
        if (favMachineIds.length === 0) {
          setRecommended([]);
          setLoading(false);
          return;
        }

        const allGyms = await fetchGymsWithMachines();

        const scored: RecommendedGym[] = allGyms
          .map(gym => ({
            gym,
            matchCount: favMachineIds.filter(id => gym.machineIds.includes(id)).length,
            totalFavs:  favMachineIds.length,
          }))
          .filter(r => r.matchCount > 0)
          .sort((a, b) => {
            if (b.matchCount !== a.matchCount) return b.matchCount - a.matchCount;
            if (userLocation) {
              const distA = (a.gym.latitude != null && a.gym.longitude != null)
                ? calcDistanceKm(userLocation.latitude, userLocation.longitude, a.gym.latitude, a.gym.longitude)
                : 9999;
              const distB = (b.gym.latitude != null && b.gym.longitude != null)
                ? calcDistanceKm(userLocation.latitude, userLocation.longitude, b.gym.latitude, b.gym.longitude)
                : 9999;
              return distA - distB;
            }
            return 0;
          })
          .slice(0, 5);

        setRecommended(scored);
      } catch (e) {
        if (__DEV__) console.warn('[FavoriteGymRecommendation] 로딩 오류:', e);
      }
      setLoading(false);
    }
    load();
  }, [userLocation]);

  if (loading) {
    return (
      <View style={s.loadingWrap}>
        <ActivityIndicator size="small" color={C.accent} />
      </View>
    );
  }

  if (recommended.length === 0) {
    return (
      <View style={s.emptyWrap}>
        <Ionicons name="heart-outline" size={20} color={C.textDim} />
        <Text style={s.emptyText}>즐겨찾기한 머신을 보유한 헬스장이 없어요</Text>
      </View>
    );
  }

  const gymsForMap = recommended
    .filter(r => r.gym.latitude != null && r.gym.longitude != null)
    .map(r => r.gym);

  return (
    <View style={s.container}>
      {/* 헤더 */}
      <View style={s.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>내 즐겨찾기 머신 보유 헬스장</Text>
          <Text style={s.subtitle}>즐겨찾기 머신을 많이 보유한 순으로 표시됩니다</Text>
        </View>
        {gymsForMap.length > 0 && (
          <TouchableOpacity
            style={[s.mapToggleBtn, showMap && s.mapToggleBtnActive]}
            onPress={() => setShowMap(v => !v)}
            activeOpacity={0.8}
          >
            <Ionicons name="map-outline" size={14} color={showMap ? C.bg : C.accent} />
            <Text style={[s.mapToggleTxt, showMap && s.mapToggleTxtActive]}>
              {showMap ? '목록' : '지도'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* 지도 */}
      {showMap && gymsForMap.length > 0 && (
        <View style={s.mapWrap}>
          <GymMapView
            gyms={gymsForMap}
            userLocation={userLocation}
            selectedGymId={mapSelectedId}
            height={220}
            onSelectGym={gym => {
              if (mapSelectedId === gym.id) {
                onSelectGym(gym.id);
                setMapSelectedId(null);
              } else {
                setMapSelectedId(gym.id);
              }
            }}
          />
        </View>
      )}

      {/* 목록 */}
      {!showMap && (
        <View style={s.listWrap}>
          {recommended.map((r, i) => {
            const distLabel = userLocation && r.gym.latitude != null && r.gym.longitude != null
              ? formatDistance(calcDistanceKm(
                  userLocation.latitude, userLocation.longitude,
                  r.gym.latitude, r.gym.longitude,
                ))
              : null;
            const matchRatio = `${r.matchCount}/${r.totalFavs}`;
            const isAll      = r.matchCount === r.totalFavs;

            return (
              <React.Fragment key={r.gym.id}>
                {i > 0 && <View style={s.divider} />}
                <TouchableOpacity
                  style={s.gymRow}
                  activeOpacity={0.8}
                  onPress={() => onSelectGym(r.gym.id)}
                >
                  <View style={[s.rankBadge, i === 0 && s.rankBadgeTop]}>
                    <Text style={[s.rankText, i === 0 && s.rankTextTop]}>{i + 1}</Text>
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={s.gymName} numberOfLines={1}>{r.gym.name}</Text>
                    <View style={s.gymMeta}>
                      <Ionicons name="location-outline" size={11} color={C.textSub} />
                      <Text style={s.gymLoc} numberOfLines={1}>{r.gym.location}</Text>
                      {distLabel && (
                        <>
                          <Text style={s.dot}>·</Text>
                          <Ionicons name="navigate-outline" size={10} color={C.accent} />
                          <Text style={s.gymDist}>{distLabel}</Text>
                        </>
                      )}
                    </View>
                  </View>

                  <View style={[s.matchBadge, isAll && s.matchBadgeAll]}>
                    <Ionicons
                      name={isAll ? 'checkmark-circle' : 'heart'}
                      size={11}
                      color={isAll ? C.bg : C.accent}
                    />
                    <Text style={[s.matchText, isAll && s.matchTextAll]}>
                      {matchRatio}개 보유
                    </Text>
                  </View>

                  <Ionicons name="chevron-forward" size={14} color={C.textDim} style={{ marginLeft: 6 }} />
                </TouchableOpacity>
              </React.Fragment>
            );
          })}
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    marginBottom: 20,
  },
  loadingWrap: {
    paddingVertical: 24,
    alignItems:      'center',
  },
  emptyWrap: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               8,
    paddingVertical:   16,
    paddingHorizontal: 16,
    backgroundColor:   C.surface,
    borderRadius:      R.card,
    borderWidth:       1,
    borderColor:       C.border,
    marginBottom:      20,
  },
  emptyText: {
    fontSize: 13,
    color:    C.textDim,
    flex:     1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems:    'center',
    marginBottom:  10,
    gap:           8,
  },
  title: {
    fontSize:     14,
    fontWeight:   '800',
    color:        C.text,
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 11,
    color:    C.textDim,
  },
  mapToggleBtn: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               4,
    paddingHorizontal: 10,
    paddingVertical:   6,
    borderRadius:      R.pill,
    borderWidth:       1,
    borderColor:       C.accent,
    backgroundColor:   C.bg,
  },
  mapToggleBtnActive: {
    backgroundColor: C.accent,
    borderColor:     C.accent,
  },
  mapToggleTxt: {
    fontSize:   12,
    fontWeight: '700',
    color:      C.accent,
  },
  mapToggleTxtActive: {
    color: C.bg,
  },
  mapWrap: {
    borderRadius: R.card,
    overflow:     'hidden',
    borderWidth:  1,
    borderColor:  C.border,
    marginBottom: 0,
  },
  listWrap: {
    backgroundColor: C.surface,
    borderRadius:    R.card,
    borderWidth:     1,
    borderColor:     C.border,
    overflow:        'hidden',
  },
  divider: {
    height:          1,
    backgroundColor: C.border,
  },
  gymRow: {
    flexDirection: 'row',
    alignItems:    'center',
    padding:       14,
    gap:           10,
  },
  rankBadge: {
    width:           26,
    height:          26,
    borderRadius:    13,
    backgroundColor: C.surfaceHigh,
    alignItems:      'center',
    justifyContent:  'center',
  },
  rankBadgeTop: {
    backgroundColor: C.accent,
  },
  rankText: {
    fontSize:   12,
    fontWeight: '800',
    color:      C.textSub,
  },
  rankTextTop: {
    color: C.bg,
  },
  gymName: {
    fontSize:     14,
    fontWeight:   '700',
    color:        C.text,
    marginBottom: 3,
  },
  gymMeta: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           4,
  },
  gymLoc: {
    fontSize: 11,
    color:    C.textSub,
    flex:     1,
  },
  dot: {
    fontSize: 11,
    color:    C.textDim,
  },
  gymDist: {
    fontSize:   11,
    fontWeight: '700',
    color:      C.accent,
  },
  matchBadge: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               4,
    paddingHorizontal: 8,
    paddingVertical:   4,
    borderRadius:      R.pill,
    backgroundColor:   C.accentBg,
    borderWidth:       1,
    borderColor:       C.accent + '40',
  },
  matchBadgeAll: {
    backgroundColor: C.accent,
    borderColor:     C.accent,
  },
  matchText: {
    fontSize:   11,
    fontWeight: '700',
    color:      C.accent,
  },
  matchTextAll: {
    color: C.bg,
  },
});
