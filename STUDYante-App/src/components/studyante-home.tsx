import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CappyMascot, cappyPalette, darkPalette, PlannerStore } from './cappy';
import { dateKey, streak } from './cappy-model';
import { CappyMood, useAutomaticCappyMood } from './cappy-mascot';
import { formatClassTime } from './class-time';

export function StudyanteHome({ store, user, go, dark }: { store: PlannerStore; user: { name: string }; go: (screen: any) => void; dark: boolean }) {
  const p = dark ? darkPalette : cappyPalette;
  const { mood, setMood } = useAutomaticCappyMood();
  const moodCopy: Record<CappyMood, [string, string]> = {
    wave: ['Big dreams.\nOne small step.', 'You don’t have to do it all today. Let’s find your next little win.'],
    dance: ['A little wiggle.\nA brighter day.', 'Stretch your shoulders. Smile a little. Cappy’s got the happy dance covered.'],
    sleep: ['Soft paws.\nSlow moments.', 'Rest is part of growing, too. Take a breather with your sleepy study buddy.'],
    read: ['One page.\nOne new idea.', 'Settle in beside Cappy. Even a few quiet minutes can make something click.'],
    celebrate: ['Look at you!\nA little victory.', 'You showed up, and that matters. Cappy thinks every small win deserves a cheer.'],
    cute: ['A tiny tilt.\nA big smile.', 'Cappy’s trying out the cutest pose. A little silliness brightens a study day.'],
    sad: ['A tiny pout.\nA little kindness.', 'Cappy could use a little cheer. Tap your buddy for a happy little bounce.'],
  };
  const d = store.data; const today = dateKey();
  const meetings = d.noClass.includes(today) ? [] : d.classes.filter(c => c.day === new Date().getDay()).sort((a, b) => a.start.localeCompare(b.start));
  const tasks = d.tasks.filter(t => !t.done);
  const completed = d.tasks.filter(t => t.done).length;
  const balance = d.expenses.reduce((n, e) => n + (e.income ? e.amount : -e.amount), 0);
  const checked = d.attendance.includes(today);
  const action = (label: string, icon: any, screen: string, caption: string, tint: string) => <Pressable accessibilityRole="button" accessibilityLabel={label} key={label} onPress={() => go(screen)} style={({ pressed }) => [s.tile, { backgroundColor: dark ? p.white : tint, borderColor: p.line, opacity: pressed ? 0.75 : 1 }]}><View style={s.row}><Ionicons name={icon} color={p.blue} size={23} /><Ionicons name="arrow-forward" color={p.muted} size={17} style={{ transform: [{ rotate: '-45deg' }] }} /></View><Text style={[s.tileTitle, { color: p.navy }]}>{label}</Text><Text style={{ color: p.muted, fontSize: 12, lineHeight: 18 }}>{caption}</Text></Pressable>;
  return <>
    <View style={[s.row, { marginBottom: 22 }]}><View><Text style={[s.brand, { color: p.navy }]}>STUDY<Text style={{ color: p.blue }}>ante</Text><Text style={{ color: p.red }}>.</Text></Text><Text style={{ color: p.muted, fontSize: 11, letterSpacing: 0.4 }}>YOUR SPACE TO GROW</Text></View><Pressable accessibilityLabel="Open account settings" onPress={() => go('profile')} style={[s.settings, { backgroundColor: p.white, borderColor: p.line }]}><Ionicons name="options-outline" size={23} color={p.ink} /></Pressable></View>
    <Text style={[s.date, { color: p.muted }]}>{new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }).toUpperCase()}</Text>
    <Text style={[s.greeting, { color: p.navy }]}>Hello, {d.nickname || user.name.split(' ')[0]}!</Text>
    <View style={s.hero}>
      <View pointerEvents="none" style={s.orbit} />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><View style={{ flex: 1 }}><Text style={s.heroLabel}>YOUR LITTLE STUDY COMPANION</Text><Text style={s.heroTitle}>{moodCopy[mood][0]}</Text><Text style={s.heroCopy}>{moodCopy[mood][1]}</Text></View><View style={{ alignItems: 'center' }}><View pointerEvents="none" style={{ position: 'absolute', bottom: 2, width: 90, height: 18, borderRadius: 45, backgroundColor: '#F8D9A829' }} /><CappyMascot size={110} mood={mood} onMoodChange={setMood} /></View></View>
      <View style={s.heroFooter}><Ionicons name="heart-outline" size={17} color="#FFD5A0" /><Text style={{ flex: 1, color: '#F6DEC0', fontSize: 12 }}>A little company for every kind of day.</Text></View>

    </View>
    <View style={s.grid}>
      {action('Snap & Sort', 'scan-outline', 'schedule', 'Photograph a timetable. Plan your week.', '#F5E4CB')}
      {action('Small Wins', 'checkbox-outline', 'tasks', `${tasks.length} things waiting. One step at a time.`, '#E8F4EF')}
      {action('Pocket Plan', 'wallet-outline', 'budget', d.expenses.length ? `₱${balance.toFixed(2)} left` : 'Give your allowance a little direction.', '#FFF1E4')}
      {action('Study Desk', 'book-outline', 'library', 'Your notes, flashcards, and bright ideas.', '#F6EDD8')}
    </View>
    <View style={[s.row, { marginTop: 22, marginBottom: 12 }]}><Text style={[s.section, { color: p.navy }]}>Today’s path</Text><Pressable accessibilityRole="button" onPress={() => go('schedule')} style={{ padding: 8 }}><Text style={{ color: p.blue, fontWeight: '700', fontSize: 12 }}>Open Week Canvas →</Text></Pressable></View>
    <View style={[s.paper, { backgroundColor: p.white, borderColor: p.line }]}>
      {!meetings.length ? <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}><View style={[s.icon, { backgroundColor: p.softBlue }]}><Ionicons name="sunny-outline" size={25} color={p.red} /></View><View style={{ flex: 1 }}><Text style={{ color: p.navy, fontWeight: '800', fontSize: 16 }}>A little breathing room</Text><Text style={{ color: p.muted, marginTop: 5, lineHeight: 19 }}>No classes today. Make space for a hobby, a nap, or a fresh idea.</Text></View></View> : meetings.map(c => <View key={c.id} style={[s.meeting, { borderLeftColor: p.blue }]}><Text style={{ color: p.blue, fontSize: 12, fontWeight: '800' }}>{formatClassTime(c.start)}—{formatClassTime(c.end)}</Text><Text style={{ color: p.navy, fontWeight: '800', fontSize: 16, marginTop: 3 }}>{c.name}</Text>{!!c.room && <Text style={{ color: p.muted, fontSize: 12, marginTop: 3 }}>{c.room}</Text>}</View>)}
      {!!tasks.length && <View style={{ marginTop: 14, gap: 10 }}>{tasks.slice(0, 3).map(task => <Pressable key={task.id} accessibilityRole="checkbox" accessibilityState={{ checked: false }} accessibilityLabel={`Complete ${task.title}`} onPress={() => { store.update(v => ({ ...v, tasks: v.tasks.map(t => t.id === task.id ? { ...t, done: true } : t) })); setMood('celebrate'); }} style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}><Ionicons name="ellipse-outline" size={21} color={p.blue} /><View style={{ flex: 1 }}><Text style={{ color: p.ink }}>{task.title}</Text>{!!task.due && <Text style={{ color: p.muted, fontSize: 11 }}>{task.due}</Text>}</View></Pressable>)}</View>}
      <Pressable accessibilityRole="button" onPress={() => go('tasks')} style={[s.outline, { borderColor: p.line }]}><Text style={{ color: p.blue, fontWeight: '700' }}>＋ Add a small win</Text></Pressable>
    </View>
    <View style={[s.row, { marginTop: 24, marginBottom: 12 }]}><Text style={[s.section, { color: p.navy }]}>Your momentum</Text><Text style={{ color: p.red, fontWeight: '800', fontSize: 12 }}>✦ {streak(d.attendance)} day streak</Text></View>
    <View style={[s.paper, { backgroundColor: p.white, borderColor: p.line }]}><View style={s.row}>{Array.from({ length: 7 }, (_, i) => { const date = new Date(); date.setDate(date.getDate() - 6 + i); const done = d.attendance.includes(dateKey(date)); return <View key={i} style={{ flex: 1, alignItems: 'center' }}><View style={[s.pebble, { backgroundColor: done ? p.blue : p.softBlue }]}><Ionicons name={done ? 'checkmark' : 'leaf-outline'} size={16} color={done ? '#FFFFFF' : p.muted} /></View><Text style={{ color: p.muted, fontSize: 10, marginTop: 6 }}>{date.toLocaleDateString(undefined, { weekday: 'narrow' })}</Text></View>; })}</View><Pressable accessibilityRole="button" disabled={checked || !store.ready} onPress={() => store.update(v => ({ ...v, attendance: [...v.attendance, today] }))} style={[s.outline, { borderColor: p.line, backgroundColor: p.softBlue, marginTop: 15 }]}><Text style={{ color: p.blue, fontWeight: '800' }}>{checked ? 'Today’s check-in is saved ✓' : 'Check in for today'}</Text></Pressable><Text style={{ color: p.muted, fontSize: 12, textAlign: 'center', marginTop: 10 }}>{completed} small win{completed === 1 ? '' : 's'} completed. Showing up counts.</Text></View>
    <Pressable accessibilityRole="button" accessibilityLabel="Ask AI" onPress={() => go('ai')} style={[s.assist, { backgroundColor: dark ? p.softBlue : '#E8F3EF' }]}><Ionicons name="sparkles-outline" size={26} color="#387F6B" /><View style={{ flex: 1 }}><Text style={{ color: p.navy, fontWeight: '800', fontSize: 17 }}>A fresh way to understand</Text><Text style={{ color: p.muted, lineHeight: 20, marginTop: 4 }}>Bring a question to STUDYante AI.</Text></View><Ionicons name="arrow-forward" size={20} color={p.blue} /></Pressable>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginVertical: 14 }}>{[['Progress Pages', 'grades'], ['Study Circle', 'friends'], ['Community', 'community']].map(([label, screen]) => <Pressable key={screen} accessibilityRole="button" accessibilityLabel={label} onPress={() => go(screen)} style={[s.shortcut, { backgroundColor: p.white, borderColor: p.line }]}><Text style={{ color: p.blue, fontWeight: '700', fontSize: 12 }}>{label} ↗</Text></Pressable>)}</View>
  </>;
}
const s = StyleSheet.create({
  brand: { fontSize: 26, fontWeight: '900', letterSpacing: -1 }, settings: { width: 44, height: 44, borderRadius: 15, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 5 }, date: { fontSize: 10, letterSpacing: 1.2, fontWeight: '700' }, greeting: { fontSize: 30, fontWeight: '900', letterSpacing: -1, marginTop: 8, marginBottom: 20 },
  hero: { backgroundColor: '#785037', borderRadius: 26, padding: 20, overflow: 'hidden', marginBottom: 18 }, orbit: { position: 'absolute', top: -65, right: -60, width: 220, height: 220, borderRadius: 110, borderWidth: 32, borderColor: '#FFFFFF09' }, heroLabel: { color: '#F7D6A3', fontSize: 9, fontWeight: '800', letterSpacing: 1.3 }, heroTitle: { color: '#FFF9EF', fontWeight: '900', fontSize: 26, lineHeight: 31, letterSpacing: -0.5, marginTop: 10 }, heroCopy: { color: '#F9E2C5', lineHeight: 20, fontSize: 12, marginTop: 10 }, heroFooter: { flexDirection: 'row', alignItems: 'center', gap: 8, borderTopWidth: 1, borderTopColor: '#FFFFFF18', paddingTop: 14, marginTop: 18 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 }, tile: { width: '47%', flexGrow: 1, minWidth: 120, borderRadius: 21, padding: 16, borderWidth: 1 }, tileTitle: { fontWeight: '800', fontSize: 16, marginTop: 17, marginBottom: 5 }, section: { fontSize: 19, fontWeight: '800', letterSpacing: -0.4 }, paper: { padding: 18, borderRadius: 22, borderWidth: 1 }, icon: { width: 45, height: 45, borderRadius: 15, alignItems: 'center', justifyContent: 'center' }, meeting: { borderLeftWidth: 3, paddingLeft: 13, marginVertical: 9 }, outline: { borderWidth: 1, borderRadius: 14, padding: 14, minHeight: 46, alignItems: 'center', marginTop: 18 }, pebble: { width: 29, height: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }, assist: { marginTop: 20, borderRadius: 21, padding: 18, flexDirection: 'row', alignItems: 'center', gap: 12 }, shortcut: { padding: 12, borderRadius: 14, minHeight: 44, borderWidth: 1 },
});
