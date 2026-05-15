import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, Pressable, Animated, Easing, StyleSheet, StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useOnboardingStore, Archetype, ArchetypeAnswer } from '../store/onboardingStore';

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

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

/** Display-only split for poster-layout options. The underlying
 *  option string in `Question.options` is still the SCORING SOURCE
 *  OF TRUTH — `OPTION_SCORES` is keyed by A/B/C/D position, not by
 *  text — so re-titling here for the poster view changes nothing
 *  about how the quiz scores. */
interface PosterMeta {
  title: string;
  descriptor: string;
  icon: IconName;
}

/** Per-question rendering style.
 *   - `'stack'`  → the existing full-width 4-card vertical stack
 *   - `'grid'`   → 2 × 2 typographic chips (single-word options)
 *   - `'poster'` → 2 × 2 streaming-poster tiles (~3:4 aspect)
 *
 *  Scoring is independent of layout. Option order MUST stay
 *  A → Scalper, D → Position across every question. */
type QuestionLayout = 'stack' | 'grid' | 'poster';

interface Question {
  headline: string;
  options: [string, string, string, string]; // A, B, C, D
  layout: QuestionLayout;
  /** Only used by `'poster'` layout. Index-aligned with `options`. */
  posterMeta?: [PosterMeta, PosterMeta, PosterMeta, PosterMeta];
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
    layout: 'stack',
  },
  {
    headline: "A trade you took two days ago is finally moving. You're not at your screen. What's the right call?",
    options: [
      "I shouldn't have a 2-day-old trade open in the first place.",
      "Phone alert — I'll check at lunch and decide then.",
      'Let the plan run. I set this up not to need babysitting.',
      "Honestly? I'd already forgotten about it. That's normal for me.",
    ],
    layout: 'stack',
  },
  {
    headline: "Pick the show you'd binge first.",
    // Underlying option strings — UNCHANGED, used by accessibility +
    // any downstream consumer reading `Question.options`. The poster
    // view splits + re-titles them via `posterMeta` for display only.
    options: [
      'A 22-minute sitcom — fast, light, done.',
      'A 1-hour procedural — case opens and closes in one episode.',
      'An 8-episode prestige drama — full arc, satisfying.',
      "A 5-season slow-burn epic — I'm in for the long haul.",
    ],
    layout: 'poster',
    posterMeta: [
      { title: '22-min Sitcom',   descriptor: 'Fast, light, done.',                    icon: 'coffee-outline' },
      { title: '1-hr Procedural', descriptor: 'Case opens and closes in one episode.', icon: 'magnify' },
      { title: '8-ep Drama',      descriptor: 'Full arc, satisfying.',                 icon: 'book-open-variant' },
      { title: '5-season Epic',   descriptor: 'In for the long haul.',                 icon: 'infinity' },
    ],
  },
  {
    headline: 'Which compliment would mean more to you?',
    options: ['Fast.', 'Sharp.', 'Patient.', 'Right.'],
    layout: 'grid',
  },
  {
    headline: 'What time do you want to be done thinking about the market each day?',
    options: [
      "Just the first hour or two — I'm in and out fast.",
      'All day during market hours, but done by evening.',
      'Check it briefly a couple of times during the day.',
      "I don't want to think about it during the day at all — set it and forget.",
    ],
    layout: 'stack',
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

/**
 * Archetype config — name + description + sigil icon + rarity stat +
 * trait values, all in one place.
 *
 * `rarity` is the % of users whose quiz answers resolve to this
 * archetype, computed by running `computeArchetype` across all
 * 4^5 = 1024 possible answer paths. Hardcoded here rather than
 * re-simulated at runtime; can later be swapped for live user data
 * once we have it. (Computation, for reference:
 *   scalper          → 136/1024 ≈ 13%
 *   day_trader       → 376/1024 ≈ 37%
 *   swing_trader     → 298/1024 ≈ 29%
 *   position_trader  → 214/1024 ≈ 21%)
 *
 * `traits` are TEMPO / PATIENCE / CONVICTION on a 0-100 axis. They
 * drive the 3-bar visual on the reveal screen.
 */
interface ArchetypeInfo {
  name: string;
  description: string;
  icon: IconName;
  rarity: number;
  traits: { tempo: number; patience: number; conviction: number };
}

const ARCHETYPE_INFO: Record<Archetype, ArchetypeInfo> = {
  scalper: {
    name: 'Scalper',
    description: 'You live in the moment. Quick decisions, tight risk, dozens of trades a day. Your edge is speed and pattern reflexes.',
    icon: 'lightning-bolt',
    rarity: 13,
    traits: { tempo: 95, patience: 15, conviction: 30 },
  },
  day_trader: {
    name: 'Day Trader',
    description: 'You read price action and act decisively. In and out within hours. Your edge is reading the tape.',
    icon: 'clock-outline',
    rarity: 37,
    traits: { tempo: 75, patience: 40, conviction: 50 },
  },
  swing_trader: {
    name: 'Swing Trader',
    description: 'You wait for the right setup, then ride it for days. Patience is your weapon. Your edge is timing.',
    icon: 'chart-line-variant',
    rarity: 29,
    traits: { tempo: 40, patience: 75, conviction: 70 },
  },
  position_trader: {
    name: 'Position Trader',
    description: 'You see the big picture and hold for weeks or months. Your edge is conviction and zoom-out perspective.',
    icon: 'anchor',
    rarity: 21,
    traits: { tempo: 15, patience: 95, conviction: 90 },
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

/** Q4 (grid) chip — square, single-word, big bold typography. */
function ChipOption({
  label, onPress, highlighted, disabled,
}: { label: string; onPress: () => void; highlighted: boolean; disabled: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.chip,
        (highlighted || pressed) && styles.chipActive,
      ]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Text style={styles.chipText}>{label}</Text>
    </Pressable>
  );
}

/** Q3 (poster) tile — ~3:4 streaming-poster aspect, gold sigil at the
 *  top, bold title in the middle, descriptor at the bottom. The icon
 *  is the "distinguishing visual treatment" the audit asked for —
 *  the same vocabulary as the identity / archetype-reveal sigils,
 *  on-brand (white text, gold accent only). */
function PosterTile({
  meta, onPress, highlighted, disabled,
}: { meta: PosterMeta; onPress: () => void; highlighted: boolean; disabled: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.poster,
        (highlighted || pressed) && styles.posterActive,
      ]}
      accessibilityRole="button"
      accessibilityLabel={`${meta.title}. ${meta.descriptor}`}
    >
      <MaterialCommunityIcons
        name={meta.icon}
        size={26}
        color={GOLD}
        style={styles.posterIcon}
      />
      <Text style={styles.posterTitle} numberOfLines={2}>{meta.title}</Text>
      <Text style={styles.posterDescriptor} numberOfLines={3}>{meta.descriptor}</Text>
    </Pressable>
  );
}

/** Animated horizontal trait bar — fill scales 0% → `value`% over
 *  500 ms with ease-out cubic. Width interpolation requires the JS
 *  driver. Used only on the reveal screen. */
function TraitBar({ label, value, delay = 0 }: { label: string; value: number; delay?: number }) {
  const fill = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(fill, {
      toValue: 1,
      duration: 500,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
    // mount-once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const width = fill.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', `${value}%`],
  });
  return (
    <View style={styles.trait}>
      <Text style={styles.traitLabel}>{label}</Text>
      <View style={styles.traitTrack}>
        <Animated.View style={[styles.traitFill, { width }]} />
      </View>
    </View>
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

            {q.layout === 'stack' && OPTIONS.map((opt, idx) => (
              <View key={opt} style={idx > 0 ? { marginTop: 10 } : null}>
                <AnswerCard
                  label={q.options[idx]}
                  onPress={() => handleAnswer(opt)}
                  highlighted={selected === opt}
                  disabled={selected !== null}
                />
              </View>
            ))}

            {q.layout === 'grid' && (
              <View style={styles.gridContainer}>
                <View style={styles.gridRow}>
                  {[0, 1].map((i) => (
                    <View key={OPTIONS[i]} style={styles.gridCell}>
                      <ChipOption
                        label={q.options[i]}
                        onPress={() => handleAnswer(OPTIONS[i])}
                        highlighted={selected === OPTIONS[i]}
                        disabled={selected !== null}
                      />
                    </View>
                  ))}
                </View>
                <View style={styles.gridRow}>
                  {[2, 3].map((i) => (
                    <View key={OPTIONS[i]} style={styles.gridCell}>
                      <ChipOption
                        label={q.options[i]}
                        onPress={() => handleAnswer(OPTIONS[i])}
                        highlighted={selected === OPTIONS[i]}
                        disabled={selected !== null}
                      />
                    </View>
                  ))}
                </View>
              </View>
            )}

            {q.layout === 'poster' && q.posterMeta && (
              <View style={styles.gridContainer}>
                <View style={styles.gridRow}>
                  {[0, 1].map((i) => (
                    <View key={OPTIONS[i]} style={styles.gridCell}>
                      <PosterTile
                        meta={q.posterMeta![i]}
                        onPress={() => handleAnswer(OPTIONS[i])}
                        highlighted={selected === OPTIONS[i]}
                        disabled={selected !== null}
                      />
                    </View>
                  ))}
                </View>
                <View style={styles.gridRow}>
                  {[2, 3].map((i) => (
                    <View key={OPTIONS[i]} style={styles.gridCell}>
                      <PosterTile
                        meta={q.posterMeta![i]}
                        onPress={() => handleAnswer(OPTIONS[i])}
                        highlighted={selected === OPTIONS[i]}
                        disabled={selected !== null}
                      />
                    </View>
                  ))}
                </View>
              </View>
            )}
          </>
        )}

        {isReveal && info && (
          <View style={styles.revealBlock}>
            <Text style={styles.revealLabel}>YOUR CLOSEST MATCH</Text>
            <MaterialCommunityIcons
              name={info.icon}
              size={40}
              color={GOLD}
              style={styles.revealSigil}
            />
            <Text style={styles.revealName} allowFontScaling={false}>{info.name}</Text>
            <Text style={styles.revealRarity}>
              {info.rarity}% of traders match {info.name}
            </Text>
            <Text style={styles.revealDescription}>{info.description}</Text>
            <View style={styles.traitsBlock}>
              <TraitBar label="TEMPO"      value={info.traits.tempo}      delay={0}   />
              <TraitBar label="PATIENCE"   value={info.traits.patience}   delay={80}  />
              <TraitBar label="CONVICTION" value={info.traits.conviction} delay={160} />
            </View>
          </View>
        )}
      </Animated.View>

      {/* Reveal CTA — relabelled to "This is me" for identity reinforcement. */}
      {isReveal && (
        <View style={[styles.ctaWrap, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <Pressable
            onPress={handleContinue}
            style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}
            accessibilityRole="button"
            accessibilityLabel="This is me"
          >
            <Text style={styles.ctaText}>This is me</Text>
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

  // Q3 / Q4 — 2 × 2 layout shared scaffolding.
  // Two explicit rows of two flex:1 cells, gap-separated. flexWrap
  // would also work but explicit rows keep the layout obvious.
  gridContainer: {
    gap: 10,
  },
  gridRow: {
    flexDirection: 'row',
    gap: 10,
  },
  gridCell: {
    flex: 1,
  },

  // Q4 chip — square, single-word, oversize typography.
  chip: {
    backgroundColor: CARD_BG,
    borderColor: CARD_BORDER,
    borderWidth: 1,
    borderRadius: 16,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipActive: {
    borderColor: GOLD,
    borderWidth: 2,
  },
  chipText: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.4,
    textAlign: 'center',
  },

  // Q3 poster tile — ~3:4 streaming-poster aspect.
  poster: {
    backgroundColor: CARD_BG,
    borderColor: CARD_BORDER,
    borderWidth: 1,
    borderRadius: 14,
    aspectRatio: 3 / 4,
    paddingHorizontal: 14,
    paddingVertical: 16,
    // Stack from top → bottom: icon, title, descriptor.
    justifyContent: 'flex-start',
  },
  posterActive: {
    borderColor: GOLD,
    borderWidth: 2,
    // Compensate so content position doesn't shift on selection.
    paddingHorizontal: 13,
    paddingVertical: 15,
  },
  posterIcon: {
    marginBottom: 12,
  },
  posterTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.2,
    lineHeight: 21,
  },
  posterDescriptor: {
    marginTop: 6,
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 16,
  },

  // Reveal view
  revealBlock: {
    alignItems: 'center',
    alignSelf: 'stretch',
  },
  revealLabel: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 2,
    textAlign: 'center',
  },
  revealSigil: {
    marginTop: 14,
  },
  revealName: {
    marginTop: 8,
    color: GOLD,
    fontSize: 52,
    fontWeight: '700',
    letterSpacing: -1,
    textAlign: 'center',
    lineHeight: 60,
  },
  revealRarity: {
    marginTop: 8,
    color: 'rgba(255,255,255,0.6)',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.2,
    textAlign: 'center',
  },
  revealDescription: {
    marginTop: 20,
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
    lineHeight: 25,
    textAlign: 'center',
    maxWidth: '90%',
  },

  // Trait bars below the description
  traitsBlock: {
    alignSelf: 'stretch',
    marginTop: 26,
    paddingHorizontal: 4,
    gap: 12,
  },
  trait: {
    alignSelf: 'stretch',
  },
  traitLabel: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginBottom: 6,
  },
  traitTrack: {
    height: 6,
    backgroundColor: '#1F1F1F',
    borderRadius: 3,
    overflow: 'hidden',
  },
  traitFill: {
    height: '100%',
    backgroundColor: GOLD,
    borderRadius: 3,
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
