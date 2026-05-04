import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, TextInput } from 'react-native';
import { fetchMarkets } from '../services/api';

const CATEGORIES = ['All', 'crypto', 'index', 'futures', 'commodity'];

export default function MarketsScreen({ navigation }: any) {
  const [markets, setMarkets] = useState<any[]>([]);
  const [filter, setFilter] = useState('All');
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchMarkets().then(setMarkets).catch(console.warn);
  }, []);

  const filtered = markets.filter((m) => {
    const matchCat = filter === 'All' || m.category === filter;
    const matchSearch = m.symbol.toLowerCase().includes(search.toLowerCase())
      || m.name.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Markets</Text>

      <TextInput
        style={styles.search}
        placeholder="Search symbol or name..."
        placeholderTextColor="#666"
        value={search}
        onChangeText={setSearch}
      />

      <View style={styles.catBar}>
        {CATEGORIES.map((c) => (
          <TouchableOpacity
            key={c}
            style={[styles.catBtn, filter === c && styles.catActive]}
            onPress={() => setFilter(c)}
          >
            <Text style={[styles.catText, filter === c && styles.catTextActive]}>
              {c.charAt(0).toUpperCase() + c.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(m) => m.symbol}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.marketRow}
            onPress={() => navigation.navigate('Trading', { ...item })}
          >
            <View>
              <Text style={styles.symbol}>{item.symbol}</Text>
              <Text style={styles.name}>{item.name}</Text>
            </View>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{item.category}</Text>
            </View>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d1117', padding: 16 },
  header: { color: '#e6edf3', fontSize: 26, fontWeight: '900', marginBottom: 12, marginTop: 8 },
  search: {
    backgroundColor: '#161b22', color: '#e6edf3', borderRadius: 10,
    padding: 12, marginBottom: 12, borderWidth: 1, borderColor: '#30363d',
  },
  catBar: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  catBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: '#161b22' },
  catActive: { backgroundColor: '#1f6feb' },
  catText: { color: '#8b949e', fontWeight: '600', fontSize: 13 },
  catTextActive: { color: '#fff' },
  marketRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#161b22', borderRadius: 10, padding: 14, marginBottom: 8,
  },
  symbol: { color: '#e6edf3', fontWeight: '800', fontSize: 15 },
  name: { color: '#8b949e', fontSize: 12, marginTop: 2 },
  badge: { backgroundColor: '#21262d', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  badgeText: { color: '#58a6ff', fontSize: 11, fontWeight: '700' },
});
