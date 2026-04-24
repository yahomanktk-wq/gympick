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

export default function LogWorkoutScreen() {
  const [visible, setVisible] = useState(false);

  // Open the modal every time this tab is focused (i.e. every tab press)
  useFocusEffect(
    useCallback(() => {
      setVisible(true);
    }, []),
  );

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />

      {/* Background ready-state — visible when modal is closed */}
      <View style={s.center}>
        <View style={s.iconRing}>
          <Ionicons name="barbell" size={42} color={C.accent} />
        </View>

        <Text style={s.title}>Log a Workout</Text>
        <Text style={s.sub}>
          Record what you performed{'\n'}after your session is done
        </Text>

        <View style={s.features}>
          {[
            { icon: 'map-outline',          text: 'Pick the gym you trained at'     },
            { icon: 'barbell-outline',       text: 'Select the machines you used'   },
            { icon: 'create-outline',        text: 'Log weight, reps, and sets'     },
            { icon: 'camera-outline',        text: 'Capture a workout photo'        },
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
          <Text style={s.startBtnText}>Start Logging</Text>
        </TouchableOpacity>
      </View>

      <PostWorkoutLogModal
        visible={visible}
        onClose={() => setVisible(false)}
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
    paddingHorizontal: 36,
  },

  iconRing: {
    width:           96,
    height:          96,
    borderRadius:    48,
    backgroundColor: C.accentBg,
    borderWidth:     1.5,
    borderColor:     C.accent + '40',
    alignItems:      'center',
    justifyContent:  'center',
    marginBottom:    24,
  },

  title: { ...T.title, color: C.text, textAlign: 'center', marginBottom: 10 },
  sub:   { fontSize: 14, color: C.textSub, textAlign: 'center', lineHeight: 22, marginBottom: 28 },

  features: {
    alignSelf:       'stretch',
    backgroundColor: C.surface,
    borderRadius:    20,
    borderWidth:     1,
    borderColor:     C.border,
    padding:         18,
    gap:             12,
    marginBottom:    28,
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
