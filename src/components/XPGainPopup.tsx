import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
} from 'react-native';
import { C, R } from '../theme';
import { MachineLevelData } from '../data/types';
import { getLevelProgress, getLevelTitle } from '../lib/machineLevelUtils';
import MachineLevelBadge from './MachineLevelBadge';

const SCREEN_W = Dimensions.get('window').width;
const BAR_W    = SCREEN_W - 32 - 48; // popup padding

type XPResult = {
  baseXP:        number;
  prBonus:       number;
  firstUseBonus: number;
  streakBonus:   number;
  totalXP:       number;
};

type Props = {
  visible:     boolean;
  machineName: string;
  xpResult:    XPResult;
  levelData:   MachineLevelData;
  leveledUp:   boolean;
  newLevel:    number;
  onClose:     () => void;
};

// ── Sub-components (module-level) ─────────────────────────────────────────────

function XPRow({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  if (value === 0) return null;
  return (
    <View style={s.xpRow}>
      <Text style={s.xpLabel}>{label}</Text>
      <Text style={[s.xpValue, accent && s.xpValueAccent]}>+{value} XP</Text>
    </View>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function XPGainPopup({
  visible,
  machineName,
  xpResult,
  levelData,
  leveledUp,
  newLevel,
  onClose,
}: Props) {
  const barAnim   = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;

  const { progressRatio, currentLevelXP, requiredXP } = getLevelProgress(levelData);

  useEffect(() => {
    if (!visible) return;

    // XP 바 애니메이션 (0 → progressRatio)
    barAnim.setValue(0);
    Animated.timing(barAnim, {
      toValue:         progressRatio,
      duration:        600,
      useNativeDriver: false,
    }).start();

    // 팝업 scale 스프링
    scaleAnim.setValue(0.8);
    Animated.spring(scaleAnim, {
      toValue:         1,
      friction:        6,
      tension:         120,
      useNativeDriver: true,
    }).start();

    // 2초 후 자동 닫힘
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [visible]);

  if (!visible) return null;

  const prevLevel = leveledUp ? newLevel - 1 : newLevel;

  return (
    <View style={s.overlay}>
      <Animated.View style={[s.popup, { transform: [{ scale: scaleAnim }] }]}>

          {/* ── 레벨업 헤더 ── */}
          {leveledUp && (
            <View style={s.levelUpHeader}>
              <Text style={s.levelUpTitle}>LEVEL UP! 🎉</Text>
              <View style={s.levelUpRow}>
                <Text style={s.levelUpOld}>Lv.{prevLevel}</Text>
                <Text style={s.levelUpArrow}> → </Text>
                <Text style={s.levelUpNew}>Lv.{newLevel}</Text>
              </View>
              <View style={s.levelUpBadgeRow}>
                <MachineLevelBadge level={newLevel} size="medium" />
                <Text style={s.levelUpTitle2}>{getLevelTitle(newLevel)}</Text>
              </View>
            </View>
          )}

          {/* ── 머신명 ── */}
          <Text style={s.machineName} numberOfLines={1}>{machineName}</Text>

          {/* ── XP 내역 ── */}
          <View style={s.xpList}>
            <XPRow label="기본 XP"   value={xpResult.baseXP} />
            <XPRow label="PR 달성 🏆" value={xpResult.prBonus}       accent />
            <XPRow label="첫 사용 🌟" value={xpResult.firstUseBonus} accent />
            <XPRow label="연속 사용 🔥" value={xpResult.streakBonus}  accent />
          </View>
          <View style={s.xpTotal}>
            <Text style={s.xpTotalLabel}>획득 XP</Text>
            <Text style={s.xpTotalValue}>+{xpResult.totalXP} XP</Text>
          </View>

          {/* ── 경험치 바 ── */}
          <View style={s.barWrap}>
            <View style={s.barBg}>
              <Animated.View
                style={[
                  s.barFill,
                  { width: barAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) },
                ]}
              />
            </View>
            <Text style={s.barLabel}>
              {`Lv.${levelData.level} · ${currentLevelXP}/${requiredXP} XP`}
            </Text>
          </View>

          {/* ── 닫기 버튼 ── */}
          <TouchableOpacity style={s.closeBtn} onPress={onClose} activeOpacity={0.8}>
            <Text style={s.closeBtnText}>확인</Text>
          </TouchableOpacity>

      </Animated.View>
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  overlay: {
    position:        'absolute',
    top:             0,
    left:            0,
    right:           0,
    bottom:          0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems:      'center',
    justifyContent:  'center',
    zIndex:          9999,
  },
  popup: {
    width:             SCREEN_W - 32,
    backgroundColor:   C.surface,
    borderRadius:      R.card,
    padding:           24,
    gap:               12,
  },

  // Level up header
  levelUpHeader: {
    alignItems:      'center',
    paddingBottom:   12,
    borderBottomWidth: 1,
    borderBottomColor: C.border ?? '#2a2a30',
    gap:             6,
  },
  levelUpTitle: {
    fontSize:   22,
    fontWeight: '900',
    color:      '#FFD700',
    letterSpacing: 1,
  },
  levelUpTitle2: {
    fontSize:   16,
    fontWeight: '800',
    color:      C.accent,
    marginLeft: 8,
  },
  levelUpRow: {
    flexDirection: 'row',
    alignItems:    'center',
  },
  levelUpOld: {
    fontSize:   18,
    fontWeight: '700',
    color:      C.textSub,
  },
  levelUpArrow: {
    fontSize:   18,
    color:      C.textDim,
  },
  levelUpNew: {
    fontSize:   22,
    fontWeight: '900',
    color:      C.accent,
  },
  levelUpBadgeRow: {
    flexDirection: 'row',
    alignItems:    'center',
    marginTop:     4,
  },

  // Machine name
  machineName: {
    fontSize:   15,
    fontWeight: '800',
    color:      C.text,
  },

  // XP list
  xpList: {
    gap: 4,
  },
  xpRow: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'center',
  },
  xpLabel: {
    fontSize:   13,
    color:      C.textSub,
    fontWeight: '500',
  },
  xpValue: {
    fontSize:   13,
    fontWeight: '700',
    color:      C.text,
  },
  xpValueAccent: {
    color: C.accent,
  },

  // XP total
  xpTotal: {
    flexDirection:     'row',
    justifyContent:    'space-between',
    paddingTop:        8,
    borderTopWidth:    1,
    borderTopColor:    C.border ?? '#2a2a30',
  },
  xpTotalLabel: {
    fontSize:   14,
    fontWeight: '700',
    color:      C.text,
  },
  xpTotalValue: {
    fontSize:   16,
    fontWeight: '900',
    color:      C.accent,
  },

  // XP bar
  barWrap: {
    gap: 6,
  },
  barBg: {
    height:        8,
    borderRadius:  4,
    backgroundColor: '#2a2a30',
    overflow:      'hidden',
  },
  barFill: {
    height:        '100%',
    borderRadius:  4,
    backgroundColor: C.accent,
  },
  barLabel: {
    fontSize:   11,
    color:      C.textDim,
    fontWeight: '500',
  },

  // Close button
  closeBtn: {
    backgroundColor: C.accent,
    borderRadius:    R.btn,
    paddingVertical: 12,
    alignItems:      'center',
    marginTop:       4,
  },
  closeBtnText: {
    fontSize:   14,
    fontWeight: '800',
    color:      C.bg,
  },
});
