import React, { useRef, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
} from 'react-native';
import MapView, { Marker, PROVIDER_DEFAULT, Region } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { C, R } from '../theme';
import { GymWithMachines } from '../data/types';
import { calcDistanceKm, formatDistance } from '../lib/geocoding';

interface GymMapViewProps {
  gyms:          GymWithMachines[];
  userLocation:  { latitude: number; longitude: number } | null;
  onSelectGym:   (gym: GymWithMachines) => void;
  selectedGymId: string | null;
  height?:       number;
}

export default function GymMapView({
  gyms, userLocation, onSelectGym, selectedGymId, height,
}: GymMapViewProps) {
  const mapRef = useRef<MapView>(null);

  const initialRegion: Region = userLocation
    ? {
        latitude:       userLocation.latitude,
        longitude:      userLocation.longitude,
        latitudeDelta:  0.05,
        longitudeDelta: 0.05,
      }
    : {
        latitude:       37.5665,
        longitude:      126.9780,
        latitudeDelta:  0.15,
        longitudeDelta: 0.15,
      };

  useEffect(() => {
    if (userLocation && mapRef.current) {
      mapRef.current.animateToRegion({
        latitude:       userLocation.latitude,
        longitude:      userLocation.longitude,
        latitudeDelta:  0.05,
        longitudeDelta: 0.05,
      }, 800);
    }
  }, [userLocation]);

  const mappableGyms = gyms.filter(
    g => g.latitude != null && g.longitude != null,
  );

  const selectedGym = gyms.find(g => g.id === selectedGymId) ?? null;

  function getDistLabel(gym: GymWithMachines): string {
    if (!userLocation || gym.latitude == null || gym.longitude == null) return '';
    const km = calcDistanceKm(
      userLocation.latitude, userLocation.longitude,
      gym.latitude, gym.longitude,
    );
    return formatDistance(km);
  }

  function moveToUser() {
    if (!userLocation || !mapRef.current) return;
    mapRef.current.animateToRegion({
      latitude:       userLocation.latitude,
      longitude:      userLocation.longitude,
      latitudeDelta:  0.03,
      longitudeDelta: 0.03,
    }, 500);
  }

  const containerStyle = height != null ? { height } : { flex: 1 };

  return (
    <View style={containerStyle}>
      <MapView
        ref={mapRef}
        style={{ flex: 1 }}
        provider={PROVIDER_DEFAULT}
        initialRegion={initialRegion}
        showsUserLocation={true}
        showsMyLocationButton={false}
        showsCompass={false}
      >
        {mappableGyms.map(gym => {
          const isSelected = gym.id === selectedGymId;
          return (
            <Marker
              key={gym.id}
              coordinate={{
                latitude:  gym.latitude!,
                longitude: gym.longitude!,
              }}
              onPress={() => onSelectGym(gym)}
            >
              <View style={[styles.marker, isSelected && styles.markerSelected]}>
                <Ionicons
                  name="barbell"
                  size={isSelected ? 14 : 12}
                  color={isSelected ? C.bg : C.accent}
                />
                <Text
                  style={[styles.markerText, isSelected && styles.markerTextSelected]}
                  numberOfLines={1}
                >
                  {gym.name}
                </Text>
              </View>
            </Marker>
          );
        })}
      </MapView>

      {userLocation && (
        <TouchableOpacity style={styles.myLocationBtn} onPress={moveToUser} activeOpacity={0.85}>
          <Ionicons name="navigate" size={18} color={C.accent} />
        </TouchableOpacity>
      )}

      {mappableGyms.length < gyms.length && (
        <View style={styles.noCoordBanner}>
          <Ionicons name="information-circle-outline" size={12} color={C.textSub} />
          <Text style={styles.noCoordText}>
            일부 헬스장은 위치 정보가 없어 지도에 표시되지 않아요
          </Text>
        </View>
      )}

      {selectedGym && (
        <TouchableOpacity
          style={styles.gymCard}
          activeOpacity={0.9}
          onPress={() => onSelectGym(selectedGym)}
        >
          <View style={{ flex: 1 }}>
            <Text style={styles.gymCardName} numberOfLines={1}>{selectedGym.name}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
              <Ionicons name="location-outline" size={11} color={C.textSub} />
              <Text style={styles.gymCardLoc} numberOfLines={1}>{selectedGym.location}</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 6 }}>
              <Text style={styles.gymCardMeta}>{selectedGym.machines.length} 머신</Text>
              {getDistLabel(selectedGym) ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Ionicons name="navigate-outline" size={11} color={C.accent} />
                  <Text style={[styles.gymCardMeta, { color: C.accent, fontWeight: '700' }]}>
                    {getDistLabel(selectedGym)}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>
          <View style={styles.gymCardArrow}>
            <Ionicons name="chevron-forward" size={16} color={C.bg} />
          </View>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  marker: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               4,
    backgroundColor:   C.bg,
    borderRadius:      R.pill,
    borderWidth:       1.5,
    borderColor:       C.accent,
    paddingHorizontal: 8,
    paddingVertical:   4,
    shadowColor:       '#000',
    shadowOpacity:     0.15,
    shadowRadius:      4,
    shadowOffset:      { width: 0, height: 2 },
    elevation:         3,
  },
  markerSelected: {
    backgroundColor: C.accent,
    borderColor:     C.accent,
  },
  markerText: {
    fontSize:   11,
    fontWeight: '700',
    color:      C.accent,
    maxWidth:   80,
  },
  markerTextSelected: {
    color: C.bg,
  },
  myLocationBtn: {
    position:        'absolute',
    top:             12,
    right:           12,
    width:           40,
    height:          40,
    borderRadius:    20,
    backgroundColor: C.bg,
    alignItems:      'center',
    justifyContent:  'center',
    shadowColor:     '#000',
    shadowOpacity:   0.15,
    shadowRadius:    4,
    shadowOffset:    { width: 0, height: 2 },
    elevation:       4,
    borderWidth:     1,
    borderColor:     C.border,
  },
  noCoordBanner: {
    position:          'absolute',
    top:               12,
    left:              12,
    flexDirection:     'row',
    alignItems:        'center',
    gap:               5,
    backgroundColor:   C.bg + 'ee',
    borderRadius:      R.pill,
    paddingHorizontal: 10,
    paddingVertical:   5,
    borderWidth:       1,
    borderColor:       C.border,
  },
  noCoordText: {
    fontSize:   10,
    color:      C.textSub,
    fontWeight: '600',
    maxWidth:   200,
  },
  gymCard: {
    position:        'absolute',
    bottom:          12,
    left:            12,
    right:           12,
    flexDirection:   'row',
    alignItems:      'center',
    backgroundColor: C.bg,
    borderRadius:    R.card,
    padding:         14,
    shadowColor:     '#000',
    shadowOpacity:   0.18,
    shadowRadius:    8,
    shadowOffset:    { width: 0, height: 3 },
    elevation:       6,
    borderWidth:     1,
    borderColor:     C.border,
  },
  gymCardName: {
    fontSize:   15,
    fontWeight: '800',
    color:      C.text,
  },
  gymCardLoc: {
    fontSize: 12,
    color:    C.textSub,
    flex:     1,
  },
  gymCardMeta: {
    fontSize:   12,
    color:      C.textDim,
    fontWeight: '600',
  },
  gymCardArrow: {
    width:           32,
    height:          32,
    borderRadius:    16,
    backgroundColor: C.accent,
    alignItems:      'center',
    justifyContent:  'center',
    marginLeft:      10,
  },
});
