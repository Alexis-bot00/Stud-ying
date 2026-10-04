import React from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

export function CircleForm({ value, onChange, onSave, onCancel, busy, p, dark }: any) {
  const field = (key: string, label: string, placeholder: string, multiline = false) => <View style={{ marginTop: 18 }}>
    <Text style={{ color: p.navy, fontSize: 13, fontWeight: '700', marginBottom: 8 }}>{label}</Text>
    <TextInput accessibilityLabel={label} value={value[key]} onChangeText={text => onChange({ ...value, [key]: text })}
      placeholder={placeholder} placeholderTextColor={p.muted} multiline={multiline} maxLength={multiline ? 2000 : 160}
      style={{ color: p.ink, backgroundColor: p.bg, borderColor: p.line, borderWidth: 1, borderRadius: 14, padding: 14, minHeight: multiline ? 100 : 48, textAlignVertical: 'top' }} />
  </View>;
  return <View style={{ width: '100%', maxWidth: 640, alignSelf: 'center', padding: 22, borderRadius: 24, backgroundColor: p.white, borderWidth: 1, borderColor: p.line }}>
    <Text style={{ color: p.navy, fontSize: 23, fontWeight: '800' }}>{value.edit ? 'Manage Circle' : 'Create Circle'}</Text>
    <Text style={{ color: p.muted, fontSize: 13, lineHeight: 21, marginTop: 8 }}>Give your circle a name, then choose who can find it.</Text>
    <Text style={{ color: p.blue, fontSize: 12, lineHeight: 20, marginTop: 8 }}>No Notes needed to start. Add or upload them once you're inside.</Text>
    {field('circleName', 'Circle Name', 'What would you like to call your circle?')}
    {field('subject', 'Subject', 'What are you studying?')}
    {field('description', 'Description', 'Tell your study buddies a little about this circle.', true)}
    <Text style={{ color: p.navy, fontSize: 13, fontWeight: '700', marginTop: 22 }}>Who can find your circle?</Text>
    <Text style={{ color: p.muted, fontSize: 12, marginTop: 6 }}>Choose one option.</Text>
    <View accessibilityRole="radiogroup" accessibilityLabel="Circle privacy" style={{ gap: 10, marginTop: 12 }}>
      {[
        { privacy: 'public', title: 'Public / Searchable', icon: '🌿', description: 'People can find your circle and request to join. You approve each request.' },
        { privacy: 'private', title: 'Private / Invite Only', icon: '🔒', description: 'Hidden from search. Only people you invite can join.' },
      ].map(option => {
        const selected = value.privacy === option.privacy;
        return <Pressable key={option.privacy} accessibilityRole="radio" accessibilityLabel={option.title}
          accessibilityState={{ checked: selected, disabled: busy }} aria-checked={selected} aria-disabled={busy} disabled={busy} onPress={() => onChange({ ...value, privacy: option.privacy })}
          style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start', padding: 16, borderRadius: 16, borderWidth: 2, borderColor: selected ? p.blue : p.line, backgroundColor: selected ? p.softBlue : p.white }}>
          <View style={{ width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: selected ? p.blue : p.muted, alignItems: 'center', justifyContent: 'center', marginTop: 2 }}>{selected && <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: p.blue }} />}</View>
          <View style={{ flex: 1 }}><Text style={{ color: p.navy, fontWeight: '700', fontSize: 14 }}>{option.icon} {option.title}</Text><Text style={{ color: p.muted, fontSize: 12, lineHeight: 19, marginTop: 5 }}>{option.description}</Text></View>
        </Pressable>;
      })}
    </View>
    <Pressable accessibilityRole="button" accessibilityLabel={value.edit ? 'Save Circle' : 'Create Study Circle'} disabled={busy || !value.circleName.trim()} onPress={onSave}
      style={{ backgroundColor: p.blue, borderRadius: 16, padding: 15, minHeight: 48, marginTop: 24, opacity: busy || !value.circleName.trim() ? 0.5 : 1 }}>
      <Text style={{ color: dark ? '#352920' : '#FFFDF8', fontWeight: '800', textAlign: 'center' }}>{value.edit ? 'Save Circle' : 'Create Study Circle'}</Text>
    </Pressable>
    <Pressable accessibilityRole="button" accessibilityLabel="Cancel" disabled={busy} onPress={onCancel} style={{ padding: 14, minHeight: 44, marginTop: 6 }}><Text style={{ color: p.muted, textAlign: 'center', fontWeight: '600' }}>Cancel</Text></Pressable>
  </View>;
}
