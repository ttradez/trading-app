import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, type as typo } from '../theme/tokens';

/**
 * SectionHeader — the one section title for the whole app. Created
 * as part of the design-system foundation; not wired into screens
 * yet.
 *
 *  - 'display': the signature 3px-radius gold square marker (with a
 *    gold glow) + optional leading icon + title in `type.sectionHeader`.
 *  - 'eyebrow': no marker, small uppercase tertiary label.
 *  - Optional right-aligned action: label (+ count) and a chevron.
 *
 * `icon` is a ReactNode (caller supplies the element) rather than a
 * `LucideIcon` — lucide-react-native isn't installed in this
 * project; call sites pass an `@expo/vector-icons` glyph.
 */

interface Props {
  title: string;
  icon?: React.ReactNode;
  actionLabel?: string;
  actionCount?: number;
  onActionPress?: () => void;
  variant?: 'display' | 'eyebrow';
}

export default function SectionHeader({
  title,
  icon,
  actionLabel,
  actionCount,
  onActionPress,
  variant = 'display',
}: Props) {
  const isDisplay = variant === 'display';

  return (
    <View style={styles.row}>
      <View style={styles.left}>
        {isDisplay && <View style={styles.marker} />}
        {isDisplay && icon ? (
          <View style={styles.iconWrap}>{icon}</View>
        ) : null}
        <Text
          style={isDisplay ? styles.titleDisplay : styles.titleEyebrow}
          numberOfLines={1}
        >
          {title}
        </Text>
      </View>

      {actionLabel ? (
        <Pressable
          onPress={onActionPress}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={({ pressed }) => [styles.action, pressed && { opacity: 0.6 }]}
          accessibilityRole="button"
          accessibilityLabel={
            actionCount != null
              ? `${actionLabel} ${actionCount}`
              : actionLabel
          }
        >
          <Text style={styles.actionText}>
            {actionLabel}
            {actionCount != null ? ` ${actionCount}` : ''}
          </Text>
          <Ionicons
            name="chevron-forward"
            size={16}
            color={colors.gold}
          />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  left: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  // Signature brand marker: small gold square (3px-radius) with a
  // gold glow. Appears on every primary ('display') section header.
  marker: {
    width: 14,
    height: 14,
    borderRadius: 3,
    backgroundColor: colors.gold,
    marginRight: spacing.sm,
    shadowColor: colors.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 6,
    elevation: 4,
  },
  iconWrap: {
    marginRight: spacing.sm,
  },
  titleDisplay: {
    ...typo.sectionHeader,
    flexShrink: 1,
  },
  titleEyebrow: {
    ...typo.eyebrow,
    flexShrink: 1,
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  actionText: {
    color: colors.gold,
    fontSize: 14,
    fontWeight: '700',
  },
});
