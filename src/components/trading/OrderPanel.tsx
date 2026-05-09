import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, Modal, Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { openTrade, closeTrade } from '../../services/api';
import { useSessionStore } from '../../store/sessionStore';
import { colors, radius, spacing, fontSize, fontWeight, labelStyle } from '../../theme';

interface Props {
  currentPrice: number;
  pip: number;
  contractSize: number;
}

export default function OrderPanel({ currentPrice, pip, contractSize }: Props) {
  const [orderModalSide, setOrderModalSide] = useState<'buy' | 'sell' | null>(null);
  const [lots, setLots] = useState('1');
  const [sl, setSl] = useState('');
  const [tp, setTp] = useState('');
  const [loading, setLoading] = useState(false);

  const { sessionId, positions, addPosition, removePosition, addClosedTrade, setBalance } = useSessionStore();

  const placeOrder = async () => {
    if (!sessionId || !orderModalSide) return;
    const lotsNum = parseFloat(lots);
    if (isNaN(lotsNum) || lotsNum <= 0) { Alert.alert('Invalid lot size'); return; }
    setLoading(true);
    try {
      const res = await openTrade(
        sessionId, orderModalSide, lotsNum,
        sl ? parseFloat(sl) : undefined,
        tp ? parseFloat(tp) : undefined,
      );
      addPosition({
        id: res.position.id,
        side: res.position.side,
        lots: res.position.lots,
        entry_price: res.position.entry_price,
        stop_loss: res.position.stop_loss,
        take_profit: res.position.take_profit,
        opened_at: res.position.opened_at,
      });
      setOrderModalSide(null);
      setSl('');
      setTp('');
    } catch (e: any) {
      Alert.alert('Order failed', e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = async (posId: string) => {
    if (!sessionId) return;
    setLoading(true);
    try {
      const res = await closeTrade(sessionId, posId);
      removePosition(posId);
      addClosedTrade(res.trade);
      setBalance(res.balance);
    } catch (e: any) {
      Alert.alert('Close failed', e.message);
    } finally {
      setLoading(false);
    }
  };

  const fmt = (n: number) => n.toFixed(pip < 0.01 ? 5 : 2);
  const buyPrice  = currentPrice + pip / 2;
  const sellPrice = currentPrice - pip / 2;

  return (
    <View style={styles.container}>

      {/* Open Position card — only shown when there are open positions */}
      {positions.length > 0 && (
        <View style={styles.posCard}>
          <View style={styles.posHeader}>
            <Text style={styles.posTitle}>OPEN POSITION</Text>
            {positions.map((p) => (
              <View key={p.id} style={[styles.posBadge, p.side === 'buy' ? styles.posBadgeBuy : styles.posBadgeSell]}>
                <Text style={styles.posBadgeText}>{p.side === 'buy' ? 'LONG' : 'SHORT'} {p.lots}</Text>
              </View>
            ))}
          </View>

          {positions.map((pos) => {
            const dir = pos.side === 'buy' ? 1 : -1;
            const pips = ((currentPrice - pos.entry_price) / pip) * dir;
            const pnl = pips * pip * contractSize * pos.lots;
            return (
              <View key={pos.id} style={styles.posBody}>
                <View style={styles.posStats}>
                  <View style={styles.posStat}>
                    <Text style={styles.posStatLabel}>Entry</Text>
                    <Text style={styles.posStatValue}>{fmt(pos.entry_price)}</Text>
                  </View>
                  <View style={styles.posStat}>
                    <Text style={styles.posStatLabel}>Size</Text>
                    <Text style={styles.posStatValue}>{pos.lots}</Text>
                  </View>
                  <View style={styles.posStat}>
                    <Text style={styles.posStatLabel}>P&amp;L</Text>
                    <Text style={[styles.posStatValue, pnl >= 0 ? styles.green : styles.red]}>
                      {pnl >= 0 ? '+' : ''}${pnl.toFixed(2)}
                    </Text>
                  </View>
                </View>

                {(pos.stop_loss || pos.take_profit) && (
                  <View style={styles.sltpRow}>
                    {pos.stop_loss != null && (
                      <View style={styles.sltpItem}>
                        <Text style={styles.sltpLabel}>Stop Loss</Text>
                        <View style={styles.sltpValueRow}>
                          <Text style={styles.sltpValue}>{fmt(pos.stop_loss)}</Text>
                          <Ionicons name="pencil" size={12} color={colors.textTertiary} style={{ marginLeft: 6 }} />
                        </View>
                      </View>
                    )}
                    {pos.take_profit != null && (
                      <View style={styles.sltpItem}>
                        <Text style={styles.sltpLabel}>Take Profit</Text>
                        <View style={styles.sltpValueRow}>
                          <Text style={styles.sltpValue}>{fmt(pos.take_profit)}</Text>
                          <Ionicons name="pencil" size={12} color={colors.textTertiary} style={{ marginLeft: 6 }} />
                        </View>
                      </View>
                    )}
                  </View>
                )}

                <TouchableOpacity style={styles.closeBtn} onPress={() => handleClose(pos.id)}>
                  <Text style={styles.closeBtnText}>CLOSE POSITION</Text>
                </TouchableOpacity>
              </View>
            );
          })}
        </View>
      )}

      {/* BUY / SELL buttons */}
      <View style={styles.tradeRow}>
        <TouchableOpacity
          style={styles.buyBtn}
          onPress={() => { setOrderModalSide('buy'); }}
          activeOpacity={0.85}
        >
          <View style={styles.tradeBtnTop}>
            <Text style={styles.tradeBtnLabel}>BUY</Text>
            <Ionicons name="chevron-up" size={14} color="#fff" />
          </View>
          <Text style={styles.tradeBtnPrice}>{fmt(buyPrice)}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.sellBtn}
          onPress={() => { setOrderModalSide('sell'); }}
          activeOpacity={0.85}
        >
          <View style={styles.tradeBtnTop}>
            <Text style={styles.tradeBtnLabel}>SELL</Text>
            <Ionicons name="chevron-down" size={14} color="#fff" />
          </View>
          <Text style={styles.tradeBtnPrice}>{fmt(sellPrice)}</Text>
        </TouchableOpacity>
      </View>

      {/* Bottom toolbar */}
      <View style={styles.toolbar}>
        <TouchableOpacity style={styles.toolbarBtn}>
          <Ionicons name="pencil-outline" size={20} color={colors.textSecondary} />
          <Text style={styles.toolbarLabel}>DRAW</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.toolbarBtn}>
          <Ionicons name="analytics-outline" size={20} color={colors.textSecondary} />
          <Text style={styles.toolbarLabel}>INDICATORS</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.toolbarBtn}>
          <Ionicons name="receipt-outline" size={20} color={colors.textSecondary} />
          <Text style={styles.toolbarLabel}>ORDERS</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.toolbarBtn}>
          <Ionicons name="briefcase-outline" size={20} color={colors.textSecondary} />
          <Text style={styles.toolbarLabel}>POSITIONS</Text>
        </TouchableOpacity>
      </View>

      {/* Order entry modal (shown when BUY or SELL is tapped) */}
      <Modal visible={orderModalSide !== null} animationType="slide" transparent>
        <Pressable style={styles.modalBackdrop} onPress={() => setOrderModalSide(null)}>
          <Pressable style={styles.modalSheet} onPress={() => {}}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>
              {orderModalSide === 'buy' ? 'BUY' : 'SELL'}  ·  {fmt(orderModalSide === 'buy' ? buyPrice : sellPrice)}
            </Text>

            <Text style={styles.modalLabel}>SIZE (LOTS)</Text>
            <TextInput
              style={styles.modalInput}
              value={lots}
              onChangeText={setLots}
              keyboardType="decimal-pad"
              placeholder="1"
              placeholderTextColor={colors.textTertiary}
            />

            <View style={styles.modalRow}>
              <View style={{ flex: 1, marginRight: spacing.sm }}>
                <Text style={styles.modalLabel}>STOP LOSS</Text>
                <TextInput
                  style={styles.modalInput}
                  value={sl}
                  onChangeText={setSl}
                  keyboardType="decimal-pad"
                  placeholder="Optional"
                  placeholderTextColor={colors.textTertiary}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalLabel}>TAKE PROFIT</Text>
                <TextInput
                  style={styles.modalInput}
                  value={tp}
                  onChangeText={setTp}
                  keyboardType="decimal-pad"
                  placeholder="Optional"
                  placeholderTextColor={colors.textTertiary}
                />
              </View>
            </View>

            <TouchableOpacity
              style={[
                styles.confirmBtn,
                orderModalSide === 'buy' ? { backgroundColor: colors.green } : { backgroundColor: colors.red },
                loading && { opacity: 0.5 },
              ]}
              onPress={placeOrder}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.confirmBtnText}>CONFIRM {orderModalSide?.toUpperCase()}</Text>}
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg, gap: spacing.md },

  // Open position card
  posCard: {
    backgroundColor: colors.card, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border,
    padding: spacing.md,
  },
  posHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm, gap: spacing.sm },
  posTitle: { ...labelStyle, color: colors.textPrimary, flex: 1 },
  posBadge: { paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: radius.sm },
  posBadgeBuy:  { backgroundColor: colors.greenDim },
  posBadgeSell: { backgroundColor: colors.redDim },
  posBadgeText: { color: '#fff', fontSize: fontSize.xs, fontWeight: fontWeight.bold, letterSpacing: 1 },

  posBody: { gap: spacing.sm },
  posStats: { flexDirection: 'row', justifyContent: 'space-between' },
  posStat: { flex: 1 },
  posStatLabel: { color: colors.textSecondary, fontSize: fontSize.xs, marginBottom: 2 },
  posStatValue: {
    color: colors.textPrimary, fontSize: fontSize.lg, fontWeight: fontWeight.bold,
    fontVariant: ['tabular-nums'],
  },

  sltpRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.sm, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border },
  sltpItem: { flex: 1 },
  sltpLabel: { color: colors.textSecondary, fontSize: fontSize.xs, marginBottom: 2 },
  sltpValueRow: { flexDirection: 'row', alignItems: 'center' },
  sltpValue: { color: colors.textPrimary, fontWeight: fontWeight.semibold, fontVariant: ['tabular-nums'] },

  closeBtn: {
    backgroundColor: colors.cardAlt, borderRadius: radius.sm,
    paddingVertical: spacing.sm, alignItems: 'center', marginTop: spacing.sm,
  },
  closeBtnText: { color: colors.textPrimary, fontWeight: fontWeight.bold, fontSize: fontSize.xs, letterSpacing: 1.5 },

  // BUY / SELL row
  tradeRow: { flexDirection: 'row', gap: spacing.sm },
  buyBtn: {
    flex: 1, backgroundColor: colors.green, borderRadius: radius.md,
    paddingVertical: spacing.md, paddingHorizontal: spacing.md,
    alignItems: 'center',
  },
  sellBtn: {
    flex: 1, backgroundColor: colors.red, borderRadius: radius.md,
    paddingVertical: spacing.md, paddingHorizontal: spacing.md,
    alignItems: 'center',
  },
  tradeBtnTop: { flexDirection: 'row', alignItems: 'center' },
  tradeBtnLabel: { color: '#fff', fontWeight: fontWeight.black, fontSize: fontSize.md, letterSpacing: 1 },
  tradeBtnPrice: { color: '#fff', fontSize: fontSize.lg, fontWeight: fontWeight.bold, marginTop: 2, fontVariant: ['tabular-nums'] },

  // Toolbar
  toolbar: {
    flexDirection: 'row', justifyContent: 'space-around',
    paddingTop: spacing.md, marginTop: spacing.sm,
    borderTopWidth: 1, borderTopColor: colors.border,
  },
  toolbarBtn: { alignItems: 'center', gap: 4 },
  toolbarLabel: { color: colors.textSecondary, fontSize: 9, fontWeight: fontWeight.bold, letterSpacing: 1 },

  // Modal
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: colors.card, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl,
    paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.xxl,
  },
  modalHandle: { alignSelf: 'center', width: 40, height: 4, backgroundColor: colors.border, borderRadius: 2, marginBottom: spacing.md },
  modalTitle: { color: colors.textPrimary, fontSize: fontSize.lg, fontWeight: fontWeight.bold, marginBottom: spacing.lg, letterSpacing: 1 },
  modalLabel: { ...labelStyle, marginBottom: 6 },
  modalInput: {
    backgroundColor: colors.bg, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: spacing.md, paddingVertical: 14,
    color: colors.textPrimary, fontSize: fontSize.md,
    marginBottom: spacing.md, fontVariant: ['tabular-nums'],
  },
  modalRow: { flexDirection: 'row' },

  confirmBtn: { borderRadius: radius.md, paddingVertical: 16, alignItems: 'center', marginTop: spacing.md },
  confirmBtnText: { color: '#fff', fontWeight: fontWeight.black, fontSize: fontSize.md, letterSpacing: 2 },

  green: { color: colors.green },
  red:   { color: colors.red },
});
