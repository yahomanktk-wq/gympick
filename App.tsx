import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from './src/context/AuthContext';
import TabNavigator from './src/navigation/TabNavigator';
import WorkoutFeedScreen from './src/screens/WorkoutFeedScreen';
import WorkoutAnalyticsScreen from './src/screens/WorkoutAnalyticsScreen';
import MachineRankingScreen   from './src/screens/MachineRankingScreen';
import MachineHistoryScreen   from './src/screens/MachineHistoryScreen';

const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <AuthProvider>
      <SafeAreaProvider>
        <NavigationContainer>
          <Stack.Navigator screenOptions={{ headerShown: false, gestureEnabled: false }}>
            <Stack.Screen name="Main"              component={TabNavigator}            options={{ gestureEnabled: false }} />
            <Stack.Screen name="WorkoutFeed"      component={WorkoutFeedScreen}       options={{ gestureEnabled: true, fullScreenGestureEnabled: true }} />
            <Stack.Screen name="WorkoutAnalytics" component={WorkoutAnalyticsScreen}  options={{ gestureEnabled: true, fullScreenGestureEnabled: true }} />
            <Stack.Screen name="MachineRanking"   component={MachineRankingScreen}    options={{ gestureEnabled: true, fullScreenGestureEnabled: true }} />
            <Stack.Screen name="MachineHistory"   component={MachineHistoryScreen}    options={{ gestureEnabled: true, fullScreenGestureEnabled: true }} />
          </Stack.Navigator>
        </NavigationContainer>
        <StatusBar style="light" />
      </SafeAreaProvider>
    </AuthProvider>
  );
}
