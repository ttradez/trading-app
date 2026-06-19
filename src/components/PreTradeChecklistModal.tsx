import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, Modal, Pressable, ScrollView, TextInput,
  KeyboardAvoidingView, Platform, StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import {
  XIcon, LightbulbIcon, CheckCircleIcon,
} from 'phosphor-react-native';

import Button from './ui/Button';
import NumericText from './NumericText';
import {
  LibrarySetup, CATEGORY_LABEL,
  CLASSIC_SETUPS, ICT_SETUPS, getLibrarySetup,
} from '../data/setupLibrary';
import { colors, typography, borders, surface } from '../theme';

/**
 * Pre-trade discipline checklist + plan capture. Symmetric
 * counterpart to PostTradeSummaryModal — same surface.l0
 * background, same slide-up presentation, same bottom-pinned
 * Primary CTA so pre/post bracket the trade in one language.
 *
 * Capture surface: setup picker (if untagged), STOP / TARGET /
 * SIZE numeric inputs, live-computed RISK / REWARD / R:R, and
 * the 5-item discipline checklist. Place gates on plan + setup
 * + every item checked. Skip Checklist still requires the plan
 * — the discipline checks are skippable, the plan numbers aren't.
 */

const GOLD  = colors.gold;
const WHITE = colors.textPrimary;
const GREEN = colors.green;

const CHECKLIST_ITEMS: ReadonlyArray<string> = [
  "I've confirmed the setup is valid right now",
  "I've set my stop loss BEFORE entry",
  "I've set my profit target",
  "I'm risking no more than my plan allows",
  "I'm not trading on emotion (revenge, FOMO, boredom)",
];

export interface PreTradeChecklistResult {
  checklistPassed: boolean;
  checklistSkipped: boolean;
  setupId: string;
  intendedStop: number;
  intendedTarget: number;
  positionSize: number;
  intendedRisk: number;
  intendedRR: number;
}

interface Props {
  visible: boolean;
  direction: 'long' | 'short';
  /** Current price — used to seed numeric placeholders and as
   *  the entry-price reference for risk/reward calc. */
  currentPrice: number;
  /** $ per point for this symbol (market.contractSize). NQ = 20,
   *  ES = 50, etc. Drives the live risk/reward display. */
  pointValue: number;
  /** Decimal places for the symbol. */
  pricePrecision: number;
  /** Pre-set setup id when the trade was launched from Today's
   *  Mission / Setup detail / Saved Setups. Null when entered
   *  directly from the Chart. */
  initialSetupId?: string | null;
  /** Initial contract size — from the parent's `lots` state. */
  initialSize?: number;
  onConfirm: (result: PreTradeChecklistResult) => void;
  onCancel: () => void;
}

export default function PreTradeChecklistModal({
  visible, direction, currentPrice, pointValue, pricePrecision,
  initialSetupId, initialSize = 1,
  onConfirm, onCancel,
}: Props) {
  const [checked, setChecked] = useState<boolean[]>(
    () => CHECKLIST_ITEMS.map(() => false),
  );
  const [setupId, setSetupId] = useState<string | null>(initialSetupId ?? null);
  const [stopStr, setStopStr] = useState('');
  const [targetStr, setTargetStr] = useState('');
  const [sizeStr, setSizeStr] = useState(() => String(initialSize));
  const [pickerOpen, setPickerOpen] = useState(false);

  // Reset every open — checklist + plan inputs never bleed
  // between trades. Setup pre-fill comes from the prop.
  useEffect(() => {
    if (!visible) return;
    setChecked(CHECKLIST_ITEMS.map(() => false));
    setSetupId(initialSetupId ?? null);
    setStopStr('');
    setTargetStr('');
    setSizeStr(String(initialSize));
    setPickerOpen(false);
  }, [visible, initialSetupId, initialSize]);

  const setup = setupId ? getLibrarySetup(setupId) ?? null : null;
  const directionLabel = direction === 'short' ? 'sell' : 'buy';

  // Parse the plan numbers — empty / non-numeric → 0.
  const stop = parseNum(stopStr);
  const target = parseNum(targetStr);
  const size = parseNum(sizeStr);

  // Computed risk / reward / RR. All require a non-zero entry,
  // stop, target, and size to read sensibly.
  const risk = currentPrice > 0 && stop > 0 && size > 0
    ? Math.abs(currentPrice - stop) * size * pointValue
    : 0;
  const reward = currentPrice > 0 && target > 0 && size > 0
    ? Math.abs(target - currentPrice) * size * pointValue
    : 0;
  const rr = risk > 0 && reward > 0 ? reward / risk : 0;

  const allChecked = checked.every(Boolean);
  const planFilled = stop > 0 && target > 0 && size > 0;
  const canPlace = allChecked && planFilled && setupId !== null;
  const canSkip  = planFilled && setupId !== null;

  // Helper text — explains why CTAs are disabled.
  const helperText = (() => {
    if (canPlace) return '';
    const missing: string[] = [];
    if (setupId === null) missing.push('tag a setup');
    if (!planFilled) missing.push('fill the plan');
    if (!allChecked) missing.push('complete the checklist');
    return `Need to ${missing.join(' + ')} to continue`;
  })();

  const toggle = (i: number) =>
    setChecked((prev) => prev.map((v, idx) => (idx === i ? !v : v)));

  const buildResult = (skipped: boolean): PreTradeChecklistResult => ({
    checklistPassed: !skipped && allChecked,
    checklistSkipped: skipped,
    setupId: setupId!,
    intendedStop: stop,
    intendedTarget: target,
    positionSize: size,
    intendedRisk: risk,
    intendedRR: rr,
  });

  const handlePlace = () => onConfirm(buildResult(false));
  const handleSkip  = () => onConfirm(buildResult(true));

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onCancel}
    >
      <SafeAreaView edges={['top', 'bottom']} style={styles.root}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          {/* Close X */}
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
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Setup context — when set, shows centered name + subline.
                When null, shows a centered "Untagged trade" + Pick a
                setup link that opens the bottom-sheet picker. */}
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
                  <View style={styles.tagSetupWrap}>
                    <Button
                      label="Pick a setup"
                      variant="tertiary"
                      onPress={() => setPickerOpen(true)}
                    />
                  </View>
                </>
              )}
            </View>

            {/* One-line rule tip card — pulls the setup's how-to-trade
                hint when a setup is attached. */}
            {setup?.howToTrade && (
              <TipCard text={setup.howToTrade.split('\n')[0]} />
            )}

            {/* YOUR PLAN — capture stop / target / size + live risk /
                reward / R:R. */}
            <View style={[styles.card, styles.sectionGap]}>
              <View style={styles.planHeaderRow}>
                <Text style={styles.cardEyebrow}>YOUR PLAN</Text>
                {setup && (
                  <Pressable
                    onPress={() => setPickerOpen(true)}
                    hitSlop={6}
                    style={({ pressed }) => [pressed && { opacity: 0.6 }]}
                    accessibilityRole="button"
                    accessibilityLabel="Change setup"
                  >
                    <Text style={styles.changeLink}>Change</Text>
                  </Pressable>
                )}
              </View>

              <View style={styles.inputsRow}>
                <PlanInput
                  label="STOP"
                  value={stopStr}
                  onChange={setStopStr}
                  placeholder={currentPrice > 0 ? currentPrice.toFixed(pricePrecision) : 'Price'}
                />
                <View style={styles.inputDivider} />
                <PlanInput
                  label="TARGET"
                  value={targetStr}
                  onChange={setTargetStr}
                  placeholder={currentPrice > 0 ? currentPrice.toFixed(pricePrecision) : 'Price'}
                />
                <View style={styles.inputDivider} />
                <PlanInput
                  label="SIZE"
                  value={sizeStr}
                  onChange={setSizeStr}
                  placeholder="1"
                />
              </View>

              <View style={styles.computedRow}>
                <ComputedCell
                  label="RISK"
                  value={risk > 0 ? `$${formatAbsShort(risk)}` : '—'}
                />
                <ComputedCell
                  label="REWARD"
                  value={reward > 0 ? `$${formatAbsShort(reward)}` : '—'}
                />
                <ComputedCell
                  label="R:R"
                  value={rr > 0 ? rr.toFixed(2) : '—'}
                  valueColor={rr >= 1 ? GREEN : undefined}
                />
              </View>
            </View>

            {/* BEFORE YOU CLICK — 5-item discipline checklist. */}
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
              label={canPlace ? `Place ${directionLabel}` : 'Complete the plan to continue'}
              variant="primary"
              hero={canPlace}
              disabled={!canPlace}
              onPress={handlePlace}
            />
            {!canPlace && helperText.length > 0 && (
              <Text style={styles.helperText}>{helperText}</Text>
            )}
            {canSkip && !canPlace && (
              <Pressable
                onPress={handleSkip}
                hitSlop={6}
                style={({ pressed }) => [
                  styles.skipLinkWrap,
                  pressed && { opacity: 0.5 },
                ]}
                accessibilityRole="button"
                accessibilityLabel="Skip checklist this time"
              >
                <Text style={styles.skipLinkText}>Skip checklist this time</Text>
              </Pressable>
            )}
          </View>

          {/* Setup picker — nested Modal. */}
          <SetupPickerSheet
            visible={pickerOpen}
            onClose={() => setPickerOpen(false)}
            onPick={(id) => {
              setSetupId(id);
              setPickerOpen(false);
            }}
            selectedId={setupId}
          />
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

// ── Tip card ───────────────────────────────────────────────────────

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
        <Text style={styles.tipText}>{text}</Text>
      </View>
    </View>
  );
}

// ── Plan input / computed cells ───────────────────────────────────

function PlanInput({
  label, value, onChange, placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <View style={styles.inputCell}>
      <Text style={styles.inputLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor="rgba(255,255,255,0.25)"
        keyboardType="decimal-pad"
        selectionColor={GOLD}
        style={styles.input}
        returnKeyType="done"
      />
    </View>
  );
}

function ComputedCell({
  label, value, valueColor,
}: { label: string; value: string; valueColor?: string }) {
  return (
    <View style={styles.computedCell}>
      <Text style={styles.computedLabel}>{label}</Text>
      <NumericText
        bold
        style={[styles.computedValue, valueColor ? { color: valueColor } : null]}
        allowFontScaling={false}
      >
        {value}
      </NumericText>
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

// ── Setup picker (nested Modal) ──────────────────────────────────

function SetupPickerSheet({
  visible, onClose, onPick, selectedId,
}: {
  visible: boolean;
  onClose: () => void;
  onPick: (setupId: string) => void;
  selectedId: string | null;
}) {
  const sections = useMemo(() => [
    { title: 'CLASSIC', items: CLASSIC_SETUPS },
    { title: 'ICT',     items: ICT_SETUPS },
  ], []);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={Platform.OS !== 'ios'}
      presentationStyle={Platform.OS === 'ios' ? 'pageSheet' : undefined}
      onRequestClose={onClose}
    >
      <SafeAreaView edges={['top', 'bottom']} style={pickerStyles.root}>
        <View style={pickerStyles.headerBar}>
          <Text style={[typography.h1, pickerStyles.title]}>Pick a setup</Text>
          <Pressable
            onPress={onClose}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={({ pressed }) => [pickerStyles.closeBtn, pressed && { opacity: 0.5 }]}
            accessibilityRole="button"
            accessibilityLabel="Close"
          >
            <XIcon size={22} weight="bold" color="rgba(255,255,255,0.7)" />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={pickerStyles.scrollContent}>
          {sections.map((sec) => (
            <View key={sec.title} style={pickerStyles.section}>
              <Text style={pickerStyles.sectionEyebrow}>{sec.title}</Text>
              <View style={pickerStyles.sectionCard}>
                {sec.items.map((s, i) => {
                  const isSelected = selectedId === s.id;
                  return (
                    <React.Fragment key={s.id}>
                      <Pressable
                        onPress={() => onPick(s.id)}
                        style={({ pressed }) => [
                          pickerStyles.row,
                          pressed && { opacity: 0.6 },
                        ]}
                        accessibilityRole="button"
                        accessibilityState={{ selected: isSelected }}
                        accessibilityLabel={s.name}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={pickerStyles.rowName} numberOfLines={1}>
                            {s.name}
                          </Text>
                          <Text style={pickerStyles.rowCategory}>
                            {(CATEGORY_LABEL[s.category] ?? s.category).toUpperCase()}
                          </Text>
                        </View>
                        {isSelected && (
                          <CheckCircleIcon size={20} weight="fill" color={GOLD} />
                        )}
                      </Pressable>
                      {i < sec.items.length - 1 && <View style={pickerStyles.divider} />}
                    </React.Fragment>
                  );
                })}
              </View>
            </View>
          ))}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

// ── Helpers ────────────────────────────────────────────────────────

function parseNum(s: string): number {
  const t = s.trim();
  if (!t) return 0;
  const n = Number(t);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function formatAbsShort(n: number): string {
  return Math.round(n).toLocaleString('en-US');
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

  contextWrap: { marginTop: 8, alignItems: 'center' },
  contextEyebrow: {
    color: GOLD,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  contextTitle: { color: WHITE, textAlign: 'center', maxWidth: 320 },
  contextSubline: {
    marginTop: 6,
    color: 'rgba(255,255,255,0.6)',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  tagSetupWrap: { marginTop: 8 },

  sectionGap: { marginTop: 20 },

  // Gold tip card (same recipe as Today's Mission tip).
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

  // Generic L1 card
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
  },

  // Plan card — header row + inputs row + computed row
  planHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  changeLink: {
    color: GOLD,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  inputsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  inputCell: { flex: 1, paddingHorizontal: 4 },
  inputDivider: {
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
    marginVertical: 4,
  },
  inputLabel: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  input: {
    color: WHITE,
    fontSize: 16,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
    paddingVertical: 4,
    paddingHorizontal: 0,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.10)',
  },

  computedRow: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
    flexDirection: 'row',
  },
  computedCell: { flex: 1, alignItems: 'center' },
  computedLabel: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  computedValue: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 16,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },

  // Checklist
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
  helperText: {
    marginTop: 8,
    color: 'rgba(255,255,255,0.5)',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  skipLinkWrap: {
    marginTop: 8,
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

const pickerStyles = StyleSheet.create({
  root: { flex: 1, backgroundColor: surface.l0 },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 16,
  },
  title: { flex: 1, color: WHITE },
  closeBtn: { padding: 4 },

  scrollContent: { paddingHorizontal: 20, paddingBottom: 40 },
  section: { marginTop: 8 },
  sectionEyebrow: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
    marginBottom: 8,
    marginTop: 8,
  },
  sectionCard: {
    backgroundColor: surface.l1,
    borderColor: borders.card,
    borderWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.04)',
    borderRadius: 12,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  rowName: {
    color: WHITE,
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.1,
  },
  rowCategory: {
    marginTop: 3,
    color: 'rgba(255,255,255,0.5)',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
    marginLeft: 14,
  },
});
