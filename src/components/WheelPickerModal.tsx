import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, Modal, Pressable, TouchableOpacity,
  NativeScrollEvent, NativeSyntheticEvent,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { colors, radius, spacing, fontSize, fontWeight } from '../theme';

const ITEM_HEIGHT   = 34;          // compact rows so the wheel popup is smaller
const DEFAULT_VISIBLE_ITEMS = 5;   // odd number so one row is centered

export interface WheelHandle {
  /** Scroll the wheel to an absolute offset (0 = first item centered). */
  scrollToOffset(offsetY: number): void;
  /** Snap to the nearest row, fire onChange if it differs from value. */
  commit(): void;
  /** Animate-snap to the currently-focused row. After the snap settles the
   *  wheel's own onMomentumScrollEnd schedules the auto-close grace timer. */
  snapToFocused(): void;
  /** The pixel height of one wheel row — useful for callers translating dy → rows. */
  itemHeight: number;
}

export interface WheelAnchor {
  /** Screen-space center X of the trigger button (where the wheel should align horizontally). */
  centerX: number;
  /** Screen-space center Y of the trigger button (the wheel's center band lines up here). */
  centerY: number;
  /** Optional fixed width for the floating wheel; defaults to 160. */
  width?: number;
}

interface Props<T> {
  visible: boolean;
  onClose: () => void;
  items: T[];
  value: T;
  onChange: (v: T) => void;
  formatLabel?: (v: T) => string;
  title?: string;
  /** When provided, the wheel renders as a small floating popup centered on the
   *  anchor instead of as a bottom sheet. */
  anchor?: WheelAnchor;
  /** How many rows are visible at once. Use a larger odd number to show every
   *  option simultaneously (e.g. 9 for an 8-item timeframe list). */
  visibleItems?: number;
}

/**
 * iOS-style wheel picker. Scrolls vertically with momentum + snap. The center
 * band highlights the active row. Tapping a row scrolls it to center. Tapping
 * outside or DONE confirms the selection.
 */
function WheelPickerModalInner<T>(
  {
    visible, onClose, items, value, onChange,
    formatLabel = (v) => String(v),
    title,
    anchor,
    visibleItems = DEFAULT_VISIBLE_ITEMS,
  }: Props<T>,
  ref: React.Ref<WheelHandle>,
) {
  const WHEEL_HEIGHT = ITEM_HEIGHT * visibleItems;
  const PADDING      = ITEM_HEIGHT * Math.floor(visibleItems / 2);
  const listRef = useRef<FlatList<T>>(null);
  const initialIdx = Math.max(0, items.indexOf(value));
  const [focusedIdx, setFocusedIdx] = useState(initialIdx);
  const focusedIdxRef = useRef(initialIdx);
  const lastHapticIdxRef = useRef(initialIdx);

  useEffect(() => { focusedIdxRef.current = focusedIdx; }, [focusedIdx]);

  useImperativeHandle(ref, () => ({
    itemHeight: ITEM_HEIGHT,
    scrollToOffset: (y: number) => {
      const max = (items.length - 1) * ITEM_HEIGHT;
      const clamped = Math.max(0, Math.min(max, y));
      listRef.current?.scrollToOffset({ offset: clamped, animated: false });
    },
    commit: () => {
      const i = focusedIdxRef.current;
      if (items[i] !== undefined && items[i] !== value) onChange(items[i]);
    },
    snapToFocused: () => {
      const i = focusedIdxRef.current;
      listRef.current?.scrollToOffset({ offset: i * ITEM_HEIGHT, animated: true });
    },
  }), [items, onChange, value]);

  // Reset focus to current value whenever the modal opens.
  useEffect(() => {
    if (!visible) return;
    const i = Math.max(0, items.indexOf(value));
    setFocusedIdx(i);
    lastHapticIdxRef.current = i;
    // Defer to next frame so the FlatList is mounted before scrolling.
    requestAnimationFrame(() => {
      listRef.current?.scrollToOffset({ offset: i * ITEM_HEIGHT, animated: false });
    });
  }, [visible, value, items]);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = e.nativeEvent.contentOffset.y;
    const idx = Math.round(y / ITEM_HEIGHT);
    const clamped = Math.max(0, Math.min(items.length - 1, idx));
    if (clamped !== focusedIdx) setFocusedIdx(clamped);
    if (clamped !== lastHapticIdxRef.current) {
      Haptics.selectionAsync().catch(() => {});
      lastHapticIdxRef.current = clamped;
    }
  };

  const confirm = () => {
    if (items[focusedIdx] !== undefined && items[focusedIdx] !== value) {
      onChange(items[focusedIdx]);
    }
    onClose();
  };

  const tapItem = (idx: number) => {
    listRef.current?.scrollToOffset({ offset: idx * ITEM_HEIGHT, animated: true });
  };

  // Auto-commit with a grace window: only commit + close once the user has
  // actually stopped interacting (no fresh scroll for 800ms after momentum ends).
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelAutoClose = () => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  };
  const scheduleAutoClose = () => {
    cancelAutoClose();
    closeTimerRef.current = setTimeout(() => { confirm(); }, 800);
  };
  useEffect(() => () => cancelAutoClose(), []);
  // Reset any pending close whenever the modal reopens.
  useEffect(() => { if (!visible) cancelAutoClose(); }, [visible]);

  // Floating mode: position the wheel so its center band lines up with the
  // anchor button. Clamp top so the wheel never goes off the top of the screen.
  const wheelW = anchor?.width ?? 160;
  const sheetStyle = anchor
    ? [
        styles.floatingSheet,
        {
          top:  Math.max(20, anchor.centerY - WHEEL_HEIGHT / 2),
          left: Math.max(8,  anchor.centerX - wheelW / 2),
          width: wheelW,
        },
      ]
    : styles.sheet;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={confirm} hardwareAccelerated>
      <Pressable style={[styles.backdrop, anchor && styles.backdropTransparent]} onPress={confirm}>
        <Pressable style={sheetStyle} onPress={() => {}}>
          {title && !anchor && <Text style={styles.title}>{title}</Text>}

          <View style={{ height: WHEEL_HEIGHT, position: 'relative' }}>
            {/* Center band — visually marks the "selected" slot */}
            <View pointerEvents="none" style={[styles.centerBand, { top: PADDING }]} />

            <FlatList
              ref={listRef}
              data={items}
              keyExtractor={(_, i) => String(i)}
              renderItem={({ item, index }) => {
                const distance = Math.abs(index - focusedIdx);
                const isActive = distance === 0;
                return (
                  <TouchableOpacity
                    activeOpacity={0.6}
                    style={styles.item}
                    onPress={() => tapItem(index)}
                  >
                    <Text style={[
                      styles.itemText,
                      isActive && styles.itemTextActive,
                      distance === 1 && { opacity: 0.55 },
                      distance === 2 && { opacity: 0.30 },
                      distance >= 3  && { opacity: 0.15 },
                    ]}>
                      {formatLabel(item)}
                    </Text>
                  </TouchableOpacity>
                );
              }}
              showsVerticalScrollIndicator={false}
              snapToInterval={ITEM_HEIGHT}
              decelerationRate="fast"
              onScroll={onScroll}
              scrollEventThrottle={16}
              onScrollBeginDrag={cancelAutoClose}
              onMomentumScrollEnd={scheduleAutoClose}
              contentContainerStyle={{ paddingVertical: PADDING }}
              getItemLayout={(_, i) => ({ length: ITEM_HEIGHT, offset: i * ITEM_HEIGHT, index: i })}
              initialNumToRender={items.length}
              maxToRenderPerBatch={items.length}
              windowSize={3}
              removeClippedSubviews={false}
            />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const WheelPickerModal = forwardRef(WheelPickerModalInner) as <T>(
  props: Props<T> & { ref?: React.Ref<WheelHandle> }
) => React.ReactElement;

export default WheelPickerModal;

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  backdropTransparent: { backgroundColor: 'rgba(0,0,0,0.25)' },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md, paddingBottom: spacing.xl,
  },
  floatingSheet: {
    position: 'absolute',
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: spacing.sm, paddingVertical: spacing.sm,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4, shadowRadius: 12, elevation: 8,
  },
  title: {
    color: colors.textSecondary,
    fontSize: fontSize.xs, fontWeight: fontWeight.semibold,
    letterSpacing: 2, textTransform: 'uppercase',
    textAlign: 'center', marginBottom: spacing.sm,
  },
  centerBand: {
    position: 'absolute', left: 0, right: 0,
    height: ITEM_HEIGHT,
    backgroundColor: colors.cardAlt,
    borderRadius: radius.sm,
  },
  item: {
    height: ITEM_HEIGHT,
    alignItems: 'center', justifyContent: 'center',
  },
  itemText: {
    color: colors.textPrimary,
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
  },
  itemTextActive: {
    color: colors.gold,
    fontWeight: fontWeight.black,
    fontSize: fontSize.xl,
  },
  doneBtn: {
    marginTop: spacing.md,
    paddingVertical: spacing.md,
    backgroundColor: colors.gold,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  doneText: {
    color: colors.textInverse,
    fontWeight: fontWeight.black,
    fontSize: fontSize.md,
    letterSpacing: 1.5,
  },
});
