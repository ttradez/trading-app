import React from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, SafeAreaView,
} from 'react-native';

interface Props {
  onAccept: () => void;
}

export default function DisclaimerScreen({ onAccept }: Props) {
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <Text style={styles.logo}>Pocket Trade</Text>
        <Text style={styles.tagline}>Practice. Learn. Compete.</Text>

        <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
          <Text style={styles.heading}>Important Disclaimer</Text>
          <Text style={styles.body}>
            Pocket Trade is a <Text style={styles.bold}>simulated trading application</Text> for
            educational and entertainment purposes only.
          </Text>
          <Text style={styles.body}>
            • All trading in this app uses <Text style={styles.bold}>virtual money</Text>. No real
            funds are involved.
          </Text>
          <Text style={styles.body}>
            • Historical price data is used for practice sessions. Past market behavior does{' '}
            <Text style={styles.bold}>not</Text> predict future results.
          </Text>
          <Text style={styles.body}>
            • This app is <Text style={styles.bold}>not</Text> financial advice, investment advice,
            or a recommendation to buy or sell any financial instrument.
          </Text>
          <Text style={styles.body}>
            • Performance in simulated trading does not guarantee equivalent results in live
            markets.
          </Text>
          <Text style={styles.body}>
            • Always consult a qualified financial adviser before making real investment decisions.
          </Text>
          <Text style={styles.legal}>
            By tapping "I Understand", you confirm that you are using this app for educational
            purposes only and you have read and agree to the above disclaimer.
          </Text>
        </ScrollView>

        <TouchableOpacity style={styles.btn} onPress={onAccept}>
          <Text style={styles.btnText}>I Understand — Let's Trade</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0d1117' },
  container: { flex: 1, paddingHorizontal: 24, paddingTop: 40, paddingBottom: 24 },
  logo: { color: '#58a6ff', fontSize: 32, fontWeight: '900', textAlign: 'center' },
  tagline: { color: '#8b949e', fontSize: 14, textAlign: 'center', marginBottom: 32 },
  scroll: { flex: 1 },
  heading: { color: '#e6edf3', fontSize: 18, fontWeight: '800', marginBottom: 16 },
  body: { color: '#8b949e', fontSize: 14, lineHeight: 22, marginBottom: 12 },
  bold: { color: '#e6edf3', fontWeight: '700' },
  legal: { color: '#6e7681', fontSize: 12, lineHeight: 18, marginTop: 16, marginBottom: 24 },
  btn: {
    backgroundColor: '#1f6feb', padding: 18, borderRadius: 12, alignItems: 'center', marginTop: 8,
  },
  btnText: { color: '#fff', fontWeight: '800', fontSize: 16 },
});
