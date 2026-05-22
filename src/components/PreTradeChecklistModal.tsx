import React, { useEffect, useState } from 'react';
import {
  View, Text, Modal, Pressable, ScrollView, StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import {
  XIcon, LightbulbIcon, CheckCircleIcon,
} from 'phosphor-react-native';

import Button from './ui/Button';
import { LibrarySetup, CATEGORY_LABEL } from '../data/setupLibrary';
import { colors, typography, borders, surface } from '../theme';

/**
 * Pre-trade discipline checklist — symmetric counterpart to
 * PostTradeSummaryModal. Same surface.l0 background, same
 * full-screen slide-up presentation, same bottom-pinned Primary
 * CTA so pre/post bracket the trade with one visual language.
 *
 * Flow: 5-item checklist gates "Place trade". Each row is a
 * Pressable that toggles the item; the CTA stays disabled until
 * every item is checked. A "Skip checklist this time" tertiary
 * link below the CTA lets the user out without completing —
 * the resulting trade carries `checklistSkipped: true`.
 *
 * Setup context (top of screen) is auto-filled when the trade
 * was launched from Today's Mission / Setup detail. When the
 * user entered the Chart directly without a setup context, a
 * small Tertiary "Tag a setup →" link routes to Setup Library
 * (picker UI deferred).
 */

const GOLD  = colors.gold;
const WHITE = colors.textPrimary;

const CHECKLIST_ITEMS: ReadonlyArray<string> = [
  "I've confirmed the setup is valid right now",
  "I've set my stop loss BEFORE entry",
  "I've set my profit target",
  "I'm risking no more than my plan allows",
  "I'm not trading on emotion (revenge, FOMO, boredom)",
];

export interface PreTradeChecklistResult {
  /** Every item checked. */
  checklistPassed: boolean;
  /** User tapped "Skip checklist this time" instead of completing. */
  checklistSkipped: boolean;
}

interface Props {
  visible: boolean;
  /** Direction the user is about to take — drives the CTA label
   *  ("Place buy" / "Place sell"). Closing implicitly cancels. */
  direction: 'long' | 'short';
  /** Optional setup context — populated when the trade was
   *  launched from Today's Mission / Setup detail / a saved
   *  setup. Hidden when null. */
  setup: LibrarySetup | null;
  /** Tap on "Tag a setup →" when `setup` is null — routes to the
   *  Setup Library. Provided by the caller. */
  onTagSetup?: () => void;
  /** Trade proceeds. Caller stages the actual order. */
  onConfirm: (result: PreTradeChecklistResult) => void;
  /** Backdrop / hardware-back / X close — abort, no trade placed. */
  onCancel: () => void;
}

export default function PreTradeChecklistModal({
  visible, direction, setup, onTagSetup, onConfirm, onCancel,
}: Props) {
  const [checked, setChecked] = useState<boolean[]>(
    () => CHECKLIST_ITEMS.map(() => false),
  );

  // Fresh state every open — state persists per-modal-instance
  // only, never bleeds across trades.
  useEffect(() => {
    if (visible) setChecked(CHECKLIST_ITEMS.map(() => false));
  }, [visible]);

  const allChecked = checked.every(Boolean);
  const directionLabel = direction === 'short' ? 'sell' : 'buy';

  const toggle = (i: number) =>
    setChecked((prev) => prev.map((v, idx) => (idx === i ? !v : v)));

  const handlePlace = () =>
    onConfirm({ checklistPassed: true, checklistSkipped: false });

  const handleSkip = () =>
    onConfirm({ checklistPassed: false, checklistSkipped: true });

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onCancel}
    >
      <SafeAreaView edges={['top', 'bottom']} style={styles.root}>
        {/* Close X (top-right). */}
        <View style={styles.headerBar}>
          <View style={{ flex: 1 }} />
          <Pressable
            onPress={onCancel}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={({ pressed }) => [styles.closeBtn, pressed && { opacity: 0.5 }]}
            accessibilityRole="button"
            accessibilityLabel="Cancel"
          >
            <XIcon size={22} weight="bold" color="rgba(255,255,255,0.7)" />
          </Pressable>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Setup context — auto-filled or "Tag a setup →" link. */}
          <View style={styles.contextWrap}>
            <Text style={styles.contextEyebrow}>TRADING SETUP</Text>
            {setup ? (
              <>
                <Text style={[typography.h1, styles.contextTitle]} numberOfLines={2}>
                  {setup.name}
                </Text>
                <Text style={styles.contextSubline}>
                  {(CATEGORY_LABEL[setup.category] ?? setup.category).toUpperCase()}
                  {' · '}
                  {setup.difficulty.toUpperCase()}
                </Text>
              </>
            ) : (
              <>
                <Text style={[typography.h1, styles.contextTitle]} numberOfLines={2}>
                  Untagged trade
                </Text>
                {onTagSetup && (
                  <View style={styles.tagSetupWrap}>
                    <Button
                      label="Tag a setup"
                      variant="tertiary"
                      onPress={onTagSetup}
                    />
                  </View>
                )}
              </>
            )}
          </View>

          {/* Setup's one-line rule — same gold-on-gold tip card
              the Today's Mission card uses. */}
          {setup?.howToTrade && (
            <TipCard text={setup.howToTrade.split('\n')[0]} />
          )}

          {/* Discipline checklist — 5 yes/no items. */}
          <View style={[styles.card, styles.sectionGap]}>
            <Text style={styles.cardEyebrow}>BEFORE YOU CLICK</Text>
            {CHECKLIST_ITEMS.map((text, i) => (
              <ChecklistRow
                key={i}
                text={text}
                checked={checked[i]}
                onToggle={() => toggle(i)}
                showDivider={i < CHECKLIST_ITEMS.length - 1}
              />
            ))}
          </View>
        </ScrollView>

        {/* Bottom CTA + skip link. */}
        <View style={styles.bottomCta}>
          <Button
            label={allChecked ? `Place ${directionLabel}` : 'Complete checklist to continue'}
            variant="primary"
            hero={allChecked}
            disabled={!allChecked}
            onPress={handlePlace}
          />
          <Pressable
            onPress={handleSkip}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            style={({ pressed }) => [
              styles.skipLinkWrap,
              pressed && { opacity: 0.5 },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Skip checklist this time"
          >
            <Text style={styles.skipLinkText}>Skip checklist this time</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

// ── Tip card (mirrors the Today's Mission gold tip card) ────────

function TipCard({ text }: { text: string }) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  return (
    <View
      style={[styles.tipCard, styles.sectionGap]}
      onLayout={(e) => {
        const { width, height } = e.nativeEvent.layout;
        setSize({ w: width, h: height });
      }}
    >
      {/* Subtle radial gold ambient — same recipe used elsewhere. */}
      {size.w > 0 && (
        <Svg
          width={size.w}
          height={size.h}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        >
          <Defs>
            <RadialGradient id="tipGlow" cx="50%" cy="35%" rx="65%" ry="55%">
              <Stop offset="0" stopColor={GOLD} stopOpacity="0.06" />
              <Stop offset="1" stopColor={GOLD} stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Rect x={0} y={0} width={size.w} height={size.h} fill="url(#tipGlow)" />
        </Svg>
      )}
      <View style={styles.tipInner}>
        <LightbulbIcon
          size={16}
          weight="fill"
          color="rgba(255,184,0,0.9)"
          style={styles.tipIcon}
        />
        <Text style={[styles.tipText]}>{text}</Text>
      </View>
    </View>
  );
}

// ── Checklist row ────────────────────────────────────────────────

function ChecklistRow({
  text, checked, onToggle, showDivider,
}: {
  text: string;
  checked: boolean;
  onToggle: () => void;
  showDivider: boolean;
}) {
  return (
    <>
      <Pressable
        onPress={onToggle}
        style={({ pressed }) => [
          styles.checkRow,
          pressed && { opacity: 0.7 },
        ]}
        accessibilityRole="checkbox"
        accessibilityState={{ checked }}
        accessibilityLabel={text}
      >
        <CheckCircleIcon
          size={24}
          weight={checked ? 'fill' : 'regular'}
          color={checked ? GOLD : 'rgba(255,255,255,0.6)'}
          style={styles.checkIcon}
        />
        <Text
          style={[
            styles.checkText,
            checked && { color: WHITE },
          ]}
          numberOfLines={2}
        >
          {text}
        </Text>
      </Pressable>
      {showDivider && <View style={styles.checkDivider} />}
    </>
  );
}

// ── Styles ─────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: surface.l0 },

  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 6,
  },
  closeBtn: { padding: 4 },

  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },

  // Setup context
  contextWrap: {
    marginTop: 8,
    alignItems: 'center',
  },
  contextEyebrow: {
    color: GOLD,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  contextTitle: {
    color: WHITE,
    textAlign: 'center',
    maxWidth: 320,
  },
  contextSubline: {
    marginTop: 6,
    color: 'rgba(255,255,255,0.6)',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  tagSetupWrap: {
    marginTop: 8,
  },

  sectionGap: { marginTop: 20 },

  // Gold tip card — same treatment as Today's Mission.
  tipCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(255, 184, 0, 0.06)',
    borderColor: 'rgba(255, 184, 0, 0.16)',
    borderWidth: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  tipInner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  tipIcon: { marginRight: 8, marginTop: 2 },
  tipText: {
    flex: 1,
    color: 'rgba(255,184,0,0.9)',
    fontSize: 13,
    fontStyle: 'italic',
    lineHeight: 19,
  },

  // Checklist card
  card: {
    backgroundColor: surface.l1,
    borderColor: borders.card,
    borderWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16,
    padding: 16,
  },
  cardEyebrow: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
    marginBottom: 12,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  checkIcon: { marginRight: 12 },
  checkText: {
    flex: 1,
    color: 'rgba(255,255,255,0.7)',
    fontSize: 15,
    fontWeight: '500',
    lineHeight: 22,
  },
  checkDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
    marginLeft: 36,
  },

  // Bottom CTA
  bottomCta: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
  },
  skipLinkWrap: {
    marginTop: 12,
    alignSelf: 'center',
    paddingVertical: 6,
  },
  skipLinkText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 13,
    fontWeight: '500',
    letterSpacing: 0.2,
  },
});
