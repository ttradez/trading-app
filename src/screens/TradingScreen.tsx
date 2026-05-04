import React, { useEffect, useState, useCallback } from 'react';
import {
  View, StyleSheet, Text, ScrollView, TouchableOpacity, Alert, ActivityIndicator,
} from 'react-native';
import TradingChart from '../components/chart/TradingChart';
import OrderPanel from '../components/trading/OrderPanel';
import { startSession, advanceSession, endSession, getSession } from '../services/api';
import { useInterstitialAd } from '../services/adService';
import { useSessionStore } from '../store/sessionStore';

const TIMEFRAMES = ['1m', '5m', '15m', '30m', '1h', '4h', '1D', '1W'] as const;
const ACCOUNT_SIZES = [10_000, 25_000, 50_000, 100_000];

interface RouteParams {
  uid: string;
  username: string;
  symbol: string;
  name: string;
  pip: number;
  contractSize: number;
}

export default function TradingScreen({ route }: any) {
  const params: RouteParams = route?.params ?? {
    uid: 'guest', username: 'Guest', symbol: 'ES', name: 'S&P 500 E-Mini', pip: 0.25, contractSize: 50,
  };

  const [timeframe, setTimeframe] = useState('1D');
  const [accountSize, setAccountSize] = useState(10_000);
  const [starting, setStarting] = useState(false);
  const [advancing, setAdvancing] = useState(false);
  const [ending, setEnding] = useState(false);

  const {
    sessionId, candles, positions, balance, isEnded,
    startSession: setSession, restoreSession, appendCandles,
    removePosition, addClosedTrade, setBalance, endSession: markEnded, reset,
    getSavedSessionId,
  } = useSessionStore();

  const { startAdTimer, stopAdTimer } = useInterstitialAd();

  useEffect(() => {
    startAdTimer();
    // Try to resume a previous session on mount
    (async () => {
      const savedId = await getSavedSessionId();
      if (savedId && !sessionId) {
        try {
          const data = await getSession(savedId);
          if (data.status === 'active') {
            restoreSession(data);
          } else {
            await reset();
          }
        } catch {
          await reset(); // session gone from server
        }
      }
    })();
    return () => {
      stopAdTimer();
    };
  }, []);

  const handleStart = async () => {
    setStarting(true);
    try {
      const data = await startSession(params.uid, params.username, params.symbol, timeframe, accountSize);
      await setSession(data);
    } catch (e: any) {
      Alert.alert('Start failed', e.message);
    } finally {
      setStarting(false);
    }
  };

  const handleAdvance = useCallback(async () => {
    if (!sessionId || advancing) return;
    setAdvancing(true);
    try {
      const res = await advanceSession(sessionId, 1);
      if (res.done) {
        Alert.alert('End of data', 'No more bars available for this period.');
        return;
      }
      appendCandles(res.candles);

      // Handle auto-closed positions (SL/TP hit)
      if (res.auto_closed && res.auto_closed.length > 0) {
        res.auto_closed.forEach((t: any) => {
          removePosition(t.id);
          addClosedTrade(t);
        });
      }
    } catch (e: any) {
      Alert.alert('Advance failed', e.message);
    } finally {
      setAdvancing(false);
    }
  }, [sessionId, advancing]);

  const handleEnd = async () => {
    if (!sessionId) return;
    Alert.alert('End Session', 'Post your result to the leaderboard?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'End & Post',
        onPress: async () => {
          setEnding(true);
          try {
            const res = await endSession(sessionId, balance, params.username);
            await markEnded();
            Alert.alert(
              'Session Complete',
              `Return: ${res.return_pct > 0 ? '+' : ''}${res.return_pct}%\nWin Rate: ${res.win_rate}%`,
            );
          } catch (e: any) {
            Alert.alert('Error', e.message);
          } finally {
            setEnding(false);
          }
        },
      },
    ]);
  };

  const currentPrice = candles.length > 0 ? candles[candles.length - 1].close : 0;

  // ── Pre-session setup screen ──────────────────────────────────────────────
  if (!sessionId) {
    return (
      <View style={styles.setup}>
        <Text style={styles.setupTitle}>{params.name}</Text>
        <Text style={styles.setupSub}>Choose timeframe and account size</Text>

        <Text style={styles.setupLabel}>Timeframe</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tfBar}>
          {TIMEFRAMES.map((tf) => (
            <TouchableOpacity
              key={tf}
              style={[styles.tfBtn, timeframe === tf && styles.tfActive]}
              onPress={() => setTimeframe(tf)}
            >
              <Text style={[styles.tfText, timeframe === tf && styles.tfTextActive]}>{tf}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <Text style={styles.setupLabel}>Account Size</Text>
        <View style={styles.sizeRow}>
          {ACCOUNT_SIZES.map((s) => (
            <TouchableOpacity
              key={s}
              style={[styles.sizeBtn, accountSize === s && styles.sizeActive]}
              onPress={() => setAccountSize(s)}
            >
              <Text style={[styles.sizeText, accountSize === s && styles.sizeTextActive]}>
                ${(s / 1000).toFixed(0)}K
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity
          style={[styles.startBtn, starting && styles.disabled]}
          onPress={handleStart}
          disabled={starting}
        >
          {starting
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.startBtnText}>Start Trading →</Text>}
        </TouchableOpacity>
      </View>
    );
  }

  // ── Active / ended session ────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      {/* Header bar */}
      <View style={styles.header}>
        <Text style={styles.headerSymbol}>{params.name}</Text>
        <Text style={styles.headerTf}>{timeframe}</Text>
        {isEnded
          ? <Text style={styles.endedBadge}>ENDED</Text>
          : (
            <TouchableOpacity style={styles.endBtn} onPress={handleEnd} disabled={ending}>
              <Text style={styles.endBtnText}>{ending ? '…' : 'End'}</Text>
            </TouchableOpacity>
          )}
      </View>

      {/* Chart */}
      <View style={styles.chart}>
        <TradingChart candles={candles} positions={positions} currentPrice={currentPrice} />
      </View>

      {/* Next Bar button */}
      {!isEnded && (
        <TouchableOpacity
          style={[styles.nextBar, advancing && styles.disabled]}
          onPress={handleAdvance}
          disabled={advancing}
        >
          {advancing
            ? <ActivityIndicator color="#fff" size="small" />
            : <Text style={styles.nextBarText}>▶ Next Bar</Text>}
        </TouchableOpacity>
      )}

      {/* Order panel + positions */}
      <ScrollView style={styles.panel} keyboardShouldPersistTaps="handled">
        {!isEnded && (
          <OrderPanel
            currentPrice={currentPrice}
            pip={params.pip}
            contractSize={params.contractSize}
          />
        )}

        {/* Closed trades summary */}
        {useSessionStore.getState().closedTrades.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Closed Trades</Text>
            {useSessionStore.getState().closedTrades.map((t) => (
              <View key={t.id} style={styles.tradeRow}>
                <Text style={[styles.tradeSide, t.side === 'buy' ? styles.green : styles.red]}>
                  {t.side.toUpperCase()}
                </Text>
                <Text style={styles.tradeDetail}>
                  {t.lots} lots  {t.entry_price.toFixed(2)} → {t.exit_price.toFixed(2)}
                </Text>
                <Text style={[styles.tradePnl, t.pnl >= 0 ? styles.green : styles.red]}>
                  {t.pnl >= 0 ? '+' : ''}${t.pnl.toFixed(2)}
                </Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  // Setup screen
  setup: { flex: 1, backgroundColor: '#0d1117', padding: 24, justifyContent: 'center' },
  setupTitle: { color: '#e6edf3', fontSize: 26, fontWeight: '800', marginBottom: 4 },
  setupSub: { color: '#8b949e', fontSize: 14, marginBottom: 24 },
  setupLabel: { color: '#8b949e', fontSize: 12, fontWeight: '600', marginBottom: 8, marginTop: 16 },
  sizeRow: { flexDirection: 'row', gap: 8 },
  sizeBtn: {
    flex: 1, paddingVertical: 12, borderRadius: 8, borderWidth: 1,
    borderColor: '#30363d', alignItems: 'center',
  },
  sizeActive: { backgroundColor: '#1f6feb', borderColor: '#1f6feb' },
  sizeText: { color: '#8b949e', fontWeight: '700' },
  sizeTextActive: { color: '#fff' },
  startBtn: {
    marginTop: 32, backgroundColor: '#238636', padding: 18,
    borderRadius: 12, alignItems: 'center',
  },
  startBtnText: { color: '#fff', fontWeight: '800', fontSize: 18 },

  // Session screen
  container: { flex: 1, backgroundColor: '#0d1117' },
  header: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10,
    backgroundColor: '#161b22', gap: 8,
  },
  headerSymbol: { color: '#e6edf3', fontWeight: '700', fontSize: 15, flex: 1 },
  headerTf: { color: '#58a6ff', fontWeight: '600', fontSize: 13 },
  endedBadge: { color: '#8b949e', fontSize: 12, fontWeight: '600' },
  endBtn: { backgroundColor: '#21262d', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
  endBtnText: { color: '#f85149', fontWeight: '700', fontSize: 13 },

  chart: { height: 300 },

  nextBar: {
    backgroundColor: '#1f6feb', marginHorizontal: 12, marginVertical: 8,
    paddingVertical: 12, borderRadius: 10, alignItems: 'center',
  },
  nextBarText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  panel: { flex: 1, paddingHorizontal: 12 },

  section: { marginBottom: 16 },
  sectionTitle: { color: '#e6edf3', fontWeight: '700', fontSize: 14, marginBottom: 8 },
  tradeRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#161b22',
    borderRadius: 8, padding: 10, marginBottom: 6, gap: 8,
  },
  tradeSide: { fontWeight: '700', width: 40 },
  tradeDetail: { color: '#8b949e', fontSize: 12, flex: 1 },
  tradePnl: { fontWeight: '700', fontSize: 14 },

  tfBar: { flexGrow: 0, marginBottom: 8 },
  tfBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 6, marginRight: 6, backgroundColor: '#161b22' },
  tfActive: { backgroundColor: '#1f6feb' },
  tfText: { color: '#8b949e', fontWeight: '600' },
  tfTextActive: { color: '#fff' },

  green: { color: '#3fb950' },
  red: { color: '#f85149' },
  disabled: { opacity: 0.5 },
});
