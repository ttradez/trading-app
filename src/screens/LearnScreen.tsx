import React, { useMemo, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Pressable, LayoutChangeEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  type Icon,
  TrendUpIcon,
  ArrowsCounterClockwiseIcon,
  ArrowsHorizontalIcon,
  EyeIcon,
} from 'phosphor-react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';

import Button from '../components/ui/Button';
import PressableCard from '../components/PressableCard';
import {
  SETUP_LIBRARY_COUNT, CATEGORY_LABEL, LibrarySetup,
} from '../data/setupLibrary';
import { useLearnProgressStore } from '../store/learnProgressStore';
import {
  PATH_ORDER, pickNextSetup, setupsInPath, NextUpReason,
} from '../lib/nextSetup';
import { colors, typography, borders, surface } from '../theme';

/**
 * Learn — curriculum home. Hero recommendation at the top (Next
 * Up / Revisit), 2×2 skill-path grid that maps to Setup Library
 * filters, and a "Browse all" fallback below.
 *
 * Path cards tap-through to the existing Setup Library screen with
 * tab + filter params pre-applied; the Setup Detail mount marks
 * the setup as opened so the progress counts update on return.
 */

const GOLD  = '#FFB800';
const WHITE = colors.textPrimary;

interface PathMeta {
  key: string;
  name: string;
  Icon: Icon;
  routeParams: { tab: 'classic' | 'ict'; filter: string };
  path: typeof PATH_ORDER[number];
}

const PATHS: ReadonlyArray<PathMeta> = [
  {
    key: 'momentum',
    name: 'Momentum',
    Icon: TrendUpIcon,
    routeParams: { tab: 'classic', filter: 'momentum' },
    path: { kind: 'classic', category: 'momentum' },
  },
  {
    key: 'reversal',
    name: 'Reversal',
    Icon: ArrowsCounterClockwiseIcon,
    routeParams: { tab: 'classic', filter: 'reversal' },
    path: { kind: 'classic', category: 'reversal' },
  },
  {
    key: 'range',
    name: 'Range',
    Icon: ArrowsHorizontalIcon,
    routeParams: { tab: 'classic', filter: 'range' },
    path: { kind: 'classic', category: 'range' },
  },
  {
    key: 'ict',
    name: 'ICT',
    // ICT's signature concept is "smart money" / eyes-on-the-market —
    // Eye is the closest available glyph.
    Icon: EyeIcon,
    routeParams: { tab: 'ict', filter: 'all' },
    path: { kind: 'ict' },
  },
];

export default function LearnScreen({ navigation }: any) {
  const openedSetupIds = useLearnProgressStore((s) => s.openedSetupIds);

  const nextUp = useMemo(
    () => pickNextSetup(openedSetupIds),
    [openedSetupIds],
  );

  const goToSetupDetail = (setupId: string) =>
    navigation.navigate('SetupDetail', { setupId });

  const goToLibraryWith = (params: { tab: string; filter: string }) =>
    navigation.navigate('SetupLibrary', params);

  return (
    <SafeAreaView edges={['top']} style={styles.root}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={[typography.display, styles.title]}>Learn</Text>
          <Text style={[typography.body, styles.subtitle]}>
            Master the patterns. Practice on real history.
          </Text>
        </View>

        {/* Next Up hero */}
        <View style={styles.sectionGap}>
          <NextUpHero
            setup={nextUp.setup}
            reason={nextUp.reason}
            onStart={() => goToSetupDetail(nextUp.setup.id)}
          />
        </View>

        {/* Paths grid 2×2 */}
        <View style={[styles.pathsGrid, styles.sectionGap]}>
          {PATHS.map((p) => (
            <PathCard
              key={p.key}
              meta={p}
              opened={openedSetupIds}
              onPress={() => goToLibraryWith(p.routeParams)}
            />
          ))}
        </View>

        {/* Browse all patterns — fallback below the grid. */}
        <PressableCard
          baseBg={surface.l1}
          onPress={() => goToLibraryWith({ tab: 'classic', filter: 'all' })}
          style={[styles.browseCard, styles.sectionGap]}
          accessibilityLabel={`Browse all ${SETUP_LIBRARY_COUNT} patterns`}
        >
          <Ionicons name="book-outline" size={20} color={GOLD} />
          <View style={styles.browseText}>
            <Text style={styles.browseTitle}>Browse all patterns</Text>
            <Text style={styles.browseSub}>
              {SETUP_LIBRARY_COUNT} setups across every path
            </Text>
          </View>
          <Ionicons
            name="chevron-forward"
            size={18}
            color="rgba(255,255,255,0.3)"
          />
        </PressableCard>

        {/* Footer — future curriculum slot. */}
        <View style={[styles.footer, styles.sectionGap]}>
          <Text style={styles.footerEyebrow}>MORE COMING SOON</Text>
          <Text style={styles.footerBody}>
            Risk management, position sizing, and trade journaling
            lessons are on the way.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Next Up hero ─────────────────────────────────────────────────

function NextUpHero({
  setup, reason, onStart,
}: { setup: LibrarySetup; reason: NextUpReason; onStart: () => void }) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setSize({ w: width, h: height });
  };
  return (
    <View style={styles.heroCard} onLayout={onLayout}>
      <HeroGlow width={size.w} height={size.h} />
      <View style={styles.heroInner}>
        <Text style={styles.heroEyebrow}>{reason}</Text>
        <Text style={[typography.h1, styles.heroTitle]} numberOfLines={2}>
          {setup.name}
        </Text>
        <Text style={styles.heroCategory}>
          {(CATEGORY_LABEL[setup.category] ?? setup.category).toUpperCase()}
        </Text>
        <Text style={[typography.body, styles.heroTeaser]} numberOfLines={2}>
          {setup.description}
        </Text>
        <View style={styles.heroCtaWrap}>
          <Button
            label="Start learning"
            variant="primary"
            onPress={onStart}
          />
        </View>
      </View>
    </View>
  );
}

function HeroGlow({ width, height }: { width: number; height: number }) {
  if (width <= 0) return null;
  // Same gold@6% radial used on Today's Mission — stage cue without
  // touching the surface palette.
  return (
    <Svg
      width={width}
      height={height}
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
    >
      <Defs>
        <RadialGradient id="heroGlow" cx="50%" cy="35%" rx="65%" ry="55%">
          <Stop offset="0" stopColor={GOLD} stopOpacity="0.06" />
          <Stop offset="1" stopColor={GOLD} stopOpacity="0" />
        </RadialGradient>
      </Defs>
      <Rect x={0} y={0} width={width} height={height} fill="url(#heroGlow)" />
    </Svg>
  );
}

// ── Path card ─────────────────────────────────────────────────────

function PathCard({
  meta, opened, onPress,
}: {
  meta: PathMeta;
  opened: ReadonlySet<string>;
  onPress: () => void;
}) {
  const setups = useMemo(() => setupsInPath(meta.path), [meta.path]);
  const openedCount = useMemo(
    () => setups.reduce((n, s) => (opened.has(s.id) ? n + 1 : n), 0),
    [setups, opened],
  );
  const total = setups.length;

  return (
    <PressableCard
      onPress={onPress}
      baseBg={surface.l1}
      style={styles.pathCard}
      accessibilityLabel={
        `${meta.name} path, ${openedCount} of ${total} opened`
      }
    >
      <meta.Icon size={28} weight="bold" color="rgba(255,255,255,0.8)" />
      <Text style={[typography.h2, styles.pathName]}>{meta.name}</Text>
      <Text style={styles.pathProgress}>
        {openedCount} / {total} opened
      </Text>
    </PressableCard>
  );
}

// ── Styles ─────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 100,
  },
  sectionGap: { marginTop: 24 },

  // Header
  header: { paddingTop: 8 },
  title: { color: WHITE },
  subtitle: {
    marginTop: 6,
    color: 'rgba(255,255,255,0.6)',
  },

  // Hero card — L2 surface, full-width.
  heroCard: {
    backgroundColor: surface.l2,
    borderColor: borders.card,
    borderWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16,
    overflow: 'hidden',
  },
  heroInner: {
    padding: 20,
  },
  heroEyebrow: {
    color: GOLD,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  heroTitle: {
    marginTop: 8,
    color: WHITE,
  },
  heroCategory: {
    marginTop: 4,
    color: 'rgba(255,255,255,0.6)',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  heroTeaser: {
    marginTop: 10,
    color: 'rgba(255,255,255,0.75)',
  },
  heroCtaWrap: { marginTop: 18 },

  // Paths 2×2 grid.
  pathsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  pathCard: {
    // `flexBasis: 48%` with `flexGrow: 1` + a 12pt gap gives us two
    // even columns that handle any phone width cleanly.
    flexBasis: '48%',
    flexGrow: 1,
    minHeight: 120,
    padding: 16,
    backgroundColor: surface.l1,
    borderColor: borders.card,
    borderWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16,
  },
  pathName: {
    marginTop: 10,
    color: WHITE,
  },
  pathProgress: {
    marginTop: 4,
    color: 'rgba(255,255,255,0.6)',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    fontVariant: ['tabular-nums'],
  },

  // Browse-all card.
  browseCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 12,
    backgroundColor: surface.l1,
    borderColor: borders.card,
    borderWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16,
  },
  browseText: { flex: 1 },
  browseTitle: {
    color: WHITE,
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.1,
  },
  browseSub: {
    marginTop: 2,
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
    fontWeight: '600',
  },

  // Footer.
  footer: { paddingHorizontal: 4 },
  footerEyebrow: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  footerBody: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
  },
});
