import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

import { ChallengeInstance } from '../store/challengeStore';
import { getTemplate, challengeIcon } from '../data/challengePool';
import ProgressBar from './ProgressBar';
import NumericText from './NumericText';
import { colors as DT } from '../theme/tokens';

/**
 * Collapsed long-term goals row (DESIGN_AUDIT §3.1).
 *
 * Default: single 1-line row "Long-term goals · 0/5 weekly ·
 * 0/20 monthly        v". Tap → expand to the existing two
 * cards (weekly + monthly) with their distinctive green / red
 * left-accent stripes.
 */

const GREEN = '#00D395';
const RED   = '#FF4757';
const GOLD  = '#FFB800';
const WHITE = '#FFFFFF';
// Long-term goals are secondary — L1 in the layered surface system.
const CARD_BG     = '#0A0A0A';
const CARD_BORDER = '#1F1F1F';

interface Props {
  weekly: ChallengeInstance | null;
  monthly: ChallengeInstance | null;
}

export default function LongTermGoalsCollapsible({ weekly, monthly }: Props) {
  const [expanded, setExpanded] = useState(false);
  if (!weekly && !monthly) return null;

  const summary = [
    weekly
      ? `${Math.floor(weekly.progress)}/${weekly.target} weekly`
      : null,
    monthly
      ? `${Math.floor(monthly.progress)}/${monthly.target} monthly`
      : null,
  ].filter(Boolean).join(' · ');

  return (
    <View>
      <Pressable
        onPress={() => setExpanded((v) => !v)}
        style={({ pressed }) => [styles.row, pressed && { opacity: 0.8 }]}
        accessibilityRole="button"
        accessibilityLabel={
          expanded ? 'Collapse long-term goals' : 'Expand long-term goals'
        }
        accessibilityState={{ expanded }}
      >
        <Text style={styles.rowTitle} numberOfLines={1}>
          Long-term goals
          {' · '}
          <NumericText style={styles.rowSub}>{summary}</NumericText>
        </Text>
        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={16}
          color="rgba(255,255,255,0.45)"
        />
      </Pressable>

      {expanded && (
        <View style={styles.expandWrap}>
          {weekly && <LongTermCard inst={weekly} tag="WEEKLY" stripe={GREEN} />}
          {monthly && <LongTermCard inst={monthly} tag="MONTHLY" stripe={RED} />}
        </View>
      )}
    </View>
  );
}

function LongTermCard({
  inst, tag, stripe,
}: { inst: ChallengeInstance; tag: 'WEEKLY' | 'MONTHLY'; stripe: string }) {
  const t = getTemplate(inst.challengeId);
  if (!t) return null;
  const pct = Math.min(1, inst.target > 0 ? inst.progress / inst.target : 0);
  return (
    <View style={[styles.card, inst.completed && styles.cardDone]}>
      <View style={[styles.accent, { backgroundColor: stripe }]} />
      <View style={styles.cardInner}>
        <View style={styles.cardTopRow}>
          <MaterialCommunityIcons
            name={challengeIcon(t.category) as any}
            size={16}
            color="rgba(255,255,255,0.45)"
            style={{ marginRight: 8 }}
          />
          <Text style={styles.cardTag}>{tag}</Text>
          <Text style={[styles.cardName, { flex: 1 }]} numberOfLines={1}>
            {t.name}
          </Text>
          {inst.completed ? (
            <Ionicons name="checkmark-circle" size={18} color={GREEN} />
          ) : (
            <NumericText bold style={styles.cardProg}>
              {Math.floor(inst.progress)}/{inst.target}
            </NumericText>
          )}
        </View>
        <View style={styles.cardMetaRow}>
          <NumericText bold style={styles.cardXp} allowFontScaling={false}>
            {inst.completed ? `✓ +${inst.xpReward} XP` : `+${inst.xpReward} XP`}
          </NumericText>
        </View>
        <View style={{ marginTop: 8 }}>
          <ProgressBar
            progress={pct}
            size="md"
            variant={inst.completed ? 'green' : 'gold'}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: CARD_BG,
    borderColor: CARD_BORDER,
    borderWidth: 1,
    borderTopColor: DT.hairlineHighlight,
    borderRadius: 12,
  },
  rowTitle: {
    color: WHITE,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: -0.1,
    flex: 1,
  },
  rowSub: {
    color: 'rgba(255,255,255,0.55)',
    fontWeight: '600',
  },
  expandWrap: {
    marginTop: 8,
    gap: 8,
  },
  card: {
    flexDirection: 'row',
    backgroundColor: CARD_BG,
    borderColor: CARD_BORDER,
    borderWidth: 1,
    borderTopColor: DT.hairlineHighlight,
    borderRadius: 12,
    overflow: 'hidden',
  },
  cardDone: { borderColor: GREEN },
  accent: { width: 3 },
  cardInner: { flex: 1, paddingVertical: 13, paddingHorizontal: 12 },
  cardTopRow: { flexDirection: 'row', alignItems: 'center' },
  cardTag: {
    color: GOLD,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    marginRight: 6,
  },
  cardName: {
    color: WHITE,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: -0.1,
  },
  cardProg: {
    marginLeft: 8,
    color: WHITE,
    fontSize: 13,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  cardMetaRow: { marginTop: 6 },
  cardXp: {
    color: GOLD,
    fontSize: 12,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
});
