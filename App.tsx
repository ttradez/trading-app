import React, { useEffect, useState } from 'react';
import { View, Image, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { onAuthStateChanged } from 'firebase/auth';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { auth } from './src/services/firebase';
import { upsertUser, getUser } from './src/services/api';
import { useAuthStore } from './src/store/authStore';
import { colors } from './src/theme';

import LoginScreen        from './src/screens/LoginScreen';
import AccountSetupScreen from './src/screens/AccountSetupScreen';
import FeatureTourScreen  from './src/screens/FeatureTourScreen';
import DashboardScreen    from './src/screens/DashboardScreen';
import TradingScreen      from './src/screens/TradingScreen';
import LeaderboardScreen  from './src/screens/LeaderboardScreen';
import JournalScreen      from './src/screens/JournalScreen';
import ChallengesScreen   from './src/screens/ChallengesScreen';
import DisclaimerScreen   from './src/screens/DisclaimerScreen';

const Stack = createNativeStackNavigator();
const Tab   = createBottomTabNavigator();

const DISCLAIMER_KEY = '@pocket_trade_disclaimer_accepted';

function MainTabs() {
  const insets = useSafeAreaInsets();
  const bottomInset = Math.max(insets.bottom, 4);
  return (
    <Tab.Navigator
      initialRouteName="Chart"
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          height: 46 + bottomInset,
          paddingTop: 4,
          paddingBottom: bottomInset,
        },
        tabBarActiveTintColor: colors.gold,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarLabelStyle: {
          fontSize: 8,
          fontWeight: '700',
          letterSpacing: 1.2,
          textTransform: 'uppercase',
          marginTop: -3,
        },
        tabBarIconStyle: { marginTop: 0 },
        tabBarIcon: ({ color }) => {
          const iconMap: Record<string, keyof typeof Ionicons.glyphMap> = {
            Dashboard:   'home-outline',
            Chart:       'analytics-outline',
            Journal:     'journal-outline',
            Challenges:  'flame-outline',
            Leaderboard: 'trophy-outline',
          };
          return <Ionicons name={iconMap[route.name] ?? 'help'} size={16} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Dashboard"   component={DashboardScreen} />
      <Tab.Screen name="Chart"       component={TradingScreen} />
      <Tab.Screen name="Journal"     component={JournalScreen} />
      <Tab.Screen name="Challenges"  component={ChallengesScreen} />
      <Tab.Screen name="Leaderboard" component={LeaderboardScreen} />
    </Tab.Navigator>
  );
}

export default function App() {
  const { setUser, setReady, isReady } = useAuthStore();
  const [authed, setAuthed]               = useState<boolean | null>(null);
  const [disclaimerAccepted, setDisclaimerAccepted] = useState<boolean | null>(null);

  useEffect(() => {
    // Failsafe: if AsyncStorage hangs (happens with v3 on some platforms),
    // default to "not accepted" after 2.5s so the app never gets stuck on splash.
    const dTimeout = setTimeout(() => {
      setDisclaimerAccepted((curr) => (curr === null ? false : curr));
    }, 2500);

    AsyncStorage.getItem(DISCLAIMER_KEY)
      .then((v) => setDisclaimerAccepted(v === '1'))
      .catch(() => setDisclaimerAccepted(false))
      .finally(() => clearTimeout(dTimeout));

    // Failsafe: if Firebase auth fails to fire onAuthStateChanged,
    // assume no user after 4s so the app moves on.
    const aTimeout = setTimeout(() => {
      setAuthed((curr) => (curr === null ? false : curr));
      setReady();
    }, 4000);

    const unsub = onAuthStateChanged(auth, (user) => {
      clearTimeout(aTimeout);
      if (!user) {
        setAuthed(false);
        setReady();
        return;
      }

      // Set authed immediately with whatever username we have, then
      // refine it from the backend asynchronously (no blocking).
      const fallbackUsername = user.displayName ?? user.email?.split('@')[0] ?? 'Trader';
      setUser(user.uid, fallbackUsername, user.email ?? '');
      setAuthed(true);
      setReady();

      // Background — pull the proper username + ensure user/account row exist.
      getUser(user.uid).then((dbUser) => {
        if (dbUser?.username) {
          setUser(user.uid, dbUser.username, user.email ?? '');
        }
      }).catch(() => {});
      upsertUser(user.uid, fallbackUsername, user.email ?? '').catch(() => {});
    });
    return () => { clearTimeout(dTimeout); clearTimeout(aTimeout); unsub(); };
  }, []);

  const handleAcceptDisclaimer = async () => {
    await AsyncStorage.setItem(DISCLAIMER_KEY, '1');
    setDisclaimerAccepted(true);
  };

  if (!isReady || disclaimerAccepted === null) {
    return <SafeAreaProvider><LoadingSplash /></SafeAreaProvider>;
  }

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
          {!disclaimerAccepted ? (
            <Stack.Screen name="Disclaimer">
              {() => <DisclaimerScreen onAccept={handleAcceptDisclaimer} />}
            </Stack.Screen>
          ) : !authed ? (
            <>
              <Stack.Screen name="AccountSetup" component={AccountSetupScreen} />
              <Stack.Screen name="Login"        component={LoginScreen} />
              <Stack.Screen name="FeatureTour"  component={FeatureTourScreen} />
            </>
          ) : (
            <>
              <Stack.Screen name="Main"         component={MainTabs} />
              <Stack.Screen name="FeatureTour"  component={FeatureTourScreen} />
            </>
          )}
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

function LoadingSplash() {
  return (
    <View style={styles.splash}>
      <Image
        source={require('./assets/logo.png')}
        style={{ width: 240, height: 240, resizeMode: 'contain' }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  splash: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
});
