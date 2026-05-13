import React, { useRef, useState } from 'react';
import {
  View, Text, Pressable, Animated, StyleSheet, StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useOnboardingStore, Archetype, ArchetypeAnswer } from '../store/onboardingStore';

/**
 * Onboarding screen 3 — Trader Archetype Quiz V2.
 *
 * Single screen, internal state. 5 binary-ish questions, each with 4
 * answer options (one per archetype), advance through a fade
 * transition; then a reveal screen names the user's closest match.
 *
 * V2 changes from V1 (see docs/QUIZ_V2_RESEARCH.md):
 *  - 5 questions (was 4; briefly 6 — Q6 "decision frequency" dropped
 *    as redundant with Q1 closure behaviour + Q5 session length).
 *  - 4 options per question (was 2). Question copy is indirect /
 *    scenario-based; option order is the same A→Scalper, D→Position
 *    every question so we can apply a UNIFORM score matrix.
 *  - Quasi-ipsative scoring with adjacency weighting (B awards
 *    Scalper+1/Day+2/Swing+1; C awards Day+1/Swing+2/Position+1).
 *    Day/Swing can actually win now — V1's binary scoring biased the
 *    result to Scalper/Position.
 *  - New tie-break: archetype scored by Q1's answer wins; if still
 *    tied, longer-horizon archetype wins (Position > Swing > Day >
 *    Scalper).
 *  - Reveal label: "YOUR CLOSEST MATCH" (was "YOU ARE A").
 *  - Refined personality copy.
 */

const BG          = '#000000';
const GOLD        = '#FFB800';
const CARD_BG     = '#0F0F0F';
const CARD_BORDER = '#1F1F1F';

// ── Quiz content ────────────────────────────────────────────────────────────

interface Question {
  headline: string;
  options: [string, string, string, string]; // A, B, C, D
}

const QUESTIONS: Question[] = [
  {
    headline: "You're winning on a trade and the price is still moving your way. What do you do?",
    options: [
      "Take the profit now — you don't argue with a winner in front of you.",
      'Take half the profit now, let the rest keep running.',
      "Let it ride. The move just started — I'll move my safety stop up as it goes.",
      'Stick to the plan. I picked my target before I entered.',
    ],
  },
  {
    headline: "A trade you took two days ago is finally moving. You're not at your screen. What's the right call?",
    options: [
      "I shouldn't have a 2-day-old trade open in the first place.",
      "Phone alert — I'll check at lunch and decide then.",
      'Let the plan run. I set this up not to need babysitting.',
      "Honestly? I'd already forgotten about it. That's normal for me.",
    ],
  },
  {
    headline: "Pick the show you'd binge first.",
    options: [
      'A 22-minute sitcom — fast, light, done.',
      'A 1-hour procedural — case opens and closes in one episode.',
      'An 8-episode prestige drama — full arc, satisfying.',
      "A 5-season slow-burn epic — I'm in for the long haul.",
    ],
  },
  {
    headline: 'Which compliment would mean more to you?',
    options: ['Fast.', 'Sharp.', 'Patient.', 'Right.'],
  },
  {
    headline: 'What time do you want to be done thinking about the market each day?',
    options: [
      "Just the first hour or two — I'm in and out fast.",
      'All day during market hours, but done by evening.',
      'Check it briefly a couple of times during the day.',
      "I don't want to think about it during the day at all — set it and forget.",
    ],
  },
];

// Uniform scoring — applies to every question. Quasi-ipsative with
// adjacency weighting: middle options award points to neighbors too,
// so Day Trader and Swing Trader can actually win.
const OPTION_SCORES: Record<ArchetypeAnswer, Partial<Record<Archetype, number>>> = {
  A: { scalper: 2, day_trader: 1 },
  B: { scalper: 1, day_trader: 2, swing_trader: 1 },
  C: { day_trader: 1, swing_trader: 2, position_trader: 1 },
  D: { swing_trader: 1, position_trader: 2 },
};

// Tiebreaker #2 — longer-horizon archetype wins (locked).
const LONG_HORIZON: Archetype[] = ['position_trader', 'swing_trader', 'day_trader', 'scalper'];

const ARCHETYPE_INFO: Record<Archetype, { name: string; description: string }> = {
  scalper: {
    name: 'Scalper',
    description: 'You live in the moment. Quick decisions, tight risk, dozens of trades a day. Your edge is speed and pattern reflexes.',
  },
  day_trader: {
    name: 'Day Trader',
    description: 'You read price action and act decisively. In and out within hours. Your edge is reading the tape.',
  },
  swing_trader: {
    name: 'Swing Trader',
    description: 'You wait for the right setup, then ride it for days. Patience is your weapon. Your edge is timing.',
  },
  position_trader: {
    name: 'Position Trader',
    description: 'You see the big picture and hold for weeks or months. Your edge is conviction and zoom-out perspective.',
  },
};

function computeArchetype(answers: ArchetypeAnswer[]): Archetype {
  const totals: Record<Archetype, number> = {
    scalper: 0, day_trader: 0, swing_trader: 0, position_trader: 0,
  };
  answers.forEach((ans) => {
    const pts = OPTION_SCORES[ans];
    (Object.keys(pts) as Archetype[]).forEach((k) => {
      totals[k] += pts[k] ?? 0;
    });
  });

  const max = Math.max(...Object.values(totals));
  const tied = (Object.keys(totals) as Archetype[]).filter((k) => totals[k] === max);
  if (tied.length === 1) return tied[0];

  // Tiebreaker 1: archetypes that Q1's answer scored. If exactly one
  // tied archetype is among them, it wins.
  const q1Pts = OPTION_SCORES[answers[0]];
  const q1Archetypes = Object.keys(q1Pts) as Archetype[];
  const q1AndTied = tied.filter((a) => q1Archetypes.includes(a));
  if (q1AndTied.length === 1) return q1AndTied[0];

  // Tiebreaker 2: longer-horizon wins.
  for (const a of LONG_HORIZON) {
    if (tied.includes(a)) return a;
  }
  return tied[0]; // unreachable; satisfies the type-checker
}

// ── Subcomponents ───────────────────────────────────────────────────────────

function ProgressDots({ step, total }: { step: number; total: number }) {
  return (
    <View style={styles.progressRow}>
      {Array.from({ length: total }, (_, i) => (
        <View
          key={i}
          style={[
            styles.progressDot,
            i <= step ? styles.progressDotFilled : styles.progressDotUnfilled,
          ]}
        />
      ))}
    </View>
  );
}

function AnswerCard({
  label, onPress, highlighted, disabled,
}: { label: string; onPress: () => void; highlighted: boolean; disabled: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.card,
        (highlighted || pressed) && styles.cardActive,
      ]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Text style={styles.cardText}>{label}</Text>
    </Pressable>
  );
}

// ── Screen ──────────────────────────────────────────────────────────────────

interface Props {
  navigation: any;
}

const REVEAL_STEP = QUESTIONS.length; // step value when we're on the reveal view
const OPTIONS: ArchetypeAnswer[] = ['A', 'B', 'C', 'D'];

export default function OnboardingArchetypeScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const setArchetype = useOnboardingStore((s) => s.setArchetype);

  const [step, setStep]                 = useState(0);  // 0..4 = questions, 5 = reveal
  const [answers, setAnswers]           = useState<ArchetypeAnswer[]>([]);
  const [selected, setSelected]         = useState<ArchetypeAnswer | null>(null);
  const [archetype, setLocalArchetype]  = useState<Archetype | null>(null);

  const opacity       = useRef(new Animated.Value(1)).current;
  const transitioning = useRef(false);

  const handleAnswer = (choice: ArchetypeAnswer) => {
    if (transitioning.current || step >= REVEAL_STEP) return;
    transitioning.current = true;
    setSelected(choice);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});

    Animated.timing(opacity, {
      toValue: 0,
      duration: 180,
      useNativeDriver: true,
    }).start(() => {
      const newAnswers = [...answers, choice];
      setAnswers(newAnswers);
      setSelected(null);

      if (newAnswers.length < QUESTIONS.length) {
        setStep(newAnswers.length);
      } else {
        const result = computeArchetype(newAnswers);
        setLocalArchetype(result);
        setArchetype(result, newAnswers);
        setStep(REVEAL_STEP);
      }

      Animated.timing(opacity, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }).start(() => {
        transitioning.current = false;
      });
    });
  };

  const handleContinue = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    navigation.navigate('OnboardingIdentity');
  };

  const isReveal = step === REVEAL_STEP;
  const q = !isReveal ? QUESTIONS[step] : null;
  const info = archetype ? ARCHETYPE_INFO[archetype] : null;

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={BG} />

      {/* Top: progress dots + counter — questions only. */}
      {!isReveal && (
        <View style={[styles.top, { paddingTop: insets.top + 20 }]}>
          <ProgressDots step={step} total={QUESTIONS.length} />
          <Text style={styles.questionCounter}>
            QUESTION {step + 1} OF {QUESTIONS.length}
          </Text>
        </View>
      )}

      {/* Main content — fades on every transition. */}
      <Animated.View style={[styles.content, { opacity }]}>
        {!isReveal && q && (
          <>
            <Text style={styles.questionHeadline}>{q.headline}</Text>
            <View style={{ height: 20 }} />
            {OPTIONS.map((opt, idx) => (
              <View key={opt} style={idx > 0 ? { marginTop: 10 } : null}>
                <AnswerCard
                  label={q.options[idx]}
                  onPress={() => handleAnswer(opt)}
                  highlighted={selected === opt}
                  disabled={selected !== null}
                />
              </View>
            ))}
          </>
        )}

        {isReveal && info && (
          <View style={styles.revealBlock}>
            <Text style={styles.revealLabel}>YOUR CLOSEST MATCH</Text>
            <Text style={styles.revealName} allowFontScaling={false}>{info.name}</Text>
            <Text style={styles.revealDescription}>{info.description}</Text>
          </View>
        )}
      </Animated.View>

      {/* Reveal CTA */}
      {isReveal && (
        <View style={[styles.ctaWrap, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <Pressable
            onPress={handleContinue}
            style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}
            accessibilityRole="button"
            accessibilityLabel="Continue"
          >
            <Text style={styles.ctaText}>Continue</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },

  // Top progress band
  top: {
    paddingHorizontal: 32,
    alignItems: 'center',
  },
  progressRow: {
    flexDirection: 'row',
    gap: 6,
  },
  progressDot: {
    width: 22,
    height: 4,
    borderRadius: 2,
  },
  progressDotFilled:   { backgroundColor: GOLD },
  progressDotUnfilled: { backgroundColor: 'rgba(255,255,255,0.3)' },
  questionCounter: {
    marginTop: 12,
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.5,
  },

  // Content area — vertically centered for both questions and reveal.
  content: {
    flex: 1,
    paddingHorizontal: 20,
    justifyContent: 'center',
  },

  // Question view
  questionHeadline: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '700',
    lineHeight: 29,
    letterSpacing: -0.3,
    textAlign: 'center',
    paddingHorizontal: 8,
  },

  // V2: smaller cards (4 stacked instead of 2). minHeight lets longer
  // option text wrap to 2-3 lines without cropping.
  card: {
    backgroundColor: CARD_BG,
    borderColor: CARD_BORDER,
    borderWidth: 1,
    borderRadius: 16,
    minHeight: 76,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  cardActive: {
    borderColor: GOLD,
    borderWidth: 2,
  },
  cardText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 22,
  },

  // Reveal view
  revealBlock: {
    alignItems: 'center',
  },
  revealLabel: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 2,
    textAlign: 'center',
  },
  revealName: {
    marginTop: 16,
    color: GOLD,
    fontSize: 52,
    fontWeight: '700',
    letterSpacing: -1,
    textAlign: 'center',
    lineHeight: 60,
  },
  revealDescription: {
    marginTop: 24,
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 27,
    textAlign: 'center',
    maxWidth: '85%',
  },

  // CTA — matches screen 2's "I'm in" button.
  ctaWrap: {
    paddingHorizontal: 24,
    paddingTop: 16,
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
