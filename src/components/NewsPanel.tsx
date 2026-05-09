import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, Modal, Pressable, TouchableOpacity, ScrollView, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing, fontSize, fontWeight, labelStyle } from '../theme';
import { fetchNews, NewsItem } from '../services/api';

interface Props {
  visible: boolean;
  onClose: () => void;
  /** Symbol the chart is currently on (e.g., "NQ"). */
  symbol: string;
  /** Current session time (unix seconds). News strictly before-or-equal. */
  currentTime: number;
}

const IMPACT_COLOR: Record<NewsItem['impact'], string> = {
  low: colors.textTertiary,
  medium: '#F59E0B',
  high: colors.red,
};

/**
 * Slides up from the bottom. Shows news up to and INCLUDING `currentTime` —
 * never reveals future headlines, so anti-cheat is preserved.
 */
export default function NewsPanel({ visible, onClose, symbol, currentTime }: Props) {
  const [items, setItems] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setLoading(true); setErr(null);
    fetchNews(symbol, currentTime, 100)
      .then((data) => setItems(data))
      .catch((e) => setErr(e.message ?? 'Could not load news'))
      .finally(() => setLoading(false));
  }, [visible, symbol, currentTime]);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <View>
              <Text style={[labelStyle, { fontSize: 9 }]}>HISTORICAL NEWS</Text>
              <Text style={styles.title}>{symbol}</Text>
            </View>
            <View style={{ flex: 1 }} />
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={22} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>

          <Text style={styles.sub}>
            Showing news up to{'  '}{new Date(currentTime * 1000).toLocaleString()}
          </Text>

          {loading && <ActivityIndicator color={colors.gold} style={{ marginTop: spacing.lg }} />}
          {err && (
            <View style={styles.empty}>
              <Ionicons name="cloud-offline-outline" size={36} color={colors.textTertiary} />
              <Text style={styles.emptyTitle}>News unavailable</Text>
              <Text style={styles.emptySub}>{err}</Text>
            </View>
          )}
          {!loading && !err && items.length === 0 && (
            <View style={styles.empty}>
              <Ionicons name="newspaper-outline" size={36} color={colors.textTertiary} />
              <Text style={styles.emptyTitle}>No news in this period</Text>
              <Text style={styles.emptySub}>
                Connect a news provider in the backend (/news endpoint) to populate this feed.
              </Text>
            </View>
          )}
          {!loading && !err && items.length > 0 && (
            <ScrollView contentContainerStyle={{ paddingBottom: spacing.xl }}>
              {items.map((n) => (
                <View key={n.id} style={styles.item}>
                  <View style={[styles.impactDot, { backgroundColor: IMPACT_COLOR[n.impact] }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemHead}>{n.headline}</Text>
                    <View style={styles.itemMeta}>
                      <Text style={styles.itemSource}>{n.source}</Text>
                      <Text style={styles.itemSep}> · </Text>
                      <Text style={styles.itemTime}>{new Date(n.ts * 1000).toLocaleString()}</Text>
                    </View>
                  </View>
                </View>
              ))}
            </ScrollView>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl,
    paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.xl,
    maxHeight: '80%',
  },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.borderSubtle, marginBottom: spacing.md },
  header: { flexDirection: 'row', alignItems: 'flex-end' },
  title: { color: colors.textPrimary, fontSize: fontSize.xl, fontWeight: fontWeight.black, marginTop: 2 },
  sub: { color: colors.textTertiary, fontSize: fontSize.xs, marginTop: 2, marginBottom: spacing.md },

  empty: { alignItems: 'center', paddingVertical: spacing.xxl, gap: spacing.sm },
  emptyTitle: { color: colors.textPrimary, fontSize: fontSize.md, fontWeight: fontWeight.bold },
  emptySub: { color: colors.textTertiary, fontSize: fontSize.sm, textAlign: 'center', paddingHorizontal: spacing.lg },

  item: {
    flexDirection: 'row', alignItems: 'flex-start',
    paddingVertical: spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.border,
    gap: spacing.sm,
  },
  impactDot: { width: 8, height: 8, borderRadius: 4, marginTop: 6 },
  itemHead: { color: colors.textPrimary, fontSize: fontSize.sm, fontWeight: fontWeight.semibold, lineHeight: 19 },
  itemMeta: { flexDirection: 'row', marginTop: 4 },
  itemSource: { color: colors.textSecondary, fontSize: fontSize.xs, fontWeight: fontWeight.bold },
  itemSep: { color: colors.textTertiary, fontSize: fontSize.xs },
  itemTime: { color: colors.textTertiary, fontSize: fontSize.xs },
});
