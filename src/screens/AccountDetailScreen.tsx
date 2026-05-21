import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography } from '../theme';

/**
 * Placeholder destination for tapping the Dashboard Account hero
 * card (DESIGN_AUDIT §3.1). Full account-performance detail
 * (equity curve at multiple timeframes, drawdowns, monthly P&L
 * table, etc.) is a separate task — this stub keeps the tap
 * affordance honest without shipping half a feature.
 */

const WHITE = colors.textPrimary;
const BG    = colors.bg;

export default function AccountDetailScreen({ navigation }: any) {
  return (
    <SafeAreaView edges={['top']} style={styles.root}>
      <View style={styles.headerBar}>
        <Pressable
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Ionicons name="arrow-back" size={24} color={WHITE} />
        </Pressable>
      </View>

      <View style={styles.center}>
        <Ionicons name="analytics-outline" size={56} color="rgba(255,255,255,0.3)" />
        <Text style={[typography.display, styles.title]}>Account Performance</Text>
        <Text style={[typography.body, styles.body]}>
          Detailed insights coming soon.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  headerBar: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backBtn: { padding: 6 },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  title: {
    marginTop: 16,
    color: WHITE,
    textAlign: 'center',
  },
  body: {
    marginTop: 10,
    color: 'rgba(255,255,255,0.55)',
    textAlign: 'center',
  },
});
