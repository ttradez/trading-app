import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator,
} from 'react-native';
import { openTrade, closeTrade } from '../../services/api';
import { useSessionStore } from '../../store/sessionStore';

interface Props {
  currentPrice: number;
  pip: number;
  contractSize: number;
}

export default function OrderPanel({ currentPrice, pip, contractSize }: Props) {
  const [lots, setLots] = useState('0.10');
  const [sl, setSl] = useState('');
  const [tp, setTp] = useState('');
  const [loading, setLoading] = useState(false);

  const { sessionId, positions, balance, addPosition, removePosition, addClosedTrade, setBalance } =
    useSessionStore();

  const placeOrder = async (side: 'buy' | 'sell') => {
    if (!sessionId) return;
    const lotsNum = parseFloat(lots);
    if (isNaN(lotsNum) || lotsNum <= 0) {
      Alert.alert('Invalid lot size');
      return;
    }
    setLoading(true);
    try {
      const res = await openTrade(
        sessionId,
        side,
        lotsNum,
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

  const lotsNum = parseFloat(lots) || 0;
  const margin = lotsNum * contractSize * currentPrice * 0.01;

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <Text style={styles.label}>Balance</Text>
        <Text style={styles.balance}>${balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}</Text>
      </View>

      <Text style={styles.price}>{currentPrice.toFixed(pip < 0.01 ? 5 : 2)}</Text>

      <Text style={styles.label}>Lots</Text>
      <TextInput
        style={styles.input}
        value={lots}
        onChangeText={setLots}
        keyboardType="decimal-pad"
        placeholder="0.10"
        placeholderTextColor="#555"
      />

      <View style={styles.sltp}>
        <View style={{ flex: 1, marginRight: 6 }}>
          <Text style={styles.label}>Stop Loss</Text>
          <TextInput
            style={styles.input}
            value={sl}
            onChangeText={setSl}
            keyboardType="decimal-pad"
            placeholder="Optional"
            placeholderTextColor="#555"
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.label}>Take Profit</Text>
          <TextInput
            style={styles.input}
            value={tp}
            onChangeText={setTp}
            keyboardType="decimal-pad"
            placeholder="Optional"
            placeholderTextColor="#555"
          />
        </View>
      </View>

      <Text style={styles.margin}>Est. Margin: ${margin.toFixed(2)}</Text>

      <View style={styles.buttons}>
        <TouchableOpacity
          style={[styles.buyBtn, loading && styles.disabled]}
          onPress={() => placeOrder('buy')}
          disabled={loading}
        >
          <Text style={styles.btnText}>BUY</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.sellBtn, loading && styles.disabled]}
          onPress={() => placeOrder('sell')}
          disabled={loading}
        >
          <Text style={styles.btnText}>SELL</Text>
        </TouchableOpacity>
      </View>

      {loading && <ActivityIndicator color="#58a6ff" style={{ marginTop: 8 }} />}

      {/* Open Positions */}
      {positions.length > 0 && (
        <View style={styles.positionsSection}>
          <Text style={styles.sectionTitle}>Open Positions</Text>
          {positions.map((pos) => {
            const dir = pos.side === 'buy' ? 1 : -1;
            const pips = ((currentPrice - pos.entry_price) / pip) * dir;
            const pnl = pips * pip * contractSize * pos.lots;
            return (
              <View key={pos.id} style={styles.posCard}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.posSide, pos.side === 'buy' ? styles.green : styles.red]}>
                    {pos.side.toUpperCase()} {pos.lots} lots @ {pos.entry_price.toFixed(pip < 0.01 ? 5 : 2)}
                  </Text>
                  {pos.stop_loss ? <Text style={styles.slLabel}>SL: {pos.stop_loss}</Text> : null}
                  {pos.take_profit ? <Text style={styles.tpLabel}>TP: {pos.take_profit}</Text> : null}
                  <Text style={[styles.posPnl, pnl >= 0 ? styles.green : styles.red]}>
                    P&L: ${pnl.toFixed(2)} ({pips.toFixed(1)} pips)
                  </Text>
                </View>
                <TouchableOpacity style={styles.closeBtn} onPress={() => handleClose(pos.id)}>
                  <Text style={styles.closeBtnText}>Close</Text>
                </TouchableOpacity>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: '#161b22', padding: 16, borderRadius: 12, marginBottom: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  balance: { color: '#e6edf3', fontWeight: '700', fontSize: 14 },
  price: { color: '#58a6ff', fontSize: 24, fontWeight: '800', marginBottom: 12 },
  label: { color: '#8b949e', fontSize: 12, marginBottom: 4 },
  input: {
    backgroundColor: '#0d1117', color: '#e6edf3', borderRadius: 8,
    padding: 10, marginBottom: 12, borderWidth: 1, borderColor: '#30363d',
  },
  sltp: { flexDirection: 'row' },
  margin: { color: '#8b949e', fontSize: 12, marginBottom: 12 },
  buttons: { flexDirection: 'row', gap: 8 },
  buyBtn: { flex: 1, backgroundColor: '#238636', padding: 14, borderRadius: 8, alignItems: 'center' },
  sellBtn: { flex: 1, backgroundColor: '#da3633', padding: 14, borderRadius: 8, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  disabled: { opacity: 0.5 },
  positionsSection: { marginTop: 16 },
  sectionTitle: { color: '#e6edf3', fontWeight: '700', fontSize: 14, marginBottom: 8 },
  posCard: {
    backgroundColor: '#0d1117', borderRadius: 10, padding: 12, marginBottom: 8,
    flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#30363d',
  },
  posSide: { fontSize: 13, fontWeight: '600' },
  posPnl: { fontSize: 13, fontWeight: '700', marginTop: 4 },
  slLabel: { color: '#f85149', fontSize: 11, marginTop: 2 },
  tpLabel: { color: '#3fb950', fontSize: 11, marginTop: 2 },
  green: { color: '#3fb950' },
  red: { color: '#f85149' },
  closeBtn: { backgroundColor: '#21262d', padding: 10, borderRadius: 6, marginLeft: 8 },
  closeBtnText: { color: '#e6edf3', fontWeight: '600', fontSize: 13 },
});
