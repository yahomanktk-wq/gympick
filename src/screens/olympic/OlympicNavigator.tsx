/**
 * OlympicNavigator
 * Machine Olympic의 모든 화면을 관리하는 Modal 컨테이너.
 * React Navigation 없이 내부 page state로 화면 전환 (GymFlowModal 패턴).
 */

import React, { useState } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, SafeAreaView } from 'react-native';
import { Machine } from '../../data/types';
import { OlympicVote } from '../../data/olympicStore';
import { MACHINES } from '../../data';
import { Ionicons } from '@expo/vector-icons';
import { C, R, T } from '../../theme';

import OlympicHomeScreen    from './OlympicHomeScreen';
import OlympicBattleScreen  from './OlympicBattleScreen';
import OlympicResultScreen  from './OlympicResultScreen';
import OlympicRankingScreen from './OlympicRankingScreen';

type Page = 'home' | 'size-select' | 'battle' | 'result' | 'ranking';

interface Props {
  visible: boolean;
  onClose: () => void;
}

export default function OlympicNavigator({ visible, onClose }: Props) {
  const [page,           setPage]           = useState<Page>('home');
  const [bodyPart,       setBodyPart]       = useState<string>('Chest');
  const [tournamentSize, setTournamentSize] = useState<number>(8);
  const [gymId]                             = useState<string | null>(null);
  const [winner,         setWinner]         = useState<Machine | null>(null);
  const [sessionVotes,   setSessionVotes]   = useState<OlympicVote[]>([]);

  function reset() {
    setPage('home');
    setWinner(null);
    setSessionVotes([]);
  }

  function handleClose() {
    reset();
    onClose();
  }

  function renderPage() {
    switch (page) {
      case 'home':
        return (
          <OlympicHomeScreen
            onSelectBodyPart={(bp, size) => { setBodyPart(bp); setTournamentSize(size); setPage('battle'); }}
            onViewRankings={() => setPage('ranking')}
            onClose={handleClose}
          />
        );

      case 'size-select': {
        const availableCount = MACHINES.filter(m => m.targetMuscle === bodyPart).length;
        const sizeOptions = [32, 64, 128];
        return (
          <SafeAreaView style={nav_s.safe}>
            <View style={nav_s.header}>
              <TouchableOpacity style={nav_s.backBtn} onPress={() => setPage('home')} activeOpacity={0.7}>
                <Ionicons name="chevron-back" size={20} color={C.text} />
              </TouchableOpacity>
              <Text style={nav_s.headerTitle}>토너먼트 규모 선택</Text>
              <TouchableOpacity style={nav_s.backBtn} onPress={handleClose} activeOpacity={0.7}>
                <Ionicons name="close" size={20} color={C.textSub} />
              </TouchableOpacity>
            </View>
            <View style={nav_s.body}>
              <Text style={nav_s.bodyPart}>{bodyPart}</Text>
              <Text style={nav_s.machineCount}>사용 가능한 머신 {availableCount}개</Text>
              <View style={nav_s.sizeGrid}>
                {sizeOptions.map(size => {
                  const disabled = availableCount < size;
                  return (
                    <TouchableOpacity
                      key={size}
                      style={[nav_s.sizeCard, disabled && nav_s.sizeCardDisabled]}
                      disabled={disabled}
                      activeOpacity={0.8}
                      onPress={() => { setTournamentSize(size); setPage('battle'); }}
                    >
                      <Text style={[nav_s.sizeLabel, disabled && nav_s.sizeLabelDisabled]}>{size}강</Text>
                      {disabled && (
                        <Text style={nav_s.sizeHint}>머신 {size}개 이상 필요</Text>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </SafeAreaView>
        );
      }

      case 'battle':
        return (
          <OlympicBattleScreen
            bodyPart={bodyPart}
            gymId={gymId}
            tournamentSize={tournamentSize}
            onComplete={(w, votes) => {
              setWinner(w);
              setSessionVotes(votes);
              setPage('result');
            }}
            onBack={() => setPage('home')}
            onClose={handleClose}
          />
        );

      case 'result':
        return winner ? (
          <OlympicResultScreen
            winner={winner}
            bodyPart={bodyPart}
            allVotes={sessionVotes}
            onViewRankings={() => setPage('ranking')}
            onRestart={() => setPage('battle')}
            onHome={() => setPage('home')}
            onClose={handleClose}
          />
        ) : null;

      case 'ranking':
        return (
          <OlympicRankingScreen
            gymId={gymId}
            onBack={() => setPage(winner ? 'result' : 'home')}
            onClose={handleClose}
          />
        );
    }
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={handleClose}
    >
      {renderPage()}
    </Modal>
  );
}

const nav_s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: C.bg },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 8, paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border,
  },
  backBtn:     { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '800', color: C.text },
  body:        { flex: 1, paddingHorizontal: 20, paddingTop: 32, alignItems: 'center' },
  bodyPart:    { fontSize: 28, fontWeight: '900', color: C.accent, marginBottom: 4 },
  machineCount:{ fontSize: 13, color: C.textSub, marginBottom: 32 },
  sizeGrid:    { flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'center', width: '100%' },
  sizeCard: {
    width: '45%', alignItems: 'center', justifyContent: 'center',
    backgroundColor: C.surface, borderRadius: R.card,
    borderWidth: 1, borderColor: C.border,
    paddingVertical: 24, gap: 6,
  },
  sizeCardDisabled: { opacity: 0.35 },
  sizeLabel:        { fontSize: 32, fontWeight: '900', color: C.text },
  sizeLabelDisabled:{ color: C.textDim },
  sizeHint:         { fontSize: 10, color: C.textDim, textAlign: 'center' },
});
