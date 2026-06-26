import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { C, R } from '../../theme';
import { MANAGER_MANUAL_SECTIONS } from '../../data/managerManual';

export default function ManagerManualScreen({ onClose }: { onClose: () => void }) {
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose} style={styles.backBtn}>
          <Ionicons name="chevron-down" size={22} color={C.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>헬스장 운영 가이드</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {MANAGER_MANUAL_SECTIONS.map((sec, i) => (
          <View key={i} style={styles.card}>
            <View style={styles.cardTop}>
              <View style={[styles.iconBox, { backgroundColor: sec.iconColor + '22' }]}>
                <Ionicons name={sec.icon} size={20} color={sec.iconColor} />
              </View>
              <Text style={styles.cardTitle}>{sec.title}</Text>
            </View>
            <Text style={styles.cardBody}>{sec.body}</Text>
          </View>
        ))}
        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, fontSize: 16, fontWeight: '800', color: C.text, textAlign: 'center' },
  scroll: { padding: 20, gap: 12 },
  card: {
    backgroundColor: C.surface, borderRadius: R.card,
    borderWidth: 1, borderColor: C.border, padding: 16, gap: 10,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconBox: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { flex: 1, fontSize: 15, fontWeight: '800', color: C.text },
  cardBody: { fontSize: 14, color: C.textSub, lineHeight: 22 },
});
