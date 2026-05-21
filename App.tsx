import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { onAuthStateChanged } from 'firebase/auth';
import { Ionicons } from '@expo/vector-icons';
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_900Black,
} from '@expo-google-fonts/inter';
import {
  JetBrainsMono_400Regular,
  JetBrainsMono_500Medium,
  JetBrainsMono_700Bold,
} from '@expo-google-fonts/jetbrains-mono';

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
import ChallengeToastHost from './src/components/ChallengeToastHost';
import CelebrationHost from './src/components/CelebrationHost';
import { useCelebrationTriggers } from './src/hooks/useCelebrationTriggers';
import { colors } from './src/theme';

import HomeScreen         from './src/screens/HomeScreen';
import StatsScreen        from './src/screens/StatsScreen';
import LearnScreen        from './src/screens/LearnScreen';
import TradingScreen      from './src/screens/TradingScreen';
import LeaderboardScreen  from './src/screens/LeaderboardScreen';
import JournalScreen      from './src/screens/JournalScreen';
// ChallengesScreen retired from the tab bar 2026-05-14 — the
// dashboard's "Challenges" section is the placeholder for now.
// Component file is preserved for a future re-wire.
import SettingsScreen     from './src/screens/SettingsScreen';
import SetupLibraryScreen from './src/screens/SetupLibraryScreen';
import SetupDetailScreen  from './src/screens/SetupDetailScreen';
import InsightsScreen     from './src/screens/InsightsScreen';
import AccountDetailScreen from './src/screens/AccountDetailScreen';
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

  // Unified celebration moments (badge unlock / rank up / streak
  // milestone). Pure observer — no business-logic side-effects.
  useCelebrationTriggers();

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
      initialRouteName="Home"
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
        // 5 tabs at 10pt label — fits without truncation. Chart was
        // removed from the bottom nav (now a stack screen reached
        // from Today's Mission / saved setups / empty-state CTAs).
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '700',
          letterSpacing: 1,
          textTransform: 'uppercase',
          marginTop: -3,
        },
        tabBarIconStyle: { marginTop: 0 },
        tabBarIcon: ({ color, focused }) => {
          // Filled when active, line when inactive. Lucide names
          // mapped to Ionicons (lucide-react-native isn't a dep).
          //   Home  → home          Stats → stats-chart
          //   Journal → journal     Learn → school (≈ GraduationCap)
          //   Leaderboard (label "RANKS") → trophy
          const filled: Record<string, keyof typeof Ionicons.glyphMap> = {
            Home:        'home',
            Stats:       'stats-chart',
            Journal:     'journal',
            Learn:       'school',
            Leaderboard: 'trophy',
          };
          const outline: Record<string, keyof typeof Ionicons.glyphMap> = {
            Home:        'home-outline',
            Stats:       'stats-chart-outline',
            Journal:     'journal-outline',
            Learn:       'school-outline',
            Leaderboard: 'trophy-outline',
          };
          const name = (focused ? filled : outline)[route.name] ?? 'help';
          return (
            <View style={tabStyles.iconWrap}>
              {focused && <View style={tabStyles.activeDot} />}
              <Ionicons name={name} size={18} color={color} />
            </View>
          );
        },
        // Custom label so the active tab gets a 16×2 gold underline
        // — a physical "selected" cue beyond color alone.
        tabBarLabel: ({ focused }) => {
          const labelMap: Record<string, string> = {
            Home:        'HOME',
            Stats:       'STATS',
            Journal:     'JOURNAL',
            Learn:       'LEARN',
            // Internal route name stayed "Leaderboard" to avoid a
            // ripple of nav-call renames; the visible tab label is
            // RANKS per spec.
            Leaderboard: 'RANKS',
          };
          return (
            <View style={tabStyles.labelWrap}>
              <Text
                style={[
                  tabStyles.label,
                  { color: focused ? colors.gold : colors.textSecondary },
                ]}
                numberOfLines={1}
              >
                {labelMap[route.name] ?? route.name.toUpperCase()}
              </Text>
              <View
                style={[
                  tabStyles.underline,
                  focused && tabStyles.underlineActive,
                ]}
              />
            </View>
          );
        },
      })}
    >
      <Tab.Screen name="Home"        component={HomeScreen} />
      <Tab.Screen name="Stats"       component={StatsScreen} />
      <Tab.Screen name="Journal"     component={JournalScreen} />
      <Tab.Screen name="Learn"       component={LearnScreen} />
      <Tab.Screen name="Leaderboard" component={LeaderboardScreen} />
    </Tab.Navigator>
    <WeeklyRecapModal
      visible={weeklyRecap !== null}
      recap={weeklyRecap}
      onClose={dismissRecap}
    />
    <ChallengeToastHost />
    </>
  );
}

export default function App() {
  const setUser = useAuthStore((s) => s.setUser);

  // Bundled font families — JetBrains Mono for numerals,
  // Inter for everything else (no Display optical variant
  // available in @expo-google-fonts/inter at the time of writing;
  // headings reuse Inter Bold/Black, see src/theme/index.ts).
  // Picked weights only — keeps the bundle small (8 ttf files).
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_900Black,
    JetBrainsMono_400Regular,
    JetBrainsMono_500Medium,
    JetBrainsMono_700Bold,
  });

  // First paint is still gated on the onboarding store finishing
  // AsyncStorage rehydration so the persisted stores are ready
  // before MainTabs reads them.
  const [hydrated, setHydrated] = useState(
    useOnboardingStore.persist.hasHydrated(),
  );

  // Firebase auth resolution: 'loading' until the first
  // onAuthStateChanged fires (it restores any persisted session),
  // then 'authenticated' / 'unauthenticated'.
  const [authState, setAuthState] =
    useState<'loading' | 'authenticated' | 'unauthenticated'>('loading');

  // Navigator remount epoch — bumped ONLY on the authenticated →
  // unauthenticated edge (Sign Out) so the routing guard re-applies
  // `initialRoute` and lands on the auth screen. Sign-IN is left to
  // `finishAuth`'s explicit navigation (returning → Main, brand-new
  // → OnboardingWelcome) so we don't clobber the welcome handoff.
  const [navEpoch, setNavEpoch] = useState(0);
  const prevAuthRef = useRef<typeof authState>('loading');
  useEffect(() => {
    if (
      prevAuthRef.current === 'authenticated' &&
      authState === 'unauthenticated'
    ) {
      setNavEpoch((n) => n + 1);
    }
    prevAuthRef.current = authState;
  }, [authState]);

  // For an UNAUTHENTICATED user: someone who has onboarded before
  // (or has local profile data) goes straight to the auth screen to
  // just sign in; a genuinely brand-new device starts onboarding.
  // `onboardingComplete` survives Sign Out (it's a device-lifecycle
  // fact, not user data) so a signed-out returning user lands on
  // the auth screen rather than the full 13-screen flow.
  const handle = useOnboardingStore((s) => s.handle);
  const onboardingComplete = useOnboardingStore((s) => s.onboardingComplete);

  useEffect(() => {
    if (hydrated) return;
    const unsub = useOnboardingStore.persist.onFinishHydration(() =>
      setHydrated(true),
    );
    // Safety: never get stuck on the splash if the event misfires.
    const t = setTimeout(() => setHydrated(true), 2500);
    return () => { unsub?.(); clearTimeout(t); };
  }, [hydrated]);

  // The single Firebase auth-state listener: resolves the routing
  // guard AND populates the auth store / best-effort backend upsert
  // when a session exists. The first callback fires once Firebase
  // has restored (or not) the persisted session.
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user) {
        const fallbackUsername =
          user.displayName ?? user.email?.split('@')[0] ?? 'Trader';
        setUser(user.uid, fallbackUsername, user.email ?? '');
        getUser(user.uid).then((dbUser) => {
          if (dbUser?.username) {
            setUser(user.uid, dbUser.username, user.email ?? '');
          }
        }).catch(() => {});
        upsertUser(user.uid, fallbackUsername, user.email ?? '').catch(() => {});
        setAuthState('authenticated');
      } else {
        setAuthState('unauthenticated');
      }
    });
    return unsub;
  }, [setUser]);

  // Gate first paint on store rehydration, Firebase auth resolution,
  // AND font load — flashing the wrong family on the first render
  // would show the system fallback before snapping to Inter/JBM.
  if (!hydrated || authState === 'loading' || !fontsLoaded) {
    return <SafeAreaProvider><LoadingSplash /></SafeAreaProvider>;
  }

  // Routing guard:
  //  - authenticated            → main tabs (dashboard)
  //  - unauth + local handle    → auth screen (just sign in)
  //  - unauth + no local data   → onboarding from screen 1
  const initialRoute =
    authState === 'authenticated'
      ? 'Main'
      : onboardingComplete || handle.trim().length > 0
        ? 'OnboardingAuth'
        : 'OnboardingSplash';

  return (
    <SafeAreaProvider>
      {/* Unified celebration overlay (badge / rank / streak). Sibling
          of NavigationContainer so it floats above any screen,
          including onboarding. Host is a no-op until something
          enqueues; the modal handles its own visible state. */}
      <CelebrationHost />
      <NavigationContainer>
        {/* Remount on the Sign-Out edge (navEpoch) so the guard
            re-applies `initialRoute` and lands on the auth screen —
            the routing guard itself doing the navigation, no
            per-screen reset hack. */}
        <Stack.Navigator
          key={navEpoch}
          initialRouteName={initialRoute}
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
          {/* Chart — was a bottom-tab screen until the 5-tab restructure;
              now lives at the stack level so "Trade this setup" and
              other deep-link CTAs push it full-screen over the tabs.
              navigation.navigate('Chart', ...) from any tab screen
              still finds it via React Navigation's parent search. */}
          <Stack.Screen name="Chart"                 component={TradingScreen} />
          {/* Pushed from the dashboard gear icon — slides in over
              the tab navigator with its own in-screen back button. */}
          <Stack.Screen name="Settings"              component={SettingsScreen} />
          {/* Setup Library — pushed from the dashboard card and the
              chart header book icon. Detail deep-links into a replay
              via the nested Chart tab. */}
          <Stack.Screen name="SetupLibrary"          component={SetupLibraryScreen} />
          <Stack.Screen name="SetupDetail"           component={SetupDetailScreen} />
          {/* "Your Tendencies" — pushed from the Journal card and
              the dashboard insights link. */}
          <Stack.Screen name="Insights"              component={InsightsScreen} />
          {/* Account performance detail — stub destination for the
              Dashboard Account hero card tap (§3.1). */}
          <Stack.Screen name="AccountDetail"         component={AccountDetailScreen} />
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

const tabStyles = StyleSheet.create({
  labelWrap: { alignItems: 'center', marginTop: -3 },
  label: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  underline: {
    marginTop: 3,
    width: 16,
    height: 2,
    borderRadius: 1,
    backgroundColor: 'transparent',
  },
  underlineActive: { backgroundColor: colors.gold },
  iconWrap: {
    width: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Tiny gold dot at the iOS-badge position above the active icon.
  activeDot: {
    position: 'absolute',
    top: -3,
    right: 1,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.gold,
  },
});
