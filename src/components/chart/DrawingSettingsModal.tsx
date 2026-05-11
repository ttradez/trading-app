import React, { useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, Modal, Pressable, TouchableOpacity, TextInput, ScrollView,
  PanResponder, Alert, LayoutChangeEvent,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, fontSize, fontWeight, radius, labelStyle } from '../../theme';
import { useDrawingsStore } from '../../store/drawingsStore';
import { TOOL_BY_ID, DrawingStyle, FIB_LEVELS, FIB_LEVEL_DEFAULTS, FibLevelConfig } from '../../types/drawings';

// 16-swatch palette — TradingView-style coverage across hue + grayscale.
const QUICK_COLORS = [
  '#FFFFFF', '#D1D5DB', '#6B7280', '#000000',
  '#EF4444', '#F97316', '#F59E0B', '#EAB308',
  '#84CC16', '#22C55E', '#26A69A', '#06B6D4',
  '#3B82F6', '#58a6ff', '#A855F7', '#EC4899',
];

// Trendline v1 palette — exact 16 colors specified in
// docs/TRADINGVIEW_REFERENCE.md §1 implementation prompt.
const TRENDLINE_COLORS = [
  '#FF4757', '#FFA502', '#FFD93D', '#1DD1A1',
  '#00D395', '#009688', '#2962FF', '#6C5CE7',
  '#FF6B81', '#FF7675', '#FAB1A0', '#74B9FF',
  '#FFFFFF', '#B2BEC3', '#636E72', '#2D3436',
];

/** Tiny inline slider for line opacity. Avoids pulling in a new dependency.
 *  Maps the touch's locationX along a measured track to a 0..1 value and
 *  reports it via onChange continuously during the drag. */
function OpacitySlider({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [trackWidth, setTrackWidth] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setTrackWidth(e.nativeEvent.layout.width);
  const setFromX = React.useCallback((x: number) => {
    if (trackWidth <= 0) return;
    const ratio = Math.max(0, Math.min(1, x / trackWidth));
    onChange(Math.round(ratio * 100) / 100);
  }, [trackWidth, onChange]);
  const responder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder:  () => true,
    onPanResponderGrant: (e) => setFromX(e.nativeEvent.locationX),
    onPanResponderMove:  (e) => setFromX(e.nativeEvent.locationX),
  }), [setFromX]);
  const pct = Math.round(value * 100);
  return (
    <View style={sliderStyles.wrap}>
      <View style={sliderStyles.track} onLayout={onLayout} {...responder.panHandlers}>
        <View style={[sliderStyles.fill, { width: trackWidth * value }]} />
        <View style={[sliderStyles.thumb, { left: trackWidth * value - 8 }]} />
      </View>
      <Text style={sliderStyles.label}>{pct}%</Text>
    </View>
  );
}

const sliderStyles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  track: {
    flex: 1, height: 6,
    backgroundColor: colors.cardAlt,
    borderRadius: 3,
    borderWidth: 1, borderColor: colors.border,
    justifyContent: 'center',
  },
  fill: {
    position: 'absolute', left: 0, top: 0, bottom: 0,
    backgroundColor: '#2962FF', borderRadius: 3,
  },
  thumb: {
    position: 'absolute',
    width: 16, height: 16, borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 2, borderColor: '#2962FF',
  },
  label: {
    color: colors.textPrimary,
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    width: 42, textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
});

// Compact color cycle used by per-fib-level swatches (tap to advance).
const FIB_COLOR_CYCLE = [
  '#FFFFFF', '#9CA3AF', '#EAB308', '#22C55E',
  '#EF4444', '#3B82F6', '#A855F7', '#F97316',
];

const LINE_STYLES: { id: DrawingStyle['lineStyle']; label: string; preview: string }[] = [
  { id: 'solid',  label: 'Solid',  preview: '———' },
  { id: 'dashed', label: 'Dashed', preview: '— — —' },
  { id: 'dotted', label: 'Dotted', preview: '· · · ·' },
];

/**
 * Inline floating sheet that edits the currently-selected drawing.
 * Color, line style/width, fill (where applicable), and text (for text tools).
 * Changes apply live via updateDrawing().
 */
export default function DrawingSettingsModal() {
  const {
    drawings, selectedId, settingsOpen,
    updateDrawing, removeDrawing, setSettingsOpen, duplicateDrawing,
  } = useDrawingsStore();

  const drawing = useMemo(() => drawings.find((d) => d.id === selectedId) ?? null, [drawings, selectedId]);
  // Modal renders only when explicitly opened — single-tap selects (handles
  // visible) but does NOT pop this sheet. Double-tap is what flips
  // settingsOpen to true.
  if (!drawing || !settingsOpen) return null;

  const def  = TOOL_BY_ID[drawing.type];
  // Per-tool feature flags — pruned to the 10 keep-tools (DRAWING_TOOLS_AUDIT.md).
  // 'note', 'price_note', 'circle', 'parallel_channel', 'price_range',
  // 'date_price_range', 'ray', 'hray' all deleted from the catalog.
  const isTextual        = drawing.type === 'text';
  const hasFill          = drawing.type === 'rectangle' || drawing.type === 'gann_box';
  const isFib            = drawing.type === 'fib_retracement';
  const isTrendline      = drawing.type === 'trendline';
  const isHRay           = drawing.type === 'hray';
  // Tools that have shipped their TradingView-parity v1 settings pass —
  // they share the same UI: 16-swatch palette, slider opacity, 1/2/3/4
  // width pills, delete-with-confirm. Other tools keep the legacy UI.
  const useRichSettings  = isTrendline || isHRay;
  const canExtend        = drawing.type === 'trendline';
  // hray defaults price label ON and exposes the toggle. Trendline v1
  // defers label/price label entirely.
  const canShowPriceLbl  = isHRay;
  const widthOptions     = useRichSettings ? [1, 2, 3, 4] : [1, 2, 3, 4, 5, 6];
  const palette          = useRichSettings ? TRENDLINE_COLORS : QUICK_COLORS;
  const handleDelete = () => {
    if (useRichSettings) {
      const label = isHRay ? 'horizontal ray' : 'trendline';
      Alert.alert(`Delete ${label}?`, 'This cannot be undone.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => removeDrawing(drawing.id) },
      ]);
    } else {
      removeDrawing(drawing.id);
    }
  };

  const setStyle = (patch: Partial<DrawingStyle>) =>
    updateDrawing(drawing.id, { style: { ...drawing.style, ...patch } } as any);

  // Sparse-array helper: merge a patch into the entry for `lvl`, creating it
  // if absent. Drawings store only entries the user has actually touched.
  const updateFibLevel = (lvl: number, patch: Partial<FibLevelConfig>) => {
    const list = drawing.style.fibLevels ?? [];
    const idx = list.findIndex((o) => o.value === lvl);
    let next: FibLevelConfig[];
    if (idx >= 0) {
      next = [...list];
      next[idx] = { ...next[idx], ...patch };
    } else {
      next = [...list, { value: lvl, ...patch }];
    }
    setStyle({ fibLevels: next });
  };
  // Effective per-level state — merges override with FIB_LEVEL_DEFAULTS.
  const fibLevelState = (lvl: number) => {
    const override = drawing.style.fibLevels?.find((o) => o.value === lvl);
    const defVis = FIB_LEVEL_DEFAULTS[lvl]?.visible ?? true;
    return {
      visible: override?.visible ?? defVis,
      color:   override?.color   ?? drawing.style.color,
    };
  };
  const cycleFibColor = (lvl: number) => {
    const cur = fibLevelState(lvl).color;
    const idx = FIB_COLOR_CYCLE.findIndex((c) => c.toUpperCase() === cur.toUpperCase());
    const next = FIB_COLOR_CYCLE[(idx + 1) % FIB_COLOR_CYCLE.length];
    updateFibLevel(lvl, { color: next });
  };

  return (
    <Modal visible transparent animationType="none" onRequestClose={() => setSettingsOpen(false)}>
      <Pressable style={styles.backdrop} onPress={() => setSettingsOpen(false)}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>{def?.label ?? 'Drawing'}</Text>
            <TouchableOpacity
              onPress={() => updateDrawing(drawing.id, { hidden: !drawing.hidden } as any)}
              style={styles.headerBtn}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            >
              <Ionicons name={drawing.hidden ? 'eye-off-outline' : 'eye-outline'} size={18} color={colors.textPrimary} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => duplicateDrawing(drawing.id)} style={styles.headerBtn}>
              <Ionicons name="copy-outline" size={18} color={colors.textPrimary} />
            </TouchableOpacity>
            <TouchableOpacity onPress={handleDelete} style={styles.headerBtn}>
              <Ionicons name="trash-outline" size={18} color={colors.red} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setSettingsOpen(false)} style={styles.headerBtn}>
              <Ionicons name="close" size={20} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={{ padding: spacing.md }}>
            {/* Color row — trendline gets the spec's exact 16-color palette;
                other tools keep the legacy QUICK_COLORS swatches. */}
            <Text style={[labelStyle, styles.sectionLabel]}>Color</Text>
            <View style={styles.colorRow}>
              {palette.map((c) => (
                <TouchableOpacity
                  key={c}
                  style={[styles.swatch, { backgroundColor: c },
                    drawing.style.color.toUpperCase() === c.toUpperCase() && styles.swatchActive]}
                  onPress={() => setStyle({ color: c })}
                />
              ))}
            </View>

            {/* Line style */}
            <Text style={[labelStyle, styles.sectionLabel]}>Line style</Text>
            <View style={styles.row}>
              {LINE_STYLES.map((ls) => (
                <TouchableOpacity
                  key={ls.id}
                  style={[styles.pill, drawing.style.lineStyle === ls.id && styles.pillActive]}
                  onPress={() => setStyle({ lineStyle: ls.id })}
                >
                  <Text style={[styles.pillText, drawing.style.lineStyle === ls.id && styles.pillTextActive]}>
                    {ls.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Line width — trendline restricted to TradingView 1/2/3/4 px;
                other tools keep the wider 1-6 set. */}
            <Text style={[labelStyle, styles.sectionLabel]}>Line width</Text>
            <View style={styles.row}>
              {widthOptions.map((w) => (
                <TouchableOpacity
                  key={w}
                  style={[styles.widthBtn, drawing.style.lineWidth === w && styles.widthBtnActive]}
                  onPress={() => setStyle({ lineWidth: w })}
                >
                  <View style={{ width: 22, height: w, backgroundColor: colors.textPrimary, borderRadius: 1 }} />
                </TouchableOpacity>
              ))}
            </View>

            {/* Stroke opacity — rich-settings tools (trendline §1, hray §2)
                get a 0..100% slider per spec; other tools keep the 4-pill
                quantized control. */}
            <Text style={[labelStyle, styles.sectionLabel]}>Line opacity</Text>
            {useRichSettings ? (
              <OpacitySlider
                value={drawing.style.strokeOpacity ?? 1}
                onChange={(v) => setStyle({ strokeOpacity: v })}
              />
            ) : (
              <View style={styles.row}>
                {[0.25, 0.5, 0.75, 1].map((op) => (
                  <TouchableOpacity
                    key={op}
                    style={[styles.pill, (drawing.style.strokeOpacity ?? 1) === op && styles.pillActive]}
                    onPress={() => setStyle({ strokeOpacity: op })}
                  >
                    <Text style={[styles.pillText, (drawing.style.strokeOpacity ?? 1) === op && styles.pillTextActive]}>
                      {Math.round(op * 100)}%
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Extend left / right — only for trendline & ray (hline/hray are
                already infinite by definition). */}
            {canExtend && (
              <>
                <Text style={[labelStyle, styles.sectionLabel]}>Extend</Text>
                <View style={styles.row}>
                  <TouchableOpacity
                    style={[styles.pill, drawing.style.extendLeft && styles.pillActive]}
                    onPress={() => setStyle({ extendLeft: !drawing.style.extendLeft })}
                  >
                    <Ionicons
                      name="arrow-back-outline"
                      size={12}
                      color={drawing.style.extendLeft ? colors.bg : colors.textPrimary}
                      style={{ marginRight: 4 }}
                    />
                    <Text style={[styles.pillText, drawing.style.extendLeft && styles.pillTextActive]}>LEFT</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.pill, drawing.style.extendRight && styles.pillActive]}
                    onPress={() => setStyle({ extendRight: !drawing.style.extendRight })}
                  >
                    <Ionicons
                      name="arrow-forward-outline"
                      size={12}
                      color={drawing.style.extendRight ? colors.bg : colors.textPrimary}
                      style={{ marginRight: 4 }}
                    />
                    <Text style={[styles.pillText, drawing.style.extendRight && styles.pillTextActive]}>RIGHT</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}

            {/* Show-price-label — small price tag at the right end of any line drawing. */}
            {canShowPriceLbl && (
              <>
                <Text style={[labelStyle, styles.sectionLabel]}>Price label</Text>
                <View style={styles.row}>
                  <TouchableOpacity
                    style={[styles.pill, drawing.style.showPriceLabel && styles.pillActive]}
                    onPress={() => setStyle({ showPriceLabel: !drawing.style.showPriceLabel })}
                  >
                    <Ionicons
                      name={drawing.style.showPriceLabel ? 'pricetag' : 'pricetag-outline'}
                      size={12}
                      color={drawing.style.showPriceLabel ? colors.bg : colors.textPrimary}
                      style={{ marginRight: 6 }}
                    />
                    <Text style={[styles.pillText, drawing.style.showPriceLabel && styles.pillTextActive]}>
                      {drawing.style.showPriceLabel ? 'SHOWN' : 'HIDDEN'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
            )}

            {hasFill && (
              <>
                <Text style={[labelStyle, styles.sectionLabel]}>Fill opacity</Text>
                <View style={styles.row}>
                  {[0, 0.1, 0.25, 0.5, 0.75, 1].map((op) => (
                    <TouchableOpacity
                      key={op}
                      style={[styles.pill, (drawing.style.fillOpacity ?? 0.15) === op && styles.pillActive]}
                      onPress={() => setStyle({ fillOpacity: op, fillColor: drawing.style.color })}
                    >
                      <Text style={[styles.pillText, (drawing.style.fillOpacity ?? 0.15) === op && styles.pillTextActive]}>
                        {Math.round(op * 100)}%
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}

            {/* Fib retracement — per-level visibility/color + editable bg fill opacity. */}
            {isFib && (
              <>
                <Text style={[labelStyle, styles.sectionLabel]}>Levels</Text>
                <View style={styles.fibLevelsBlock}>
                  {FIB_LEVELS.map((lvl) => {
                    const st = fibLevelState(lvl);
                    return (
                      <View key={lvl} style={styles.fibLevelRow}>
                        <TouchableOpacity
                          style={styles.fibVisBtn}
                          onPress={() => updateFibLevel(lvl, { visible: !st.visible })}
                          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                        >
                          <Ionicons
                            name={st.visible ? 'eye-outline' : 'eye-off-outline'}
                            size={16}
                            color={st.visible ? colors.textPrimary : colors.textTertiary}
                          />
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.fibColorDot, { backgroundColor: st.color }, !st.visible && { opacity: 0.35 }]}
                          onPress={() => cycleFibColor(lvl)}
                        />
                        <Text style={[styles.fibLevelLabel, !st.visible && { color: colors.textTertiary }]}>
                          {lvl.toFixed(3)}
                        </Text>
                      </View>
                    );
                  })}
                </View>
                <Text style={[labelStyle, styles.sectionLabel]}>Background fill</Text>
                <View style={styles.row}>
                  {[0, 0.04, 0.1, 0.2].map((op) => (
                    <TouchableOpacity
                      key={op}
                      style={[styles.pill, (drawing.style.fibBgOpacity ?? 0.04) === op && styles.pillActive]}
                      onPress={() => setStyle({ fibBgOpacity: op })}
                    >
                      <Text style={[styles.pillText, (drawing.style.fibBgOpacity ?? 0.04) === op && styles.pillTextActive]}>
                        {op === 0 ? 'OFF' : Math.round(op * 100) + '%'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}

            {isTextual && (
              <>
                <Text style={[labelStyle, styles.sectionLabel]}>Text</Text>
                <TextInput
                  style={styles.textInput}
                  value={drawing.style.text || ''}
                  onChangeText={(t) => setStyle({ text: t })}
                  placeholder="Note text…"
                  placeholderTextColor={colors.textTertiary}
                />
                <Text style={[labelStyle, styles.sectionLabel]}>Font size</Text>
                <View style={styles.row}>
                  {[10, 12, 14, 16, 20, 24].map((fs) => (
                    <TouchableOpacity
                      key={fs}
                      style={[styles.pill, (drawing.style.fontSize ?? 12) === fs && styles.pillActive]}
                      onPress={() => setStyle({ fontSize: fs })}
                    >
                      <Text style={[styles.pillText, (drawing.style.fontSize ?? 12) === fs && styles.pillTextActive]}>
                        {fs}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}

          </ScrollView>

          {/* Action footer — Lock toggle, Duplicate, Delete.
              Replaces the long-press "Drawing Actions" alert (removed). */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.footerBtn, drawing.locked && styles.footerBtnLocked]}
              onPress={() => updateDrawing(drawing.id, { locked: !drawing.locked } as any)}
            >
              <Ionicons
                name={drawing.locked ? 'lock-closed' : 'lock-open-outline'}
                size={16}
                color={drawing.locked ? colors.bg : colors.textPrimary}
                style={{ marginRight: 6 }}
              />
              <Text style={[styles.footerBtnText, drawing.locked && styles.footerBtnTextLocked]}>
                {drawing.locked ? 'LOCKED' : 'LOCK'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.footerBtn}
              onPress={() => duplicateDrawing(drawing.id)}
            >
              <Ionicons name="copy-outline" size={16} color={colors.textPrimary} style={{ marginRight: 6 }} />
              <Text style={styles.footerBtnText}>DUPLICATE</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.footerBtn, styles.footerBtnDelete]}
              onPress={handleDelete}
            >
              <Ionicons name="trash-outline" size={16} color={colors.red} style={{ marginRight: 6 }} />
              <Text style={[styles.footerBtnText, { color: colors.red }]}>DELETE</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl,
    maxHeight: '70%',
  },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.md, paddingTop: spacing.md, paddingBottom: spacing.sm,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  headerTitle: { flex: 1, color: colors.textPrimary, fontSize: fontSize.md, fontWeight: fontWeight.bold },
  headerBtn: { padding: spacing.sm },

  // Action footer at the bottom of the sheet — replaces the long-press
  // alert. Three full-width-ish pill buttons: lock toggle, duplicate, delete.
  footer: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md, paddingVertical: spacing.md,
    borderTopWidth: 1, borderTopColor: colors.border,
    gap: spacing.sm,
  },
  footerBtn: {
    flex: 1,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: spacing.sm,
    backgroundColor: colors.cardAlt,
    borderRadius: radius.sm,
    borderWidth: 1, borderColor: colors.border,
  },
  footerBtnLocked: {
    backgroundColor: colors.gold,
    borderColor: colors.gold,
  },
  footerBtnDelete: {
    borderColor: colors.red,
  },
  footerBtnText: {
    color: colors.textPrimary,
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    letterSpacing: 0.6,
  },
  footerBtnTextLocked: {
    color: colors.bg,
  },

  sectionLabel: { marginTop: spacing.md, marginBottom: spacing.sm },

  colorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  swatch: {
    width: 30, height: 30, borderRadius: radius.sm,
    borderWidth: 1, borderColor: colors.borderSubtle,
  },
  swatchActive: { borderWidth: 3, borderColor: colors.gold },

  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  pill: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.cardAlt,
    paddingHorizontal: spacing.md, paddingVertical: 6,
    borderRadius: radius.sm,
    borderWidth: 1, borderColor: colors.border,
  },
  pillActive: { backgroundColor: colors.gold, borderColor: colors.gold },
  pillText: { color: colors.textPrimary, fontSize: fontSize.xs, fontWeight: fontWeight.bold, letterSpacing: 0.5 },
  pillTextActive: { color: colors.bg },

  widthBtn: {
    width: 36, height: 24, borderRadius: radius.sm,
    backgroundColor: colors.cardAlt,
    borderWidth: 1, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  widthBtnActive: { borderColor: colors.gold },

  textInput: {
    backgroundColor: colors.cardAlt,
    borderRadius: radius.sm,
    borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    color: colors.textPrimary, fontSize: fontSize.md,
  },

  // Fib per-level configurator
  fibLevelsBlock: {
    backgroundColor: colors.cardAlt,
    borderRadius: radius.sm,
    borderWidth: 1, borderColor: colors.border,
    paddingVertical: 4, paddingHorizontal: 8,
  },
  fibLevelRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 6,
    gap: 10,
  },
  fibVisBtn: {
    width: 22, height: 22,
    alignItems: 'center', justifyContent: 'center',
  },
  fibColorDot: {
    width: 18, height: 18, borderRadius: 9,
    borderWidth: 1, borderColor: colors.borderSubtle,
  },
  fibLevelLabel: {
    color: colors.textPrimary,
    fontSize: fontSize.sm,
    fontVariant: ['tabular-nums'],
    fontWeight: fontWeight.semibold,
  },
});
