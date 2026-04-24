import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { C, R, T } from '../theme';
import PostWorkoutLogModal from './flow/PostWorkoutLogModal';
import { useAuth } from '../context/AuthContext';
import AuthFlow from './auth/AuthFlow';

export default function LogWorkoutScreen() {
  const { user } = useAuth();
  const [visible, setVisible] = useState(false);

  // Open the modal every time this tab is focused — only for logged-in users.
  useFocusEffect(
    useCallback(() => {
      if (!user) return;
      setVisible(true);
    }, [user]),
  );

  if (!user) return <AuthFlow />;

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />

      {/* Background ready-state — visible when modal is closed */}
      <View style={s.center}>
        <View style={s.iconRing}>
          <Ionicons name="barbell" size={42} color={C.accent} />
        </View>

        <Text style={s.title}>운동 기록하기</Text>
        <Text style={s.sub}>
          운동을 마친 후 수행한 내용을 기록하세요
        </Text>

        <View style={s.features}>
          {[
            { icon: 'body-outline',          text: '운동한 부위를 선택하세요'        },
            { icon: 'map-outline',           text: '헬스장을 선택하세요'             },
            { icon: 'barbell-outline',       text: '사용한 머신을 선택하세요'        },
            { icon: 'create-outline',        text: '세트, 무게, 횟수를 기록하세요'   },
            { icon: 'camera-outline',        text: '운동 완료 카드 사진을 생성하세요' },
          ].map(f => (
            <View key={f.text} style={s.featureRow}>
              <Ionicons name={f.icon as any} size={15} color={C.accent} />
              <Text style={s.featureText}>{f.text}</Text>
            </View>
          ))}
        </View>

        <TouchableOpacity
          style={s.startBtn}
          activeOpacity={0.85}
          onPress={() => setVisible(true)}
        >
          <Ionicons name="add" size={18} color={C.bg} />
          <Text style={s.startBtnText}>기록 시작</Text>
        </TouchableOpacity>
      </View>

      <PostWorkoutLogModal
        visible={visible}
        onClose={(_saved) => setVisible(false)}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: C.bg },
  center: {
    flex:           1,
    alignItems:     'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },

  iconRing: {
    width:           96,
    height:          96,
    borderRadius:    48,
    backgroundColor: C.accentBg,
    alignItems:      'center',
    justifyContent:  'center',
    marginBottom:    24,
  },

  title: { ...T.title, color: C.text, textAlign: 'center', marginBottom: 10 },
  sub:   { fontSize: 14, color: C.textSub, textAlign: 'center', lineHeight: 22, marginBottom: 24 },

  features: {
    alignSelf:       'stretch',
    backgroundColor: C.surface,
    borderRadius:    20,
    padding:         16,
    gap:             12,
    marginBottom:    24,
  },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  featureText:{ fontSize: 13, color: C.textSub, fontWeight: '500' },

  startBtn: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               8,
    backgroundColor:   C.accent,
    paddingHorizontal: 28,
    paddingVertical:   15,
    borderRadius:      R.btn,
  },
  startBtnText: { fontSize: 15, fontWeight: '800', color: C.bg },
});
