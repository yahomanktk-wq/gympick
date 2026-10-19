import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Modal, View, Text, TextInput, TouchableOpacity, TouchableWithoutFeedback,
  FlatList, ActivityIndicator, Dimensions, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { C, R } from '../../theme';
import { Gym } from '../../data/types';
import { fetchGyms } from '../../lib/db/gyms';

// 오운완 피드 '내 헬스장' 직접 선택 시트 (F2-3).
// 검색창 한글 입력(IME) 버그를 피하기 위해 행 컴포넌트는 모두 모듈 최상위에 둔다.

const SHEET_MAX_H = Math.round(Dimensions.get('window').height * 0.75);

interface Props {
  visible: boolean;
  currentGymId: string | null;
  isManual: boolean;
  onClose: () => void;
  onSelect: (gymId: string | null) => void;   // null = automatic
}

interface GymRowProps {
  gym:      Gym;
  selected: boolean;
  onPress:  (gymId: string) => void;
}

const GymRow = React.memo(({ gym, selected, onPress }: GymRowProps) => (
  <TouchableOpacity
    style={{
      flexDirection: 'row', alignItems: 'center', gap: 10,
      paddingHorizontal: 16, paddingVertical: 12,
    }}
    onPress={() => onPress(gym.id)}
    activeOpacity={0.75}
  >
    <View style={{ flex: 1 }}>
      <Text style={{ fontSize: 14, fontWeight: '700', color: C.text }} numberOfLines={1}>
        {gym.name}
      </Text>
      {!!gym.location && (
        <Text style={{ fontSize: 12, color: C.textSub, marginTop: 2 }} numberOfLines={1}>
          {gym.location}
        </Text>
      )}
    </View>
    {selected && <Ionicons name="checkmark" size={18} color={C.accent} />}
  </TouchableOpacity>
));

function AutoRow({ onPress }: { onPress: () => void }) {
  return (
    <TouchableOpacity
      style={{
        flexDirection: 'row', alignItems: 'center', gap: 8,
        paddingHorizontal: 16, paddingVertical: 14,
        borderBottomWidth: 1, borderBottomColor: C.border,
      }}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <Ionicons name="refresh-outline" size={16} color={C.accent} />
      <Text style={{ fontSize: 14, fontWeight: '600', color: C.accent, flex: 1 }} numberOfLines={1}>
        자동으로 설정 (최근 30일 가장 많이 간 헬스장)
      </Text>
    </TouchableOpacity>
  );
}

export default function HomeGymPickerModal({ visible, currentGymId, isManual, onClose, onSelect }: Props) {
  const [gyms,    setGyms]    = useState<Gym[]>([]);
  const [loading, setLoading] = useState(false);
  const [query,   setQuery]   = useState('');

  // 처음 열릴 때 한 번만 헬스장 목록을 불러온다
  const requestedRef = useRef(false);
  const mountedRef   = useRef(true);
  useEffect(() => () => { mountedRef.current = false; }, []);
  useEffect(() => {
    if (!visible || requestedRef.current) return;
    requestedRef.current = true;
    setLoading(true);
    fetchGyms().then(result => {
      if (!mountedRef.current) return;
      if (result.length === 0) requestedRef.current = false; // 실패(빈 결과)면 다음에 열 때 다시 시도
      setGyms(result);
      setLoading(false);
    });
  }, [visible]);

  // 닫힐 때 검색어 초기화
  useEffect(() => {
    if (!visible) setQuery('');
  }, [visible]);

  const filteredGyms = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return gyms;
    return gyms.filter(g =>
      g.name.toLowerCase().includes(q) ||
      (g.location ?? '').toLowerCase().includes(q)
    );
  }, [gyms, query]);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <TouchableWithoutFeedback onPress={onClose}>
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }} />
        </TouchableWithoutFeedback>

        <View style={{
          maxHeight: SHEET_MAX_H,
          backgroundColor: C.surface,
          borderTopLeftRadius: R.card, borderTopRightRadius: R.card,
          paddingBottom: 24,
        }}>
          {/* 헤더 */}
          <View style={{
            flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
            paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12,
          }}>
            <Text style={{ fontSize: 16, fontWeight: '800', color: C.text }}>내 헬스장 선택</Text>
            <TouchableOpacity onPress={onClose} hitSlop={8} activeOpacity={0.7}>
              <Ionicons name="close" size={22} color={C.textSub} />
            </TouchableOpacity>
          </View>

          {/* 검색 */}
          <View style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="헬스장 이름 검색"
              placeholderTextColor={C.textDim}
              style={{
                backgroundColor: C.surfaceHigh, borderRadius: R.inner,
                color: C.text, fontSize: 14,
                paddingHorizontal: 12, paddingVertical: 10,
              }}
              autoCorrect={false}
              returnKeyType="search"
            />
          </View>

          {loading ? (
            <View style={{ paddingVertical: 32, alignItems: 'center' }}>
              <ActivityIndicator size="small" color={C.accent} />
            </View>
          ) : (
            <FlatList
              data={filteredGyms}
              keyExtractor={g => g.id}
              keyboardShouldPersistTaps="handled"
              ListHeaderComponent={isManual ? <AutoRow onPress={() => onSelect(null)} /> : null}
              renderItem={({ item }) => (
                <GymRow gym={item} selected={item.id === currentGymId} onPress={onSelect} />
              )}
              ListEmptyComponent={
                <Text style={{ fontSize: 13, color: C.textDim, textAlign: 'center', paddingVertical: 24 }}>
                  검색 결과가 없어요
                </Text>
              }
            />
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
