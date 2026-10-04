import React, { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

export function formatClassTime(value: string) {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) return value;
  const [hour, minute] = value.split(':').map(Number);
  return `${hour % 12 || 12}:${String(minute).padStart(2, '0')} ${hour >= 12 ? 'PM' : 'AM'}`;
}
export function ClassTime({ label, value, onChange, p }: { label: string; value: string; onChange: (time: string) => void; p: { ink: string; muted: string; line: string; white: string; blue: string; softBlue: string } }) {
  const initial = formatClassTime(value);
  const [clock, setClock] = useState(initial.split(' ')[0]);
  const [period, setPeriod] = useState(initial.endsWith('PM') ? 'PM' : 'AM');
  const change = (text: string, ampm: string) => {
    setClock(text); setPeriod(ampm);
    const match = /^(0?[1-9]|1[0-2]):([0-5]\d)$/.exec(text.trim());
    onChange(match ? `${String(Number(match[1]) % 12 + (ampm === 'PM' ? 12 : 0)).padStart(2, '0')}:${match[2]}` : '');
  };
  return <View style={{ flex: 1, minWidth: 100, marginBottom: 12 }}><Text style={{ color: p.ink, fontSize: 12, fontWeight: '700', marginBottom: 6 }}>{label}</Text><TextInput accessibilityLabel={label} value={clock} onChangeText={text => change(text, period)} placeholder="9:00" placeholderTextColor={p.muted} keyboardType="numbers-and-punctuation" maxLength={5} style={{ color: p.ink, backgroundColor: p.white, borderColor: p.line, borderWidth: 1, borderRadius: 14, padding: 12, minHeight: 48, fontSize: 16 }} /><View style={{ flexDirection: 'row', gap: 6, marginTop: 6 }}>{['AM', 'PM'].map(option => <Pressable key={option} accessibilityRole="button" accessibilityLabel={`${label} ${option}`} accessibilityState={{ selected: period === option }} onPress={() => change(clock, option)} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 44, borderRadius: 12, backgroundColor: period === option ? p.blue : p.softBlue }}><Text style={{ color: period === option ? '#FFFFFF' : p.ink, fontWeight: '800' }}>{option}</Text></Pressable>)}</View></View>;
}
