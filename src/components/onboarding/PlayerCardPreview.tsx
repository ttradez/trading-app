import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../../theme';

/**
 * Live player-card preview used on the trader-name screen (and
 * reusable on later screens that show the user's identity). Renders
 * the user's current rank pill, display name, and @handle — values
 * pulled from the onboarding store and updated in real time.
 *
 * Today only Gambler is wired up. The other ranks (Paper Hands /
 * Sniper / Inside Trader / Market Maker) are colored from
 * `colors.rank*` so future screens can simply pass their rank id.
 */

export type Rank =
  | 'gambler'
  | 'paper_hands'
  | 'sniper'
  | 'inside_trader'
  | 'market_maker';

interface RankInfo {
  label: string;
  bg: string;
  textColor: string;
}

const RANKS: Record<Rank, RankInfo> = {
  gambler:       { label: 'GAMBLER',       bg: colors.rankGambler,      textColor: '#FFFFFF' },
  paper_hands:   { label: 'PAPER HANDS',   bg: colors.rankPaperHands,   textColor: '#FFFFFF' },
  sniper:        { label: 'SNIPER',        bg: colors.rankSniper,       textColor: '#FFFFFF' },
  inside_trader: { label: 'INSIDE TRADER', bg: colors.rankInsideTrader, textColor: '#000000' },
  market_maker:  { label: 'MARKET MAKER',  bg: colors.rankMarketMaker,  textColor: '#000000' },
};

interface Props {
  rank?: Rank;
  displayName: string;
  handle: string;
}

export default function PlayerCardPreview({
  rank = 'gambler', displayName, handle,
}: Props) {
  const r = RANKS[rank];
  const isNameEmpty   = displayName.trim().length === 0;
  const isHandleEmpty = handle.trim().length === 0;

  return (
    <View style={styles.card}>
      <View style={[styles.rankPill, { backgroundColor: r.bg }]}>
        <Text style={[styles.rankText, { color: r.textColor }]}>{r.label}</Text>
      </View>
      <Text
        style={[styles.displayName, isNameEmpty && styles.placeholder]}
        numberOfLines={1}
      >
        {isNameEmpty ? 'Your Name' : displayName}
      </Text>
      <Text
        style={[styles.handleLine, isHandleEmpty && styles.placeholder]}
        numberOfLines={1}
      >
        {isHandleEmpty ? '@your.handle' : '@' + handle}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#0F0F0F',
    // Subtle gold-tinted border so the card reads as a player-card
    // moment without competing with the gold CTA.
    borderColor: 'rgba(255, 184, 0, 0.2)',
    borderWidth: 1,
    borderRadius: 14,
    padding: 18,
    minHeight: 108,
  },
  rankPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    marginBottom: 12,
  },
  rankText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  displayName: {
    color: '#FFFFFF',
    fontSize: 23,
    fontWeight: '700',
    letterSpacing: -0.3,
    lineHeight: 28,
  },
  handleLine: {
    marginTop: 2,
    color: 'rgba(255,255,255,0.6)',
    fontSize: 15,
    fontWeight: '400',
    lineHeight: 20,
  },
  placeholder: {
    color: 'rgba(255,255,255,0.3)',
  },
});
