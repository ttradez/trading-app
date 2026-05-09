import React, { useMemo, useRef, useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, Modal, Pressable, TouchableOpacity, ScrollView, TextInput,
  PanResponder, GestureResponderEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { ChartTheme } from './TradingChart';
import { colors, spacing, fontSize, fontWeight, radius, labelStyle } from '../../theme';

type Section = 'list' | 'symbol' | 'canvas' | 'trading' | 'alerts';
type ColorKey = keyof ChartTheme;

interface Props {
  visible: boolean;
  theme: ChartTheme;
  onChange: (theme: ChartTheme) => void;
  onClose: () => void;
}

type BoolKey =
  | 'showBorders' | 'showWicks' | 'showGrid'
  | 'showEntryLine' | 'showSlLine' | 'showTpLine';

interface SettingRow {
  label: string;
  // Optional visibility checkbox controlling a boolean field on the theme.
  toggleKey?: BoolKey;
  // Either one swatch OR a paired up/down (for candle parts).
  colorKey?: ColorKey;
  pairUp?:   ColorKey;
  pairDown?: ColorKey;
  upFallback?:   ColorKey;
  downFallback?: ColorKey;
}

const SYMBOL_ROWS: SettingRow[] = [
  { label: 'Body',    pairUp: 'upColor',         pairDown: 'downColor' },
  { label: 'Borders', toggleKey: 'showBorders',  pairUp: 'borderUpColor', pairDown: 'borderDownColor', upFallback: 'upColor', downFallback: 'downColor' },
  { label: 'Wick',    toggleKey: 'showWicks',    pairUp: 'wickUpColor',   pairDown: 'wickDownColor',   upFallback: 'upColor', downFallback: 'downColor' },
];

const CANVAS_ROWS: SettingRow[] = [
  { label: 'Background', colorKey: 'background' },
  { label: 'Grid',       toggleKey: 'showGrid', colorKey: 'gridColor' },
  { label: 'Text',       colorKey: 'textColor' },
  { label: 'Axis border', colorKey: 'borderColor' },
];

const TRADING_ROWS: SettingRow[] = [
  { label: 'Entry line',       toggleKey: 'showEntryLine', colorKey: 'entryColor' },
  { label: 'Stop loss line',   toggleKey: 'showSlLine',    colorKey: 'slColor' },
  { label: 'Take profit line', toggleKey: 'showTpLine',    colorKey: 'tpColor' },
];

// Build a TradingView-style HSL grid: 13 cols × 9 rows (top row = grayscale).
function hslHex(h: number, s: number, l: number): string {
  const sN = s / 100, lN = l / 100;
  const c = (1 - Math.abs(2 * lN - 1)) * sN;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = lN - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60)       { r = c; g = x; }
  else if (h < 120) { r = x; g = c; }
  else if (h < 180) {        g = c; b = x; }
  else if (h < 240) {        g = x; b = c; }
  else if (h < 300) { r = x;        b = c; }
  else              { r = c;        b = x; }
  const toHex = (n: number) => Math.round((n + m) * 255).toString(16).padStart(2, '0').toUpperCase();
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

// 11-col palette matching TradingView's color picker layout — top row grayscale,
// 8 rows of hues sweeping light → dark.
const HUES   = [0, 22, 45, 75, 130, 170, 200, 225, 270, 300, 335];          // 11 hues
const LIGHTS = [88, 78, 68, 58, 48, 38, 28, 18];                            // 8 brightness rows
const GRAYSCALE_ROW = [100, 92, 82, 70, 58, 46, 34, 22, 12, 6, 0]
  .map((l) => hslHex(0, 0, l));
const PALETTE_ROWS: string[][] = [
  GRAYSCALE_ROW,
  ...LIGHTS.map((l) => HUES.map((h) => hslHex(h, 78, l))),
];

// A short "favorites" strip beneath the main palette — mostly the chart-relevant
// presets the user is likely to pick.
const FAVORITES = [
  '#FFFFFF', '#22C55E', '#16A34A', '#26A69A', '#3B82F6',
  '#EAB308', '#F97316', '#A3A3A3', '#525252', '#000000',
];

function isValidHex(s: string): boolean {
  return /^#?[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/.test(s.trim());
}
function normalizeHex(s: string): string {
  const t = s.trim();
  return t.startsWith('#') ? t.toUpperCase() : `#${t.toUpperCase()}`;
}
/** Return the 6-char base hex (drops alpha if any). */
function hexBase(h: string): string {
  const t = h.startsWith('#') ? h.slice(1) : h;
  return `#${t.slice(0, 6).toUpperCase()}`;
}
/** Return the alpha as 0..1 from a #RRGGBBAA color, or 1 if no alpha. */
function hexAlpha(h: string): number {
  const t = h.startsWith('#') ? h.slice(1) : h;
  if (t.length < 8) return 1;
  return parseInt(t.slice(6, 8), 16) / 255;
}
/** Combine #RRGGBB + alpha (0..1) into #RRGGBBAA — or just #RRGGBB if alpha=1. */
function withAlpha(base: string, alpha: number): string {
  const a = Math.max(0, Math.min(1, alpha));
  if (a >= 0.999) return hexBase(base);
  const aa = Math.round(a * 255).toString(16).padStart(2, '0').toUpperCase();
  return `${hexBase(base)}${aa}`;
}

function OpacitySlider({ value, onChange, fillColor }: {
  value: number; onChange: (v: number) => void; fillColor: string;
}) {
  const [trackW, setTrackW] = useState(1);
  const trackWRef = useRef(1);
  useEffect(() => { trackWRef.current = trackW; }, [trackW]);

  const update = (e: GestureResponderEvent) => {
    const x = e.nativeEvent.locationX;
    const v = Math.max(0, Math.min(1, x / Math.max(1, trackWRef.current)));
    onChange(v);
  };

  const panResponder = useMemo(
    () => PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: update,
      onPanResponderMove:  update,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  return (
    <View
      style={sliderStyles.track}
      onLayout={(e) => setTrackW(e.nativeEvent.layout.width)}
      {...panResponder.panHandlers}
    >
      <View style={[sliderStyles.fill, { width: `${value * 100}%`, backgroundColor: fillColor }]} />
      <View style={[sliderStyles.thumb, { left: `${value * 100}%` }]} />
    </View>
  );
}

const sliderStyles = StyleSheet.create({
  track: {
    flex: 1,
    height: 6,
    backgroundColor: colors.cardAlt,
    borderRadius: 3,
    justifyContent: 'center',
    marginHorizontal: spacing.sm,
  },
  fill: {
    position: 'absolute', left: 0, top: 0, bottom: 0,
    borderRadius: 3,
  },
  thumb: {
    position: 'absolute',
    width: 18, height: 18, borderRadius: 9,
    backgroundColor: '#fff',
    borderWidth: 2, borderColor: colors.gold,
    marginLeft: -9, top: -6,
  },
});

export default function ChartSettingsModal({ visible, theme, onChange, onClose }: Props) {
  const [section, setSection] = useState<Section>('list');
  const [pickerKey, setPickerKey] = useState<ColorKey | null>(null);
  const [hex, setHex] = useState('');

  const close = () => { setSection('list'); setPickerKey(null); onClose(); };

  const colorAt = (key: ColorKey, fallback?: ColorKey): string =>
    (theme[key] as string | undefined)
    ?? (fallback ? (theme[fallback] as string) : '#000000');

  const [alpha, setAlpha] = useState(1);

  const openPicker = (key: ColorKey, currentColor: string) => {
    setPickerKey(key);
    setHex(hexBase(currentColor));
    setAlpha(hexAlpha(currentColor));
  };

  /** Live-apply: every palette tap / slider drag pushes the new color so the
   *  user sees the chart update immediately. The picker stays open until they
   *  tap outside or hit X. */
  const applyColor = (baseHex: string, a: number = alpha) => {
    if (!pickerKey) return;
    const next = withAlpha(baseHex, a);
    onChange({ ...theme, [pickerKey]: next });
    setHex(hexBase(baseHex));
  };
  const applyAlpha = (a: number) => {
    setAlpha(a);
    if (!pickerKey) return;
    const next = withAlpha(hex, a);
    onChange({ ...theme, [pickerKey]: next });
  };

  const toggleVisibility = (key: BoolKey) => {
    onChange({ ...theme, [key]: theme[key] === false ? true : false });
  };

  const Swatch = ({ color, onPress, dim }: { color: string; onPress: () => void; dim?: boolean }) => (
    <TouchableOpacity onPress={onPress} style={[styles.swatch, { backgroundColor: color }, dim && { opacity: 0.35 }]} />
  );

  const Checkbox = ({ checked, onPress }: { checked: boolean; onPress: () => void }) => (
    <TouchableOpacity onPress={onPress} style={[styles.checkbox, checked && styles.checkboxChecked]}>
      {checked && <Ionicons name="checkmark" size={14} color={colors.textInverse} />}
    </TouchableOpacity>
  );

  const renderRow = (row: SettingRow, idx: number) => {
    const visible = row.toggleKey ? theme[row.toggleKey] !== false : true;
    return (
      <View key={`${row.label}-${idx}`} style={styles.row}>
        <Text style={styles.rowLabel}>{row.label}</Text>
        <View style={styles.rowControls}>
          {row.toggleKey && (
            <Checkbox checked={visible} onPress={() => toggleVisibility(row.toggleKey!)} />
          )}
          {row.colorKey && (
            <Swatch
              color={colorAt(row.colorKey)}
              dim={!visible}
              onPress={() => openPicker(row.colorKey!, colorAt(row.colorKey!))}
            />
          )}
          {row.pairUp && row.pairDown && (
            <>
              <Swatch
                color={colorAt(row.pairUp, row.upFallback)}
                dim={!visible}
                onPress={() => openPicker(row.pairUp!, colorAt(row.pairUp!, row.upFallback))}
              />
              <Swatch
                color={colorAt(row.pairDown, row.downFallback)}
                dim={!visible}
                onPress={() => openPicker(row.pairDown!, colorAt(row.pairDown!, row.downFallback))}
              />
            </>
          )}
        </View>
      </View>
    );
  };

  const renderSection = (rows: SettingRow[], title: string) => (
    <View>
      <Text style={[labelStyle, styles.sectionLabel]}>{title}</Text>
      {rows.map(renderRow)}
    </View>
  );

  const renderHeader = (title: string) => (
    <View style={styles.header}>
      {section !== 'list' ? (
        <TouchableOpacity onPress={() => setSection('list')} style={styles.headerBtn}>
          <Ionicons name="chevron-back" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
      ) : <View style={styles.headerBtn} />}
      <Text style={styles.headerTitle}>{title}</Text>
      <TouchableOpacity onPress={close} style={styles.headerBtn}>
        <Ionicons name="close" size={22} color={colors.textPrimary} />
      </TouchableOpacity>
    </View>
  );

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={close}>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        {section === 'list' && (
          <>
            {renderHeader('Settings')}
            <ScrollView contentContainerStyle={styles.list}>
              {([
                { key: 'symbol',  icon: 'bar-chart-outline',     label: 'Symbol' },
                { key: 'canvas',  icon: 'create-outline',        label: 'Canvas' },
                { key: 'trading', icon: 'trending-up-outline',   label: 'Trading' },
                { key: 'alerts',  icon: 'notifications-outline', label: 'Alerts' },
              ] as const).map((row) => (
                <TouchableOpacity key={row.key} style={styles.listRow} onPress={() => setSection(row.key)}>
                  <Ionicons name={row.icon as any} size={22} color={colors.textPrimary} style={{ marginRight: spacing.md }} />
                  <Text style={styles.listLabel}>{row.label}</Text>
                  <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
                </TouchableOpacity>
              ))}
            </ScrollView>
          </>
        )}

        {section === 'symbol' && (
          <>
            {renderHeader('Symbol')}
            <ScrollView contentContainerStyle={styles.detail}>
              {renderSection(SYMBOL_ROWS, 'Candles')}
            </ScrollView>
          </>
        )}

        {section === 'canvas' && (
          <>
            {renderHeader('Canvas')}
            <ScrollView contentContainerStyle={styles.detail}>
              {renderSection(CANVAS_ROWS, 'Chart')}
            </ScrollView>
          </>
        )}

        {section === 'trading' && (
          <>
            {renderHeader('Trading')}
            <ScrollView contentContainerStyle={styles.detail}>
              {renderSection(TRADING_ROWS, 'Order lines')}
            </ScrollView>
          </>
        )}

        {section === 'alerts' && (
          <>
            {renderHeader('Alerts')}
            <View style={styles.placeholder}>
              <Ionicons name="notifications-outline" size={40} color={colors.textTertiary} />
              <Text style={styles.placeholderText}>Alerts coming soon</Text>
            </View>
          </>
        )}
      </SafeAreaView>

      {/* Color picker bottom sheet */}
      <Modal visible={pickerKey !== null} animationType="slide" transparent onRequestClose={() => setPickerKey(null)}>
        <Pressable style={styles.backdrop} onPress={() => setPickerKey(null)}>
          <Pressable style={styles.pickerSheet} onPress={() => {}}>
            <View style={styles.handle} />
            <Text style={[labelStyle, { textAlign: 'center', marginBottom: spacing.md }]}>Pick a color</Text>

            <View style={styles.paletteGrid}>
              {PALETTE_ROWS.map((row, rIdx) => (
                <View key={rIdx} style={styles.paletteRow}>
                  {row.map((c) => (
                    <TouchableOpacity
                      key={c + rIdx}
                      style={[styles.paletteSwatch, { backgroundColor: c },
                        hex.toUpperCase() === c.toUpperCase() && styles.paletteSwatchActive]}
                      onPress={() => applyColor(c)}
                    />
                  ))}
                </View>
              ))}
            </View>

            {/* Favorites strip + custom-hex add button */}
            <View style={styles.favoritesRow}>
              {FAVORITES.map((c) => (
                <TouchableOpacity
                  key={`fav-${c}`}
                  style={[styles.paletteSwatch, { backgroundColor: c },
                    hex.toUpperCase() === c.toUpperCase() && styles.paletteSwatchActive]}
                  onPress={() => applyColor(c)}
                />
              ))}
              <TouchableOpacity
                style={[styles.paletteSwatch, styles.addSwatch]}
                onPress={() => {/* hex input below already serves as add */}}
              >
                <Ionicons name="add" size={16} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>

            {/* Opacity slider */}
            <View style={styles.opacityRow}>
              <Text style={styles.opacityLabel}>Opacity</Text>
              <OpacitySlider value={alpha} onChange={applyAlpha} fillColor={hex} />
              <Text style={styles.opacityValue}>{Math.round(alpha * 100)}%</Text>
            </View>

            <View style={styles.hexRow}>
              <Text style={styles.hexLabel}>HEX</Text>
              <TextInput
                style={styles.hexInput}
                value={hex}
                onChangeText={setHex}
                autoCapitalize="characters"
                autoCorrect={false}
                placeholder="#RRGGBB"
                placeholderTextColor={colors.textTertiary}
                maxLength={9}
              />
              <TouchableOpacity
                style={[styles.applyBtn, !isValidHex(hex) && { opacity: 0.4 }]}
                disabled={!isValidHex(hex)}
                onPress={() => applyColor(normalizeHex(hex))}
              >
                <Text style={styles.applyBtnText}>APPLY</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  headerBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle: {
    flex: 1, textAlign: 'center',
    color: colors.textPrimary, fontSize: fontSize.lg, fontWeight: fontWeight.bold,
  },

  list: { paddingVertical: spacing.sm },
  listRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  listLabel: { flex: 1, color: colors.textPrimary, fontSize: fontSize.md, fontWeight: fontWeight.semibold },

  detail: { paddingVertical: spacing.md },
  sectionLabel: { paddingHorizontal: spacing.lg, marginTop: spacing.md, marginBottom: spacing.sm },
  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  rowLabel: { flex: 1, color: colors.textPrimary, fontSize: fontSize.md },
  rowControls: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  swatch: {
    width: 40, height: 28, borderRadius: radius.sm,
    borderWidth: 1, borderColor: colors.borderSubtle,
  },
  checkbox: {
    width: 22, height: 22, borderRadius: 4,
    borderWidth: 1.5, borderColor: colors.borderSubtle,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  checkboxChecked: {
    backgroundColor: colors.gold, borderColor: colors.gold,
  },

  placeholder: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  placeholderText: { color: colors.textSecondary, fontSize: fontSize.md },

  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  pickerSheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl,
    paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.xl,
  },
  handle: {
    alignSelf: 'center', width: 40, height: 4, borderRadius: 2,
    backgroundColor: colors.borderSubtle, marginBottom: spacing.md,
  },
  paletteGrid: {
    gap: 4, marginBottom: spacing.md,
  },
  paletteRow: {
    flexDirection: 'row', gap: 4,
  },
  paletteSwatch: {
    flex: 1, aspectRatio: 1, borderRadius: 4,
    borderWidth: 1, borderColor: colors.borderSubtle,
  },
  paletteSwatchActive: {
    borderWidth: 3, borderColor: colors.gold,
  },
  favoritesRow: {
    flexDirection: 'row', gap: 4,
    marginTop: spacing.sm, marginBottom: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1, borderTopColor: colors.border,
  },
  addSwatch: {
    backgroundColor: 'transparent',
    borderWidth: 1, borderColor: colors.borderSubtle,
    alignItems: 'center', justifyContent: 'center',
  },
  opacityRow: {
    flexDirection: 'row', alignItems: 'center',
    marginBottom: spacing.md,
  },
  opacityLabel: {
    color: colors.textSecondary, fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold, letterSpacing: 1,
  },
  opacityValue: {
    color: colors.textPrimary, fontSize: fontSize.xs,
    fontWeight: fontWeight.bold, fontVariant: ['tabular-nums'],
    minWidth: 36, textAlign: 'right',
  },
  hexRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    marginTop: spacing.sm,
  },
  hexLabel: { color: colors.textSecondary, fontSize: fontSize.xs, fontWeight: fontWeight.bold, letterSpacing: 1 },
  hexInput: {
    flex: 1, color: colors.textPrimary, fontSize: fontSize.md,
    backgroundColor: colors.cardAlt, borderRadius: radius.sm,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderWidth: 1, borderColor: colors.border,
  },
  applyBtn: {
    backgroundColor: colors.gold,
    paddingHorizontal: spacing.lg, paddingVertical: spacing.sm,
    borderRadius: radius.sm,
  },
  applyBtnText: { color: colors.textInverse, fontWeight: fontWeight.bold, letterSpacing: 1 },
});
