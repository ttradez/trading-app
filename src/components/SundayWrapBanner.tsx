import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';

import NumericText from './NumericText';
import Button from './ui/Button';
import { useRecapStore } from '../store/recapStore';
import { isoWeekId } from '../utils/weeklyRecap';
import { colors, surface } from '../theme';

/**
 * SundayWrapBanner — a quiet re-entry point pinned at the top of
 * Home that surfaces last week's recap during the Sun 00:00 →
 * Tue 23:59 (local) window.
 *
 * Target week — same as the auto-trigger hook so the banner and
 * the modal always agree:
 *  - Sun → current week (Mon…today)
 *  - Mon/Tue → previous full Mon–Sun week
 *
 * Visibility — ALL must hold:
 *  - today is Sun / Mon / Tue (local)
 *  - that week's recap exists in recapStore (i.e. ≥1 trade)
 *  - the user hasn't viewed the modal for that week
 *  - the user hasn't dismissed the banner for that week
 *
 * Dismissal is per-week: tapping the X stamps
 * `bannerDismissedAt`, which persists via AsyncStorage; opening
 * the recap modal stamps `viewedAt` (also persisted). Either flag
 * hides the banner for that week.
 */

const GOLD  = colors.gold;
const GREEN = colors.green;
const RED   = colors.red;
const WHITE = colors.textPrimary;

interface Props {
  onOpen: () => void;
}

function targetWeekIdNow(): string | null {
  const now = new Date();
  const dow = now.getDay();
  if (dow !== 0 && dow !== 1 && dow !== 2) return null;
  const ref =
    dow === 0 ? now : new Date(now.getTime() - 7 * 86_400_000);
  return isoWeekId(ref);
}

function formatNetShort(n: number): string {
  const sign = n > 0 ? '+' : n < 0 ? '-' : '';
  const abs = Math.round(Math.abs(n)).toLocaleString('en-US');
  return `${sign}$${abs}`;
}

function pnlColor(n: number): string {
  if (n > 0) return GREEN;
  if (n < 0) return RED;
  return WHITE;
}

export default function SundayWrapBanner({ onOpen }: Props) {
  const [weekId, setWeekId] = useState<string | null>(targetWeekIdNow);
  const recaps = useRecapStore((s) => s.recaps);
  const markBannerDismissed = useRecapStore((s) => s.markBannerDismissed);

  // Re-evaluate the target week if the user keeps Home open across
  // midnight Sun → Mon, or past Tue 23:59. Cheap interval; no need
  // to fight RN's foregrounding events.
  useEffect(() => {
    const t = setInterval(() => setWeekId(targetWeekIdNow()), 60_000);
    return () => clearInterval(t);
  }, []);

  if (!weekId) return null;
  const stored = recaps[weekId];
  if (!stored) return null;
  if (stored.viewedAt || stored.bannerDismissedAt) return null;
  if (stored.recap.totalTrades === 0) return null;

  const { totalPnL, totalTrades, winRate } = stored.recap;

  return (
    <View style={styles.card}>
      <View style={styles.iconWrap}>
        <MaterialCommunityIcons name="calendar-week" size={20} color={GOLD} />
      </View>
      <View style={styles.body}>
        <Text style={styles.eyebrow}>SUNDAY WRAP</Text>
        <Text style={styles.title}>Your week is ready</Text>
        <Text style={styles.sub}>
          <NumericText
            bold
            style={[styles.subNum, { color: pnlColor(totalPnL) }]}
          >
            {formatNetShort(totalPnL)}
          </NumericText>
          {' · '}
          <NumericText style={styles.subNum}>{totalTrades}</NumericText>
          {' '}{totalTrades === 1 ? 'trade' : 'trades'}
          {winRate != null && (
            <>
              {' · '}
              <NumericText style={styles.subNum}>{winRate}%</NumericText>
              {' win'}
            </>
          )}
        </Text>
        <View style={styles.ctaWrap}>
          <Button label="Open recap" variant="primary" onPress={onOpen} />
        </View>
      </View>
      <Pressable
        onPress={() => markBannerDismissed(weekId)}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        style={styles.dismiss}
        accessibilityRole="button"
        accessibilityLabel="Dismiss Sunday Wrap banner"
      >
        <Ionicons name="close" size={18} color="rgba(255,255,255,0.5)" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: surface.l2,
    borderColor: 'rgba(255, 184, 0, 0.18)',
    borderWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16,
    padding: 14,
    alignItems: 'flex-start',
    // Owned by the banner so its absence costs zero layout in the
    // Home scroll — when it returns null, the AtRiskChip + Today's
    // Mission stack their default spacing as if the banner were
    // never there.
    marginTop: 16,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 184, 0, 0.10)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  body: { flex: 1 },
  eyebrow: {
    color: GOLD,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  title: {
    marginTop: 4,
    color: WHITE,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  sub: {
    marginTop: 4,
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    fontWeight: '600',
  },
  subNum: {
    color: 'rgba(255,255,255,0.85)',
    fontWeight: '700',
  },
  ctaWrap: {
    marginTop: 12,
    alignSelf: 'flex-start',
  },
  dismiss: {
    padding: 4,
    marginLeft: 8,
  },
});

