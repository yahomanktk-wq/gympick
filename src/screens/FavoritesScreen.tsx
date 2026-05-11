import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  Dimensions,
} from 'react-native';
import * as Location from 'expo-location';
import FavoriteGymRecommendation from '../components/FavoriteGymRecommendation';
import { Ionicons } from '@expo/vector-icons';
import { C, R } from '../theme';
import { MACHINES } from '../data';
import { getFavoriteMachineIds, removeFavoriteMachine } from '../data/favoritesStore';
import { getGymFavorites, removeGymFavorite } from '../data/gymFavoriteStore';
import { fetchGymFavorites, removeGymFavoriteDB } from '../lib/db/gymFavorites';
import { fetchGymWithMachines } from '../lib/db/gyms';
import { GymWithMachines } from '../data/types';
import { useAuth } from '../context/AuthContext';
import GymDetailModal     from './flow/GymDetailModal';
import MachineDetailModal from './flow/MachineDetailModal';
import MachineCard       from '../components/MachineCard';
import MachineCardBorder from '../components/MachineCardBorder';

const { width: SCREEN_W } = Dimensions.get('window');
const CARD_W = (SCREEN_W - 32 - 8) / 2;

const MUSCLE_COLORS: Record<string, { fg: string; bg: string }> = {
  Chest:       { fg: '#5ba4ff', bg: '#5ba4ff18' },
  Back:        { fg: '#b36bff', bg: '#b36bff18' },
  Legs:        { fg: '#ff7c47', bg: '#ff7c4718' },
  Shoulders:   { fg: '#ffd166', bg: '#ffd16618' },
  Arms:        { fg: '#3dd68c', bg: '#3dd68c18' },
  Core:        { fg: '#06d6a0', bg: '#06d6a018' },
  'Full Body': { fg: '#a8dadc', bg: '#a8dadc18' },
};

function mp(muscle: string) {
  return MUSCLE_COLORS[muscle] ?? { fg: C.textSub, bg: C.border };
}

const MUSCLE_OPTIONS = ['전체', 'Chest', 'Back', 'Shoulders', 'Arms', 'Legs'] as const;

// --- Filter pill row

function FilterPills<T extends string>({
  options,
  selected,
  onSelect,
}: {
  options: T[];
  selected: T;
  onSelect: (v: T) => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={st.filterRow}
    >
      {options.map(opt => {
        const active = opt === selected;
        return (
          <TouchableOpacity
            key={opt}
            style={[st.filterPill, active && st.filterPillActive]}
            onPress={() => onSelect(opt)}
            activeOpacity={0.75}
          >
            <Text style={[st.filterPillTxt, active && st.filterPillTxtActive]}>
              {opt}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

// --- Screen

export default function FavoritesScreen({ onClose }: { onClose: () => void }) {
  const { user } = useAuth();
  const [favoriteGymIds,    setFavoriteGymIds]    = useState<string[]>([]);
  const [favoriteGyms,      setFavoriteGyms]      = useState<GymWithMachines[]>([]);
  const [gymsLoading,       setGymsLoading]       = useState(false);

  useEffect(() => {
    if (!user?.id) {
      setFavoriteGymIds([]);
      setFavoriteGyms([]);
      return;
    }
    async function loadFavoriteGyms() {
      setGymsLoading(true);
      try {
        const ids = await fetchGymFavorites(user!.id);
        setFavoriteGymIds(ids);
        const gyms = await Promise.all(ids.map(id => fetchGymWithMachines(id)));
        setFavoriteGyms(gyms.filter((g): g is GymWithMachines => g !== null));
      } catch (e) {
        if (__DEV__) console.warn('[FavoritesScreen] loadFavoriteGyms 오류:', e);
      } finally {
        setGymsLoading(false);
      }
    }
    loadFavoriteGyms();
  }, [user?.id]);
  const [removedMachineIds, setRemovedMachineIds] = useState<Set<string>>(new Set());
  const [userLocation,      setUserLocation]      = useState<{ latitude: number; longitude: number } | null>(null);

  // Detail modals
  const [gymDetailId,      setGymDetailId]      = useState<string | null>(null);
  const [selectedMachine,  setSelectedMachine]  = useState<typeof MACHINES[0] | null>(null);

  useEffect(() => {
    async function loadLocation() {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          setUserLocation({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
        }
      } catch {}
    }
    loadLocation();
  }, []);

  const [selectedMuscle, setSelectedMuscle] = useState<string>('전체');
  const [selectedBrand,  setSelectedBrand]  = useState<string>('전체');

  const favMachines = useMemo(
    () => getFavoriteMachineIds()
      .filter(id => !removedMachineIds.has(id))
      .map(id => MACHINES.find(m => m.id === id))
      .filter(Boolean) as typeof MACHINES,
    [removedMachineIds],
  );

  const brandOptions = useMemo(() => {
    const brands = [...new Set(favMachines.map(m => m.brand))].sort();
    return ['전체', ...brands];
  }, [favMachines]);

  const filteredMachines = useMemo(() => {
    return favMachines.filter(m => {
      if (selectedMuscle !== '전체' && m.targetMuscle !== selectedMuscle) return false;
      if (selectedBrand  !== '전체' && m.brand         !== selectedBrand)  return false;
      return true;
    });
  }, [favMachines, selectedMuscle, selectedBrand]);

  function removeGym(id: string) {
    removeGymFavorite(id);
    setFavoriteGymIds(prev => prev.filter(gid => gid !== id));
    setFavoriteGyms(prev => prev.filter(g => g.id !== id));
    if (user?.id) {
      removeGymFavoriteDB(user.id, id).catch(e => {
        if (__DEV__) console.warn('[FavoritesScreen] removeGym DB 오류:', e);
      });
    }
  }

  function removeMachine(id: string) {
    removeFavoriteMachine(id);
    setRemovedMachineIds(prev => new Set([...prev, id]));
    if (selectedMachine?.id === id) setSelectedMachine(null);
  }

  return (
    <SafeAreaView style={st.safe}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />

      {/* Header */}
      <View style={st.header}>
        <Text style={st.heading}>즐겨찾기</Text>
        <TouchableOpacity style={st.closeBtn} onPress={onClose} activeOpacity={0.7}>
          <Ionicons name="close" size={20} color={C.textSub} />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={st.scroll}>

        {/* ── 즐겨찾기 머신 기반 추천 헬스장 ── */}
        <Text style={st.sectionLabel}>내 머신 보유 추천 헬스장</Text>
        <View style={{ paddingHorizontal: 16, marginBottom: 8 }}>
          <FavoriteGymRecommendation
            userLocation={userLocation}
            onSelectGym={(gymId) => setGymDetailId(gymId)}
          />
        </View>

        {/* ── Favorite Gyms ── */}
        <Text style={st.sectionLabel}>즐겨찾기 헬스장</Text>
        {gymsLoading ? (
          <View style={st.emptyState}>
            <Text style={st.emptyText}>불러오는 중...</Text>
          </View>
        ) : favoriteGyms.length === 0 ? (
          <View style={st.emptyState}>
            <Ionicons name="business-outline" size={36} color={C.textDim} />
            <Text style={st.emptyText}>즐겨찾기한 헬스장이 없어요</Text>
          </View>
        ) : (
          <View style={st.card}>
            {favoriteGyms.map((gym, i) => (
              <React.Fragment key={gym.id}>
                {i > 0 && <View style={st.divider} />}
                <TouchableOpacity
                  style={st.gymRow}
                  activeOpacity={0.75}
                  onPress={() => setGymDetailId(gym.id)}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={st.gymName}>{gym.name}</Text>
                    <Text style={st.gymSub}>{gym.location}</Text>
                  </View>
                  <Text style={st.gymMachines}>{gym.machines.length} 머신</Text>
                  <TouchableOpacity
                    style={st.removeBtn}
                    onPress={() => removeGym(gym.id)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="bookmark" size={16} color={C.accent} />
                  </TouchableOpacity>
                </TouchableOpacity>
              </React.Fragment>
            ))}
          </View>
        )}

        {/* ── Favorite Machines ── */}
        <Text style={st.sectionLabel}>머신</Text>

        {favMachines.length === 0 ? (
          <View style={st.emptyState}>
            <Ionicons name="heart-outline" size={36} color={C.textDim} />
            <Text style={st.emptyText}>즐겨찾기한 머신이 없어요</Text>
          </View>
        ) : (
          <>
            {/* Muscle filter */}
            <Text style={st.filterLabel}>타겟 부위</Text>
            <FilterPills
              options={MUSCLE_OPTIONS as unknown as string[]}
              selected={selectedMuscle}
              onSelect={setSelectedMuscle}
            />

            {/* Brand filter */}
            <Text style={st.filterLabel}>브랜드</Text>
            <FilterPills
              options={brandOptions}
              selected={selectedBrand}
              onSelect={setSelectedBrand}
            />

            {/* Results */}
            {filteredMachines.length === 0 ? (
              <View style={st.emptyState}>
                <Text style={st.emptyText}>선택한 필터에 맞는 머신이 없어요.</Text>
              </View>
            ) : (
              <View style={st.machineGrid}>
                {filteredMachines.map(m => (
                  <TouchableOpacity
                    key={m.id}
                    style={{ width: CARD_W, position: 'relative' }}
                    activeOpacity={0.85}
                    onPress={() => setSelectedMachine(m)}
                  >
                    <MachineCardBorder>
                      <MachineCard machine={m} variant="grid" width={CARD_W} />
                    </MachineCardBorder>
                    <TouchableOpacity
                      style={st.removeOverlay}
                      onPress={() => removeMachine(m.id)}
                      hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                    >
                      <Ionicons name="heart" size={14} color="#ff4d6d" />
                    </TouchableOpacity>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Detail modals */}
      <GymDetailModal
        visible={!!gymDetailId}
        gymId={gymDetailId}
        onClose={() => setGymDetailId(null)}
      />
      <MachineDetailModal
        visible={!!selectedMachine}
        machine={selectedMachine}
        onClose={() => setSelectedMachine(null)}
        onSelectGym={(gymId) => {
          setSelectedMachine(null);
          setTimeout(() => {
            setGymDetailId(gymId);
          }, 350);
        }}
      />
    </SafeAreaView>
  );
}

// --- Styles

const st = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: C.bg },
  scroll: { paddingBottom: 32 },

  header:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 24, paddingBottom: 16 },
  heading:  { fontSize: 28, fontWeight: '900', color: C.text, letterSpacing: -0.8 },
  closeBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },

  sectionLabel: {
    fontSize: 11, fontWeight: '700', color: C.textDim,
    letterSpacing: 1.2, marginHorizontal: 16, marginBottom: 8, marginTop: 4,
  },

  // Filter UI
  filterLabel: {
    fontSize: 10, fontWeight: '700', color: C.textDim,
    letterSpacing: 1, marginHorizontal: 16, marginBottom: 6,
  },
  filterRow: { paddingHorizontal: 16, gap: 6, paddingBottom: 14 },
  filterPill: {
    paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: R.pill,
    backgroundColor: C.surface,
  },
  filterPillActive:    { backgroundColor: C.accent },
  filterPillTxt:       { fontSize: 13, fontWeight: '600', color: C.textSub },
  filterPillTxtActive: { color: C.bg },

  // Cards
  card: {
    backgroundColor: C.surface, borderRadius: R.card,
    marginHorizontal: 16, marginBottom: 24, overflow: 'hidden',
  },
  divider: { height: 1, backgroundColor: C.border },

  gymRow:      { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 },
  gymName:     { fontSize: 14, fontWeight: '700', color: C.text },
  gymSub:      { fontSize: 12, color: C.textSub, marginTop: 2 },
  gymMachines: { fontSize: 11, color: C.textDim, fontWeight: '600' },
  removeBtn:   { padding: 6 },

  machineGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 8,
    paddingHorizontal: 16, marginBottom: 24,
  },
  removeOverlay: {
    position: 'absolute', top: 8, right: 8,
    backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: R.pill, padding: 6,
  },

  emptyState: { alignItems: 'center', paddingVertical: 32, gap: 10, marginHorizontal: 16 },
  emptyText:  { fontSize: 13, color: C.textDim, textAlign: 'center' },
});
