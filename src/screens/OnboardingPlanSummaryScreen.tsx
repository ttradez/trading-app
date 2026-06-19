import React, { useEffect, useRef } from 'react';
import {
  View, Text, Pressable, Animated, StyleSheet, StatusBar, ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import {
  useOnboardingStore, Archetype, Identity, ExperienceLevel, DailyCommitment,
} from '../store/onboardingStore';

/**
 * Onboarding screen 11 (new) — Plan Summary.
 *
 * Inserted between Rank Reveal (10) and Auth (was 11, now 12) per
 * docs/ONBOARDING_AUDIT.md. The audit flagged a gap: 10 screens of
 * user input → auth ask, with nothing that makes those inputs feel
 * earned. This screen synthesizes everything captured so far into
 * one composed card so the user feels the plan was *built for them*
 * before being asked to save it.
 *
 * Reads only — never writes. The data available at this point is
 * archetype, identity, experienceLevel, accountSize, handle,
 * displayName, dailyCommitment, firstTrade. `dailyTimeGoalMinutes`
 * is NOT yet set — that's screen 13 (Welcome). Do not reference
 * session duration here.
 *
 * Visual intent: one cohesive card, distinct from the option-stack
 * screens (4–8, 10, 12). No RankBanner here — screens 10 and 12
 * already use it; this screen owns its own visual identity.
 */

const BG          = '#000000';
const GOLD        = '#FFB800';
const CARD_BG     = '#0F0F0F';
const CARD_BORDER = '#1F1F1F';
const DIVIDER     = '#1F1F1F';

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

/** Archetype display name + sigil icon — same glyphs as the
 *  archetype reveal screen. Kept inline (not exported from
 *  the archetype screen) to avoid coupling unrelated screens
 *  to that file's internals; the source of truth for these
 *  4 names + icons is short and stable. */
const ARCHETYPE_META: Record<Archetype, { name: string; icon: IconName }> = {
  scalper:         { name: 'Scalper',         icon: 'lightning-bolt' },
  day_trader:      { name: 'Day Trader',      icon: 'clock-outline' },
  swing_trader:    { name: 'Swing Trader',    icon: 'chart-line-variant' },
  position_trader: { name: 'Position Trader', icon: 'anchor' },
};

const IDENTITY_NAME: Record<Identity, string> = {
  patient_sniper:    'The Patient Sniper',
  process_machine:   'The Process Machine',
  risk_surgeon:      'The Risk Surgeon',
  calm_operator:     'The Calm Operator',
  profit_compounder: 'The Profit Compounder',
};

const EXPERIENCE_LABEL: Record<ExperienceLevel, string> = {
  never:        'Never traded',
  beginner:     'Beginner',
  intermediate: 'Intermediate',
  experienced:  'Experienced',
};

const COMMITMENT_LABEL: Record<DailyCommitment, string> = {
  light:  'Light · 3 sessions a week',
  steady: 'Steady · 1 session a day',
  pro:    'Pro · multiple sessions a day',
};

/** Sessions per week implied by each commitment, used to convert the
 *  ~9-sessions-to-Paper-Hands estimate into a weekly horizon. */
const SESSIONS_PER_WEEK: Record<DailyCommitment, number> = {
  light:  3,
  steady: 7,
  pro:    14,
};

/** Rank Reveal screen places the user at 10% toward Unprofitable after
 *  the first trade, so ~9 more sessions × 10% ≈ a full bar.
 *  This is a pre-XP-system estimate; when the real rank XP system
 *  lands, replace this with the actual remaining XP / per-session
 *  XP gain. Keep the comment in sync with that change. */
const SESSIONS_TO_NEXT_RANK = 9;

function weeksToNextRank(commitment: DailyCommitment): number {
  return Math.ceil(SESSIONS_TO_NEXT_RANK / SESSIONS_PER_WEEK[commitment]);
}

function formatAccountSize(n: number): string {
  return '$' + n.toLocaleString('en-US');
}

interface Props {
  navigation: any;
}

export default function OnboardingPlanSummaryScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();

  const archetype       = useOnboardingStore((s) => s.archetype);
  const identity        = useOnboardingStore((s) => s.identity);
  const experienceLevel = useOnboardingStore((s) => s.experienceLevel);
  const accountSize     = useOnboardingStore((s) => s.accountSize);
  const handle          = useOnboardingStore((s) => s.handle);
  const displayName     = useOnboardingStore((s) => s.displayName);
  const dailyCommitment = useOnboardingStore((s) => s.dailyCommitment);

  const headOp = useRef(new Animated.Value(0)).current;
  const cardOp = useRef(new Animated.Value(0)).current;
  const ctaOp  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const fadeIn = (val: Animated.Value, delay: number) =>
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(val, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
      ]);
    Animated.parallel([
      fadeIn(headOp, 0),
      fadeIn(cardOp, 180),
      fadeIn(ctaOp,  420),
    ]).start();
    // mount-once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleContinue = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    navigation.navigate('OnboardingAuth');
  };

  const archetypeMeta = archetype ? ARCHETYPE_META[archetype] : null;
  const identityName  = identity ? IDENTITY_NAME[identity] : null;
  const experience    = experienceLevel ? EXPERIENCE_LABEL[experienceLevel] : null;
  const pace          = COMMITMENT_LABEL[dailyCommitment];
  const weeks         = weeksToNextRank(dailyCommitment);

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={BG} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + 24 },
        ]}
        showsVerticalScrollIndicator={false}
        alwaysBounceVertical={false}
      >
        <Animated.View style={{ opacity: headOp }}>
          <Text style={styles.headline}>Your trading plan</Text>
          <Text style={styles.subheadline}>
            Built from everything you just told us.
          </Text>
        </Animated.View>

        <Animated.View style={[styles.card, { opacity: cardOp }]}>
          {/* Identity anchor */}
          <View style={styles.anchorRow}>
            <Text style={styles.displayName} numberOfLines={1}>
              {displayName || 'Trader'}
            </Text>
            <Text style={styles.handle} numberOfLines={1}>
              @{handle || 'unknown'}
            </Text>
          </View>

          {/* Prominent identity-thread rows */}
          <View style={styles.threadBlock}>
            {/* "Trades like a" — archetype with sigil icon */}
            <View style={styles.threadRow}>
              <Text style={styles.threadLabel}>Trades like a</Text>
              <View style={styles.threadValueRow}>
                {archetypeMeta && (
                  <MaterialCommunityIcons
                    name={archetypeMeta.icon}
                    size={22}
                    color={GOLD}
                    style={styles.threadIcon}
                  />
                )}
                <Text style={styles.threadValue} numberOfLines={1}>
                  {archetypeMeta?.name ?? '—'}
                </Text>
              </View>
            </View>

            {/* "Becoming" — identity */}
            <View style={[styles.threadRow, styles.threadRowGap]}>
              <Text style={styles.threadLabel}>Becoming</Text>
              <View style={styles.threadValueRow}>
                <Text style={styles.threadValue} numberOfLines={1}>
                  {identityName ?? '—'}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.divider} />

          {/* Compact secondary rows */}
          <SecondaryRow label="Experience"        value={experience ?? '—'} />
          <SecondaryRow label="Evaluation account" value={formatAccountSize(accountSize)} />
          <SecondaryRow label="Training pace"      value={pace} />

          <View style={styles.divider} />

          {/* Trajectory */}
          <View style={styles.trajectoryBlock}>
            <Text style={styles.trajectoryLabel}>Trajectory</Text>
            <View style={styles.trajectoryRow}>
              <Text style={styles.trajectoryFrom}>Paper</Text>
              <MaterialCommunityIcons
                name="arrow-right"
                size={16}
                color="rgba(255,255,255,0.5)"
                style={styles.trajectoryArrow}
              />
              <Text style={styles.trajectoryTo}>Unprofitable</Text>
            </View>
            <Text style={styles.trajectoryEstimate}>
              ~{weeks} {weeks === 1 ? 'week' : 'weeks'} at this pace
            </Text>
          </View>
        </Animated.View>
      </ScrollView>

      <Animated.View
        style={[
          styles.ctaWrap,
          { paddingBottom: Math.max(insets.bottom, 16), opacity: ctaOp },
        ]}
      >
        <Pressable
          onPress={handleContinue}
          style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}
          accessibilityRole="button"
          accessibilityLabel="Continue"
        >
          <Text style={styles.ctaText}>Continue</Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

function SecondaryRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.secondaryRow}>
      <Text style={styles.secondaryLabel}>{label}</Text>
      <Text style={styles.secondaryValue} numberOfLines={1}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },

  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 24,
  },

  headline: {
    color: '#FFFFFF',
    fontSize: 32,
    fontWeight: '700',
    lineHeight: 39,
    letterSpacing: -0.5,
    textAlign: 'center',
    paddingHorizontal: 8,
  },
  subheadline: {
    marginTop: 12,
    color: 'rgba(255,255,255,0.75)',
    fontSize: 15,
    fontWeight: '400',
    lineHeight: 22,
    textAlign: 'center',
    paddingHorizontal: 8,
  },

  // ── The summary card ──────────────────────────────────────────
  card: {
    marginTop: 28,
    backgroundColor: CARD_BG,
    borderColor: CARD_BORDER,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 22,
  },

  // Identity anchor at top
  anchorRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    flexWrap: 'wrap',
  },
  displayName: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  handle: {
    marginLeft: 8,
    color: 'rgba(255,255,255,0.5)',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.1,
  },

  // Identity-thread block (prominent)
  threadBlock: {
    marginTop: 18,
  },
  threadRow: {
    // label above, value below — vertical stack reads cleaner than
    // label/value on the same line when the value carries an icon.
  },
  threadRowGap: {
    marginTop: 14,
  },
  threadLabel: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  threadValueRow: {
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
  },
  threadIcon: {
    marginRight: 8,
  },
  threadValue: {
    color: '#FFFFFF',
    fontSize: 19,
    fontWeight: '700',
    letterSpacing: -0.2,
    flexShrink: 1,
  },

  divider: {
    height: 1,
    backgroundColor: DIVIDER,
    marginVertical: 18,
  },

  // Secondary rows (label left, value right)
  secondaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  secondaryLabel: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.1,
  },
  secondaryValue: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.1,
    maxWidth: '65%',
    textAlign: 'right',
  },

  // Trajectory block
  trajectoryBlock: {
    // Inherits card padding.
  },
  trajectoryLabel: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  trajectoryRow: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  trajectoryFrom: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.1,
  },
  trajectoryArrow: {
    marginHorizontal: 10,
  },
  trajectoryTo: {
    color: GOLD,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.1,
  },
  trajectoryEstimate: {
    marginTop: 8,
    color: 'rgba(255,255,255,0.65)',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.1,
  },

  // CTA
  ctaWrap: {
    paddingHorizontal: 24,
    paddingTop: 16,
    backgroundColor: BG,
  },
  cta: {
    backgroundColor: GOLD,
    height: 56,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaPressed: { opacity: 0.85 },
  ctaText: {
    color: '#000000',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});
