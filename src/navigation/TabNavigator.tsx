import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C } from '../theme';

import HomeScreen       from '../screens/HomeScreen';
import FindGymScreen    from '../screens/FindGymScreen';
import LogWorkoutScreen from '../screens/LogWorkoutScreen';
import JournalScreen   from '../screens/JournalScreen';
import ProfileScreen    from '../screens/ProfileScreen';

// --- Types

type TabParamList = {
  Home:       undefined;
  FindGym:    undefined;
  LogWorkout: undefined;
  Journal:    undefined;
  Profile:    undefined;
};

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

interface TabCfg {
  active:   IoniconName;
  inactive: IoniconName;
  label:    string;
  size?:    number;
  center?:  boolean; // visually emphasised action tab
}

const TAB_CFG: Record<keyof TabParamList, TabCfg> = {
  Home:       { active: 'home',       inactive: 'home-outline',        label: '홈'       },
  FindGym:    { active: 'map',        inactive: 'map-outline',          label: '검색'     },
  LogWorkout: { active: 'add-circle', inactive: 'add-circle-outline',   label: '기록하기', size: 29, center: true },
  Journal:    { active: 'book',       inactive: 'book-outline',         label: '운동일지' },
  Profile:    { active: 'person',     inactive: 'person-outline',       label: '프로필'   },
};

// --- Tab item

function TabItem({ name, focused }: { name: keyof TabParamList; focused: boolean }) {
  const cfg   = TAB_CFG[name];
  const size  = cfg.size ?? 23;
  const color = (cfg.center || focused) ? C.accent : C.textSub;

  return (
    <View style={[tabSt.item, cfg.center && tabSt.centerItem]}>
      {cfg.center && <View style={tabSt.centerRing} />}
      <Ionicons
        name={focused ? cfg.active : cfg.inactive}
        size={size}
        color={color}
      />
      <Text style={[tabSt.label, { color }]} numberOfLines={1}>{cfg.label}</Text>
    </View>
  );
}

// --- Navigator

const Tab = createBottomTabNavigator<TabParamList>();

export default function TabNavigator() {
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown:     false,
        tabBarShowLabel: false,
        tabBarStyle: {
          ...tabSt.bar,
          height:        Platform.OS === 'ios' ? 80 + insets.bottom : 56 + insets.bottom,
          paddingBottom: Platform.OS === 'ios' ? insets.bottom + 16 : insets.bottom > 0 ? insets.bottom : 8,
        },
        tabBarIcon:      ({ focused }) => (
          <TabItem name={route.name as keyof TabParamList} focused={focused} />
        ),
      })}
    >
      <Tab.Screen name="Home"       component={HomeScreen}       />
      <Tab.Screen name="FindGym"    component={FindGymScreen}    />
      <Tab.Screen name="LogWorkout" component={LogWorkoutScreen} />
      <Tab.Screen name="Journal"    component={JournalScreen}    />
      <Tab.Screen name="Profile"    component={ProfileScreen}    />
    </Tab.Navigator>
  );
}

// --- Styles

const tabSt = StyleSheet.create({
  bar: {
    backgroundColor: C.surface,
    borderTopWidth:  1,
    borderTopColor:  C.border,
    elevation:       0,
    shadowOpacity:   0,
  },

  item: {
    alignItems:     'center',
    justifyContent: 'center',
    gap:            4,
    paddingTop:     6,
  },

  // Center "Log" tab gets a subtle ring behind the icon
  centerItem: {
    position: 'relative',
  },
  centerRing: {
    position:        'absolute',
    width:           48,
    height:          48,
    borderRadius:    24,
    backgroundColor: C.accentBg,
    borderWidth:     1,
    borderColor:     C.accent + '30',
    top:             -2,
  },

  label: {
    fontSize:      8,
    fontWeight:    '700',
    letterSpacing: 0,
    textAlign:     'center',
  },
});
