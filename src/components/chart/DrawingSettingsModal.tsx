import React, { useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, Modal, Pressable, TouchableOpacity, ScrollView,
  PanResponder, LayoutChangeEvent,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, fontSize, fontWeight, radius, labelStyle } from '../../theme';
import { useDrawingsStore } from '../../store/drawingsStore';
import { TOOL_BY_ID, DrawingStyle } from '../../types/drawings';

/**
 * Drawing settings shell — RESET on 2026-05-11. The modal is structurally
 * intact (header, scrollable body, action footer, OpacitySlider helper)
 * but all per-tool branches (fib levels, fill opacity, extend, price
 * label, text, etc.) were stripped along with the drawing tools
 * themselves. As each tool comes back, add its branch here.
 *
 * The shell still works for any future drawing whose only customizations
 * are color, line style, width, and opacity.
 */

// Generic 16-swatch palette used until a tool brings its own.
const QUICK_COLORS = [
  '#FFFFFF', '#D1D5DB', '#6B7280', '#000000',
  '#EF4444', '#F97316', '#F59E0B', '#EAB308',
  '#84CC16', '#22C55E', '#26A69A', '#06B6D4',
  '#3B82F6', '#58a6ff', '#A855F7', '#EC4899',
];

const LINE_STYLES: { id: DrawingStyle['lineStyle']; label: string }[] = [
  { id: 'solid',  label: 'Solid'  },
  { id: 'dashed', label: 'Dashed' },
  { id: 'dotted', label: 'Dotted' },
];

const LINE_WIDTHS = [1, 2, 3, 4];

/** Inline 0..1 slider for line opacity. Avoids pulling in a new dep —
 *  maps the touch's locationX along a measured track to a 0..1 value
 *  and reports it via onChange continuously during the drag. */
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

export default function DrawingSettingsModal() {
  const {
    drawings, selectedId, settingsOpen,
    updateDrawing, removeDrawing, setSettingsOpen, duplicateDrawing,
  } = useDrawingsStore();

  const drawing = useMemo(() => drawings.find((d) => d.id === selectedId) ?? null, [drawings, selectedId]);
  if (!drawing || !settingsOpen) return null;

  const def = TOOL_BY_ID[drawing.type];

  const setStyle = (patch: Partial<DrawingStyle>) =>
    updateDrawing(drawing.id, { style: { ...drawing.style, ...patch } } as any);

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
            <TouchableOpacity onPress={() => removeDrawing(drawing.id)} style={styles.headerBtn}>
              <Ionicons name="trash-outline" size={18} color={colors.red} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setSettingsOpen(false)} style={styles.headerBtn}>
              <Ionicons name="close" size={20} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={{ padding: spacing.md }}>
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

            <Text style={[labelStyle, styles.sectionLabel]}>Line opacity</Text>
            <OpacitySlider
              value={drawing.style.strokeOpacity ?? 1}
              onChange={(v) => setStyle({ strokeOpacity: v })}
            />
          </ScrollView>

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
              onPress={() => removeDrawing(drawing.id)}
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
  footerBtnLocked: { backgroundColor: colors.gold, borderColor: colors.gold },
  footerBtnDelete: { borderColor: colors.red },
  footerBtnText: {
    color: colors.textPrimary,
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    letterSpacing: 0.6,
  },
  footerBtnTextLocked: { color: colors.bg },

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
});
