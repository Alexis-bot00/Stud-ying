import { useMemo, useState } from 'react';
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type Task = { id: number; title: string; done: boolean };
type Tab = 'Home' | 'Tasks' | 'Notes' | 'Profile';

const COLORS = {
  red: '#E63946',
  blue: '#1455D9',
  dark: '#13213C',
  muted: '#71809B',
  pale: '#F4F7FD',
  white: '#FFFFFF',
  line: '#E5EAF3',
};

export default function StudyanteApp() {
  const [tab, setTab] = useState<Tab>('Home');
  const [tasks, setTasks] = useState<Task[]>([
    { id: 1, title: 'Review Data Structures', done: false },
    { id: 2, title: 'Finish HCI activity', done: true },
    { id: 3, title: 'Practice Java code', done: false },
  ]);
  const [taskText, setTaskText] = useState('');
  const [note, setNote] = useState('Remember: A stack follows Last In, First Out.');

  const completed = useMemo(() => tasks.filter((task) => task.done).length, [tasks]);

  function addTask() {
    const title = taskText.trim();
    if (!title) return;
    setTasks((current) => [...current, { id: Date.now(), title, done: false }]);
    setTaskText('');
  }

  function toggleTask(id: number) {
    setTasks((current) =>
      current.map((task) => (task.id === id ? { ...task, done: !task.done } : task)),
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.app}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {tab === 'Home' && (
            <>
              <View style={styles.topRow}>
                <View>
                  <Text style={styles.hello}>Good day, Alexis!</Text>
                  <Text style={styles.subtitle}>What will you learn today?</Text>
                </View>
                <View style={styles.avatar}><Text style={styles.avatarText}>AA</Text></View>
              </View>

              <View style={styles.hero}>
                <View style={styles.logoRow}>
                  <View style={styles.logoMark}><Ionicons name="school" size={24} color={COLORS.white} /></View>
                  <Text style={styles.logoText}>STUDY<Text style={{ color: COLORS.red }}>ante</Text></Text>
                </View>
                <Text style={styles.heroTitle}>Learn smarter, one task at a time.</Text>
                <Text style={styles.heroText}>{completed} of {tasks.length} tasks finished today</Text>
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: `${tasks.length ? (completed / tasks.length) * 100 : 0}%` }]} />
                </View>
              </View>

              <Text style={styles.sectionTitle}>Study tools</Text>
              <View style={styles.grid}>
                <Tool icon="checkbox" title="My Tasks" color={COLORS.blue} onPress={() => setTab('Tasks')} />
                <Tool icon="document-text" title="Quick Notes" color={COLORS.red} onPress={() => setTab('Notes')} />
                <Tool icon="timer" title="Focus Timer" color="#7B4DDB" onPress={() => {}} />
                <Tool icon="book" title="Subjects" color="#F19A37" onPress={() => {}} />
              </View>

              <Text style={styles.sectionTitle}>Today's tasks</Text>
              {tasks.slice(0, 3).map((task) => (
                <TaskRow key={task.id} task={task} onToggle={toggleTask} />
              ))}
            </>
          )}

          {tab === 'Tasks' && (
            <>
              <PageHeader title="My Tasks" subtitle="Keep your schoolwork organized." />
              <View style={styles.inputRow}>
                <TextInput value={taskText} onChangeText={setTaskText} placeholder="Add a new task" placeholderTextColor={COLORS.muted} style={styles.input} onSubmitEditing={addTask} />
                <Pressable onPress={addTask} style={styles.addButton}><Ionicons name="add" size={26} color={COLORS.white} /></Pressable>
              </View>
              <Text style={styles.counter}>{completed} completed · {tasks.length - completed} remaining</Text>
              {tasks.map((task) => <TaskRow key={task.id} task={task} onToggle={toggleTask} />)}
            </>
          )}

          {tab === 'Notes' && (
            <>
              <PageHeader title="Quick Notes" subtitle="Write important ideas before you forget." />
              <View style={styles.noteCard}>
                <TextInput value={note} onChangeText={setNote} multiline textAlignVertical="top" placeholder="Start writing your notes..." placeholderTextColor={COLORS.muted} style={styles.noteInput} />
                <Text style={styles.saved}>Saved on this screen</Text>
              </View>
            </>
          )}

          {tab === 'Profile' && (
            <>
              <PageHeader title="Student Profile" subtitle="Your STUDYante space." />
              <View style={styles.profileCard}>
                <View style={styles.bigAvatar}><Text style={styles.bigAvatarText}>AA</Text></View>
                <Text style={styles.profileName}>Alexis Dustin Almonte</Text>
                <Text style={styles.profileCourse}>BSIT 2 · Section 1</Text>
                <View style={styles.profileLine} />
                <Text style={styles.profileLabel}>School</Text>
                <Text style={styles.profileValue}>Mater Dei College</Text>
                <Text style={styles.profileLabel}>Goal</Text>
                <Text style={styles.profileValue}>Learn, finish tasks, and improve every day.</Text>
              </View>
            </>
          )}
        </ScrollView>

        <View style={styles.nav}>
          {([
            ['Home', 'home'], ['Tasks', 'checkbox'], ['Notes', 'document-text'], ['Profile', 'person'],
          ] as [Tab, keyof typeof Ionicons.glyphMap][]).map(([name, icon]) => {
            const active = tab === name;
            return (
              <Pressable key={name} onPress={() => setTab(name)} style={styles.navItem}>
                <Ionicons name={active ? icon : (`${icon}-outline` as keyof typeof Ionicons.glyphMap)} size={22} color={active ? COLORS.blue : COLORS.muted} />
                <Text style={[styles.navText, active && styles.navTextActive]}>{name}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </SafeAreaView>
  );
}

function PageHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return <View style={styles.pageHeader}><Text style={styles.pageTitle}>{title}</Text><Text style={styles.subtitle}>{subtitle}</Text></View>;
}

function Tool({ icon, title, color, onPress }: { icon: keyof typeof Ionicons.glyphMap; title: string; color: string; onPress: () => void }) {
  return (
    <Pressable style={styles.tool} onPress={onPress}>
      <View style={[styles.toolIcon, { backgroundColor: `${color}18` }]}><Ionicons name={icon} size={25} color={color} /></View>
      <Text style={styles.toolTitle}>{title}</Text>
      <Ionicons name="chevron-forward" size={17} color={COLORS.muted} />
    </Pressable>
  );
}

function TaskRow({ task, onToggle }: { task: Task; onToggle: (id: number) => void }) {
  return (
    <Pressable style={styles.task} onPress={() => onToggle(task.id)}>
      <Ionicons name={task.done ? 'checkmark-circle' : 'ellipse-outline'} size={24} color={task.done ? COLORS.blue : COLORS.muted} />
      <Text style={[styles.taskText, task.done && styles.taskDone]}>{task.title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.white },
  app: { flex: 1, backgroundColor: COLORS.pale },
  content: { padding: 20, paddingTop: 18, paddingBottom: 110, width: '100%', maxWidth: 760, alignSelf: 'center' },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 },
  hello: { fontSize: 24, fontWeight: '800', color: COLORS.dark },
  subtitle: { marginTop: 5, fontSize: 14, color: COLORS.muted },
  avatar: { width: 46, height: 46, borderRadius: 23, backgroundColor: COLORS.red, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: COLORS.white, fontWeight: '800' },
  hero: { backgroundColor: COLORS.blue, borderRadius: 24, padding: 22, shadowColor: COLORS.blue, shadowOpacity: 0.2, shadowRadius: 14, shadowOffset: { width: 0, height: 8 }, elevation: 5 },
  logoRow: { flexDirection: 'row', alignItems: 'center' },
  logoMark: { width: 40, height: 40, borderRadius: 12, backgroundColor: COLORS.red, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  logoText: { color: COLORS.white, fontSize: 22, fontWeight: '900', letterSpacing: 0.3 },
  heroTitle: { color: COLORS.white, fontSize: 26, lineHeight: 32, fontWeight: '800', marginTop: 22, maxWidth: 360 },
  heroText: { color: '#D9E5FF', fontSize: 13, marginTop: 14 },
  progressTrack: { height: 8, borderRadius: 8, backgroundColor: '#FFFFFF35', marginTop: 10, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 8, backgroundColor: COLORS.red },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: COLORS.dark, marginTop: 26, marginBottom: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  tool: { width: '48%', minWidth: 150, flexGrow: 1, padding: 15, borderRadius: 18, backgroundColor: COLORS.white, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: COLORS.line },
  toolIcon: { width: 43, height: 43, borderRadius: 13, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  toolTitle: { flex: 1, fontWeight: '700', color: COLORS.dark },
  task: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, marginBottom: 10, backgroundColor: COLORS.white, borderRadius: 16, borderWidth: 1, borderColor: COLORS.line },
  taskText: { flex: 1, color: COLORS.dark, fontSize: 15, fontWeight: '600' },
  taskDone: { color: COLORS.muted, textDecorationLine: 'line-through' },
  pageHeader: { marginBottom: 24 },
  pageTitle: { fontSize: 29, fontWeight: '900', color: COLORS.dark },
  inputRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  input: { flex: 1, height: 52, backgroundColor: COLORS.white, borderRadius: 15, borderWidth: 1, borderColor: COLORS.line, paddingHorizontal: 16, color: COLORS.dark, fontSize: 15 },
  addButton: { width: 52, height: 52, borderRadius: 15, backgroundColor: COLORS.red, alignItems: 'center', justifyContent: 'center' },
  counter: { color: COLORS.muted, marginBottom: 14, fontSize: 13 },
  noteCard: { minHeight: 390, padding: 18, backgroundColor: COLORS.white, borderRadius: 20, borderWidth: 1, borderColor: COLORS.line },
  noteInput: { flex: 1, minHeight: 315, color: COLORS.dark, fontSize: 16, lineHeight: 25 },
  saved: { color: COLORS.muted, fontSize: 12, textAlign: 'right', marginTop: 10 },
  profileCard: { alignItems: 'center', padding: 24, backgroundColor: COLORS.white, borderRadius: 22, borderWidth: 1, borderColor: COLORS.line },
  bigAvatar: { width: 88, height: 88, borderRadius: 44, backgroundColor: COLORS.blue, alignItems: 'center', justifyContent: 'center' },
  bigAvatarText: { color: COLORS.white, fontSize: 26, fontWeight: '900' },
  profileName: { marginTop: 15, color: COLORS.dark, fontSize: 20, fontWeight: '800', textAlign: 'center' },
  profileCourse: { color: COLORS.muted, marginTop: 5 },
  profileLine: { width: '100%', height: 1, backgroundColor: COLORS.line, marginVertical: 22 },
  profileLabel: { alignSelf: 'flex-start', color: COLORS.muted, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', marginTop: 12 },
  profileValue: { alignSelf: 'flex-start', color: COLORS.dark, fontSize: 15, marginTop: 5 },
  nav: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 82, flexDirection: 'row', backgroundColor: COLORS.white, borderTopWidth: 1, borderTopColor: COLORS.line, paddingBottom: 10, justifyContent: 'space-around' },
  navItem: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  navText: { marginTop: 4, color: COLORS.muted, fontSize: 11, fontWeight: '600' },
  navTextActive: { color: COLORS.blue, fontWeight: '800' },
});
