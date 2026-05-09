import React, { useMemo } from 'react';
import {
  View, Text, StyleSheet, Modal, Pressable, TouchableOpacity, TextInput, ScrollView,
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

const LINE_WIDTHS = [1, 2, 3, 4, 5, 6];

/**
 * Inline floating sheet that edits the currently-selected drawing.
 * Color, line style/width, fill (where applicable), and text (for text tools).
 * Changes apply live via updateDrawing().
 */
export default function DrawingSettingsModal() {
  const { drawings, selectedId, updateDrawing, removeDrawing, setSelected, duplicateDrawing } = useDrawingsStore();

  const drawing = useMemo(() => drawings.find((d) => d.id === selectedId) ?? null, [drawings, selectedId]);
  if (!drawing) return null;

  const def  = TOOL_BY_ID[drawing.type];
  const isTextual = drawing.type === 'text' || drawing.type === 'note' || drawing.type === 'price_note';
  const hasFill   = drawing.type === 'rectangle' || drawing.type === 'circle'
                  || drawing.type === 'parallel_channel'
                  || drawing.type === 'price_range' || drawing.type === 'date_price_range';
  // Per-tool feature flags — drives which optional rows the panel renders.
  const isFib            = drawing.type === 'fib_retracement';
  const canExtend        = drawing.type === 'trendline' || drawing.type === 'ray';
  const canShowPriceLbl  = drawing.type === 'trendline' || drawing.type === 'ray'
                        || drawing.type === 'hline'     || drawing.type === 'hray';

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
    <Modal visible transparent animationType="none" onRequestClose={() => setSelected(null)}>
      <Pressable style={styles.backdrop} onPress={() => setSelected(null)}>
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
            <TouchableOpacity onPress={() => { removeDrawing(drawing.id); }} style={styles.headerBtn}>
              <Ionicons name="trash-outline" size={18} color={colors.red} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setSelected(null)} style={styles.headerBtn}>
              <Ionicons name="close" size={20} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={{ padding: spacing.md }}>
            {/* Color row */}
            <Text style={[labelStyle, styles.sectionLabel]}>Color</Text>
            <View style={styles.colorRow}>
              {QUICK_COLORS.map((c) => (
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

            {/* Line width */}
            <Text style={[labelStyle, styles.sectionLabel]}>Line width</Text>
            <View style={styles.row}>
              {LINE_WIDTHS.map((w) => (
                <TouchableOpacity
                  key={w}
                  style={[styles.widthBtn, drawing.style.lineWidth === w && styles.widthBtnActive]}
                  onPress={() => setStyle({ lineWidth: w })}
                >
                  <View style={{ width: 22, height: w, backgroundColor: colors.textPrimary, borderRadius: 1 }} />
                </TouchableOpacity>
              ))}
            </View>

            {/* Stroke opacity — separate from fill; affects line color alpha. */}
            <Text style={[labelStyle, styles.sectionLabel]}>Line opacity</Text>
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

            {/* Lock toggle */}
            <Text style={[labelStyle, styles.sectionLabel]}>Lock</Text>
            <View style={styles.row}>
              <TouchableOpacity
                style={[styles.pill, drawing.locked && styles.pillActive]}
                onPress={() => updateDrawing(drawing.id, { locked: !drawing.locked } as any)}
              >
                <Ionicons name={drawing.locked ? 'lock-closed' : 'lock-open-outline'}
                          size={14} color={drawing.locked ? colors.bg : colors.textPrimary}
                          style={{ marginRight: 6 }} />
                <Text style={[styles.pillText, drawing.locked && styles.pillTextActive]}>
                  {drawing.locked ? 'LOCKED' : 'UNLOCKED'}
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
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
