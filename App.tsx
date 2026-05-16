import React, { useEffect, useState } from 'react';
import { View, Image, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { onAuthStateChanged } from 'firebase/auth';
import { Ionicons } from '@expo/vector-icons';

import { auth } from './src/services/firebase';
import { upsertUser, getUser } from './src/services/api';
import { useAuthStore } from './src/store/authStore';
import { useOnboardingStore } from './src/store/onboardingStore';
import { useStreakManager } from './src/hooks/useStreakManager';
import { useWeeklyRecapTrigger } from './src/hooks/useWeeklyRecapTrigger';
import WeeklyRecapModal from './src/components/WeeklyRecapModal';
import { useBadgeWatchers } from './src/hooks/useBadgeWatchers';
import { useXpWatchers } from './src/hooks/useXpWatchers';
import { useChallengeRotation } from './src/hooks/useChallengeRotation';
import BadgeToastHost from './src/components/BadgeToastHost';
import ChallengeToastHost from './src/components/ChallengeToastHost';
import RankUpCelebrationHost from './src/components/RankUpCelebrationHost';
import { colors } from './src/theme';

import DashboardScreen    from './src/screens/DashboardScreen';
import TradingScreen      from './src/screens/TradingScreen';
import LeaderboardScreen  from './src/screens/LeaderboardScreen';
import JournalScreen      from './src/screens/JournalScreen';
// ChallengesScreen retired from the tab bar 2026-05-14 — the
// dashboard's "Challenges" section is the placeholder for now.
// Component file is preserved for a future re-wire.
import SettingsScreen     from './src/screens/SettingsScreen';
import { useJournalStore } from './src/store/journalStore';
import OnboardingSplashScreen    from './src/screens/OnboardingSplashScreen';
import OnboardingPremiseScreen   from './src/screens/OnboardingPremiseScreen';
import OnboardingArchetypeScreen from './src/screens/OnboardingArchetypeScreen';
import OnboardingIdentityScreen   from './src/screens/OnboardingIdentityScreen';
import OnboardingExperienceScreen from './src/screens/OnboardingExperienceScreen';
import OnboardingAccountSizeScreen from './src/screens/OnboardingAccountSizeScreen';
import OnboardingTraderNameScreen  from './src/screens/OnboardingTraderNameScreen';
import OnboardingCommitmentScreen  from './src/screens/OnboardingCommitmentScreen';
import OnboardingFirstTradeScreen  from './src/screens/OnboardingFirstTradeScreen';
import OnboardingRankRevealScreen  from './src/screens/OnboardingRankRevealScreen';
import OnboardingPlanSummaryScreen from './src/screens/OnboardingPlanSummaryScreen';
import OnboardingAuthScreen        from './src/screens/OnboardingAuthScreen';
import OnboardingWelcomeScreen     from './src/screens/OnboardingWelcomeScreen';

const Stack = createNativeStackNavigator();
const Tab   = createBottomTabNavigator();

function MainTabs() {
  // Streak daily-check runs when the user enters the main app
  // (post-onboarding) and on every background → foreground.
  useStreakManager();

  // Sunday Wrap: auto-decides whether to surface the weekly recap
  // on app open (once per mount). Renders the modal as an overlay
  // sibling of the tab navigator below.
  const { recap: weeklyRecap, dismiss: dismissRecap } = useWeeklyRecapTrigger();

  // Achievement badges: full re-evaluation on entry + streak/freeze
  // subscription. Trade/journal/daily-setup/watchlist triggers fire
  // at their call sites in TradingScreen.
  useBadgeWatchers();

  // Streak XP (daily-goal / maintain / milestone) via a streakStore
  // subscription — keeps streakStore free of an xpStore import.
  useXpWatchers();

  // Challenge rotation — refresh dailies/weekly/monthly on open
  // and on background → foreground.
  useChallengeRotation();

  // Load persisted journal entries from AsyncStorage so the
  // dashboard's stats + recent-trades section have real data on
  // first paint. `hydrate` is idempotent; calling it again on
  // re-mount is harmless.
  React.useEffect(() => {
    useJournalStore.getState().hydrate().catch(() => {});
  }, []);

  const insets = useSafeAreaInsets();
  const bottomInset = Math.max(insets.bottom, 4);
  return (
    <>
    <Tab.Navigator
      initialRouteName="Dashboard"
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
        // With 4 tabs (was 5), the labels (DASHBOARD / CHART /
        // JOURNAL / LEADERBOARD) fit without truncation at 10 px.
        // The CHALLENGES tab was retired — its content lives as
        // a placeholder section inside the dashboard.
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '700',
          letterSpacing: 1,
          textTransform: 'uppercase',
          marginTop: -3,
        },
        tabBarIconStyle: { marginTop: 0 },
        tabBarIcon: ({ color }) => {
          const iconMap: Record<string, keyof typeof Ionicons.glyphMap> = {
            Dashboard:   'home-outline',
            Chart:       'analytics-outline',
            Journal:     'journal-outline',
            Leaderboard: 'trophy-outline',
          };
          return <Ionicons name={iconMap[route.name] ?? 'help'} size={18} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Dashboard"   component={DashboardScreen} />
      <Tab.Screen name="Chart"       component={TradingScreen} />
      <Tab.Screen name="Journal"     component={JournalScreen} />
      <Tab.Screen name="Leaderboard" component={LeaderboardScreen} options={{ tabBarLabel: 'Ranks' }} />
    </Tab.Navigator>
    <WeeklyRecapModal
      visible={weeklyRecap !== null}
      recap={weeklyRecap}
      onClose={dismissRecap}
    />
    <BadgeToastHost />
    <ChallengeToastHost />
    <RankUpCelebrationHost />
    </>
  );
}

export default function App() {
  const setUser = useAuthStore((s) => s.setUser);

  // Routing guard: returning users (onboardingComplete persisted
  // true) skip straight to the main app; everyone else starts at
  // onboarding screen 1. First paint is gated on the onboarding
  // store finishing AsyncStorage rehydration so a returning user
  // never sees a flash of the onboarding flow.
  const onboardingComplete = useOnboardingStore((s) => s.onboardingComplete);
  const handle = useOnboardingStore((s) => s.handle);
  // Pre-flag users finished onboarding before `onboardingComplete`
  // existed — a non-empty persisted `handle` proves they did.
  const skipOnboarding = onboardingComplete || handle.trim().length > 0;
  const [hydrated, setHydrated] = useState(
    useOnboardingStore.persist.hasHydrated(),
  );

  // Backfill the flag once the fallback triggers so the check
  // isn't needed again.
  useEffect(() => {
    if (hydrated && !onboardingComplete && handle.trim().length > 0) {
      useOnboardingStore.getState().setOnboardingComplete(true);
    }
  }, [hydrated, onboardingComplete, handle]);

  useEffect(() => {
    if (hydrated) return;
    const unsub = useOnboardingStore.persist.onFinishHydration(() =>
      setHydrated(true),
    );
    // Safety: never get stuck on the splash if the event misfires.
    const t = setTimeout(() => setHydrated(true), 2500);
    return () => { unsub?.(); clearTimeout(t); };
  }, [hydrated]);

  // Populate the auth store (uid / username) for backend calls when
  // a Firebase session exists. Routing no longer depends on auth —
  // the local onboarding flag governs it — so there's no force
  // sign-out and no auth/disclaimer gate.
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (!user) return;
      const fallbackUsername =
        user.displayName ?? user.email?.split('@')[0] ?? 'Trader';
      setUser(user.uid, fallbackUsername, user.email ?? '');
      getUser(user.uid).then((dbUser) => {
        if (dbUser?.username) {
          setUser(user.uid, dbUser.username, user.email ?? '');
        }
      }).catch(() => {});
      upsertUser(user.uid, fallbackUsername, user.email ?? '').catch(() => {});
    });
    return unsub;
  }, [setUser]);

  if (!hydrated) {
    return <SafeAreaProvider><LoadingSplash /></SafeAreaProvider>;
  }

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <Stack.Navigator
          initialRouteName={skipOnboarding ? 'Main' : 'OnboardingSplash'}
          screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#000000' } }}
        >
          <Stack.Screen name="OnboardingSplash"    component={OnboardingSplashScreen} />
          <Stack.Screen name="OnboardingPremise"   component={OnboardingPremiseScreen}   options={{ gestureEnabled: false }} />
          <Stack.Screen name="OnboardingArchetype" component={OnboardingArchetypeScreen} options={{ gestureEnabled: false }} />
          <Stack.Screen name="OnboardingIdentity"   component={OnboardingIdentityScreen}   options={{ gestureEnabled: false }} />
          <Stack.Screen name="OnboardingExperience"  component={OnboardingExperienceScreen}  options={{ gestureEnabled: false }} />
          <Stack.Screen name="OnboardingAccountSize" component={OnboardingAccountSizeScreen} options={{ gestureEnabled: false }} />
          <Stack.Screen name="OnboardingTraderName"  component={OnboardingTraderNameScreen}  options={{ gestureEnabled: false }} />
          <Stack.Screen name="OnboardingCommitment"  component={OnboardingCommitmentScreen}  options={{ gestureEnabled: false }} />
          <Stack.Screen name="OnboardingFirstTrade"  component={OnboardingFirstTradeScreen}  options={{ gestureEnabled: false }} />
          <Stack.Screen name="OnboardingRankReveal"  component={OnboardingRankRevealScreen}  options={{ gestureEnabled: false }} />
          <Stack.Screen name="OnboardingPlanSummary" component={OnboardingPlanSummaryScreen} options={{ gestureEnabled: false }} />
          <Stack.Screen name="OnboardingAuth"        component={OnboardingAuthScreen}        options={{ gestureEnabled: false }} />
          <Stack.Screen name="OnboardingWelcome"     component={OnboardingWelcomeScreen}     options={{ gestureEnabled: false }} />
          {/* Hand-off destination: screen 12 (or Settings → Redo
              Onboarding) navigation.reset's between these. */}
          <Stack.Screen name="Main"                  component={MainTabs}                    options={{ gestureEnabled: false }} />
          {/* Pushed from the dashboard gear icon — slides in over
              the tab navigator with its own in-screen back button. */}
          <Stack.Screen name="Settings"              component={SettingsScreen} />
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
