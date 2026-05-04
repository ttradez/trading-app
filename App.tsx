import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { onAuthStateChanged } from 'firebase/auth';
import { Text, View, StyleSheet, TouchableOpacity } from 'react-native';
import { auth } from './src/services/firebase';
import { upsertUser } from './src/services/api';
import { useAuthStore } from './src/store/authStore';

import LoginScreen       from './src/screens/LoginScreen';
import SignupScreen      from './src/screens/SignupScreen';
import DashboardScreen   from './src/screens/DashboardScreen';
import MarketsScreen     from './src/screens/MarketsScreen';
import TradingScreen     from './src/screens/TradingScreen';
import LeaderboardScreen from './src/screens/LeaderboardScreen';
import DisclaimerScreen  from './src/screens/DisclaimerScreen';

const Stack = createNativeStackNavigator();
const Tab   = createBottomTabNavigator();

const TAB_ICON: Record<string, string> = {
  Dashboard: '📊', Markets: '🌐', Leaderboard: '🏆',
};

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: { backgroundColor: '#161b22', borderTopColor: '#30363d' },
        tabBarActiveTintColor: '#58a6ff',
        tabBarInactiveTintColor: '#8b949e',
        tabBarIcon: () => <Text style={{ fontSize: 18 }}>{TAB_ICON[route.name]}</Text>,
      })}
    >
      <Tab.Screen name="Dashboard"   component={DashboardScreen} />
      <Tab.Screen name="Markets"     component={MarketsScreen} />
      <Tab.Screen name="Leaderboard" component={LeaderboardScreen} />
    </Tab.Navigator>
  );
}

export default function App() {
  const { setUser, setReady, isReady } = useAuthStore();
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [disclaimerDone, setDisclaimerDone] = useState(false);

  useEffect(() => {
    return onAuthStateChanged(auth, async (user) => {
      if (user) {
        const username = user.displayName ?? user.email?.split('@')[0] ?? 'Trader';
        setUser(user.uid, username, user.email ?? '');
        // Ensure user+account rows exist in our SQLite backend
        await upsertUser(user.uid, username, user.email ?? '').catch(() => {});
        setAuthed(true);
      } else {
        setAuthed(false);
      }
      setReady();
    });
  }, []);

  if (!isReady) return null;

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!authed ? (
          <>
            <Stack.Screen name="Login"  component={LoginScreen} />
            <Stack.Screen name="Signup" component={SignupScreen} />
          </>
        ) : !disclaimerDone ? (
          <Stack.Screen name="Disclaimer">
            {() => <DisclaimerScreen onAccept={() => setDisclaimerDone(true)} />}
          </Stack.Screen>
        ) : (
          <>
            <Stack.Screen name="Main" component={MainTabs} />
            <Stack.Screen
              name="Trading"
              component={TradingScreen}
              options={{
                headerShown: true,
                title: 'Practice Session',
                headerStyle: { backgroundColor: '#161b22' },
                headerTintColor: '#e6edf3',
                headerTitleStyle: { fontWeight: '700' },
              }}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
