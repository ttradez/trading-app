import React, { useRef, useState } from 'react';
import {
  View, Text, Pressable, Animated, StyleSheet, StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useOnboardingStore, Archetype, ArchetypeAnswer } from '../store/onboardingStore';

/**
 * Onboarding screen 3 — Trader Archetype Quiz.
 *
 * Single screen, internal state. 4 binary questions advance through
 * a fade transition, then a reveal screen names the user's archetype
 * and gives a 2-sentence personality description.
 *
 * Scoring: each question's A/B answer awards 1-2 points across the
 * four archetypes. After Q4 we sum the totals and pick the highest;
 * ties resolve via TIE_PRIORITY (most generally-applicable wins).
 *
 * Per docs/ONBOARDING_RETENTION_RESEARCH.md (locked flow + Q6 #2).
 */

const BG          = '#000000';
const GOLD        = '#FFB800';
const CARD_BG     = '#0F0F0F';
const CARD_BORDER = '#1F1F1F';

// ── Quiz content ────────────────────────────────────────────────────────────

type Scores = Partial<Record<Archetype, number>>;

interface Question {
  headline: string;
  a: { label: string; scores: Scores };
  b: { label: string; scores: Scores };
}

const QUESTIONS: Question[] = [
  {
    headline: 'How long would you hold a winning trade?',
    a: { label: 'Minutes',        scores: { scalper: 2, day_trader: 1 } },
    b: { label: 'Days or weeks',  scores: { swing_trader: 1, position_trader: 2 } },
  },
  {
    headline: 'How many trades a day feels right?',
    a: { label: 'Ten or more',    scores: { scalper: 2, day_trader: 1 } },
    b: { label: 'One or two',     scores: { swing_trader: 1, position_trader: 2 } },
  },
  {
    headline: 'What do you trust more?',
    a: { label: 'Just the chart',                  scores: { scalper: 1, day_trader: 2 } },
    b: { label: 'Charts plus the news cycle',      scores: { swing_trader: 2, position_trader: 1 } },
  },
  {
    headline: "What's your edge?",
    a: { label: 'Speed and pattern recognition',  scores: { scalper: 2, day_trader: 1 } },
    b: { label: 'Patience and conviction',         scores: { swing_trader: 1, position_trader: 2 } },
  },
];

// Tie-breaker: most generally-applicable archetype wins (locked).
const TIE_PRIORITY: Archetype[] = ['day_trader', 'swing_trader', 'scalper', 'position_trader'];

const ARCHETYPE_INFO: Record<Archetype, { name: string; description: string }> = {
  scalper: {
    name: 'Scalper',
    description: 'You live in the moment. Quick decisions, tight risk, dozens of trades a day. Your edge is speed.',
  },
  day_trader: {
    name: 'Day Trader',
    description: 'You read price action and act decisively. In and out within hours. Your edge is pattern recognition.',
  },
  swing_trader: {
    name: 'Swing Trader',
    description: 'You wait for the right setup, then ride it for days. Patience is your weapon. Your edge is timing.',
  },
  position_trader: {
    name: 'Position Trader',
    description: 'You see the big picture. Hold positions for weeks or months. Your edge is conviction.',
  },
};

function computeArchetype(answers: ArchetypeAnswer[]): Archetype {
  const totals: Record<Archetype, number> = {
    scalper: 0, day_trader: 0, swing_trader: 0, position_trader: 0,
  };
  answers.forEach((ans, idx) => {
    const opt = ans === 'A' ? QUESTIONS[idx].a : QUESTIONS[idx].b;
    (Object.keys(opt.scores) as Archetype[]).forEach((k) => {
      totals[k] += opt.scores[k] ?? 0;
    });
  });
  let winner: Archetype = TIE_PRIORITY[0];
  let winnerScore = totals[winner];
  for (const a of TIE_PRIORITY) {
    if (totals[a] > winnerScore) {
      winner = a;
      winnerScore = totals[a];
    }
  }
  return winner;
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

export default function OnboardingArchetypeScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const setArchetype = useOnboardingStore((s) => s.setArchetype);

  const [step, setStep]                 = useState(0);  // 0..3 = questions, 4 = reveal
  const [answers, setAnswers]           = useState<ArchetypeAnswer[]>([]);
  const [selected, setSelected]         = useState<'A' | 'B' | null>(null);
  const [archetype, setLocalArchetype]  = useState<Archetype | null>(null);

  const opacity     = useRef(new Animated.Value(1)).current;
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

      {/* Top: progress dots + counter — only shown during questions. */}
      {!isReveal && (
        <View style={[styles.top, { paddingTop: insets.top + 24 }]}>
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
            <View style={{ height: 32 }} />
            <AnswerCard
              label={q.a.label}
              onPress={() => handleAnswer('A')}
              highlighted={selected === 'A'}
              disabled={selected !== null}
            />
            <View style={{ height: 16 }} />
            <AnswerCard
              label={q.b.label}
              onPress={() => handleAnswer('B')}
              highlighted={selected === 'B'}
              disabled={selected !== null}
            />
          </>
        )}

        {isReveal && info && (
          <View style={styles.revealBlock}>
            <Text style={styles.revealLabel}>YOU ARE A</Text>
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
    gap: 8,
  },
  progressDot: {
    width: 24,
    height: 4,
    borderRadius: 2,
  },
  progressDotFilled:   { backgroundColor: GOLD },
  progressDotUnfilled: { backgroundColor: 'rgba(255,255,255,0.3)' },
  questionCounter: {
    marginTop: 16,
    color: 'rgba(255,255,255,0.6)',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1.5,
  },

  // Content area — vertically centered for both questions and reveal.
  content: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
  },

  // Question view
  questionHeadline: {
    color: '#FFFFFF',
    fontSize: 30,
    fontWeight: '700',
    lineHeight: 38,
    letterSpacing: -0.4,
    textAlign: 'center',
    paddingHorizontal: 8, // breathing room beyond the 24px outer
  },

  card: {
    backgroundColor: CARD_BG,
    borderColor: CARD_BORDER,
    borderWidth: 1,
    borderRadius: 16,
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  cardActive: {
    borderColor: GOLD,
    borderWidth: 2,
  },
  cardText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 26,
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
    lineHeight: 27,        // ~1.5×
    textAlign: 'center',
    maxWidth: '85%',
  },

  // CTA (matches screen 2's "I'm in" button)
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
