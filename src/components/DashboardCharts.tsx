import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path, Line, Rect, Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import { colors, radius, spacing, fontSize, fontWeight, labelStyle } from '../theme';

interface Trade { pnl: number; closed_at: number; r_multiple?: number | null; }

// ── Equity curve ───────────────────────────────────────────────────────────────
export function EquityCurve({ trades, startBalance = 10000, height = 140 }: {
  trades: Trade[]; startBalance?: number; height?: number;
}) {
  const points = useMemo(() => {
    const sorted = [...trades].sort((a, b) => a.closed_at - b.closed_at);
    let cum = startBalance;
    return [{ x: 0, equity: cum }, ...sorted.map((t, i) => {
      cum += t.pnl;
      return { x: i + 1, equity: cum };
    })];
  }, [trades, startBalance]);

  if (points.length < 2) return <EmptyChart label="No trades yet" height={height} />;

  const minEq = Math.min(...points.map((p) => p.equity));
  const maxEq = Math.max(...points.map((p) => p.equity));
  const range = Math.max(maxEq - minEq, 1);
  const W = 320, H = height;
  const xStep = W / (points.length - 1);
  const xy = (i: number) => ({
    x: i * xStep,
    y: H - ((points[i].equity - minEq) / range) * (H - 20) - 10,
  });
  const path = points.map((_, i) => {
    const { x, y } = xy(i);
    return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');

  const lastEquity = points[points.length - 1].equity;
  const profitable = lastEquity >= startBalance;
  const stroke = profitable ? colors.green : colors.red;

  // Area fill below the line
  const areaPath = `${path} L${W},${H} L0,${H} Z`;

  return (
    <View style={[charts.card, { padding: spacing.md }]}>
      <Text style={[labelStyle, { fontSize: 9 }]}>EQUITY CURVE</Text>
      <Text style={[charts.bigValue, { color: stroke, marginTop: 2 }]}>
        ${lastEquity.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </Text>
      <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}>
        <Defs>
          <LinearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={stroke} stopOpacity="0.3" />
            <Stop offset="1" stopColor={stroke} stopOpacity="0" />
          </LinearGradient>
        </Defs>
        <Path d={areaPath} fill="url(#grad)" />
        <Path d={path} stroke={stroke} strokeWidth={2} fill="none" />
        <Circle cx={(points.length - 1) * xStep} cy={xy(points.length - 1).y} r={4} fill={stroke} />
      </Svg>
    </View>
  );
}

// ── Win/loss horizontal bar ────────────────────────────────────────────────────
export function WinLossBar({ trades }: { trades: Trade[] }) {
  const wins   = trades.filter((t) => t.pnl > 0).length;
  const losses = trades.filter((t) => t.pnl <= 0).length;
  const total  = wins + losses;
  const winPct = total ? wins / total : 0;
  return (
    <View style={charts.card}>
      <Text style={[labelStyle, { fontSize: 9, padding: spacing.md, paddingBottom: 4 }]}>WIN / LOSS RATIO</Text>
      <View style={charts.barTrack}>
        <View style={[charts.barFill, { backgroundColor: colors.green, flex: winPct }]} />
        <View style={[charts.barFill, { backgroundColor: colors.red, flex: 1 - winPct }]} />
      </View>
      <View style={charts.barLegend}>
        <Text style={[charts.legendText, { color: colors.green }]}>{wins} WINS</Text>
        <Text style={charts.legendCenter}>{(winPct * 100).toFixed(0)}%</Text>
        <Text style={[charts.legendText, { color: colors.red }]}>{losses} LOSSES</Text>
      </View>
    </View>
  );
}

// ── Daily P&L sparkline ───────────────────────────────────────────────────────
export function DailyPnlSpark({ trades, height = 80 }: { trades: Trade[]; height?: number }) {
  const buckets = useMemo(() => {
    const map: Record<string, number> = {};
    trades.forEach((t) => {
      const d = new Date(t.closed_at).toISOString().slice(0, 10);
      map[d] = (map[d] || 0) + t.pnl;
    });
    return Object.entries(map).sort(([a], [b]) => a < b ? -1 : 1).slice(-30); // last 30 days
  }, [trades]);

  if (buckets.length === 0) return <EmptyChart label="No trades yet" height={height} />;

  const max = Math.max(...buckets.map(([, v]) => Math.abs(v)), 1);
  const W = 320, H = height;
  const barW = (W / buckets.length) * 0.8;
  const gap  = (W / buckets.length) * 0.2;

  return (
    <View style={[charts.card, { padding: spacing.md }]}>
      <Text style={[labelStyle, { fontSize: 9 }]}>DAILY P&amp;L (LAST {buckets.length})</Text>
      <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}>
        <Line x1={0} y1={H / 2} x2={W} y2={H / 2} stroke={colors.borderSubtle} strokeWidth={1} />
        {buckets.map(([_, v], i) => {
          const h = (Math.abs(v) / max) * (H / 2 - 4);
          const x = i * (barW + gap);
          const y = v >= 0 ? H / 2 - h : H / 2;
          return (
            <Rect key={i} x={x} y={y} width={barW} height={h}
                  fill={v >= 0 ? colors.green : colors.red} />
          );
        })}
      </Svg>
    </View>
  );
}

// ── Streak tracker ─────────────────────────────────────────────────────────────
export function StreakTracker({ trades }: { trades: Trade[] }) {
  const sorted = [...trades].sort((a, b) => a.closed_at - b.closed_at);
  let curWin = 0, curLoss = 0, maxWin = 0, maxLoss = 0;
  let cw = 0, cl = 0;
  sorted.forEach((t) => {
    if (t.pnl > 0) { cw++; cl = 0; maxWin = Math.max(maxWin, cw); }
    else           { cl++; cw = 0; maxLoss = Math.max(maxLoss, cl); }
  });
  curWin = cw; curLoss = cl;
  return (
    <View style={[charts.card, charts.streakCard]}>
      <View style={charts.streakItem}>
        <Text style={[labelStyle, { fontSize: 9 }]}>CURRENT</Text>
        <Text style={[charts.streakValue, { color: curWin > 0 ? colors.green : (curLoss > 0 ? colors.red : colors.textSecondary) }]}>
          {curWin > 0 ? `${curWin}W` : curLoss > 0 ? `${curLoss}L` : '—'}
        </Text>
      </View>
      <View style={charts.streakDiv} />
      <View style={charts.streakItem}>
        <Text style={[labelStyle, { fontSize: 9 }]}>BEST WIN</Text>
        <Text style={[charts.streakValue, { color: colors.green }]}>{maxWin || 0}</Text>
      </View>
      <View style={charts.streakDiv} />
      <View style={charts.streakItem}>
        <Text style={[labelStyle, { fontSize: 9 }]}>WORST LOSS</Text>
        <Text style={[charts.streakValue, { color: colors.red }]}>{maxLoss || 0}</Text>
      </View>
    </View>
  );
}

function EmptyChart({ label, height }: { label: string; height: number }) {
  return (
    <View style={[charts.card, { height: height + 40, alignItems: 'center', justifyContent: 'center' }]}>
      <Text style={charts.empty}>{label}</Text>
    </View>
  );
}

const charts = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border,
    overflow: 'hidden',
  },
  bigValue: {
    fontSize: fontSize.xxl, fontWeight: fontWeight.black, fontVariant: ['tabular-nums'],
    marginBottom: spacing.sm,
  },
  empty: { color: colors.textTertiary, fontSize: fontSize.sm },

  barTrack: {
    flexDirection: 'row', height: 18, marginHorizontal: spacing.md, borderRadius: radius.sm,
    overflow: 'hidden', backgroundColor: colors.cardAlt,
  },
  barFill: { height: '100%' },
  barLegend: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
  },
  legendText: { fontSize: fontSize.xs, fontWeight: fontWeight.bold, letterSpacing: 0.5 },
  legendCenter: { color: colors.textPrimary, fontSize: fontSize.lg, fontWeight: fontWeight.black, fontVariant: ['tabular-nums'] },

  streakCard: { flexDirection: 'row', paddingVertical: spacing.md },
  streakItem: { flex: 1, alignItems: 'center' },
  streakValue: { fontSize: fontSize.xxl, fontWeight: fontWeight.black, fontVariant: ['tabular-nums'], marginTop: 2 },
  streakDiv: { width: 1, backgroundColor: colors.border, marginVertical: spacing.sm },
});
