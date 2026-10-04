import React, { useState } from 'react';
import { ActivityIndicator, Pressable, SafeAreaView, ScrollView, Text, TextInput, View } from 'react-native';
import { cappyPalette as p } from './cappy';

export function PasswordRecovery({ apiUrl, initialEmail, back }: { apiUrl: string; initialEmail: string; back: (email?: string) => void }) {
  const [email, setEmail] = useState(initialEmail); const [code, setCode] = useState('');
  const [password, setPassword] = useState(''); const [confirm, setConfirm] = useState('');
  const [step, setStep] = useState<'email' | 'code' | 'done'>('email'); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const request = async (reset: boolean) => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return setError('Enter your account email address.');
    if (reset && (!/^\d{6}$/.test(code) || password.length < 6 || password !== confirm)) return setError('Enter the 6-digit code and matching passwords of at least 6 characters.');
    setBusy(true); setError('');
    try {
      const r = await fetch(`${apiUrl}/api/auth/${reset ? 'reset-password' : 'forgot-password'}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(reset ? { email: email.trim(), code, newPassword: password } : { email: email.trim() }) });
      const data = await r.json().catch(() => ({})); if (!r.ok || data.success === false) throw new Error(data.message || 'Could not complete the request. Please try again.');
      setStep(reset ? 'done' : 'code'); if (reset) { setPassword(''); setConfirm(''); setCode(''); }
    } catch (e: any) { setError(e.message || 'Check your connection and try again.'); } finally { setBusy(false); }
  };
  const field = (label: string, value: string, change: (value: string) => void, secure = false) => <TextInput accessibilityLabel={label} placeholder={label} placeholderTextColor={p.muted} value={value} onChangeText={change} editable={!busy} secureTextEntry={secure} autoCapitalize="none" keyboardType={label === 'Reset code' ? 'number-pad' : label === 'Email address' ? 'email-address' : 'default'} maxLength={label === 'Reset code' ? 6 : undefined} style={{ minHeight: 52, padding: 14, borderWidth: 1, borderColor: p.line, borderRadius: 14, color: p.ink, marginTop: 12 }} />;
  const button = (label: string, action: () => void) => <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={busy} onPress={action} style={{ minHeight: 48, padding: 14, borderRadius: 16, backgroundColor: p.blue, marginTop: 18, opacity: busy ? 0.5 : 1 }}>{busy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={{ color: '#FFFFFF', textAlign: 'center', fontWeight: '800' }}>{label}</Text>}</Pressable>;
  return <SafeAreaView style={{ flex: 1, backgroundColor: p.bg }}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}><View style={{ width: '100%', maxWidth: 430, padding: 24, borderRadius: 24, borderWidth: 1, borderColor: p.line, backgroundColor: p.white }}><Text style={{ color: p.blue, fontWeight: '800' }}>STUDYante</Text><Text style={{ color: p.navy, fontSize: 26, fontWeight: '900', marginTop: 14 }}>{step === 'done' ? 'Your fresh start is ready.' : 'Forgot your password?'}</Text><Text style={{ color: p.muted, lineHeight: 22, marginTop: 10 }}>{step === 'email' ? 'Enter your account email to request a reset code.' : step === 'code' ? 'Check your email and spam folder for the 6-digit code. It expires in 10 minutes.' : 'Your password has been updated. Sign in with your new password.'}</Text>
    {step !== 'done' && <>{field('Email address', email, setEmail)}{step === 'code' && <>{field('Reset code', code, value => setCode(value.replace(/\D/g, '')))}{field('New password', password, setPassword, true)}{field('Confirm new password', confirm, setConfirm, true)}</>}{!!error && <Text accessibilityLiveRegion="polite" style={{ color: '#C44545', marginTop: 12 }}>{error}</Text>}{button(step === 'email' ? 'Send reset code' : 'Reset password', () => request(step === 'code'))}{step === 'code' && <Pressable accessibilityRole="button" disabled={busy} onPress={() => request(false)} style={{ padding: 14 }}><Text style={{ color: p.blue, textAlign: 'center' }}>Resend code</Text></Pressable>}</>}
    {button('Back to sign in', () => back(step === 'done' ? email.trim() : undefined))}
  </View></ScrollView></SafeAreaView>;
}
