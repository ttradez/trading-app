import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '../services/firebase';

export default function SignupScreen({ navigation }: any) {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const signup = async () => {
    if (!username || !email || !password) { Alert.alert('Fill in all fields'); return; }
    if (password.length < 6) { Alert.alert('Password must be at least 6 characters'); return; }
    setLoading(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      await setDoc(doc(db, 'users', cred.user.uid), {
        uid: cred.user.uid,
        username,
        email,
        balance: 100000,
        startingBalance: 100000,
        equity: 100000,
        totalPnl: 0,
        dailyPnl: 0,
        winRate: 0,
        totalTrades: 0,
        createdAt: Date.now(),
      });
    } catch (e: any) {
      Alert.alert('Signup failed', e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.logo}>📈 TradeSim</Text>
      <Text style={styles.sub}>Create your account</Text>

      <TextInput
        style={styles.input}
        placeholder="Username"
        placeholderTextColor="#666"
        value={username}
        onChangeText={setUsername}
        autoCapitalize="none"
      />
      <TextInput
        style={styles.input}
        placeholder="Email"
        placeholderTextColor="#666"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
      />
      <TextInput
        style={styles.input}
        placeholder="Password (min 6 chars)"
        placeholderTextColor="#666"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />

      <Text style={styles.note}>Starting balance: $100,000 (paper money)</Text>

      <TouchableOpacity style={styles.btn} onPress={signup} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Create Account</Text>}
      </TouchableOpacity>

      <TouchableOpacity onPress={() => navigation.goBack()}>
        <Text style={styles.link}>Already have an account? <Text style={styles.linkBold}>Log In</Text></Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d1117', justifyContent: 'center', padding: 24 },
  logo: { fontSize: 32, fontWeight: '900', color: '#58a6ff', textAlign: 'center', marginBottom: 8 },
  sub: { color: '#8b949e', textAlign: 'center', marginBottom: 32, fontSize: 15 },
  input: {
    backgroundColor: '#161b22', color: '#e6edf3', borderRadius: 10,
    padding: 14, marginBottom: 14, borderWidth: 1, borderColor: '#30363d', fontSize: 15,
  },
  note: { color: '#3fb950', textAlign: 'center', marginBottom: 20, fontSize: 13 },
  btn: { backgroundColor: '#1f6feb', padding: 16, borderRadius: 10, alignItems: 'center', marginBottom: 16 },
  btnText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  link: { color: '#8b949e', textAlign: 'center' },
  linkBold: { color: '#58a6ff', fontWeight: '700' },
});
