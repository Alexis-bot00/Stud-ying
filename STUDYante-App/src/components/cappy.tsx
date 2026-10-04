import { StudyCircles } from './study-circles';
import { ClassTime, formatClassTime } from './class-time';
import { CappyMascot } from './cappy-mascot';
export { CappyMascot } from './cappy-mascot';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { ClassItem, Planner, TaskItem, dateKey, emptyPlanner, grade, makeId, streak, validDate, validTime } from './cappy-model';
import { chooseReminderSound, syncReminders, testReminder } from './cappy-notifications';

export const cappyPalette = { blue: '#865438', red: '#B66035', navy: '#3E2B22', ink: '#594338', muted: '#826E5E', bg: '#FFF8EE', white: '#FFFDF8', line: '#EADBC7', softBlue: '#F4E5D0', softRed: '#FFE6CF' };
const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const darkPalette = { ...cappyPalette, blue: '#D5A16B', red: '#E4AA75', navy: '#FFF3DE', ink: '#F2E2CD', muted: '#C5B09A', bg: '#261D18', white: '#352920', line: '#594434', softBlue: '#4B3829', softRed: '#533A29' };
type Theme = typeof cappyPalette;
type Go = (screen: any) => void;

export function usePlanner(userId: string) {
  const [data, setData] = useState<Planner>(emptyPlanner);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const key = `cappy-planner:${userId}`;
  const [loadedKey, setLoadedKey] = useState('');
  const writes = useRef(Promise.resolve());
  const currentData = useRef<Planner>(emptyPlanner);
  const loadFailed = useRef(false);
  const writeFailed = useRef(false);
  useEffect(() => {
    let live = true; setReady(false); setData(emptyPlanner); currentData.current = emptyPlanner; loadFailed.current = false; writeFailed.current = false; setError('');
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(key);
        const starter = userId !== 'guest' ? await AsyncStorage.getItem('cappy-planner:guest') : null;
        const value = saved || starter;
        const loaded = value ? { ...emptyPlanner, ...JSON.parse(value) } : { ...emptyPlanner };
        if (live) { currentData.current = loaded; setData(loaded); }
        if (live && !saved && starter) { await AsyncStorage.setItem(key, JSON.stringify(loaded)); await AsyncStorage.removeItem('cappy-planner:guest'); }
      } catch { if (live) { loadFailed.current = true; setError('Could not load your planner. Please reopen the app before making changes.'); } }
      finally { if (live) { setLoadedKey(key); setReady(true); } }
    })();
    return () => { live = false; };
  }, [key, userId]);
  const update = (change: (current: Planner) => Planner) => {
    if (!ready || loadedKey !== key || loadFailed.current) return;
    const next = change(currentData.current);
    currentData.current = next;
    setData(next);
    writes.current = writes.current.catch(() => {}).then(async () => { await AsyncStorage.setItem(key, JSON.stringify(next)); writeFailed.current = false; setError(''); }).catch(() => { writeFailed.current = true; setError('Your changes could not be saved. Free some storage and try again.'); });
  };
  return { data: loadedKey === key ? data : emptyPlanner, update, ready: ready && loadedKey === key, error, flush: async () => { await writes.current; if (loadFailed.current || writeFailed.current) throw new Error('Planner storage unavailable'); } };
}
export type PlannerStore = ReturnType<typeof usePlanner>;
export function CappyPreferences({ store, dark }: { store: PlannerStore; dark: boolean }) {
  const p = dark ? darkPalette : cappyPalette;
  return <Panel p={p}><View style={styles.between}><Text style={[styles.subtitle, { color: p.navy }]}>Your STUDYante space</Text><CappyMascot size={60} /></View><Field label="Your nickname" value={store.data.nickname} onChange={nickname => store.update(d => ({ ...d, nickname }))} p={p} /><Text style={{ color: p.muted }}>Planner entries save on this device, separately for each account.</Text></Panel>;
}
function Button({ label, onPress, p, secondary = false, disabled = false }: { label: string; onPress: () => void; p: Theme; secondary?: boolean; disabled?: boolean }) {
  return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.button, { backgroundColor: secondary ? p.softBlue : p.blue, opacity: disabled ? 0.45 : pressed ? 0.75 : 1 }]}><Text style={{ color: secondary ? p.blue : '#FFFFFF', fontWeight: '800', fontSize: 15 }}>{label}</Text></Pressable>;
}
function Field({ label, value, onChange, p, numeric = false }: { label: string; value: string; onChange: (v: string) => void; p: Theme; numeric?: boolean }) {
  return <View style={{ marginBottom: 12 }}><Text style={[styles.label, { color: p.ink }]}>{label}</Text><TextInput accessibilityLabel={label} placeholder={label} placeholderTextColor={p.muted} value={value} onChangeText={onChange} keyboardType={numeric ? 'decimal-pad' : 'default'} style={[styles.field, { color: p.ink, borderColor: p.line, backgroundColor: p.white }]} /></View>;
}
function Panel({ children, p }: { children: React.ReactNode; p: Theme }) { return <View style={[styles.panel, { backgroundColor: p.white, borderColor: p.line }]}>{children}</View>; }
function Heading({ title, sub, p }: { title: string; sub: string; p: Theme }) {
  return <View style={styles.heading}><View style={{ flex: 1 }}><Text style={[styles.eyebrow, { color: p.blue }]}>STUDYante · A LITTLE MORE POSSIBLE</Text><Text style={[styles.title, { color: p.navy }]}>{title}</Text><Text style={[styles.copy, { color: p.muted }]}>{sub}</Text></View><CappyMascot size={68} /></View>;
}
function Empty({ text, p }: { text: string; p: Theme }) { return <View style={{ padding: 20, alignItems: 'center' }}><Ionicons name="leaf-outline" size={32} color={p.blue} /><Text style={[styles.copy, { textAlign: 'center', color: p.muted }]}>{text}</Text></View>; }
function Chips({ values, selected, onSelect, p }: { values: string[]; selected: string; onSelect: (v: string) => void; p: Theme }) {
  return <View style={styles.wrap}>{values.map(value => <Pressable key={value} accessibilityRole="button" accessibilityState={{ selected: value === selected }} onPress={() => onSelect(value)} style={[styles.chip, { backgroundColor: selected === value ? p.blue : p.white, borderColor: selected === value ? p.blue : p.line }]}><Text style={{ color: selected === value ? '#FFFFFF' : p.ink, fontWeight: '700' }}>{value}</Text></Pressable>)}</View>;
}

export function ClassForm({ p, save, cancel }: { p: Theme; save: (c: ClassItem) => void; cancel: () => void }) {
  const [name, setName] = useState(''); const [day, setDay] = useState('Mon');
  const [start, setStart] = useState('08:00'); const [end, setEnd] = useState('09:00'); const [room, setRoom] = useState(''); const [error, setError] = useState('');
  return <Panel p={p}><Text style={[styles.subtitle, { color: p.navy }]}>Add a class</Text><Field label="Subject name" value={name} onChange={setName} p={p} /><Chips values={days} selected={day} onSelect={setDay} p={p} /><View style={{ flexDirection: 'row', gap: 12 }}><ClassTime label="Start time" value={start} onChange={setStart} p={p} /><ClassTime label="End time" value={end} onChange={setEnd} p={p} /></View><Field label="Room or meeting link (optional)" value={room} onChange={setRoom} p={p} />{!!error && <Text style={{ color: '#C44545' }}>{error}</Text>}<Button label="Save class" p={p} onPress={() => {
    if (!name.trim() || !validTime(start) || !validTime(end) || end <= start) return setError('Enter a subject and valid times. End time must be after start time.');
    save({ id: makeId(), name: name.trim(), day: days.indexOf(day), start, end, room: room.trim() });
  }} /><Button label="Cancel" secondary p={p} onPress={cancel} /></Panel>;
}
function Reminders({ store, p }: { store: PlannerStore; p: Theme }) {
  const [message, setMessage] = useState(''); const [busy, setBusy] = useState(false);
  const { data, update } = store;
  const run = async (action: () => Promise<string>) => {
    setBusy(true); setMessage('');
    try { await store.flush(); setMessage(await action()); }
    catch { setMessage('Could not update reminders. Check notification permissions in your device settings and try again.'); }
    finally { setBusy(false); }
  };
  return <Panel p={p}>
    <Text style={[styles.subtitle, { color: p.navy }]}>Cappy’s class reminders</Text>
    <Text style={[styles.copy, { color: p.muted }]}>Choose when your phone alerts you about your scheduled classes.</Text>
    {([['At class time', 'notifyAt', 'Notify me when class starts.'], ['Before class', 'notifyBefore', 'Give me time to get ready.']] as const).map(([label, key, help]) => <View key={key} style={[styles.between, { gap: 12, paddingVertical: 10 }]}>
      <View style={{ flex: 1 }}><Text style={{ color: p.ink, fontWeight: '700' }}>{label}</Text><Text style={{ color: p.muted, marginTop: 4 }}>{help}</Text></View>
      <Switch accessibilityLabel={label} disabled={busy} value={data[key]} onValueChange={value => { setMessage(''); update(d => ({ ...d, [key]: value })); }} trackColor={{ true: p.blue, false: p.line }} />
    </View>)}
    {data.notifyBefore && <><Text style={[styles.copy, { color: p.ink }]}>How early?</Text><Chips values={['5 min', '10 min', '15 min', '20 min', '30 min']} selected={data.minutes + ' min'} onSelect={v => { setMessage(''); update(d => ({ ...d, minutes: parseInt(v, 10) })); }} p={p} /></>}
    <View style={{ borderTopWidth: 1, borderColor: p.line, paddingTop: 14, marginTop: 12 }}>
      <Text style={{ color: p.ink, fontWeight: '700' }}>Reminder sound</Text>
      <Text style={[styles.copy, { color: p.muted }]}>{Platform.OS === 'android' ? 'Tap Choose reminder sound, then Sound. Choose a tone, or add your own music if your phone offers that option.' : Platform.OS === 'web' ? 'Sound notifications are available in the mobile app.' : 'Uses your iPhone’s notification sound.'}</Text>
      {Platform.OS === 'android' && <Button label="Choose reminder sound" secondary disabled={busy} p={p} onPress={() => run(chooseReminderSound)} />}
      {Platform.OS !== 'web' && <Button label="Test reminder sound" secondary disabled={busy} p={p} onPress={() => run(testReminder)} />}
    </View>
    <Button label={busy ? 'Please wait…' : 'Apply reminders'} disabled={busy} p={p} onPress={() => run(() => syncReminders(data))} />
    <Text style={{ color: p.muted, fontSize: 12 }}>Sound follows your phone?s volume and silent settings.</Text>
    {!!message && <Text accessibilityLiveRegion="polite" style={[styles.copy, { color: p.muted }]}>{message}</Text>}
  </Panel>;
}

export function CappyOnboarding({ done, signIn, dark, setDark }: { done: () => void; signIn: () => void; dark: boolean; setDark: (v: boolean) => void }) {
  const store = usePlanner('guest'); const p = dark ? darkPalette : cappyPalette; const insets = useSafeAreaInsets();
  const [step, setStep] = useState(0); const [adding, setAdding] = useState(false); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const titles = ['A lighter day starts here.', 'Let’s make this your space.', 'Find your comfort zone.', 'Give your week a shape.', 'A nudge at the right moment.', 'Your next chapter starts here.'];
  const finish = async () => { setBusy(true); try { await store.flush(); await AsyncStorage.setItem('cappy-onboarded', 'true'); done(); } catch { setError('Could not save setup. Please try again.'); } finally { setBusy(false); } };
  if (!store.ready) return <View style={{ flex: 1, justifyContent: 'center', backgroundColor: p.bg }}><ActivityIndicator color={p.blue} /></View>;
  return <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: p.bg, paddingTop: insets.top, paddingBottom: insets.bottom }}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1, padding: 22, width: '100%', maxWidth: 600, alignSelf: 'center' }}>
    <View style={[styles.between, { gap: 14, marginBottom: 28 }]}><Pressable accessibilityLabel="Previous setup step" disabled={step === 0} onPress={() => setStep(n => n - 1)} style={[styles.back, { borderColor: p.line, opacity: step ? 1 : 0.4 }]}><Ionicons name="arrow-back" size={24} color={p.ink} /></Pressable><View style={{ flex: 1, height: 8, borderRadius: 8, backgroundColor: p.softBlue }}><View style={{ width: `${(step + 1) / 6 * 100}%`, height: 8, borderRadius: 8, backgroundColor: p.blue }} /></View></View>
    <View style={[styles.heading, { marginTop: 12, gap: 8 }]}><CappyMascot size={112} /><View style={[styles.speech, { flex: 1, backgroundColor: p.softBlue }]}><Text style={{ fontSize: 23, fontWeight: '800', color: p.navy }}>{titles[step]}</Text></View></View>
    {step === 0 && <><Text style={[styles.copy, { color: p.muted, fontSize: 17, lineHeight: 27 }]}>Your classes, tasks, allowance, and study tools. One cozy place, with Cappy by your side.</Text><Pressable onPress={signIn} style={{ paddingVertical: 24 }}><Text style={{ color: p.blue, fontWeight: '800' }}>Already have an account? Sign in and skip setup</Text></Pressable></>}
    {step === 1 && <><Text style={[styles.copy, { color: p.muted }]}>This is the name on your home screen. Hello, {store.data.nickname || 'friend'}!</Text><Field label="Your nickname" value={store.data.nickname} onChange={nickname => store.update(d => ({ ...d, nickname }))} p={p} /></>}
    {step === 2 && <Chips values={['Light', 'Dark']} selected={dark ? 'Dark' : 'Light'} onSelect={v => setDark(v === 'Dark')} p={p} />}
    {step === 3 && <><Text style={[styles.copy, { color: p.muted }]}>Add a class now, or come back from the Schedule tab later.</Text>{store.data.classes.map(c => <Text key={c.id} style={[styles.copy, { color: p.ink }]}>{days[c.day]} · {formatClassTime(c.start)} · {c.name}</Text>)}{adding ? <ClassForm p={p} cancel={() => setAdding(false)} save={c => { store.update(d => ({ ...d, classes: [...d.classes, c] })); setAdding(false); }} /> : <Button label="Yes, add a class" p={p} secondary onPress={() => setAdding(true)} />}</>}
    {step === 4 && <Reminders store={store} p={p} />}
    {step === 5 && <Text style={[styles.copy, { color: p.muted, fontSize: 18 }]}>A little progress every day goes a long way. Create an account or sign in to keep using your existing study tools.</Text>}
    {!!(error || store.error) && <Text style={{ color: '#C44545' }}>{error || store.error}</Text>}
    <View style={{ flex: 1, minHeight: 30 }} /><Button p={p} label={busy ? 'Saving…' : step === 0 ? 'Let’s get started' : step === 5 ? 'Meet your study space' : step === 3 && !store.data.classes.length ? 'Skip, I’ll add it later' : 'Continue'} disabled={busy || (step === 1 && !store.data.nickname.trim()) || adding} onPress={() => step === 5 ? finish() : setStep(n => n + 1)} />
  </ScrollView></KeyboardAvoidingView>;
}

export function CappyTasks({ store, dark }: { store: PlannerStore; dark: boolean }) {
  const p = dark ? darkPalette : cappyPalette; const [tab, setTab] = useState('Pending'); const [title, setTitle] = useState(''); const [due, setDue] = useState(''); const [repeat, setRepeat] = useState(false); const [error, setError] = useState(''); const [adding, setAdding] = useState(false);
  const items = store.data.tasks.filter(t => tab === 'History' ? t.done : tab === 'Repeats' ? t.repeat && !t.done : tab === 'Checklist' ? true : !t.done);
  const toggle = (task: TaskItem) => store.update(d => ({ ...d, tasks: d.tasks.map(t => t.id === task.id ? { ...t, done: !t.done } : t) }));
  return <><Heading title="Small Wins" sub="Little wins. Less last-minute panic." p={p} /><Chips values={['Pending', 'Repeats', 'History', 'Checklist']} selected={tab} onSelect={setTab} p={p} /><View style={[styles.banner, { backgroundColor: '#785037' }]}><View style={{ flex: 1 }}><Text style={{ color: '#FFEDD2', fontWeight: '800' }}>✦ TASK POINTS</Text><Text style={{ color: '#FFFFFF', fontSize: 42, fontWeight: '900', marginVertical: 8 }}>{store.data.tasks.filter(t => t.done).length}</Text><Text style={{ color: '#FFEDD2' }}>1 completed task = 1 point. Keep it up!</Text></View><Ionicons name="ribbon-outline" size={44} color="#F4CA70" /></View>
    {!items.length && <Empty text="Nothing here yet. Cappy’s ready when you are." p={p} />}{items.map(task => <Panel key={task.id} p={p}><View style={styles.between}><Pressable accessibilityRole="checkbox" accessibilityState={{ checked: task.done }} onPress={() => toggle(task)} style={{ flex: 1, flexDirection: 'row', gap: 10, alignItems: 'center' }}><Ionicons name={task.done ? 'checkmark-circle' : 'ellipse-outline'} size={25} color={p.blue} /><View style={{ flex: 1 }}><Text style={{ color: p.ink, fontWeight: '700', textDecorationLine: task.done ? 'line-through' : 'none' }}>{task.title}</Text><Text style={{ color: p.muted, marginTop: 4 }}>{task.due || 'No deadline'}{task.repeat ? ' · repeats weekly' : ''}</Text></View></Pressable><Pressable accessibilityLabel={`Delete ${task.title}`} onPress={() => store.update(d => ({ ...d, tasks: d.tasks.filter(t => t.id !== task.id) }))} style={{ padding: 10 }}><Ionicons name="trash-outline" size={20} color={p.muted} /></Pressable></View>{task.repeat && task.done && <Button label="Create next week’s task" secondary p={p} onPress={() => { const next = new Date(`${task.due || dateKey()}T12:00:00`); next.setDate(next.getDate() + 7); store.update(d => ({ ...d, tasks: [...d.tasks.map(t => t.id === task.id ? { ...t, repeat: false } : t), { ...task, id: makeId(), done: false, due: dateKey(next) }] })); }} />}</Panel>)}
    {adding ? <Panel p={p}><Field label="Task or event title" value={title} onChange={setTitle} p={p} /><Field label="Deadline YYYY-MM-DD (optional)" value={due} onChange={setDue} p={p} /><View style={styles.between}><Text style={{ color: p.ink }}>Repeat weekly</Text><Switch value={repeat} onValueChange={setRepeat} /></View>{!!error && <Text style={{ color: '#C44545' }}>{error}</Text>}<Button label="Save task" p={p} onPress={() => { if (!title.trim() || (due && !validDate(due))) return setError('Enter a title and a valid deadline, or leave the deadline empty.'); store.update(d => ({ ...d, tasks: [...d.tasks, { id: makeId(), title: title.trim(), due, repeat, done: false }] })); setAdding(false); setTitle(''); setDue(''); setError(''); }} /><Button label="Cancel" secondary p={p} onPress={() => setAdding(false)} /></Panel> : <Button label="＋ Add task or event" p={p} onPress={() => setAdding(true)} />}
  </>;
}

export function CappySchedule({ store, dark, scan, calendar }: { store: PlannerStore; dark: boolean; scan?: React.ReactNode; calendar?: React.ReactNode }) {
  const p = dark ? darkPalette : cappyPalette; const [view, setView] = useState('Weekly'); const [adding, setAdding] = useState(false); const [selected, setSelected] = useState(dateKey()); const [month, setMonth] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1)); const [message, setMessage] = useState('');
  const selectedDay = new Date(`${selected}T12:00:00`).getDay(); const noClass = store.data.noClass.includes(selected);
  const remove = (id: string) => { const next = { ...store.data, classes: store.data.classes.filter(c => c.id !== id) }; store.update(() => next); syncReminders(next).catch(() => setMessage('Class removed. Reapply reminders below to update alerts.')); };
  const exportSchedule = async () => {
    const text = ['Cappy class schedule', '', ...days.flatMap((day, index) => [day, ...store.data.classes.filter(c => c.day === index).sort((a, b) => a.start.localeCompare(b.start)).map(c => `  ${formatClassTime(c.start)}–${formatClassTime(c.end)} ${c.name}${c.room ? ` (${c.room})` : ''}`), ''])].join('\n');
    try {
      if (Platform.OS === 'web') { const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' })); const link = document.createElement('a'); link.href = url; link.download = 'cappy-schedule.txt'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
      else if (FileSystem.cacheDirectory && await Sharing.isAvailableAsync()) { const file = `${FileSystem.cacheDirectory}cappy-schedule.txt`; await FileSystem.writeAsStringAsync(file, text); await Sharing.shareAsync(file, { mimeType: 'text/plain', dialogTitle: 'Share your Cappy schedule' }); }
      else setMessage('Sharing is not available on this device.');
    } catch { setMessage('Could not export the schedule. Please try again.'); }
  };
  return <><Heading title="Week Canvas" sub="Your classes, with room to breathe." p={p} />{scan}<Chips values={['Weekly', 'Monthly']} selected={view} onSelect={setView} p={p} />
    {view === 'Monthly' && calendar}
    {view === 'Monthly' && <Panel p={p}><View style={styles.between}><Pressable accessibilityLabel="Previous month" onPress={() => setMonth(d => new Date(d.getFullYear(), d.getMonth() - 1, 1))} style={{ padding: 12 }}><Ionicons name="chevron-back" color={p.blue} size={23} /></Pressable><Text style={{ color: p.navy, fontWeight: '800' }}>{month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</Text><Pressable accessibilityLabel="Next month" onPress={() => setMonth(d => new Date(d.getFullYear(), d.getMonth() + 1, 1))} style={{ padding: 12 }}><Ionicons name="chevron-forward" color={p.blue} size={23} /></Pressable></View><View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>{days.map(day => <Text key={day} style={{ width: '14.28%', textAlign: 'center', color: p.muted, paddingVertical: 8, fontSize: 11 }}>{day}</Text>)}{Array.from({ length: month.getDay() }, (_, i) => <View key={`blank-${i}`} style={{ width: '14.28%' }} />)}{Array.from({ length: new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate() }, (_, i) => { const day = new Date(month.getFullYear(), month.getMonth(), i + 1); const key = dateKey(day); return <Pressable key={key} onPress={() => setSelected(key)} style={{ width: '14.28%', minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: key === selected ? p.blue : 'transparent' }}><Text style={{ color: key === selected ? '#FFFFFF' : p.ink }}>{i + 1}</Text>{(store.data.classes.some(c => c.day === day.getDay()) && !store.data.noClass.includes(key) || (store.data.activities || []).some(a => a.start <= key && a.end >= key)) && <Text style={{ color: key === selected ? '#FFFFFF' : p.blue, fontSize: 8 }}>●</Text>}</Pressable>; })}</View></Panel>}
    {view === 'Weekly' ? days.map((day, index) => <Panel key={day} p={p}><Text style={[styles.subtitle, { color: p.blue }]}>{day}</Text>{store.data.classes.filter(c => c.day === index).sort((a, b) => a.start.localeCompare(b.start)).map(c => <View key={c.id} style={styles.between}><View style={{ flex: 1 }}><Text style={[styles.copy, { color: p.ink, fontWeight: '700' }]}>{c.name}</Text><Text style={{ color: p.muted }}>{formatClassTime(c.start)}–{formatClassTime(c.end)}{c.room ? ` · ${c.room}` : ''}</Text></View><Pressable accessibilityLabel={`Delete class ${c.name}`} onPress={() => remove(c.id)} style={{ padding: 12 }}><Ionicons name="trash-outline" size={19} color={p.muted} /></Pressable></View>)}{!store.data.classes.some(c => c.day === index) && <Text style={{ color: p.muted }}>No classes. Take it easy.</Text>}</Panel>) : <Panel p={p}><Text style={[styles.subtitle, { color: p.navy }]}>{selected}</Text>{noClass ? <Text style={[styles.copy, { color: p.muted }]}>Marked as no class.</Text> : store.data.classes.filter(c => c.day === selectedDay).map(c => <Text key={c.id} style={[styles.copy, { color: p.ink }]}>{formatClassTime(c.start)}–{formatClassTime(c.end)} · {c.name}</Text>)}<Text style={[styles.copy, { color: p.navy, fontWeight: '700' }]}>School activities</Text>{(store.data.activities || []).filter(a => a.start <= selected && a.end >= selected).map(a => <View key={a.id} style={styles.between}><View style={{ flex: 1 }}><Text style={{ color: p.ink, fontWeight: '700' }}>{a.title}</Text><Text style={{ color: p.muted }}>{a.start === a.end ? a.start : a.start + ' to ' + a.end}</Text></View><Pressable accessibilityRole="button" accessibilityLabel={'Remove activity ' + a.title} onPress={() => store.update(d => ({ ...d, activities: (d.activities || []).filter(item => item.id !== a.id) }))} style={{ padding: 12 }}><Ionicons name="trash-outline" size={19} color={p.muted} /></Pressable></View>)}{!(store.data.activities || []).some(a => a.start <= selected && a.end >= selected) && <Text style={{ color: p.muted }}>No school activities on this date.</Text>}<Button label={noClass ? 'Restore classes for this date' : 'Mark this date as no class'} secondary p={p} onPress={() => { const next = { ...store.data, noClass: noClass ? store.data.noClass.filter(v => v !== selected) : [...store.data.noClass, selected] }; store.update(() => next); syncReminders(next).catch(() => setMessage('Reapply reminders below to update alerts.')); }} /></Panel>}
    {adding ? <ClassForm p={p} cancel={() => setAdding(false)} save={c => { const next = { ...store.data, classes: [...store.data.classes, c] }; store.update(() => next); setAdding(false); syncReminders(next).catch(() => setMessage('Class saved. Reapply reminders below to enable alerts.')); }} /> : <Button label="＋ Add class" p={p} onPress={() => setAdding(true)} />}<Button label="Export schedule" secondary p={p} onPress={exportSchedule} />{!!message && <Text style={[styles.copy, { color: p.muted }]}>{message}</Text>}<Reminders store={store} p={p} />
  </>;
}

export function CappyBudget({ store, dark }: { store: PlannerStore; dark: boolean }) {
  const p = dark ? darkPalette : cappyPalette; const [label, setLabel] = useState(''); const [amount, setAmount] = useState(''); const [type, setType] = useState('Allowance'); const [error, setError] = useState('');
  const income = store.data.expenses.filter(e => e.income).reduce((n, e) => n + e.amount, 0); const spent = store.data.expenses.filter(e => !e.income).reduce((n, e) => n + e.amount, 0);
  return <><Heading title="Pocket Plan" sub="Keep the little expenses from sneaking up on you." p={p} /><View style={[styles.banner, { backgroundColor: '#287652' }]}><View><Text style={{ color: '#D9F3E5' }}>YOUR BALANCE</Text><Text style={{ color: '#FFFFFF', fontSize: 36, fontWeight: '900', marginVertical: 8 }}>₱{(income - spent).toFixed(2)}</Text><Text style={{ color: '#D9F3E5' }}>Received ₱{income.toFixed(2)} · Spent ₱{spent.toFixed(2)}</Text></View></View><Panel p={p}><Chips values={['Allowance', 'Expense']} selected={type} onSelect={setType} p={p} /><Field label="Description" value={label} onChange={setLabel} p={p} /><Field label="Amount in pesos" value={amount} onChange={setAmount} numeric p={p} />{!!error && <Text style={{ color: '#C44545' }}>{error}</Text>}<Button label="Save entry" p={p} onPress={() => { const n = Number(amount); if (!label.trim() || !Number.isFinite(n) || n <= 0 || n > 10000000) return setError('Enter a description and a positive amount.'); store.update(d => ({ ...d, expenses: [...d.expenses, { id: makeId(), label: label.trim(), amount: Math.round(n * 100) / 100, income: type === 'Allowance' }] })); setLabel(''); setAmount(''); setError(''); }} /></Panel>{!store.data.expenses.length && <Empty p={p} text="Start with your allowance, then track what you spend." />}{[...store.data.expenses].reverse().map(e => <Panel key={e.id} p={p}><View style={styles.between}><Text style={{ flex: 1, color: p.ink }}>{e.label}</Text><Text style={{ color: e.income ? '#38936A' : '#C57744', fontWeight: '800' }}>{e.income ? '+' : '−'}₱{e.amount.toFixed(2)}</Text><Pressable accessibilityLabel={`Delete ${e.label}`} style={{ padding: 12 }} onPress={() => store.update(d => ({ ...d, expenses: d.expenses.filter(v => v.id !== e.id) }))}><Ionicons name="trash-outline" size={19} color={p.muted} /></Pressable></View></Panel>)}</>;
}

export function CappyGrades({ store, dark }: { store: PlannerStore; dark: boolean }) {
  const p = dark ? darkPalette : cappyPalette; const [name, setName] = useState(''); const [selected, setSelected] = useState(''); const [assessment, setAssessment] = useState(''); const [earned, setEarned] = useState(''); const [total, setTotal] = useState(''); const [error, setError] = useState('');
  return <><Heading title="Progress Pages" sub="See how far you’ve come, one subject at a time." p={p} /><Panel p={p}><Field label="Subject name" value={name} onChange={setName} p={p} /><Button label="＋ Add subject" p={p} disabled={!name.trim()} onPress={() => { store.update(d => ({ ...d, subjects: [...d.subjects, { id: makeId(), name: name.trim(), scores: [] }] })); setName(''); }} /></Panel>{!store.data.subjects.length && <Empty text="Add a subject to start estimating your grade." p={p} />}{store.data.subjects.map(subject => <Panel key={subject.id} p={p}><View style={styles.between}><Text style={[styles.subtitle, { color: p.navy, flex: 1 }]}>{subject.name}</Text><Text style={{ color: p.blue, fontSize: 24, fontWeight: '800' }}>{grade(subject) === null ? '—' : `${grade(subject)!.toFixed(1)}%`}</Text><Pressable accessibilityLabel={`Delete subject ${subject.name}`} style={{ padding: 10 }} onPress={() => store.update(d => ({ ...d, subjects: d.subjects.filter(v => v.id !== subject.id) }))}><Ionicons name="trash-outline" size={18} color={p.muted} /></Pressable></View><Text style={{ color: p.muted, fontSize: 12 }}>Estimate based on total points earned; school weighting may differ.</Text>{subject.scores.map(score => <View key={score.id} style={styles.between}><Text style={[styles.copy, { color: p.ink, flex: 1 }]}>{score.name} · {score.earned}/{score.total}</Text><Pressable accessibilityLabel={`Remove ${score.name}`} style={{ padding: 10 }} onPress={() => store.update(d => ({ ...d, subjects: d.subjects.map(s => s.id === subject.id ? { ...s, scores: s.scores.filter(v => v.id !== score.id) } : s) }))}><Ionicons name="close" color={p.muted} size={18} /></Pressable></View>)}{selected === subject.id ? <><Field label="Activity or assessment" value={assessment} onChange={setAssessment} p={p} /><Field label="Points earned" value={earned} onChange={setEarned} numeric p={p} /><Field label="Total possible points" value={total} onChange={setTotal} numeric p={p} />{!!error && <Text style={{ color: '#C44545' }}>{error}</Text>}<Button label="Save score" p={p} onPress={() => { const e = Number(earned), t = Number(total); if (!assessment.trim() || !earned.trim() || !total.trim() || !Number.isFinite(e) || !Number.isFinite(t) || t <= 0 || e < 0 || e > t) return setError('Enter a valid activity and score between zero and the total possible points.'); store.update(d => ({ ...d, subjects: d.subjects.map(s => s.id === subject.id ? { ...s, scores: [...s.scores, { id: makeId(), name: assessment.trim(), earned: e, total: t }] } : s) })); setSelected(''); setAssessment(''); setEarned(''); setTotal(''); setError(''); }} /><Button label="Cancel" p={p} secondary onPress={() => setSelected('')} /></> : <Button label="＋ Add activity score" p={p} secondary onPress={() => setSelected(subject.id)} />}</Panel>)}</>;
}

export function CappyFriends({ api, dark, noteId }: { api: any; dark: boolean; noteId?: string }) {
  return <StudyCircles api={api} dark={dark} noteId={noteId} />;
}

const styles = StyleSheet.create({
  wordmark: { fontSize: 34, fontWeight: '900', letterSpacing: -1.5 },
  title: { fontSize: 29, fontWeight: '900', marginTop: 8, letterSpacing: -0.7 },
  eyebrow: { fontSize: 9, fontWeight: '800', letterSpacing: 1.3 },
  heading: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 22 },
  copy: { fontSize: 14, lineHeight: 22, marginTop: 8, marginBottom: 8 },
  subtitle: { fontSize: 18, fontWeight: '800', marginBottom: 8 },
  speech: { padding: 17, borderRadius: 23 },
  panel: { padding: 17, borderRadius: 24, marginVertical: 8, borderWidth: 1 },
  banner: { borderRadius: 26, padding: 22, marginVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 14 },
  between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  button: { paddingHorizontal: 20, minHeight: 50, paddingVertical: 14, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginVertical: 6 },
  label: { fontSize: 12, fontWeight: '700', marginTop: 10, marginBottom: 7 },
  field: { minHeight: 52, borderWidth: 1, padding: 14, borderRadius: 18, fontSize: 16 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginVertical: 8 },
  chip: { minHeight: 44, paddingHorizontal: 15, paddingVertical: 12, borderRadius: 24, borderWidth: 1 },
  back: { width: 48, height: 48, borderRadius: 24, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  dayDot: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginVertical: 8 },
});
