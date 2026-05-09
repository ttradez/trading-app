import React, { useState, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Modal, Pressable, ScrollView, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, fontSize, fontWeight, radius } from '../../theme';
import {
  DrawingCategory, DrawingType, CATEGORY_BUTTONS, TOOL_CATALOG, TOOL_BY_ID,
} from '../../types/drawings';
import { useDrawingsStore } from '../../store/drawingsStore';

/**
 * TradingView-style left drawing toolbar.
 *  - Top section: starred ("favorite") tools, accessible with one tap
 *  - Below that: one button per category (Cursor / Lines / Fib / …)
 *  - Tapping a category opens a popup with all the tools in that category.
 *  - Long-pressing (or tapping the ★ next to) a tool toggles it as a favorite.
 *  - Bottom section: lock / hide / clear-all
 */
export default function DrawingToolbar() {
  const {
    setActiveTool, favorites, toggleFavorite,
  } = useDrawingsStore();

  const [openCategory, setOpenCategory] = useState<DrawingCategory | null>(null);
  const [anchorTop, setAnchorTop] = useState(120);
  const buttonRefs = useRef<Record<string, View | null>>({});

  const showSubmenu = (cat: DrawingCategory) => {
    const btn = buttonRefs.current[cat];
    if (btn && (btn as any).measureInWindow) {
      (btn as any).measureInWindow((_x: number, y: number) => {
        setAnchorTop(Math.max(50, y));
        setOpenCategory(cat);
      });
    } else {
      setOpenCategory(cat);
    }
  };

  const pickTool = (tool: DrawingType) => {
    const def = TOOL_BY_ID[tool];
    if (!def.drawable && def.pointsRequired > 0) {
      Alert.alert(def.label, 'This drawing tool is on the way — coming in the next batch.');
      return;
    }
    setActiveTool(tool);
    setOpenCategory(null);
  };

  return (
    <View style={styles.rail}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ alignItems: 'center' }}>
        {/* Category buttons */}
        {CATEGORY_BUTTONS.map((c) => (
          <View
            key={c.category}
            ref={(r) => { buttonRefs.current[c.category] = r; }}
            collapsable={false}
          >
            <TouchableOpacity
              style={[styles.btn, openCategory === c.category && styles.btnActive]}
              onPress={() => showSubmenu(c.category)}
            >
              <Ionicons name={c.icon as any} size={18} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>
        ))}

      </ScrollView>

      <DrawingSubmenu
        category={openCategory}
        anchorTop={anchorTop}
        onClose={() => setOpenCategory(null)}
        onPick={pickTool}
        onToggleFavorite={toggleFavorite}
        favorites={favorites}
      />
    </View>
  );
}


// ── Sub-menu popup ──────────────────────────────────────────────────────────────
interface SubmenuProps {
  category: DrawingCategory | null;
  anchorTop: number;
  onClose: () => void;
  onPick: (t: DrawingType) => void;
  onToggleFavorite: (t: DrawingType) => void;
  favorites: Set<DrawingType>;
}

function DrawingSubmenu({ category, anchorTop, onClose, onPick, onToggleFavorite, favorites }: SubmenuProps) {
  if (!category) return null;
  const items = TOOL_CATALOG.filter((t) => t.category === category);

  // Group tools by their subsection (categories without subsections become a
  // single un-headered list). Preserve insertion order.
  const groups: { heading: string | null; tools: typeof items }[] = [];
  for (const tool of items) {
    const heading = tool.subsection ?? null;
    const last = groups[groups.length - 1];
    if (last && last.heading === heading) last.tools.push(tool);
    else groups.push({ heading, tools: [tool] });
  }

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose}>
      <Pressable style={submenuStyles.backdrop} onPress={onClose}>
        <Pressable
          style={[submenuStyles.popup, { top: anchorTop, left: 48 }]}
          onPress={() => {}}
        >
          <ScrollView style={{ maxHeight: 480 }} showsVerticalScrollIndicator={false}>
            {groups.map((group, gi) => (
              <View key={gi} style={gi > 0 ? submenuStyles.groupSep : undefined}>
                {group.heading && (
                  <Text style={submenuStyles.heading}>{group.heading.toUpperCase()}</Text>
                )}
                {group.tools.map((t) => {
                  const isStar = favorites.has(t.id);
                  return (
                    <View key={t.id} style={submenuStyles.row}>
                      <TouchableOpacity
                        style={submenuStyles.rowMain}
                        onPress={() => onPick(t.id)}
                      >
                        <Ionicons name={t.icon as any} size={16} color={colors.textPrimary} style={{ marginRight: 10 }} />
                        <Text style={submenuStyles.rowLabel}>{t.label}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => onToggleFavorite(t.id)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Ionicons
                          name={isStar ? 'star' : 'star-outline'}
                          size={14}
                          color={isStar ? colors.gold : colors.textTertiary}
                        />
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </View>
            ))}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  rail: {
    width: 36,
    backgroundColor: colors.bg,
    borderRightWidth: 1, borderRightColor: colors.border,
    paddingVertical: 4,
    alignItems: 'center',
  },
  btn: {
    width: 32, height: 30,
    alignItems: 'center', justifyContent: 'center',
    marginVertical: 1, borderRadius: 4,
  },
  btnActive: {
    backgroundColor: colors.cardAlt,
  },
  divider: {
    width: 20, height: 1,
    backgroundColor: colors.border,
    marginVertical: 4,
  },
  starBadge: {
    position: 'absolute', top: 2, right: 4,
  },
});

const submenuStyles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.25)' },
  popup: {
    position: 'absolute',
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    minWidth: 220,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4, shadowRadius: 12, elevation: 8,
  },
  heading: {
    color: colors.textTertiary,
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    letterSpacing: 1.5,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.sm, paddingVertical: 6,
  },
  rowMain: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  rowLabel: {
    color: colors.textPrimary,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
  },
  groupSep: {
    marginTop: spacing.sm,
    borderTopWidth: 1, borderTopColor: colors.border,
    paddingTop: spacing.xs,
  },
});
