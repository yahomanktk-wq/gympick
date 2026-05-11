import React, { useState, useMemo, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, StatusBar,
  Dimensions, ScrollView,
} from 'react-native';
import { TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { C, R, T } from '../../theme';
import { Machine } from '../../data/types';
import { MACHINES } from '../../data';
import { saveVote, OlympicVote } from '../../data/olympicStore';
import OlympicTradingCard from './OlympicTradingCard';

const { width: SCREEN_W } = Dimensions.get('window');

// Card width: two cards fill ~48% of screen each, VS badge floats absolutely
const H_PAD   = 4;
const CARD_GAP = 6;
const CARD_W  = Math.floor((SCREEN_W - H_PAD * 2 - CARD_GAP) / 2);

const MUSCLE_COLORS: Record<string, string> = {
  Chest: '#5ba4ff', Back: '#cc5de8', Legs: '#ff922b',
  Shoulders: '#ffd166', Arms: '#3dd68c',
};

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function getRoundLabel(poolSize: number): '128강' | '64강' | '32강' | '16강' | '8강' | '4강' | '결승' {
  if (poolSize <= 2)   return '결승';
  if (poolSize <= 4)   return '4강';
  if (poolSize <= 8)   return '8강';
  if (poolSize <= 16)  return '16강';
  if (poolSize <= 32)  return '32강';
  if (poolSize <= 64)  return '64강';
  return '128강';
}

interface Props {
  bodyPart: string;
  category: string;
  gymId: string | null;
  tournamentSize: number;
  onComplete: (winner: Machine, allVotes: OlympicVote[]) => void;
  onBack: () => void;
  onClose: () => void;
}

export default function OlympicBattleScreen({ bodyPart, category, gymId, tournamentSize, onComplete, onBack, onClose }: Props) {
  const accentColor = MUSCLE_COLORS[bodyPart] ?? C.accent;

  const initialPool = useMemo(() => {
    const all = MACHINES.filter((m) => {
      const muscleMatch = m.targetMuscle?.toLowerCase() === bodyPart.toLowerCase();
      if (!muscleMatch) return false;
      if (!m.id) return false;
      if (category === '전체') return true;
      const machineCats = (m.category ?? '').split(',').map((c: string) => c.trim());
      return machineCats.includes(category);
    });
    return shuffle(all).slice(0, tournamentSize);
  }, [bodyPart, category, tournamentSize]);

  const [pool,         setPool]         = useState<Machine[]>(initialPool);
  const [battleIndex,  setBattleIndex]  = useState(0);
  const [winners,      setWinners]      = useState<Machine[]>([]);
  const [sessionVotes, setSessionVotes] = useState<OlympicVote[]>([]);
  const [selectedId,   setSelectedId]   = useState<string | null>(null);
  const advancing = useRef(false);

  const pairs = useMemo(() => {
    const result: [Machine, Machine][] = [];
    for (let i = 0; i + 1 < pool.length; i += 2) {
      result.push([pool[i], pool[i + 1]]);
    }
    return result;
  }, [pool]);

  const currentPair  = pairs[battleIndex] ?? null;
  const totalBattles = pairs.length;
  const roundLabel   = getRoundLabel(pool.length);

  const handleSelect = useCallback((winner: Machine, loser: Machine) => {
    if (advancing.current || selectedId) return;
    advancing.current = true;
    setSelectedId(winner.id);

    const vote: OlympicVote = {
      id:         `ov-${Date.now()}`,
      machineId:  winner.id,
      opponentId: loser.id,
      bodyPart,
      round:      roundLabel,
      gymId,
      createdAt:  new Date().toISOString(),
    };
    saveVote(vote);
    const newVotes = [...sessionVotes, vote];
    setSessionVotes(newVotes);

    // Advance after scale animation finishes (~260ms) + brief pause
    setTimeout(() => {
      const newWinners = [...winners, winner];

      if (battleIndex + 1 < totalBattles) {
        setBattleIndex((i) => i + 1);
        setWinners(newWinners);
        setSelectedId(null);
        advancing.current = false;
      } else {
        if (newWinners.length === 1) {
          onComplete(newWinners[0], newVotes);
        } else {
          setPool(shuffle(newWinners));
          setBattleIndex(0);
          setWinners([]);
          setSelectedId(null);
          advancing.current = false;
        }
      }
    }, 500);
  }, [selectedId, winners, battleIndex, totalBattles, sessionVotes, roundLabel, bodyPart, gymId, onComplete]);

  // Edge case: odd machine or pool < 2
  if (!currentPair || pool.length < 2) {
    const last = pool[0] ?? winners[0];
    if (last) setTimeout(() => onComplete(last, sessionVotes), 0);
    return null;
  }

  const [machineA, machineB] = currentPair;
  const progress = (battleIndex + (selectedId ? 1 : 0)) / totalBattles;

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="light-content" />

      {/* Nav */}
      <View style={s.nav}>
        <TouchableOpacity style={s.navBtn} onPress={onBack} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={20} color={C.text} />
        </TouchableOpacity>
        <View style={s.navCenter}>
          <Text style={[s.roundLabel, { color: accentColor }]}>{roundLabel}</Text>
          <Text style={s.battleSub}>
            {bodyPart}{category !== '전체' ? ` · ${category}` : ''} · {battleIndex + 1}/{totalBattles}경기
          </Text>
        </View>
        <TouchableOpacity style={s.navBtn} onPress={onClose} activeOpacity={0.7}>
          <Ionicons name="close" size={20} color={C.textSub} />
        </TouchableOpacity>
      </View>

      {/* Battle area — fills remaining space */}
      <View style={s.battleArea}>
        {/* Machine A */}
        <OlympicTradingCard
          machine={machineA}
          width={CARD_W}
          selected={selectedId === machineA.id}
          selectedColor={accentColor}
          onPress={() => handleSelect(machineA, machineB)}
        />

        {/* VS — absolute overlay so it doesn't shrink card widths */}
        <View style={s.vsWrap} pointerEvents="none">
          <View style={[s.vsCircle, { borderColor: accentColor + '50' }]}>
            <Text style={[s.vsText, { color: accentColor }]}>VS</Text>
          </View>
        </View>

        {/* Machine B */}
        <OlympicTradingCard
          machine={machineB}
          width={CARD_W}
          selected={selectedId === machineB.id}
          selectedColor={accentColor}
          onPress={() => handleSelect(machineB, machineA)}
        />
      </View>

      {/* Progress bar */}
      <View style={s.progressWrap}>
        <Text style={s.progressLabel}>
          {pool.length}강 · {battleIndex + 1}/{totalBattles}
        </Text>
        <View style={s.progressBar}>
          <View
            style={[s.progressFill, {
              width: `${Math.round(progress * 100)}%`,
              backgroundColor: accentColor,
            }]}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },

  nav: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 8, paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border,
  },
  navBtn:    { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  navCenter: { flex: 1, alignItems: 'center', gap: 2 },
  roundLabel:{ fontSize: 20, fontWeight: '900', letterSpacing: 0.5 },
  battleSub: { ...T.micro, color: C.textSub },

  battleArea: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: H_PAD,
    gap: CARD_GAP,
  },

  vsWrap:   { position: 'absolute', left: 0, right: 0, alignItems: 'center', zIndex: 10 },
  vsCircle: {
    width: 34, height: 34, borderRadius: 17,
    borderWidth: 1.5, justifyContent: 'center', alignItems: 'center',
    backgroundColor: C.surfaceHigh,
  },
  vsText: { fontSize: 11, fontWeight: '900', letterSpacing: 0.5 },

  progressWrap: { paddingHorizontal: 16, paddingBottom: 20, gap: 6 },
  progressLabel:{ ...T.micro, color: C.textSub, textAlign: 'center' },
  progressBar:  { height: 4, backgroundColor: C.surfaceHigh, borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: 4, borderRadius: 2 },
});
