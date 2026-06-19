import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, Modal, Pressable, Animated, Easing, StyleSheet, ScrollView,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Svg, { Circle } from 'react-native-svg';

import NumericText from './NumericText';
import Button from './ui/Button';
import StreakBadge from './StreakBadge';
import { WeeklyRecap, RecapPlanAdherence } from '../utils/weeklyRecap';
import { colors, borders, surface } from '../theme';

/**
 * WeeklyRecapModal — "Sunday Wrap". Reused by the auto-trigger
 * (MainTabs), the Home banner ("Open recap"), the Settings entry
 * ("Weekly recap"), and the Journal review path (tap a past
 * recap).
 *
 * Layout — newsletter-style scroll of L1 cards, each with an
 * eyebrow label:
 *   1. HEADLINE          — net P&L (count-up), one-line breakdown,
 *                          delta vs prev week
 *   2. TOP MOVES         — best / worst trade columns (tap → trade)
 *   3. BY SETUP          — top + bottom setup rows + takeaway
 *   4. PROCESS           — mini discipline ring + mini adherence bar
 *   5. ENGAGEMENT        — XP, sessions, streak tiles
 *   6. NEXT WEEK         — recommendation card
 *
 * Entrance choreography: container fade → P&L count-up from $0 →
 * sections stagger-fade in. Total ~1.6s.
 */

const GOLD  = colors.gold;
const GREEN = colors.green;
const RED   = colors.red;
const WHITE = colors.textPrimary;
const TRACK = 'rgba(255,255,255,0.08)';

const ADHERENCE_COLOR = {
  hitTarget:  'rgba(0, 211, 149, 0.80)',
  partial:    'rgba(255, 184, 0, 0.80)',
  earlyExit:  'rgba(255, 255, 255, 0.40)',
  stoppedOut: 'rgba(255, 71, 87, 0.80)',
} as const;

const ADHERENCE_LABEL = {
  hitTarget:  'Hit target',
  partial:    'Partial',
  earlyExit:  'Early exit',
  stoppedOut: 'Stopped',
} as const;

function formatUSD(n: number, decimals = 2): string {
  const sign = n > 0 ? '+' : n < 0 ? '-' : '';
  const abs = Math.abs(n).toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return `${sign}$${abs}`;
}

function pnlColor(n: number): string {
  if (n > 0) return GREEN;
  if (n < 0) return RED;
  return WHITE;
}

function formatPF(pf: number | 'inf' | null): string {
  if (pf === null) return '—';
  if (pf === 'inf') return '∞';
  return pf.toFixed(2);
}

interface Props {
  visible: boolean;
  recap: WeeklyRecap | null;
  onClose: () => void;
  /** Tap a best/worst trade → open the JournalEntry detail.
   *  Caller (MainTabs / JournalScreen) wires to navigation. */
  onOpenTrade?: (tradeId: string) => void;
  /** Empty-state Primary CTA → Chart. */
  onStartSession?: () => void;
}

export default function WeeklyRecapModal({
  visible, recap, onClose, onOpenTrade, onStartSession,
}: Props) {
  const fadeIn   = useRef(new Animated.Value(0)).current;
  const pnlValue = useRef(new Animated.Value(0)).current;
  const sectionsOp = useRef(new Animated.Value(0)).current;
  const ctaOp = useRef(new Animated.Value(0)).current;
  const [displayPnl, setDisplayPnl] = useState(0);

  useEffect(() => {
    if (!visible || !recap) return;

    fadeIn.setValue(0);
    pnlValue.setValue(0);
    sectionsOp.setValue(0);
    ctaOp.setValue(0);
    setDisplayPnl(0);

    const id = pnlValue.addListener(({ value }) => setDisplayPnl(value));

    Animated.parallel([
      Animated.timing(fadeIn, {
        toValue: 1, duration: 400, useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.delay(200),
        Animated.timing(pnlValue, {
          toValue: recap.totalPnL,
          duration: 700,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: false,
        }),
      ]),
      Animated.sequence([
        Animated.delay(700),
        Animated.timing(sectionsOp, {
          toValue: 1, duration: 450, useNativeDriver: true,
        }),
      ]),
      Animated.sequence([
        Animated.delay(1200),
        Animated.timing(ctaOp, {
          toValue: 1, duration: 300, useNativeDriver: true,
        }),
      ]),
    ]).start();

    return () => pnlValue.removeListener(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, recap?.weekId]);

  if (!recap) return null;

  // Empty-state branch: surface a single card with a clear CTA.
  if (recap.totalTrades === 0) {
    return (
      <Modal
        visible={visible}
        animationType="none"
        transparent
        onRequestClose={onClose}
      >
        <Animated.View style={[styles.root, { opacity: fadeIn }]}>
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <Header dateRange={recap.dateRange} />
            <View style={[styles.card, styles.emptyCard]}>
              <MaterialCommunityIcons
                name="moon-waning-crescent"
                size={32}
                color="rgba(255,184,0,0.7)"
              />
              <Text style={styles.emptyTitle}>No trades closed this week</Text>
              <Text style={styles.emptyBody}>
                A quiet week. Jump in to a session — even one trade gives next
                week's recap something to chew on.
              </Text>
              {onStartSession && (
                <View style={styles.emptyCtaWrap}>
                  <Button
                    label="Start session"
                    variant="primary"
                    hero
                    onPress={() => {
                      onClose();
                      onStartSession();
                    }}
                  />
                </View>
              )}
            </View>
            <CloseButton fadeAnim={ctaOp} onPress={onClose} />
          </ScrollView>
        </Animated.View>
      </Modal>
    );
  }

  const delta = recap.prevWeek
    ? recap.totalPnL - recap.prevWeek.netPnl
    : null;

  return (
    <Modal
      visible={visible}
      animationType="none"
      transparent
      onRequestClose={onClose}
    >
      <Animated.View style={[styles.root, { opacity: fadeIn }]}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <Header dateRange={recap.dateRange} />

          {/* 1. HEADLINE */}
          <View style={[styles.card, styles.firstCard]}>
            <Text style={styles.eyebrow}>HEADLINE</Text>
            <NumericText
              bold
              allowFontScaling={false}
              style={[styles.heroPnl, { color: pnlColor(recap.totalPnL) }]}
            >
              {formatUSD(displayPnl)}
            </NumericText>
            <Text style={styles.heroSubline}>
              <NumericText style={styles.heroSublineNum}>
                {recap.totalTrades}
              </NumericText>
              {' '}{recap.totalTrades === 1 ? 'trade' : 'trades'}
              {recap.winRate != null && (
                <>
                  {' · '}
                  <NumericText style={styles.heroSublineNum}>
                    {recap.winRate}%
                  </NumericText>
                  {' win'}
                </>
              )}
              {recap.profitFactor != null && (
                <>
                  {' · PF '}
                  <NumericText style={styles.heroSublineNum}>
                    {formatPF(recap.profitFactor)}
                  </NumericText>
                </>
              )}
            </Text>
            {delta != null && (
              <View style={styles.deltaRow}>
                <NumericText
                  bold
                  allowFontScaling={false}
                  style={[styles.deltaValue, { color: pnlColor(delta) }]}
                >
                  {formatUSD(delta)}
                </NumericText>
                <Text style={styles.deltaCaption}> vs last week</Text>
              </View>
            )}
          </View>

          <Animated.View style={{ opacity: sectionsOp, alignSelf: 'stretch' }}>
            {/* 2. TOP MOVES */}
            {(recap.bestTrade || recap.worstTrade) && (
              <View style={styles.card}>
                <Text style={styles.eyebrow}>TOP MOVES</Text>
                <View style={styles.movesRow}>
                  {recap.bestTrade && (
                    <MoveCell
                      label="BEST"
                      symbol={recap.bestTrade.symbol}
                      direction={recap.bestTrade.direction}
                      pnl={recap.bestTrade.pnl}
                      tradeId={recap.bestTrade.tradeId}
                      onOpenTrade={onOpenTrade}
                      onClose={onClose}
                    />
                  )}
                  {recap.worstTrade && recap.bestTrade?.tradeId !== recap.worstTrade.tradeId && (
                    <MoveCell
                      label="WORST"
                      symbol={recap.worstTrade.symbol}
                      direction={recap.worstTrade.direction}
                      pnl={recap.worstTrade.pnl}
                      tradeId={recap.worstTrade.tradeId}
                      onOpenTrade={onOpenTrade}
                      onClose={onClose}
                    />
                  )}
                </View>
              </View>
            )}

            {/* 3. BY SETUP */}
            {recap.topSetup && (
              <View style={styles.card}>
                <Text style={styles.eyebrow}>BY SETUP</Text>
                <SetupRow
                  rank="top"
                  name={recap.topSetup.name}
                  category={recap.topSetup.category}
                  netPnl={recap.topSetup.netPnl}
                  tradeCount={recap.topSetup.tradeCount}
                />
                {recap.bottomSetup &&
                 recap.bottomSetup.setupId !== recap.topSetup.setupId && (
                  <>
                    <View style={styles.setupSpacer} />
                    <SetupRow
                      rank="bottom"
                      name={recap.bottomSetup.name}
                      category={recap.bottomSetup.category}
                      netPnl={recap.bottomSetup.netPnl}
                      tradeCount={recap.bottomSetup.tradeCount}
                    />
                  </>
                )}
                <Text style={styles.takeaway}>
                  {setupTakeaway(recap)}
                </Text>
              </View>
            )}

            {/* 4. PROCESS (discipline + plan adherence) */}
            <View style={styles.card}>
              <Text style={styles.eyebrow}>PROCESS</Text>
              <View style={styles.processRow}>
                <MiniRing ratio={recap.disciplineRate / 100} />
                <View style={styles.processCopy}>
                  <Text style={styles.processBig}>
                    <NumericText bold style={styles.processBigNum}>
                      {recap.disciplineRate}%
                    </NumericText>
                    {' checklist'}
                  </Text>
                  <Text style={styles.processSub}>
                    pre-trade discipline rate
                  </Text>
                </View>
              </View>
              {recap.planAdherence.totalScored > 0 && (
                <>
                  <View style={styles.processDivider} />
                  <MiniAdherenceBar adherence={recap.planAdherence} />
                </>
              )}
              <Text style={styles.takeaway}>
                {processTakeaway(recap)}
              </Text>
            </View>

            {/* 5. ENGAGEMENT */}
            <View style={styles.card}>
              <Text style={styles.eyebrow}>ENGAGEMENT</Text>
              <View style={styles.engageRow}>
                <EngageTile label="XP" value={`+${recap.xpEarned}`} />
                <EngageTile
                  label={recap.sessionsCount === 1 ? 'Session' : 'Sessions'}
                  value={String(recap.sessionsCount)}
                />
                <EngageTile
                  label="Streak"
                  value={`${recap.currentStreak}`}
                  accessory={
                    recap.currentStreak > 0 ? (
                      <StreakBadge
                        count={recap.currentStreak}
                        status="active"
                        size="small"
                      />
                    ) : undefined
                  }
                />
              </View>
              <Text style={styles.takeaway}>
                {engagementTakeaway(recap)}
              </Text>
            </View>

            {/* 6. NEXT WEEK */}
            {recap.nextRecommendation && (
              <View style={[styles.card, styles.nextCard]}>
                <Text style={[styles.eyebrow, styles.nextEyebrow]}>
                  NEXT WEEK
                </Text>
                <Text style={styles.nextTitle}>
                  {recap.nextRecommendation.title}
                </Text>
                <Text style={styles.nextReason}>
                  {recap.nextRecommendation.reason}
                </Text>
              </View>
            )}
          </Animated.View>

          <CloseButton fadeAnim={ctaOp} onPress={onClose} />
        </ScrollView>
      </Animated.View>
    </Modal>
  );
}

// ── Building blocks ─────────────────────────────────────────────────

function Header({ dateRange }: { dateRange: string }) {
  return (
    <View style={styles.header}>
      <Text style={styles.headerEyebrow}>WEEK IN REVIEW</Text>
      <Text style={styles.headerRange}>{dateRange}</Text>
    </View>
  );
}

function CloseButton({
  fadeAnim, onPress,
}: { fadeAnim: Animated.Value; onPress: () => void }) {
  return (
    <Animated.View style={{ opacity: fadeAnim, alignSelf: 'stretch' }}>
      <View style={styles.ctaWrap}>
        <Button label="Continue" variant="primary" hero onPress={onPress} />
      </View>
    </Animated.View>
  );
}

function MoveCell({
  label, symbol, direction, pnl, tradeId, onOpenTrade, onClose,
}: {
  label: string;
  symbol: string;
  direction: 'long' | 'short';
  pnl: number;
  tradeId: string;
  onOpenTrade?: (tradeId: string) => void;
  onClose: () => void;
}) {
  const dirColor = direction === 'long' ? GREEN : RED;
  const dirLabel = direction === 'long' ? 'LONG' : 'SHORT';
  const pressable = !!onOpenTrade;

  const content = (
    <>
      <Text style={styles.moveLabel}>{label}</Text>
      <NumericText
        bold
        allowFontScaling={false}
        style={[styles.movePnl, { color: pnlColor(pnl) }]}
      >
        {formatUSD(pnl, 2)}
      </NumericText>
      <Text style={styles.moveSymbol}>{symbol}</Text>
      <View style={[styles.moveDirChip, { borderColor: dirColor }]}>
        <Text style={[styles.moveDirText, { color: dirColor }]}>{dirLabel}</Text>
      </View>
    </>
  );

  if (pressable) {
    return (
      <Pressable
        onPress={() => {
          onClose();
          onOpenTrade!(tradeId);
        }}
        style={({ pressed }) => [
          styles.moveCell,
          pressed && styles.movePressed,
        ]}
        accessibilityRole="button"
        accessibilityLabel={`${label} trade ${symbol} ${formatUSD(pnl)}`}
      >
        {content}
      </Pressable>
    );
  }
  return <View style={styles.moveCell}>{content}</View>;
}

function SetupRow({
  rank, name, category, netPnl, tradeCount,
}: {
  rank: 'top' | 'bottom';
  name: string;
  category: string;
  netPnl: number;
  tradeCount: number;
}) {
  const accent = rank === 'top' ? GREEN : RED;
  return (
    <View style={styles.setupRow}>
      <View style={[styles.setupBadge, { borderColor: accent }]}>
        <Text style={[styles.setupBadgeText, { color: accent }]}>
          {rank === 'top' ? 'TOP' : 'BOTTOM'}
        </Text>
      </View>
      <View style={styles.setupCopy}>
        <Text style={styles.setupName} numberOfLines={1}>{name}</Text>
        <Text style={styles.setupMeta} numberOfLines={1}>
          {category.toUpperCase()}
          {' · '}
          <NumericText style={styles.setupMeta}>{tradeCount}</NumericText>
          {' '}{tradeCount === 1 ? 'trade' : 'trades'}
        </Text>
      </View>
      <NumericText
        bold
        allowFontScaling={false}
        style={[styles.setupPnl, { color: pnlColor(netPnl) }]}
      >
        {formatUSD(netPnl, 0)}
      </NumericText>
    </View>
  );
}

function MiniRing({ ratio }: { ratio: number }) {
  const clamped = Math.max(0, Math.min(1, ratio));
  const SIZE = 50;
  const STROKE = 6;
  const radius = (SIZE - STROKE) / 2;
  const cx = SIZE / 2;
  const cy = SIZE / 2;
  const circ = 2 * Math.PI * radius;
  const offset = circ * (1 - clamped);
  return (
    <View style={{ width: SIZE, height: SIZE }}>
      <Svg width={SIZE} height={SIZE}>
        <Circle
          cx={cx} cy={cy} r={radius}
          stroke={TRACK} strokeWidth={STROKE} fill="none"
        />
        <Circle
          cx={cx} cy={cy} r={radius}
          stroke={GOLD} strokeWidth={STROKE} fill="none"
          strokeDasharray={`${circ} ${circ}`}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform={`rotate(-90 ${cx} ${cy})`}
        />
      </Svg>
    </View>
  );
}

function MiniAdherenceBar({ adherence }: { adherence: RecapPlanAdherence }) {
  const total = adherence.totalScored;
  if (total === 0) return null;

  const order = ['hitTarget', 'partial', 'earlyExit', 'stoppedOut'] as const;
  return (
    <View>
      <View style={styles.adherenceBarWrap}>
        <View style={styles.adherenceBar}>
          {order.map((b) => {
            const count = adherence[b];
            if (count === 0) return null;
            return (
              <View
                key={b}
                style={{
                  flex: count / total,
                  backgroundColor: ADHERENCE_COLOR[b],
                }}
              />
            );
          })}
        </View>
        <View style={styles.adherenceBarBorder} pointerEvents="none" />
      </View>
      <View style={styles.adherenceLegend}>
        {order.map((b) => {
          if (adherence[b] === 0) return null;
          return (
            <View key={b} style={styles.legendCell}>
              <View
                style={[styles.legendDot, { backgroundColor: ADHERENCE_COLOR[b] }]}
              />
              <Text style={styles.legendLabel}>{ADHERENCE_LABEL[b]}</Text>
              <NumericText style={styles.legendCount}>{adherence[b]}</NumericText>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function EngageTile({
  label, value, accessory,
}: { label: string; value: string; accessory?: React.ReactNode }) {
  return (
    <View style={styles.engageTile}>
      <View style={styles.engageValueRow}>
        <NumericText bold allowFontScaling={false} style={styles.engageValue}>
          {value}
        </NumericText>
        {accessory}
      </View>
      <Text style={styles.engageLabel}>{label.toUpperCase()}</Text>
    </View>
  );
}

// ── Takeaway copy ───────────────────────────────────────────────────

function setupTakeaway(recap: WeeklyRecap): string {
  const top = recap.topSetup;
  const bot = recap.bottomSetup;
  if (!top) return '';
  if (bot && bot.setupId !== top.setupId && bot.netPnl < 0) {
    return `Your edge was on ${top.name}. Watch your reads on ${bot.name}.`;
  }
  if (top.netPnl > 0) {
    return `Your edge this week was on ${top.name}.`;
  }
  return 'No clear edge on any one setup this week.';
}

function processTakeaway(recap: WeeklyRecap): string {
  const adh = recap.planAdherence;
  if (recap.disciplineRate >= 80 && adh.hitTarget >= 2) {
    return 'Process is sharp — keep running the same checks next week.';
  }
  if (recap.disciplineRate < 70) {
    return 'Discipline slipped this week. Run the checklist every trade.';
  }
  if (adh.totalScored > 0 && adh.earlyExit > adh.hitTarget) {
    return 'You bailed early more than you let plans play out. Trust the stop.';
  }
  return 'Stay on the checklist — process drives outcomes over time.';
}

function engagementTakeaway(recap: WeeklyRecap): string {
  if (recap.sessionsCount >= 5) {
    return 'Strong consistency — five-plus session weeks build edge fastest.';
  }
  if (recap.sessionsCount >= 3) {
    return 'Solid rhythm. One or two more sessions and the data sharpens.';
  }
  return 'More sessions next week = more data = sharper edge.';
}

// ── Styles ──────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 48,
  },

  header: {
    alignItems: 'center',
    marginBottom: 20,
  },
  headerEyebrow: {
    color: GOLD,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 2,
  },
  headerRange: {
    marginTop: 6,
    color: 'rgba(255,255,255,0.7)',
    fontSize: 15,
    fontWeight: '600',
  },

  card: {
    backgroundColor: surface.l1,
    borderColor: borders.card,
    borderWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16,
    padding: 18,
    marginTop: 14,
    alignSelf: 'stretch',
  },
  firstCard: {
    marginTop: 0,
    alignItems: 'flex-start',
  },
  eyebrow: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
    marginBottom: 12,
  },

  // Headline
  heroPnl: {
    fontSize: 44,
    fontWeight: '900',
    letterSpacing: -1,
    lineHeight: 50,
  },
  heroSubline: {
    marginTop: 6,
    color: 'rgba(255,255,255,0.6)',
    fontSize: 13,
    fontWeight: '500',
  },
  heroSublineNum: {
    color: 'rgba(255,255,255,0.85)',
    fontWeight: '700',
  },
  deltaRow: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  deltaValue: {
    fontSize: 15,
    fontWeight: '700',
  },
  deltaCaption: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 13,
    fontWeight: '500',
  },

  // Top moves
  movesRow: {
    flexDirection: 'row',
    gap: 10,
  },
  moveCell: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderColor: borders.hairline,
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    alignItems: 'flex-start',
  },
  movePressed: { opacity: 0.7 },
  moveLabel: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  movePnl: {
    marginTop: 8,
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  moveSymbol: {
    marginTop: 6,
    color: WHITE,
    fontSize: 14,
    fontWeight: '700',
  },
  moveDirChip: {
    marginTop: 8,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  moveDirText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },

  // By setup
  setupRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  setupSpacer: { height: 10 },
  setupBadge: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginRight: 10,
  },
  setupBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  setupCopy: {
    flex: 1,
    paddingRight: 8,
  },
  setupName: {
    color: WHITE,
    fontSize: 15,
    fontWeight: '700',
  },
  setupMeta: {
    marginTop: 2,
    color: 'rgba(255,255,255,0.5)',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.4,
  },
  setupPnl: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  takeaway: {
    marginTop: 14,
    color: 'rgba(255,255,255,0.65)',
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 19,
  },

  // Process
  processRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  processCopy: {
    marginLeft: 14,
    flex: 1,
  },
  processBig: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 16,
    fontWeight: '600',
  },
  processBigNum: {
    color: GOLD,
    fontSize: 20,
    fontWeight: '800',
  },
  processSub: {
    marginTop: 2,
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
    fontWeight: '500',
  },
  processDivider: {
    height: 1,
    backgroundColor: borders.hairline,
    marginVertical: 14,
  },
  adherenceBarWrap: {
    height: 12,
    borderRadius: 4,
    overflow: 'hidden',
    position: 'relative',
  },
  adherenceBar: {
    flex: 1,
    flexDirection: 'row',
    borderRadius: 4,
    overflow: 'hidden',
  },
  adherenceBarBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: borders.card,
  },
  adherenceLegend: {
    marginTop: 10,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  legendCell: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  legendLabel: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 11,
    fontWeight: '600',
  },
  legendCount: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 11,
    fontWeight: '700',
  },

  // Engagement
  engageRow: {
    flexDirection: 'row',
    gap: 10,
  },
  engageTile: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderColor: borders.hairline,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 10,
    alignItems: 'center',
  },
  engageValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  engageValue: {
    color: WHITE,
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  engageLabel: {
    marginTop: 6,
    color: 'rgba(255,255,255,0.5)',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
  },

  // Next week
  nextCard: {
    backgroundColor: 'rgba(255, 184, 0, 0.05)',
    borderColor: 'rgba(255, 184, 0, 0.18)',
  },
  nextEyebrow: { color: GOLD },
  nextTitle: {
    color: WHITE,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  nextReason: {
    marginTop: 6,
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
  },
  // Empty state
  emptyCard: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 24,
  },
  emptyTitle: {
    marginTop: 14,
    color: WHITE,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  emptyBody: {
    marginTop: 8,
    color: 'rgba(255,255,255,0.65)',
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
    textAlign: 'center',
  },
  emptyCtaWrap: {
    marginTop: 22,
    alignSelf: 'stretch',
  },

  // Continue CTA
  ctaWrap: {
    marginTop: 28,
  },
});

