import React, { useState, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, SafeAreaView, ScrollView, Dimensions, NativeScrollEvent, NativeSyntheticEvent,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing, fontSize, fontWeight, letterSpacing, labelStyle } from '../theme';

const { width: SCREEN_W } = Dimensions.get('window');

interface Props {
  navigation: any;
}

const SLIDES = [
  {
    headline: 'RANDOM DATES.',
    headline2: 'REAL DISCIPLINE.',
    body: 'You trade real historical data, but the dates are hidden and the chart only reveals one bar at a time. No rewinding. No peeking.',
    visual: 'chart' as const,
  },
  {
    headline: 'RANK UP.',
    headline2: 'EARN YOUR TIER.',
    body: 'Climb from Gambler → Paper Hands → Sniper → Inside Trader → Market Maker. Your rank is computed from your last 200 trades.',
    visual: 'ranks' as const,
  },
  {
    headline: 'EVERY TRADE',
    headline2: 'AUTO-LOGGED.',
    body: 'Closed trades are auto-saved with stats, R-multiple, screenshots, and notes. Review your edge in the journal.',
    visual: 'journal' as const,
  },
  {
    headline: 'COMPETE.',
    headline2: 'CLIMB. WIN.',
    body: 'Global leaderboards reset weekly and monthly. Monthly tournaments score by consistency, not just total profit.',
    visual: 'leaderboards' as const,
  },
];

export default function FeatureTourScreen({ navigation }: Props) {
  const [page, setPage] = useState(0);
  const scrollRef = useRef<ScrollView>(null);

  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const newPage = Math.round(e.nativeEvent.contentOffset.x / SCREEN_W);
    if (newPage !== page) setPage(newPage);
  };

  const next = () => {
    if (page < SLIDES.length - 1) {
      scrollRef.current?.scrollTo({ x: (page + 1) * SCREEN_W, animated: true });
      setPage(page + 1);
    } else {
      navigation.replace('Main');
    }
  };

  const skip = () => navigation.replace('Main');

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>FEATURE TOUR</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Step dots */}
      <View style={styles.stepDots}>
        {SLIDES.map((_, i) => (
          <React.Fragment key={i}>
            <View style={[styles.stepDot, i <= page && styles.stepDotActive]}>
              <Text style={[styles.stepDotText, i <= page && styles.stepDotTextActive]}>{i + 1}</Text>
            </View>
            {i < SLIDES.length - 1 && <View style={[styles.stepConnector, i < page && styles.stepConnectorActive]} />}
          </React.Fragment>
        ))}
      </View>

      {/* Slides */}
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        style={{ flex: 1 }}
      >
        {SLIDES.map((slide, i) => (
          <View key={i} style={styles.slide}>
            <Text style={styles.headline}>{slide.headline}</Text>
            <Text style={styles.headline}>{slide.headline2}</Text>
            <Text style={styles.body}>{slide.body}</Text>

            <View style={styles.visualBox}>
              {slide.visual === 'chart' && <ChartVisual />}
              {slide.visual === 'ranks' && <RanksVisual />}
              {slide.visual === 'journal' && <JournalVisual />}
              {slide.visual === 'leaderboards' && <LeaderboardsVisual />}
            </View>
          </View>
        ))}
      </ScrollView>

      {/* Pagination dots */}
      <View style={styles.pagination}>
        {SLIDES.map((_, i) => (
          <View key={i} style={[styles.pageDot, i === page && styles.pageDotActive]} />
        ))}
      </View>

      {/* Bottom CTAs */}
      <View style={styles.bottom}>
        <TouchableOpacity style={styles.cta} onPress={next} activeOpacity={0.85}>
          <Text style={styles.ctaText}>{page === SLIDES.length - 1 ? 'START TRADING' : 'NEXT'}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={skip} style={styles.skipBtn}>
          <Text style={styles.skipText}>SKIP TOUR</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

// ─── Visual decorations per slide ──────────────────────────────────────────

function ChartVisual() {
  return (
    <View style={styles.visualInner}>
      <Ionicons name="bar-chart" size={120} color={colors.gold} style={{ opacity: 0.85 }} />
      <View style={styles.miniBadge}>
        <Text style={styles.miniBadgeText}>NEXT BAR  ▶▶</Text>
      </View>
    </View>
  );
}

function RanksVisual() {
  const tiers = [
    { name: 'Gambler', color: colors.rankGambler },
    { name: 'Paper Hands', color: colors.rankPaperHands },
    { name: 'Sniper', color: colors.rankSniper },
    { name: 'Inside Trader', color: colors.rankInsideTrader },
    { name: 'Market Maker', color: colors.rankMarketMaker },
  ];
  return (
    <View style={[styles.visualInner, { gap: spacing.xs }]}>
      {tiers.map((t, i) => (
        <View key={t.name} style={[styles.rankPill, { borderColor: t.color }]}>
          <View style={[styles.rankDot, { backgroundColor: t.color }]} />
          <Text style={[styles.rankName, { color: t.color }]}>{t.name}</Text>
        </View>
      ))}
    </View>
  );
}

function JournalVisual() {
  return (
    <View style={styles.visualInner}>
      <Ionicons name="document-text-outline" size={120} color={colors.gold} style={{ opacity: 0.85 }} />
    </View>
  );
}

function LeaderboardsVisual() {
  return (
    <View style={styles.visualInner}>
      <Ionicons name="trophy" size={120} color={colors.gold} style={{ opacity: 0.85 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: {
    color: colors.textPrimary, fontSize: fontSize.md,
    fontWeight: fontWeight.bold, letterSpacing: letterSpacing.ultraWide,
  },

  stepDots: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.md },
  stepDot: {
    width: 28, height: 28, borderRadius: 14,
    borderWidth: 1.5, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.bg,
  },
  stepDotActive: { borderColor: colors.gold, backgroundColor: colors.gold },
  stepDotText: { color: colors.textSecondary, fontSize: 12, fontWeight: fontWeight.bold },
  stepDotTextActive: { color: colors.bg },
  stepConnector: { width: 24, height: 1.5, backgroundColor: colors.border },
  stepConnectorActive: { backgroundColor: colors.gold },

  slide: {
    width: SCREEN_W, paddingHorizontal: spacing.xl, paddingTop: spacing.xl,
  },
  headline: {
    color: colors.gold, fontSize: 26, fontWeight: fontWeight.black, letterSpacing: 1,
  },
  body: {
    color: colors.textSecondary, fontSize: fontSize.md, lineHeight: 22,
    marginTop: spacing.md,
  },
  visualBox: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    borderWidth: 1, borderColor: colors.border,
    marginTop: spacing.xl,
    minHeight: 240,
    alignItems: 'center', justifyContent: 'center',
    padding: spacing.lg,
  },
  visualInner: { alignItems: 'center', justifyContent: 'center' },

  miniBadge: {
    marginTop: spacing.lg,
    backgroundColor: colors.gold,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderRadius: radius.md,
  },
  miniBadgeText: { color: colors.bg, fontWeight: fontWeight.bold, fontSize: fontSize.sm, letterSpacing: 1.5 },

  rankPill: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderRadius: radius.pill,
    paddingHorizontal: spacing.md, paddingVertical: 6,
    minWidth: 180,
  },
  rankDot: { width: 8, height: 8, borderRadius: 4, marginRight: spacing.sm },
  rankName: { fontWeight: fontWeight.bold, fontSize: fontSize.sm },

  pagination: { flexDirection: 'row', justifyContent: 'center', paddingVertical: spacing.md, gap: 6 },
  pageDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.border },
  pageDotActive: { backgroundColor: colors.gold, width: 18 },

  bottom: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xl, paddingTop: spacing.sm },
  cta: { backgroundColor: colors.gold, borderRadius: radius.lg, paddingVertical: 18, alignItems: 'center' },
  ctaText: { color: colors.bg, fontSize: fontSize.md, fontWeight: fontWeight.bold, letterSpacing: 2 },
  skipBtn: { paddingVertical: spacing.md, alignItems: 'center' },
  skipText: { color: colors.textSecondary, fontSize: fontSize.sm, fontWeight: fontWeight.semibold, letterSpacing: 1.5 },
});
