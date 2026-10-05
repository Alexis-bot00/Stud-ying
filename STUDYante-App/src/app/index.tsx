import Markdown from 'react-native-markdown-display';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAccountCache } from '../components/account-cache';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useEffect, useRef, useState } from 'react';
import { AppState, Modal, Alert, ActivityIndicator, Animated, Image, KeyboardAvoidingView, Linking, PanResponder, Platform, Pressable, SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { useAudioPlayer } from 'expo-audio';
import * as Speech from 'expo-speech';
import * as FileSystem from 'expo-file-system/legacy';
import { attachUploadFile } from '../lib/upload-file';
import { fetch as expoFetch } from 'expo/fetch';
import * as Sharing from 'expo-sharing';
import { CappyOnboarding, CappyTasks, CappySchedule, CappyBudget, CappyGrades, CappyFriends, CappyMascot, CappyPreferences, cappyPalette, usePlanner } from '../components/cappy';
import { syncReminders } from '../components/cappy-notifications';
import { StudyanteHome } from '../components/studyante-home';
import { ScheduleScan } from '../components/schedule-scan';
import { SchoolCalendar } from '../components/school-calendar';
import { PasswordRecovery } from '../components/password-recovery';

const API = (process.env.EXPO_PUBLIC_API_URL || 'https://stud-ying-production.up.railway.app').replace(/\/$/, '');
const WEBSITE = 'https://alexis-bot00.github.io/Stud-ying/';
const C = cappyPalette;
const accountCache = createAccountCache(AsyncStorage);
type User = { id: string; name: string; email: string; profilePicture?: string };
type Screen = 'dashboard' | 'upload' | 'create' | 'library' | 'community' | 'ai' | 'profile' | 'admin' | 'tasks' | 'schedule' | 'budget' | 'grades' | 'friends';

function savedToken() { return Platform.OS === 'web' && typeof window !== 'undefined' ? window.localStorage.getItem('studyingToken') || '' : ''; }
function saveToken(token: string) { if (Platform.OS !== 'web' || typeof window === 'undefined') return; token ? window.localStorage.setItem('studyingToken', token) : window.localStorage.removeItem('studyingToken'); }

export default function StudyanteApp() {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [token, setToken] = useState(savedToken);
  const [user, setUser] = useState<User | null>(null);
  const [admin, setAdmin] = useState(false);
  const [screen, setScreen] = useState<Screen>('dashboard');
  const [circleNoteId, setCircleNoteId] = useState('');
  const [loading, setLoading] = useState(Boolean(token));
  const [darkMode, setDarkMode] = useState(false);
  const [setupReady, setSetupReady] = useState(false);
  const [onboarded, setOnboarded] = useState(false);
  const planner = usePlanner(user?.id || 'guest');

  useEffect(() => {
    if (!token || !user) return;
    const heartbeat = () => {
      const active = Platform.OS === 'web' ? typeof document !== 'undefined' && document.visibilityState === 'visible' : AppState.currentState === 'active';
      if (active) api('/api/presence/heartbeat', { method: 'POST', body: '{}' }).catch(() => {});
    };
    heartbeat();
    const timer = setInterval(heartbeat, 30000);
    const subscription = AppState.addEventListener('change', heartbeat);
    if (Platform.OS === 'web') document.addEventListener('visibilitychange', heartbeat);
    return () => { clearInterval(timer); subscription.remove(); if (Platform.OS === 'web') document.removeEventListener('visibilitychange', heartbeat); };
  }, [token, user?.id]);

  useEffect(() => {
    let live = true;
    Promise.all([AsyncStorage.getItem('cappy-onboarded'), AsyncStorage.getItem('cappy-auth-token')]).then(([setup, nativeToken]) => {
      if (!live) return;
      setOnboarded(setup === 'true');
      if (Platform.OS !== 'web' && nativeToken) { setLoading(true); setToken(nativeToken); }
      setSetupReady(true);
    }).catch(() => { if (live) setSetupReady(true); });
    return () => { live = false; };
  }, []);

  useEffect(() => {
    if (!user || !planner.ready || Platform.OS === 'web') return;
    syncReminders(planner.data).catch(() => {});
  }, [user?.id, planner.ready]);

  function chooseTheme(value: boolean) {
    setDarkMode(value);
    AsyncStorage.setItem('studyanteDarkMode', String(value)).catch(() => {});
  }

  useEffect(() => {
    AsyncStorage.getItem('studyanteDarkMode')
      .then(value => setDarkMode(value === 'true'))
      .catch(() => {});
  }, []);

  s = darkMode ? darkStyles : lightStyles;

  function toggleDarkMode() {
    setDarkMode(value => {
      const next = !value;
      AsyncStorage.setItem('studyanteDarkMode', String(next))
        .catch(() => {});
      return next;
    });
  }

  async function api(path: string, options: RequestInit = {}) {
    const multipart = options.body instanceof FormData;
    const transport: typeof fetch =
      multipart && Platform.OS !== 'web'
        ? (expoFetch as unknown as typeof fetch)
        : fetch;
    const response = await transport(`${API}${path}`, { ...options, headers: { ...(multipart ? {} : { 'Content-Type': 'application/json' }), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(options.headers || {}) } });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const missingFeature = response.status === 404 && !data.message && (path.startsWith('/api/cappy/') || path === '/api/schedule/scan');
      throw Object.assign(new Error(data.message || (missingFeature ? path === '/api/schedule/scan' ? 'Photo scheduling is unavailable right now. You can still add classes manually.' : path.endsWith('/capybara') ? 'Your jacket could not be saved because this server does not have the Circle jacket update yet.' : path.includes('/materials') ? 'This server does not have the Circle sharing update yet.' : path.endsWith('/notes/import') ? 'This server does not have the Circle file upload update yet.' : 'This Circle action is missing from the server. The Circle backend needs to be updated.' : response.status === 401 ? 'Please sign in again.' : `Could not complete this request (${response.status}). Please try again.`)), { status: response.status });
    }
    return data;
  }

  useEffect(() => {
    let live = true;
    if (!token) { setLoading(false); return; }
    async function openAccount() {
      try {
        const [me, owner] = await Promise.all([api('/api/auth/me'), api('/api/admin/me')]);
        if (!live) return;
        await accountCache.bind(me.user.id, token);
        await accountCache.write('user', me.user.id, me.user);
        if (!live) return;
        setUser(me.user); setAdmin(owner.isAdmin === true);
      } catch (error: any) {
        if (!live) return;
        const id = error?.status === 401 || error?.status === 403 ? null : await accountCache.restore(token);
        const saved = id ? await accountCache.read<User>('user', id) : null;
        if (!live) return;
        if (saved && saved.id === id) { setUser(saved); setAdmin(false); }
        else { await accountCache.logout(id || undefined); if (!live) return; saveToken(''); setToken(''); setUser(null); setAdmin(false); }
      } finally { if (live) setLoading(false); }
    }
    openAccount();
    return () => { live = false; };
  }, [token]);

  if (!setupReady || loading) return <SafeAreaView style={{ flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
    <StatusBar barStyle="dark-content" backgroundColor={C.bg} />
    <Image source={require('../../assets/images/studyante-splash.png')} accessibilityLabel="STUDYante — A little more possible" style={{ width: '100%', maxWidth: 320, height: 107 }} resizeMode="contain" />
    <ActivityIndicator color={C.blue} style={{ marginTop: 24 }} />
    <Text style={{ color: C.muted, fontSize: 13, textAlign: 'center', marginTop: 14 }}>Getting your study space ready…</Text>
  </SafeAreaView>;
  if (!onboarded && !token) return <CappyOnboarding dark={darkMode} setDark={chooseTheme} done={() => setOnboarded(true)} signIn={() => { setOnboarded(true); AsyncStorage.setItem('cappy-onboarded', 'true').catch(() => {}); }} />;
  if (!token || !user) return <Auth done={async (t, u) => { await accountCache.bind(u.id, t); await accountCache.write('user', u.id, u); saveToken(t); await AsyncStorage.setItem('cappy-auth-token', t); setUser(u); setToken(t); }} />;
  const logout = async () => { saveToken(''); const clearing = accountCache.logout(user.id); setToken(''); setUser(null); setAdmin(false); setScreen('dashboard'); await Promise.all([clearing, planner.flush().catch(() => {}), syncReminders({ ...planner.data, notifyAt: false, notifyBefore: false }).catch(() => {})]); };

  return <SafeAreaView style={s.safe}><StatusBar barStyle={darkMode ? "light-content" : "dark-content"} /><KeyboardAvoidingView style={s.shell} behavior={Platform.OS === 'ios' ? 'padding' : undefined}><ScrollView contentContainerStyle={[s.content, { paddingHorizontal: width < 400 ? 12 : 20, paddingBottom: 135 + insets.bottom, paddingTop: Platform.OS === 'android' ? Math.max(insets.top, 20) : 20 }]} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets showsVerticalScrollIndicator={false}>
    {screen !== 'dashboard' && <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 18 }}><Pressable accessibilityLabel="Back to Cappy home" onPress={() => setScreen('dashboard')} style={{ padding: 10 }}><Ionicons name="arrow-back" size={24} color={C.blue} /></Pressable><Pressable accessibilityLabel="Open account" onPress={() => setScreen('profile')} style={{ padding: 10 }}><Ionicons name="settings-outline" size={24} color={C.blue} /></Pressable></View>}
    {!!planner.error && <Notice text={planner.error} />}
    {screen === 'dashboard' && <StudyanteHome store={planner} user={user} go={setScreen} dark={darkMode} />}
    {screen === 'tasks' && <CappyTasks store={planner} dark={darkMode} />}
    {screen === 'schedule' && <CappySchedule store={planner} dark={darkMode} calendar={<SchoolCalendar api={api} store={planner} dark={darkMode} />} scan={<ScheduleScan api={api} store={planner} dark={darkMode} />} />}
    {screen === 'budget' && <CappyBudget store={planner} dark={darkMode} />}
    {screen === 'grades' && <CappyGrades store={planner} dark={darkMode} />}
    {screen === 'friends' && <CappyFriends api={api} dark={darkMode} noteId={circleNoteId} />}
    {screen === 'library' && <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>{(['upload', 'create', 'grades', 'ai', 'community'] as Screen[]).map((id, index) => <Pressable key={id} onPress={() => setScreen(id)} style={{ backgroundColor: darkMode ? '#293F5A' : C.softBlue, padding: 13, borderRadius: 22 }}><Text style={{ color: darkMode ? '#D7E9FF' : C.blue, fontWeight: '800' }}>{['Upload', 'Create', 'Grades', 'STUDYante AI', 'Community'][index]}</Text></Pressable>)}</View>}
    {screen === 'upload' && <UploadMaterial api={api} done={() => setScreen('library')} />}
    {screen === 'create' && <ManualCreator api={api} done={() => setScreen('library')} back={() => setScreen('dashboard')} />}
    {screen === 'library' && <Library key={user.id} userId={user.id} api={api} token={token} onStudy={id => { setCircleNoteId(id); setScreen('friends'); }} />}
    {screen === 'community' && <Community api={api} />}
    {screen === 'ai' && <AI api={api} />}
    {screen === 'profile' && <CappyPreferences store={planner} dark={darkMode} />}
    {screen === 'profile' && <Profile user={user} admin={admin} logout={logout} go={setScreen}
      darkMode={darkMode} toggleDarkMode={toggleDarkMode}
      api={api} updated={(nextUser, nextToken) => {
        setUser(nextUser);
        if (nextToken) {
          saveToken(nextToken);
          setToken(nextToken);
        }
      }} />}
    {screen === 'admin' && admin && <Admin api={api} />}
  </ScrollView><Nav active={screen} go={setScreen} admin={admin} /></KeyboardAvoidingView></SafeAreaView>;
}

function Auth({ done }: { done: (token: string, user: User) => void | Promise<void> }) {
  const [recovering, setRecovering] = useState(false);
  const [register, setRegister] = useState(false), [name, setName] = useState(''), [email, setEmail] = useState(''), [password, setPassword] = useState(''), [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit() {
    if (!email.trim() || !password || (register && !name.trim())) return setMessage('Please complete all fields.');
    setBusy(true); setMessage('');
    try { const r = await fetch(`${API}/api/auth/${register ? 'register' : 'login'}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: name.trim(), email: email.trim(), password }) }); const d = await r.json().catch(() => ({})); if (!r.ok || !d.token) throw new Error(d.message || 'Could not continue.'); await done(d.token, d.user); } catch (e: any) { setMessage(e.message); } finally { setBusy(false); }
  }
  if (recovering) return <PasswordRecovery apiUrl={API} initialEmail={email} back={resetEmail => { setRecovering(false); setMessage(''); setPassword(''); if (resetEmail) setEmail(resetEmail); }} />;
  return <SafeAreaView style={s.authSafe}><ScrollView contentContainerStyle={s.authWrap} keyboardShouldPersistTaps="handled"><View style={s.authCard}>
    <View style={{ alignItems: 'center' }}><CappyMascot size={115} /><Text style={[s.authTitle, { fontSize: 32 }]}>STUDYante</Text></View><Text style={s.authTitle}>{register ? 'Make room for your next chapter' : 'Welcome back, friend'}</Text><Text style={s.authSub}>A little more organized. A lot more you.</Text>
    {register && <TextInput style={s.input} placeholder="Full name" placeholderTextColor={C.muted} value={name} onChangeText={setName} />}
    <TextInput style={s.input} placeholder="Email address" placeholderTextColor={C.muted} autoCapitalize="none" value={email} onChangeText={setEmail} />
    <TextInput style={s.input} placeholder="Password" placeholderTextColor={C.muted} secureTextEntry value={password} onChangeText={setPassword} onSubmitEditing={submit} />
    {!!message && <Text style={s.error}>{message}</Text>}<Pressable style={s.primary} onPress={submit} disabled={busy}>{busy ? <ActivityIndicator color="white" /> : <Text style={s.primaryText}>{register ? 'Create Account' : 'Log In'}</Text>}</Pressable>
    {!register && <Pressable accessibilityRole="button" disabled={busy} onPress={() => { setMessage(''); setRecovering(true); }}><Text style={s.switchText}>Forgot password?</Text></Pressable>}
    <Pressable onPress={() => { setRegister(!register); setMessage(''); }}><Text style={s.switchText}>{register ? 'Already have an account? Log in' : 'New to STUDYante? Create an account'}</Text></Pressable>
  </View></ScrollView></SafeAreaView>;
}

function Dashboard({ user, admin, go }: { user: User; admin: boolean; go: (x: Screen) => void }) {
  return <><Image source={require('../../assets/images/studyante-logo.png')} style={s.homeLogo} resizeMode="contain" />

<Text style={s.eyebrow}>STUDY SMARTER. LEARN BETTER.</Text><Text style={s.title}>Hello, {user.name.split(' ')[0]}!</Text><Text style={s.sub}>Upload lessons, create study materials, and learn with STUDYante AI.</Text>
    <View style={s.hero}>
      <View pointerEvents="none" style={s.heroOrbit} />
      <View pointerEvents="none" style={s.heroOrbitSmall} />
      <View style={s.heroTop}><View style={s.heroIcon}><Ionicons name="sparkles" size={25} color={C.white} /></View><Text style={s.heroTag}>YOUR NEXT LIGHTBULB MOMENT</Text></View>
      <Text style={s.heroTitle}>Big ideas.{'\n'}Small study steps.</Text>
      <Text style={s.heroCopy}>Turn a tricky lesson into something that clicks. Your AI study buddy is ready.</Text>
      <Pressable style={({ pressed }) => [s.heroButton, pressed && s.pressed]} onPress={() => go('ai')}><Text style={s.heroButtonText}>Let’s figure it out</Text><Ionicons name="arrow-forward" size={18} color={C.blue} /></Pressable>
    </View>
    <View style={s.sectionHeading}><Text style={[s.section, { marginTop: 0, marginBottom: 0 }]}>Make it a study day</Text><Ionicons name="flash" size={20} color={C.red} /></View><View style={s.grid}>
      <Card icon="cloud-upload-outline" title="Upload Material" text="Add lessons and files" color={C.red} tap={() => go('upload')} />
      <Card icon="create-outline" title="Create Flashcards and Notes" text="Type and save your own study tools" color="#22A06B" tap={() => go('create')} />
      <Card icon="library-outline" title="My Library" text="Files and flashcards" color={C.blue} tap={() => go('library')} />
      <Card icon="globe-outline" title="Community Notes" text="Approved materials" color="#6E47C8" tap={() => go('community')} />
      <Card icon="chatbubble-ellipses-outline" title="STUDYante AI" text="Ask and review" color="#E18A20" tap={() => go('ai')} />
      {admin && <Card icon="shield-checkmark-outline" title="Admin" text="Private owner controls" color={C.navy} tap={() => go('admin')} />}
    </View></>;
}
function Card({ icon, title, text, color, tap }: any) {
  const { width } = useWindowDimensions();
  return <Pressable accessibilityRole="button" style={({ pressed }) => [s.card, { width: width < 600 ? '100%' : '48%', minWidth: 0, borderLeftColor: color, borderLeftWidth: 4 }, pressed && s.pressed]} onPress={tap}><View style={[s.cardIcon, { backgroundColor: `${color}18` }]}><Ionicons name={icon} size={25} color={color} /></View><View style={{ flex: 1, minWidth: 0 }}><Text style={s.cardTitle}>{title}</Text><Text style={s.cardText}>{text}</Text></View><View style={[s.cardArrow, { backgroundColor: `${color}12` }]}><Ionicons name="arrow-forward" size={17} color={color} /></View></Pressable>;
}


function ManualCreator({
  api,
  done,
  back,
}: {
  api: any;
  done: () => void;
  back: () => void;
}) {
  const [mode, setMode] =
    useState<'notes' | 'flashcards' | null>(null);
  const [name, setName] = useState('');
  const [notes, setNotes] = useState('');
  const [cards, setCards] = useState([
    { question: '', answer: '' },
  ]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  async function save() {
    const cleanName = name.trim();

    if (!cleanName || !mode || busy) {
      setMessage('Please enter a title.');
      return;
    }

    setBusy(true);
    setMessage('');

    try {
      if (mode === 'notes') {
        const cleanNotes = notes.trim();

        if (!cleanNotes) {
          throw new Error('Please enter your notes.');
        }

        await api('/api/library/study-materials', {
          method: 'POST',
          body: JSON.stringify({
            type: 'notes',
            name: cleanName,
            folderId: null,
            data: {
              notes: cleanNotes,
            },
          }),
        });
      } else {
        const flashcards = cards
          .map(card => ({
            question: card.question.trim(),
            answer: card.answer.trim(),
          }))
          .filter(card =>
            card.question && card.answer
          );

        if (!flashcards.length) {
          throw new Error(
            'Complete at least one definition and term.'
          );
        }

        await api('/api/library/flashcards', {
          method: 'POST',
          body: JSON.stringify({
            name: cleanName,
            folderId: null,
            flashcards,
          }),
        });
      }

      done();
    } catch (error: any) {
      setMessage(
        error.message || 'Could not save your study material.'
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Page
      title="Create Study Material"
      sub="Write and save your own notes or flashcards."
    >
      <Pressable
        accessibilityLabel="Back to Home"
        onPress={() => {
          if (mode) {
            setMode(null);
            setMessage('');
          } else {
            back();
          }
        }}
        style={{
          alignSelf: 'flex-start',
          width: 40,
          height: 40,
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 14,
        }}
      >
        <Ionicons
          name="arrow-back"
          size={23}
          color={C.blue}
        />
      </Pressable>

      {!mode ? (
        <View style={s.grid}>
          <Pressable
            style={s.card}
            onPress={() => setMode('notes')}
          >
            <View style={[s.cardIcon, {
              backgroundColor: C.softBlue,
            }]}>
              <Ionicons
                name="document-text-outline"
                size={25}
                color={C.blue}
              />
            </View>

            <View style={{ flex: 1 }}>
              <Text style={s.cardTitle}>Create Notes</Text>
              <Text style={s.cardText}>
                Type and save your own study notes
              </Text>
            </View>
          </Pressable>

          <Pressable
            style={s.card}
            onPress={() => setMode('flashcards')}
          >
            <View style={[s.cardIcon, {
              backgroundColor: '#E9F8F0',
            }]}>
              <Ionicons
                name="albums-outline"
                size={25}
                color="#22A06B"
              />
            </View>

            <View style={{ flex: 1 }}>
              <Text style={s.cardTitle}>
                Create Flashcards
              </Text>
              <Text style={s.cardText}>
                Enter definitions and their terms
              </Text>
            </View>
          </Pressable>
        </View>
      ) : (
        <View style={[s.uploadCard, {
          alignItems: 'stretch',
        }]}>
          <Text style={s.cardTitle}>
            {mode === 'notes'
              ? 'Create Notes'
              : 'Create Flashcards'}
          </Text>

          <TextInput
            value={name}
            onChangeText={setName}
            placeholder={
              mode === 'notes'
                ? 'Notes title'
                : 'Flashcard set name'
            }
            placeholderTextColor={C.muted}
            style={{
              borderWidth: 1,
              borderColor: C.line,
              borderRadius: 12,
              padding: 12,
              marginTop: 14,
              color: C.ink,
              backgroundColor: C.white,
            }}
          />

          {mode === 'notes' ? (
            <TextInput
              value={notes}
              onChangeText={setNotes}
              placeholder="Write your notes here..."
              placeholderTextColor={C.muted}
              multiline
              textAlignVertical="top"
              style={{
                minHeight: 260,
                borderWidth: 1,
                borderColor: C.line,
                borderRadius: 12,
                padding: 14,
                marginTop: 12,
                color: C.ink,
                backgroundColor: C.white,
              }}
            />
          ) : (
            <>
              {cards.map((card, index) => (
                <View
                  key={index}
                  style={{
                    borderWidth: 1,
                    borderColor: C.line,
                    borderRadius: 14,
                    padding: 12,
                    marginTop: 14,
                  }}
                >
                  <View style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}>
                    <Text style={s.cardTitle}>
                      Card {index + 1}
                    </Text>

                    {cards.length > 1 && (
                      <Pressable
                        accessibilityLabel="Remove card"
                        onPress={() =>
                          setCards(previous =>
                            previous.filter(
                              (_, cardIndex) =>
                                cardIndex !== index
                            )
                          )
                        }
                        style={{ padding: 6 }}
                      >
                        <Ionicons
                          name="trash-outline"
                          size={20}
                          color={C.red}
                        />
                      </Pressable>
                    )}
                  </View>

                  <TextInput
                    value={card.question}
                    onChangeText={value =>
                      setCards(previous =>
                        previous.map((entry, cardIndex) =>
                          cardIndex === index
                            ? {
                                ...entry,
                                question: value,
                              }
                            : entry
                        )
                      )
                    }
                    placeholder="Definition or explanation"
                    placeholderTextColor={C.muted}
                    multiline
                    style={{
                      borderWidth: 1,
                      borderColor: C.line,
                      borderRadius: 10,
                      padding: 11,
                      marginTop: 10,
                      color: C.ink,
                      backgroundColor: C.white,
                    }}
                  />

                  <TextInput
                    value={card.answer}
                    onChangeText={value =>
                      setCards(previous =>
                        previous.map((entry, cardIndex) =>
                          cardIndex === index
                            ? {
                                ...entry,
                                answer: value,
                              }
                            : entry
                        )
                      )
                    }
                    placeholder="Term"
                    placeholderTextColor={C.muted}
                    style={{
                      borderWidth: 1,
                      borderColor: C.line,
                      borderRadius: 10,
                      padding: 11,
                      marginTop: 9,
                      color: C.ink,
                      backgroundColor: C.white,
                    }}
                  />
                </View>
              ))}

              <Pressable
                style={[s.outline, {
                  marginTop: 14,
                  width: '100%',
                  maxWidth: undefined,
                }]}
                onPress={() =>
                  setCards(previous => [
                    ...previous,
                    { question: '', answer: '' },
                  ])
                }
              >
                <Text style={s.outlineText}>
                  + Add Flashcard
                </Text>
              </Pressable>
            </>
          )}

          {!!message && <Notice text={message} />}

          <Pressable
            style={[s.primary, { marginTop: 16 }]}
            onPress={save}
            disabled={busy}
          >
            {busy ? (
              <ActivityIndicator color={C.white} />
            ) : (
              <Text style={s.primaryText}>
                Save to My Library
              </Text>
            )}
          </Pressable>
        </View>
      )}
    </Page>
  );
}

type MaterialType = 'notes' | 'flashcards' | 'test' | 'game';

function SwipeStudyCard({
  question, answer, showAnswer, onFlip, onRate, expanded,
}: {
  question: string;
  answer: string;
  showAnswer: boolean;
  onFlip: () => void;
  onRate: (rating: 'known' | 'learning') => void;
  expanded: boolean;
}) {
  const x = useRef(new Animated.Value(0)).current;
  const current = useRef({ onFlip, onRate });
  current.current = { onFlip, onRate };

  const responder = useRef(PanResponder.create({
    onMoveShouldSetPanResponder: (_, gesture) =>
      Math.abs(gesture.dx) > 5 &&
      Math.abs(gesture.dx) > Math.abs(gesture.dy) * 0.7,
    onMoveShouldSetPanResponderCapture: (_, gesture) =>
      Math.abs(gesture.dx) > 5 &&
      Math.abs(gesture.dx) > Math.abs(gesture.dy) * 0.7,
    onPanResponderTerminationRequest: () => false,
    onPanResponderMove: (_, gesture) => {
      x.setValue(gesture.dx);
    },
    onPanResponderRelease: (_, gesture) => {
      if (Math.abs(gesture.dx) < 70) {
        Animated.spring(x, {
          toValue: 0,
          useNativeDriver: true,
        }).start();
        return;
      }

      const rating = gesture.dx > 0 ? 'known' : 'learning';
      Animated.timing(x, {
        toValue: gesture.dx > 0 ? 650 : -650,
        duration: 220,
        useNativeDriver: true,
      }).start(() => {
        x.setValue(0);
        current.current.onRate(rating);
      });
    },
    onPanResponderTerminate: () => {
      Animated.spring(x, {
        toValue: 0,
        useNativeDriver: true,
      }).start();
    },
  })).current;

  const rotate = x.interpolate({
    inputRange: [-250, 0, 250],
    outputRange: ['-12deg', '0deg', '12deg'],
    extrapolate: 'clamp',
  });
  const knownOpacity = x.interpolate({
    inputRange: [0, 45, 120],
    outputRange: [0, 0.5, 1],
    extrapolate: 'clamp',
  });
  const learningOpacity = x.interpolate({
    inputRange: [-120, -45, 0],
    outputRange: [1, 0.5, 0],
    extrapolate: 'clamp',
  });

  return (
    <Animated.View
      {...responder.panHandlers}
      style={{
        width: '100%',
        transform: [{ translateX: x }, { rotate }],
      }}>
      <Pressable onPress={() => current.current.onFlip()}
        style={{
          minHeight: expanded ? 400 : 240,
          width: '100%',
          backgroundColor: s === darkStyles ? '#141D2B' : C.white,
          borderColor: s === darkStyles ? '#536179' : C.line,
          borderWidth: 1,
          borderRadius: 22,
          padding: 24,
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        <Animated.Text style={{
          position: 'absolute', top: 18, left: 18,
          opacity: knownOpacity, color: '#40D38A',
          fontSize: 19, fontWeight: '900',
        }}>
          KNOW IT
        </Animated.Text>
        <Animated.Text style={{
          position: 'absolute', top: 18, right: 18,
          opacity: learningOpacity, color: '#FF6A75',
          fontSize: 19, fontWeight: '900',
        }}>
          STILL LEARNING
        </Animated.Text>
        <Text style={{
          color: s === darkStyles ? C.white : C.navy, fontSize: 11, fontWeight: '900',
          marginBottom: 12,
        }}>
          {showAnswer ? 'ANSWER' : 'QUESTION'}
        </Text>
        <Text style={{
          color: s === darkStyles ? C.white : C.navy, textAlign: 'center',
          fontSize: 20, fontWeight: '800', lineHeight: 29,
        }}>
          {showAnswer ? answer : question}
        </Text>
        {!showAnswer && (
          <Text style={{
            color: '#C4CCDC', textAlign: 'center', marginTop: 20,
          }}>
            Tap to reveal answer
          </Text>
        )}
      </Pressable>
    </Animated.View>
  );
}
function UploadMaterial({ api, done }: { api: any; done: () => void }) {
  const [asset, setAsset] =
    useState<DocumentPicker.DocumentPickerAsset | null>(null);
  const [assets, setAssets] =
    useState<DocumentPicker.DocumentPickerAsset[]>([]);
  const [libraryId, setLibraryId] = useState<string | null>(null);
  const [libraryIds, setLibraryIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [result, setResult] = useState<any>(null);
  const [type, setType] = useState<MaterialType | null>(null);
  const [flashcardCount, setFlashcardCount] = useState(50);
  const [questionCount, setQuestionCount] = useState(20);
  const [expanded, setExpanded] = useState(false);
  const [openCount, setOpenCount] = useState<'flashcards' | 'questions' | null>(null);
  const [cardIndex, setCardIndex] = useState(0);
  const [showBack, setShowBack] = useState(false);
  const [cardRatings, setCardRatings] = useState<Record<number, 'known' | 'learning'>>({});
  const swipeStartX = useRef<number | null>(null);
  const didSwipe = useRef(false);
  const [selected, setSelected] = useState<Record<number, number>>({});
  const [submitted, setSubmitted] = useState(false);

  async function chooseFile() {
    const picked = await DocumentPicker.getDocumentAsync({
      type: [
        'application/pdf',
        'text/plain',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'image/jpeg',
        'image/png',
        'image/webp',
      ],
      copyToCacheDirectory: true,
      multiple: true,
    });

    if (!picked.canceled && picked.assets.length > 0) {
      setAssets(picked.assets);
      setAsset(picked.assets[0]);
      setLibraryId(null);
      setLibraryIds([]);
      setResult(null);
      setType(null);
      setMessage('');
    }
  }

  async function attachFile(
    form: FormData,
    selectedAsset: DocumentPicker.DocumentPickerAsset | null = asset
  ) {
    if (!selectedAsset) return;

    await attachUploadFile(form, 'file', selectedAsset);
  }

  async function upload() {
    if (!assets.length || busy) return;

    setBusy(true);
    setMessage('');

    try {
      const uploadedIds: string[] = [];

      for (const selectedAsset of assets) {
        const form = new FormData();
        await attachFile(form, selectedAsset);

        const saved = await api('/api/library', {
          method: 'POST',
          body: form,
        });

        const savedFile = saved.file || saved.data?.file || saved.data;
        const id = savedFile?.id || savedFile?._id ||
          saved.libraryId || saved.fileId || saved.id;

        if (!id) {
          throw new Error(
            `Could not save ${selectedAsset.name}.`
          );
        }

        uploadedIds.push(String(id));
      }

      setLibraryIds(uploadedIds);
      setLibraryId(uploadedIds[0] || null);
      setMessage(
        `${uploadedIds.length} file${uploadedIds.length === 1 ? '' : 's'} saved. ` +
        'Choose what to generate below.'
      );
    } catch (error: any) {
      setMessage(error.message || 'Upload failed.');
    } finally {
      setBusy(false);
    }
  }

  async function generate(nextType: MaterialType) {
    if (!asset || busy) return;
    setBusy(true);
    setMessage('');
    setResult(null);
    setType(nextType);
    setCardIndex(0);
    setShowBack(false);
    setCardRatings({});
    setSelected({});
    setSubmitted(false);

    try {
      const form = new FormData();
      form.append('type', nextType);
      form.append('provider', 'gemini');

      if (libraryIds.length > 0) {
        form.append('libraryIds', JSON.stringify(libraryIds));
      } else if (libraryId) {
        form.append('libraryId', libraryId);
      } else {
        await attachFile(form);
      }

      if (nextType === 'flashcards') {
        form.append('flashcardCount', String(flashcardCount));
      }
      if (nextType === 'test' || nextType === 'game') {
        form.append('questionCount', String(questionCount));
      }

      const generated = await api('/api/generate', {
        method: 'POST',
        body: form,
      });

      if (generated.success === false) {
        throw new Error(generated.message || 'Generation failed.');
      }

      setResult(generated.data || {});
    } catch (error: any) {
      setMessage(error.message || 'Generation failed.');
    } finally {
      setBusy(false);
    }
  }

  const options: { id: MaterialType; label: string; icon: any }[] = [
    { id: 'notes', label: 'Notes', icon: 'document-text-outline' },
    { id: 'flashcards', label: 'Flashcards', icon: 'albums-outline' },
    { id: 'test', label: 'Practice Test', icon: 'checkbox-outline' },
    { id: 'game', label: 'Study Game', icon: 'game-controller-outline' },
  ];

  const cards: any[] = Array.isArray(result?.flashcards)
    ? result.flashcards : [];
  const questions: any[] = type === 'game'
    ? (Array.isArray(result?.game) ? result.game : [])
    : (Array.isArray(result?.questions) ? result.questions : []);

  return (
    <Page title="Upload Material"
      sub="Upload a lesson, then choose what to create.">
      <View style={s.uploadCard}>
        <View style={s.uploadIcon}>
          <Ionicons name="cloud-upload-outline" size={42} color={C.blue} />
        </View>
        <Text style={s.uploadTitle}>
          {assets.length > 1
            ? `${assets.length} files selected`
            : asset
              ? asset.name
              : 'Choose your study material'}
        </Text>
        <Text style={s.uploadText}>
          {assets.length > 0
            ? assets.map(item => item.name).join(', ')
            : 'PDF, DOCX, PPTX, TXT, JPG, PNG, or WEBP. Maximum size: 20 MB each.'}
        </Text>
        <Pressable style={s.outline} onPress={chooseFile} disabled={busy}>
          <Text style={s.outlineText}>
            {assets.length ? 'Choose Other Files' : 'Choose Files'}
          </Text>
        </Pressable>
        <Pressable
          style={[s.primary, { width: '100%', maxWidth: 330 },
            (!asset || busy) && { opacity: 0.55 }]}
          onPress={upload}
          disabled={!asset || busy}
        >
          <Text style={s.primaryText}>Upload to My Library</Text>
        </Pressable>
        {!!message && <Text style={s.uploadMessage}>{message}</Text>}
        {libraryId && (
          <Pressable style={s.libraryButton} onPress={done}>
            <Text style={s.libraryButtonText}>Open My Library</Text>
          </Pressable>
        )}
      </View>

      {asset && (
        <>
          <View style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 14,
            marginTop: 24,
            marginBottom: 16,
            position: 'relative',
            zIndex: 100,
          }}>
            <View style={{ flexGrow: 1 }}>
              <Text style={[s.section, { marginTop: 0, marginBottom: 2 }]}>
                What do you want to create?
              </Text>
              <Text style={{ color: C.muted }}>Choose a study tool.</Text>
            </View>

            <View style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              alignItems: 'flex-start',
              gap: 14,
              zIndex: 20,
            }}>
              <View style={{ position: 'relative',
                zIndex: openCount === 'flashcards' ? 30 : 1 }}>
                <Text style={s.cardTitle}>Flashcards</Text>
                <Pressable
                  onPress={() => setOpenCount(value =>
                    value === 'flashcards' ? null : 'flashcards')}
                  style={[s.outline, {
                    paddingHorizontal: 12,
                    paddingVertical: 9,
                    marginTop: 5,
                    minWidth: 82,
                  }]}
                >
                  <Text style={s.outlineText}>
                    {flashcardCount}  ▾
                  </Text>
                </Pressable>

                {openCount === 'flashcards' && (
                  <View style={{
                    position: 'absolute',
                    top: 62,
                    left: 0,
                    minWidth: 82,
                    maxHeight: 210,
                    backgroundColor: C.white,
                    borderWidth: 1,
                    borderColor: C.line,
                    borderRadius: 10,
                    zIndex: 40,
                    elevation: 8,
                  }}>
                    <ScrollView nestedScrollEnabled>
                      {[10, 20, 30, 40, 50].map(count => (
                        <Pressable key={count}
                          onPress={() => {
                            setFlashcardCount(count);
                            setOpenCount(null);
                          }}
                          style={{ padding: 11 }}>
                          <Text style={{ color: C.ink }}>{count}</Text>
                        </Pressable>
                      ))}
                    </ScrollView>
                  </View>
                )}
              </View>

              <View style={{ position: 'relative',
                zIndex: openCount === 'questions' ? 30 : 1 }}>
                <Text style={s.cardTitle}>Test / Game Questions</Text>
                <Pressable
                  onPress={() => setOpenCount(value =>
                    value === 'questions' ? null : 'questions')}
                  style={[s.outline, {
                    paddingHorizontal: 12,
                    paddingVertical: 9,
                    marginTop: 5,
                    minWidth: 82,
                  }]}
                >
                  <Text style={s.outlineText}>
                    {questionCount}  ▾
                  </Text>
                </Pressable>

                {openCount === 'questions' && (
                  <View style={{
                    position: 'absolute',
                    top: 62,
                    left: 0,
                    minWidth: 82,
                    maxHeight: 210,
                    backgroundColor: C.white,
                    borderWidth: 1,
                    borderColor: C.line,
                    borderRadius: 10,
                    zIndex: 40,
                    elevation: 8,
                  }}>
                    <ScrollView nestedScrollEnabled>
                      {[10, 20, 30, 40, 50, 60, 70, 80, 90, 100]
                        .map(count => (
                          <Pressable key={count}
                            onPress={() => {
                              setQuestionCount(count);
                              setOpenCount(null);
                            }}
                            style={{ padding: 11 }}>
                            <Text style={{ color: C.ink }}>
                              {count}
                            </Text>
                          </Pressable>
                        ))}
                    </ScrollView>
                  </View>
                )}
              </View>
            </View>
          </View>

          <View style={[s.grid, { position: "relative", zIndex: 0 }]}>
            {options.map(option => (
              <Pressable
                key={option.id}
                style={s.card}
                disabled={busy}
                onPress={() => generate(option.id)}
              >
                <Ionicons name={option.icon} size={24} color={C.blue} />
                <Text style={s.cardTitle}>{option.label}</Text>
              </Pressable>
            ))}
          </View>
        </>
      )}

      {busy && <ActivityIndicator color={C.blue}
        style={{ marginTop: 20 }} />}

      {result && (type === 'notes' || type === 'test' || type === 'game') && (
        <View style={{ marginTop: 16 }}>
          <Pressable
            style={s.primary}
            disabled={busy}
            onPress={async () => {
              if (busy) return;

              const data = type === 'notes'
                ? { notes: String(result.notes || '') }
                : type === 'test'
                  ? { questions: result.questions || [] }
                  : { game: result.game || [] };

              const label = type === 'notes'
                ? 'Notes'
                : type === 'test'
                  ? 'Practice Test'
                  : 'Study Game';

              const fileName = asset?.name || 'Study Material';
              const name = fileName.replace(/\.[^/.]+$/, '') + ' ' + label;

              setBusy(true);
              setMessage('');

              try {
                await api('/api/library/study-materials', {
                  method: 'POST',
                  body: JSON.stringify({ type, name, data }),
                });
                setMessage(label + ' saved to My Library.');
              } catch (error: any) {
                setMessage(error.message || 'Could not save study material.');
              } finally {
                setBusy(false);
              }
            }}
          >
            <Text style={s.primaryText}>Save to My Library</Text>
          </Pressable>

          {!!message && (
            <Text style={[s.cardText, {
              textAlign: 'center', marginTop: 10,
            }]}>
              {message}
            </Text>
          )}
        </View>
      )}
      {result && type === 'notes' && (
        <View style={[s.uploadCard, { marginTop: 20 }]}>
          <Text style={s.section}>Study Notes</Text>
          <Text style={{ color: C.ink, lineHeight: 24 }}>
            {formatStudyNotes(result.notes || 'No notes were returned.')}
          </Text>
        </View>
      )}

      {result && type === 'flashcards' && (
        <View style={{ marginTop: 20, width: '100%' }}>
          <Text style={[s.section, { textAlign: 'center', color: s === darkStyles ? '#F8FAFC' : C.navy }]}>
            Flashcard {cards.length ? cardIndex + 1 : 0} of {cards.length}
          </Text>

          {cards.length ? (
            <>
              <SwipeStudyCard
                question={String(cards[cardIndex]?.question ||
                  cards[cardIndex]?.front || '')}
                answer={String(cards[cardIndex]?.answer ||
                  cards[cardIndex]?.back || '')}
                showAnswer={showBack}
                expanded={expanded}
                onFlip={() => setShowBack(value => !value)}
                onRate={rating => {
                  const updated: Record<number, 'known' | 'learning'> = {
                    ...cardRatings,
                    [cardIndex]: rating,
                  };
                  setCardRatings(updated);
                  setShowBack(false);
                  for (let step = 1; step <= cards.length; step++) {
                    const next = (cardIndex + step) % cards.length;
                    if (!updated[next]) {
                      setCardIndex(next);
                      break;
                    }
                  }
                }}
              />
              <Pressable
                style={[s.libraryButton, { alignSelf: 'center' }]}
                onPress={() => setExpanded(value => !value)}
              >
                <Text style={s.libraryButtonText}>
                  {expanded ? 'Collapse Card' : 'Expand Card'}
                </Text>
              </Pressable>

              

              <Text style={[s.cardText, { textAlign: 'center', marginTop: 12 }]}>
                Reviewed {Object.keys(cardRatings).length} of {cards.length}
              </Text>

              {Object.keys(cardRatings).length === cards.length && (
                <View style={[s.uploadCard, { marginTop: 12, width: '100%' }]}>
                  <Text style={s.cardTitle}>Flashcard Result</Text>
                  <Text style={[s.cardTitle, { marginTop: 10, fontSize: 24 }]}>
                    {Object.values(cardRatings).filter(rating => rating === 'known').length}
                    /{cards.length}
                  </Text>
                  <Text style={[s.cardText, { marginTop: 8 }]}>
                    Still Learning: {Object.values(cardRatings).filter(
                      rating => rating === 'learning'
                    ).length}
                  </Text>
                  <Text style={s.cardText}>
                    Mastery: {Math.round(
                      Object.values(cardRatings).filter(
                        rating => rating === 'known'
                      ).length / cards.length * 100
                    )}%
                  </Text>
                </View>
              )}
              <Pressable
                style={[s.primary, { width: '100%', marginTop: 16 }]}
                disabled={busy}
                onPress={async () => {
                  if (!cards.length || busy) return;
                  setBusy(true);
                  setMessage('');

                  try {
                    const flashcards = cards.map(card => ({
                      question: String(card.question || card.front || '').trim(),
                      answer: String(card.answer || card.back || '').trim(),
                    })).filter(card => card.question && card.answer);

                    if (!flashcards.length) {
                      throw new Error('There are no complete flashcards to save.');
                    }

                    const fileName = asset?.name || 'Study Material';
                    const name = fileName.replace(/\.[^/.]+$/, '') + ' Flashcards';

                    await api('/api/library/flashcards', {
                      method: 'POST',
                      body: JSON.stringify({ name, flashcards }),
                    });

                    setMessage('Flashcards saved to My Library.');
                  } catch (error: any) {
                    setMessage(error.message || 'Could not save flashcards.');
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <Text style={s.primaryText}>
                  Save Flashcards to My Library
                </Text>
              </Pressable>
              {!!message && (
                <Text style={[s.cardText, { textAlign: 'center', marginTop: 10 }]}>
                  {message}
                </Text>
              )}
              <View style={{ flexDirection: 'row', gap: 12, marginTop: 8 }}>
                <Pressable
                  style={[s.outline, { flex: 1, flexBasis: 0, width: '100%', minWidth: 0, maxWidth: '100%', marginTop: 0, alignSelf: 'stretch', justifyContent: 'center' }]}
                  onPress={() => {
                    setCardIndex(index => (index - 1 + cards.length) % cards.length);
                    setShowBack(false);
                  }}
                >
                  <Text style={s.outlineText}>Previous</Text>
                </Pressable>

                <Pressable
                  style={[s.primary, { flex: 1, flexBasis: 0, width: '100%', minWidth: 0, maxWidth: '100%', marginTop: 0, alignSelf: 'stretch' }]}
                  onPress={() => {
                    setCardIndex(index => (index + 1) % cards.length);
                    setShowBack(false);
                  }}
                >
                  <Text style={s.primaryText}>Next</Text>
                </Pressable>
              </View>
            </>
          ) : (
            <Text style={{ textAlign: 'center' }}>No flashcards were returned.</Text>
          )}
        </View>
      )}
      {result && type === 'test' && (
        <View style={{ marginTop: 20 }}>
          <Text style={s.section}>
            {type === 'test' ? 'Practice Test' : 'Study Game'}
          </Text>
          {questions.length ? questions.map((item, index) => (
            <View key={index}
              style={[s.uploadCard, { marginBottom: 12 }]}>
              <Text style={[s.cardTitle, {
                  width: '100%',
                  maxWidth: '100%',
                  alignSelf: 'stretch',
                  textAlign: 'left',
                }]}>
                  {index + 1}. {String(item.question || '')}
                </Text>
              {(item.choices || []).map((choice: string, choiceIndex: number) => {
                const picked = selected[index] === choiceIndex;
                const correct = Number(item.answer ?? 0) === choiceIndex;
                const reveal = false ? selected[index] !== undefined
                  : submitted;
                return (
                  <Pressable key={choiceIndex}
                    disabled={false
                      ? selected[index] !== undefined : submitted}
                    onPress={() => setSelected(previous => ({
                      ...previous, [index]: choiceIndex,
                    }))}
                    style={[s.outline, {
                      width: '100%',
                      minWidth: '100%',
                      maxWidth: '100%',
                      alignSelf: 'stretch',
                      alignItems: 'flex-start',
                      marginTop: 8,
                      padding: 12,
                    },
                      picked && { backgroundColor: C.softBlue },
                      reveal && correct && {
                        borderColor: '#2E9D67',
                        backgroundColor: '#EAF8EF',
                      },
                      reveal && picked && !correct && {
                        borderColor: C.red,
                        backgroundColor: C.softRed,
                      }]}
                  >
                    <Text style={[s.outlineText, {
                          width: '100%',
                          minWidth: '100%',
                          maxWidth: '100%',
                          textAlign: 'left',
                          alignSelf: 'stretch',
                        }]}>
                          {String.fromCharCode(65 + choiceIndex)}. {String(choice)}
                    </Text>
                  </Pressable>
                );
              })}
              {(false ? selected[index] !== undefined : submitted)
                && !!item.explanation && (
                  <Text style={[s.cardText, { marginTop: 12 }]}>
                    {String(item.explanation)}
                  </Text>
                )}
            </View>
          )) : <Text>No questions were returned.</Text>}
          {type === 'test' && questions.length > 0 && !submitted && (
            <Pressable style={s.primary}
              onPress={() => setSubmitted(true)}>
              <Text style={s.primaryText}>Submit Test</Text>
            </Pressable>
          )}
          {(submitted || false) && questions.length > 0 && (
            <Text style={s.section}>
              Score: {questions.filter((item, index) =>
                selected[index] === Number(item.answer ?? 0)).length}
              /{questions.length}
            </Text>
          )}
        </View>
      )}
      {result && type === 'game' && (
        <MillionaireGame
          questions={questions}
          generating={busy}
          onPlayAgain={() => generate('game')}
        />
      )}
    </Page>
  );
}
function MillionaireGame({
  questions,
  generating,
  onPlayAgain,
}: {
  questions: any[];
  generating: boolean;
  onPlayAgain: () => void;
}) {
  const [soundOn, setSoundOn] = useState(true);
  const [voiceOn, setVoiceOn] = useState(false);
  const [musicOn, setMusicOn] = useState(false);
  const tickSound = useAudioPlayer(
    require('../../assets/sounds/quiz-tick.wav')
  );
  const correctSound = useAudioPlayer(
    require('../../assets/sounds/quiz-applause.wav')
  );
  const wrongSound = useAudioPlayer(
    require('../../assets/sounds/quiz-wrong.wav')
  );
  const winSound = useAudioPlayer(
    require('../../assets/sounds/quiz-win.wav')
  );

  const backgroundMusic = useAudioPlayer(
    require('../../assets/sounds/quiz-background.wav')
  );
  backgroundMusic.loop = true;
  backgroundMusic.volume = 0.8;
  function playSound(player: typeof tickSound) {
    if (!soundOn) return;
    player.seekTo(0);
    player.play();
  }
  const prizes = [
    100,
    200,
    300,
    500,
    1000,
    2000,
    3000,
    5000,
    7500,
    10000,
    15000,
    25000,
    50000,
    75000,
    100000,
    150000,
    200000,
    250000,
    300000,
    400000,
    500000,
    600000,
    750000,
    900000,
    1000000,
  ];
  const total = Math.min(25, questions.length);
  const [round, setRound] = useState(0);
  const [lastTick, setLastTick] = useState(30);
  const [seconds, setSeconds] = useState(30);
  const [choice, setChoice] = useState<number | null>(null);
  const [ended, setEnded] = useState<'no' | 'lost' | 'walked' | 'won'>('no');
  const [used, setUsed] = useState({
    fifty: false, audience: false, friend: false,
  });
  const [fiftyActive, setFiftyActive] = useState(false);
  const [hint, setHint] = useState('');

  const question = questions[round];
  const answers: string[] = Array.isArray(question?.choices)
    ? question.choices : [];
  const correct = Number(question?.answer ?? 0);
  const other = answers.findIndex((_, index) => index !== correct);

  useEffect(() => {
    setFiftyActive(false);
  }, [round]);

  useEffect(() => {
    if (voiceOn && ended === 'no' && question) {
      Speech.stop();
      const spokenChoices = answers.map((answer, index) =>
        `${String.fromCharCode(65 + index)}. ${answer}`
      ).join('. ');
      Speech.speak(
        `Question ${round + 1}. ${question.question}. ${spokenChoices}`,
        { language: 'en-US', rate: 0.9 }
      );
    }
    return () => { Speech.stop(); };
  }, [round, voiceOn]);

  useEffect(() => {
    if (ended !== 'no') backgroundMusic.pause();
  }, [ended]);


  useEffect(() => {
    if (!total || ended !== 'no' || choice !== null) return;
    const timer = setInterval(() => {
      setSeconds(previous => {
        if (previous <= 1) {
          setEnded('lost');
          return 0;
        }
        return previous - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [total, round, ended, choice]);

  useEffect(() => {
    if (ended !== 'no' || choice !== null ||
        seconds > 10 || seconds < 1 ||
        seconds === lastTick) return;
    setLastTick(seconds);
    playSound(tickSound);
  }, [seconds, ended, choice]);
  const guaranteed = round >= 10 ? 32000
    : round >= 5 ? 1000 : 0;
  const winnings = ended === 'won' ? prizes[total - 1]
    : ended === 'walked'
      ? (round ? prizes[round - 1] : 0)
      : guaranteed;

  function next() {
    if (round + 1 >= total) {
      setEnded('won');
      playSound(winSound);
    } else {
      setRound(value => value + 1);
      setSeconds(30);
      setChoice(null);
      setHint('');
    }
  }

  function restart() {
    setRound(0);
    setSeconds(30);
    setChoice(null);
    setEnded('no');
    setHint('');
    setUsed({ fifty: false, audience: false, friend: false });
    setFiftyActive(false);
  }

  const gold = '#F5CB67';
  const gameBlue = '#17104A';
  const answerBlue = '#241A6B';
  const borderBlue = '#8494D6';

  return (
    <View style={{
      marginTop: 20,
      padding: 16,
      borderRadius: 20,
      backgroundColor: gameBlue,
      borderWidth: 1,
      borderColor: '#43398A',
    }}>
      <Text style={{
        color: gold,
        fontWeight: '900',
        fontSize: 24,
        textAlign: 'center',
      }}>
        Cappy Challenge
      </Text>

      <Text style={{
        color: '#D8D9FF',
        textAlign: 'center',
        marginTop: 3,
      }}>
        25 questions · Virtual study challenge
      </Text>

      {!total ? (
        <Text style={{
          color: C.white,
          textAlign: 'center',
          marginTop: 24,
        }}>
          No questions were returned.
        </Text>
      ) : (
        <View style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          alignItems: 'flex-start',
          gap: 14,
          marginTop: 18,
        }}>
          <View style={{
            flex: 1,
            flexGrow: 1,
            minWidth: 280,
          }}>
            <View style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 8,
              marginBottom: 12,
            }}>
              <View style={{
                flexDirection: 'row',
                flexWrap: 'wrap',
                gap: 8,
              }}>
                <Pressable
                  disabled={used.fifty || choice !== null}
                  onPress={() => {
                    setUsed(previous => ({
                      ...previous,
                      fifty: true,
                    }));
                    setFiftyActive(true);
                  }}
                  style={{
                    minWidth: 62,
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                    alignItems: 'center',
                    borderRadius: 25,
                    borderWidth: 2,
                    borderColor: gold,
                    backgroundColor: '#29206D',
                    opacity: used.fifty ? 0.35 : 1,
                  }}
                >
                  <Text style={{ color: gold, fontWeight: '900' }}>
                    50:50
                  </Text>
                </Pressable>

                <Pressable
                  disabled={used.audience || choice !== null}
                  onPress={() => {
                    setUsed(previous => ({
                      ...previous,
                      audience: true,
                    }));
                    setHint(
                      'Audience favors ' +
                      String.fromCharCode(65 + correct) + '.'
                    );
                  }}
                  style={{
                    minWidth: 62,
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                    alignItems: 'center',
                    borderRadius: 25,
                    borderWidth: 2,
                    borderColor: gold,
                    backgroundColor: '#29206D',
                    opacity: used.audience ? 0.35 : 1,
                  }}
                >
                  <Text style={{ color: gold, fontWeight: '900' }}>
                    Audience
                  </Text>
                </Pressable>

                <Pressable
                  disabled={used.friend || choice !== null}
                  onPress={() => {
                    setUsed(previous => ({
                      ...previous,
                      friend: true,
                    }));
                    setHint(
                      'Friend suggests ' +
                      String.fromCharCode(65 + correct) + '.'
                    );
                  }}
                  style={{
                    minWidth: 62,
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                    alignItems: 'center',
                    borderRadius: 25,
                    borderWidth: 2,
                    borderColor: gold,
                    backgroundColor: '#29206D',
                    opacity: used.friend ? 0.35 : 1,
                  }}
                >
                  <Text style={{ color: gold, fontWeight: '900' }}>
                    Friend
                  </Text>
                </Pressable>
              </View>

              <Text style={{
                color: seconds <= 10 ? '#FF7788' : C.white,
                fontWeight: '900',
                fontSize: 18,
              }}>
                {seconds}s
              </Text>
            </View>

            <View style={{
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: 115,
              padding: 20,
              borderWidth: 2,
              borderColor: borderBlue,
              borderRadius: 18,
              backgroundColor: '#201663',
            }}>
              <Text style={{
                color: gold,
                fontSize: 13,
                fontWeight: '900',
                marginBottom: 8,
              }}>
                QUESTION {round + 1} OF {total}
              </Text>

              <Text style={{
                color: C.white,
                textAlign: 'center',
                fontSize: 19,
                lineHeight: 27,
                fontWeight: '900',
              }}>
                {String(question?.question || '')}
              </Text>
            </View>

            <View style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              gap: 10,
              marginTop: 14,
            }}>
              {answers.map((answer, index) => {
                const hidden = fiftyActive &&
                  index !== correct &&
                  index !== other;

                const selected = choice === index;
                const correctAnswer =
                  choice !== null && index === correct;
                const wrongAnswer =
                  selected && index !== correct;

                return (
                  <Pressable
                    key={index}
                    disabled={
                      hidden ||
                      choice !== null ||
                      ended !== 'no'
                    }
                    onPress={() => {
                      setChoice(index);

                      if (index === correct && soundOn) {
                        Speech.stop();
                        Speech.speak(
                          'You got the correct answer!',
                          {
                            language: 'en-US',
                            rate: 0.9,
                          }
                        );
                      }

                      playSound(
                        index === correct
                          ? correctSound
                          : wrongSound
                      );

                      if (index !== correct) {
                        setEnded('lost');
                      }
                    }}
                    style={{
                      width: '48%',
                      minWidth: 235,
                      flexGrow: 1,
                      minHeight: 58,
                      paddingHorizontal: 16,
                      paddingVertical: 14,
                      justifyContent: 'center',
                      borderWidth: 2,
                      borderColor: correctAnswer
                        ? '#38D890'
                        : wrongAnswer
                          ? '#FF5263'
                          : borderBlue,
                      borderRadius: 15,
                      backgroundColor: correctAnswer
                        ? '#17664D'
                        : wrongAnswer
                          ? '#7A2336'
                          : answerBlue,
                      opacity: hidden ? 0.12 : 1,
                    }}
                  >
                    <Text style={{
                      color: C.white,
                      fontWeight: '800',
                      fontSize: 15,
                    }}>
                      {hidden
                        ? ''
                        : `${String.fromCharCode(65 + index)}: ${String(answer)}`}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {!!hint && (
              <Text style={{
                color: gold,
                textAlign: 'center',
                fontWeight: '800',
                marginTop: 12,
              }}>
                {hint}
              </Text>
            )}

            {ended === 'no' && choice === null && (
              <Pressable
                onPress={() => setEnded('walked')}
                style={{
                  alignSelf: 'center',
                  paddingHorizontal: 20,
                  paddingVertical: 11,
                  marginTop: 16,
                  borderWidth: 1,
                  borderColor: '#9CA9D7',
                  borderRadius: 12,
                }}
              >
                <Text style={{
                  color: C.white,
                  fontWeight: '800',
                }}>
                  Walk Away
                </Text>
              </Pressable>
            )}

            {ended === 'no' && choice === correct && (
              <Pressable
                onPress={next}
                style={{
                  alignItems: 'center',
                  padding: 15,
                  marginTop: 16,
                  borderRadius: 13,
                  backgroundColor: '#E79B24',
                }}
              >
                <Text style={{
                  color: '#17104A',
                  fontWeight: '900',
                }}>
                  Next Question
                </Text>
              </Pressable>
            )}

            {ended !== 'no' && (
              <View style={{
                alignItems: 'center',
                marginTop: 18,
              }}>
                <Text style={{
                  color: gold,
                  textAlign: 'center',
                  fontSize: 18,
                  fontWeight: '900',
                }}>
                  {ended === 'won'
                    ? 'You completed the challenge!'
                    : ended === 'walked'
                      ? 'You walked away.'
                      : 'Game over.'}
                </Text>

                <Text style={{
                  color: C.white,
                  textAlign: 'center',
                  marginTop: 5,
                }}>
                  Virtual winnings: ₱{winnings.toLocaleString()}
                </Text>

                <Pressable
                  onPress={onPlayAgain}
                  disabled={generating}
                  style={{
                    paddingHorizontal: 24,
                    paddingVertical: 13,
                    marginTop: 14,
                    borderRadius: 12,
                    backgroundColor: '#E79B24',
                    opacity: generating ? 0.5 : 1,
                  }}
                >
                  {generating ? (
                    <ActivityIndicator color="#17104A" />
                  ) : (
                    <Text style={{
                      color: '#17104A',
                      fontWeight: '900',
                    }}>
                      Generate New Questions
                    </Text>
                  )}
                </Pressable>
              </View>
            )}

            <View style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              justifyContent: 'center',
              gap: 8,
              marginTop: 16,
            }}>
              <Pressable
                onPress={() => {
                  setVoiceOn(value => !value);
                  if (voiceOn) Speech.stop();
                }}
                style={{ padding: 8 }}
              >
                <Text style={{ color: '#C8CEEC' }}>
                  Voice: {voiceOn ? 'On' : 'Off'}
                </Text>
              </Pressable>

              <Pressable
                onPress={() => {
                  if (musicOn) {
                    backgroundMusic.pause();
                  } else {
                    backgroundMusic.play();
                  }
                  setMusicOn(value => !value);
                }}
                style={{ padding: 8 }}
              >
                <Text style={{ color: '#C8CEEC' }}>
                  Music: {musicOn ? 'On' : 'Off'}
                </Text>
              </Pressable>

              <Pressable
                onPress={() => setSoundOn(value => !value)}
                style={{ padding: 8 }}
              >
                <Text style={{ color: '#C8CEEC' }}>
                  Sound: {soundOn ? 'On' : 'Off'}
                </Text>
              </Pressable>
            </View>
          </View>

          <View style={{
            width: 235,
            flexGrow: 0,
            flexShrink: 1,
            minWidth: 210,
            maxHeight: 570,
            padding: 10,
            borderWidth: 1,
            borderColor: '#514798',
            borderRadius: 15,
            backgroundColor: '#0D0A2F',
            display: choice === correct ? 'flex' : 'none',
          }}>
            <Text style={{
              color: C.white,
              textAlign: 'center',
              fontWeight: '900',
              marginBottom: 7,
            }}>
              PRIZE LADDER
            </Text>

            <ScrollView
              nestedScrollEnabled
              showsVerticalScrollIndicator
            >
              {prizes
                .slice(0, total)
                .map((prize, index) => ({
                  prize,
                  index,
                }))
                .reverse()
                .map(({ prize, index }) => {
                  const current =
                    index === round &&
                    choice === correct &&
                    ended === 'no';

                  const earned = index < round;

                  const checkpoint =
                    index === 4 ||
                    index === 9 ||
                    index === 24;

                  return (
                    <View
                      key={index}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        paddingHorizontal: 10,
                        paddingVertical: 5,
                        marginBottom: 2,
                        borderRadius: 14,
                        backgroundColor: current
                          ? '#E79B24'
                          : 'transparent',
                      }}
                    >
                      <Text style={{
                        width: 30,
                        color: current
                          ? '#17104A'
                          : earned
                            ? gold
                            : C.white,
                        fontWeight: '900',
                      }}>
                        {index + 1}
                      </Text>

                      <Text style={{
                        color: current
                          ? '#17104A'
                          : earned
                            ? gold
                            : C.white,
                        fontWeight: checkpoint || current
                          ? '900'
                          : '700',
                      }}>
                        ◆ ₱{prize.toLocaleString()}
                      </Text>
                    </View>
                  );
                })}
            </ScrollView>
          </View>
        </View>
      )}
    </View>
  );
}
function Library({ api, token, userId, onStudy }: { api: any; token: string; userId: string; onStudy: (id: string) => void }) {
  const [folder, setFolder] = useState('all');
  const [addingFolder, setAddingFolder] = useState(false);
  const [folderName, setFolderName] = useState('');
  const [creatingCards, setCreatingCards] = useState(false);
  const [setName, setSetName] = useState('');
  const [draftCards, setDraftCards] = useState([
    { question: '', answer: '' },
  ]);
  const [saving, setSaving] = useState(false);
  const [libraryMessage, setLibraryMessage] = useState('');
  const [data, setData] = useState<any>({});
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [openSet, setOpenSet] = useState<any>(null);
  const [openMaterial, setOpenMaterial] = useState<any>(null);
  const [movingItem, setMovingItem] = useState<any>(null);
  const [fileError, setFileError] = useState('');
  const [openingFile, setOpeningFile] = useState(false);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [submitted, setSubmitted] = useState(false);
  const [cardIndex, setCardIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [ratings, setRatings] =
    useState<Record<number, 'known' | 'learning'>>({});

  const load = async () => {
    setBusy(true);
    setError('');

    try {
      const latestData = await api('/api/library');

      setData(latestData);

      await accountCache.write('library', userId, latestData);
    } catch (error: any) {
      try {
        const saved = error?.status === 401 || error?.status === 403 ? null : await accountCache.read<any>('library', userId);

        if (saved) {
          setData(saved);
          setError('Offline mode: showing your saved study materials.');
        } else {
          setError(
            'No offline materials yet. Connect to the internet once to save them.'
          );
        }
      } catch {
        setError(error.message || 'Could not open My Library.');
      }
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => { load(); }, []);

  const items = [
    ...(data.files || []).map((x: any) => ({ ...x, kind: 'File' })),
    ...(data.flashcardSets || []).map((x: any) => ({ ...x, kind: 'Flashcards' })),
    ...(data.studyMaterials || []).map((x: any) => ({
      ...x,
      kind: x.type || 'Study material',
    })),
  ];

  const visibleItems = items.filter((item: any) =>
    folder === 'all' ||
    (folder === 'uncategorized'
      ? !item.folderId
      : String(item.folderId || '') === folder)
  );

  async function createFolder() {
    const name = folderName.trim();
    if (!name || saving) return;
    setSaving(true);
    setLibraryMessage('');
    try {
      const result = await api('/api/library/folders', {
        method: 'POST',
        body: JSON.stringify({ name }),
      });
      setFolderName('');
      setAddingFolder(false);
      if (result.folder?.id) setFolder(String(result.folder.id));
      load();
    } catch (error: any) {
      setLibraryMessage(error.message || 'Could not create folder.');
    } finally {
      setSaving(false);
    }
  }

  async function createFlashcards() {
    const name = setName.trim();
    const flashcards = draftCards.map(card => ({
      question: card.question.trim(),
      answer: card.answer.trim(),
    })).filter(card => card.question && card.answer);

    if (!name || !flashcards.length || saving) {
      setLibraryMessage('Enter a set name and at least one complete card.');
      return;
    }

    setSaving(true);
    setLibraryMessage('');
    try {
      await api('/api/library/flashcards', {
        method: 'POST',
        body: JSON.stringify({
          name,
          flashcards,
          folderId: folder === 'all' || folder === 'uncategorized'
            ? null : folder,
        }),
      });
      setCreatingCards(false);
      setSetName('');
      setDraftCards([{ question: '', answer: '' }]);
      load();
    } catch (error: any) {
      setLibraryMessage(error.message || 'Could not save flashcards.');
    } finally {
      setSaving(false);
    }
  }

  async function moveLibraryItem(
    item: any,
    nextFolderId: string | null
  ) {
    if (!item?.id || saving) return;

    const itemType =
      item.kind === 'File'
        ? 'file'
        : item.kind === 'Flashcards'
          ? 'flashcards'
          : 'material';

    setSaving(true);
    setLibraryMessage('');

    try {
      await api(
        `/api/library/move/${itemType}/${item.id}`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            folderId: nextFolderId,
          }),
        }
      );

      setMovingItem(null);
      setLibraryMessage(
        nextFolderId
          ? 'Moved to folder.'
          : 'Moved to No Folder.'
      );

      await load();
    } catch (error: any) {
      setLibraryMessage(
        error.message || 'Could not move this item.'
      );
    } finally {
      setSaving(false);
    }
  }
  async function openPrivateFile(item: any) {
    if (!token || openingFile) return;

    if (Platform.OS === 'web') {
      setFileError('Open uploaded files in the Android app for now.');
      return;
    }

    setOpeningFile(true);
    setFileError('');

    try {
      const safeName = String(item.name || 'study-material.pdf')
        .replace(/[\\/:*?"<>|]/g, '_');
      const destination = FileSystem.cacheDirectory +
        String(item.id) + '-' + safeName;

      const downloaded = await FileSystem.downloadAsync(
        `${API}/api/library/${encodeURIComponent(item.id)}/file`,
        destination,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (downloaded.status !== 200) {
        throw new Error(`File download failed (${downloaded.status}).`);
      }

      if (!(await Sharing.isAvailableAsync())) {
        throw new Error('No compatible file-opening app is available.');
      }

      await Sharing.shareAsync(downloaded.uri);
    } catch (error: any) {
      setFileError(error.message || 'Could not open this file.');
    } finally {
      setOpeningFile(false);
    }
  }
  if (openMaterial) {
    const kind = String(openMaterial.type || '');
    const questions: any[] = kind === 'game'
      ? openMaterial.data?.game || []
      : openMaterial.data?.questions || [];

    return (
      <Page title={openMaterial.name || 'Study Material'} sub="Saved in My Library">
        <Pressable
          style={{
          alignSelf: 'flex-start',
          width: 40,
          height: 40,
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 12,
        }}
          onPress={() => {
            setOpenMaterial(null);
            setAnswers({});
            setSubmitted(false);
          }}
        >
          <Ionicons name="arrow-back" size={22} color={C.blue} />
        </Pressable>

        {kind === 'notes' ? (
          <View style={s.uploadCard}>
            <Pressable accessibilityRole="button" accessibilityLabel="Invite friends to study these notes" onPress={() => onStudy(openMaterial.id)} style={[s.primary, { marginBottom: 16 }]}><Text style={s.primaryText}>Invite friends in Study Circle</Text></Pressable>
            <Text style={[s.cardText, { lineHeight: 24 }]}>
              {formatStudyNotes(openMaterial.data?.notes || 'No notes found.')}
            </Text>
          </View>
        ) : kind === 'game' ? (
          <MillionaireGame
            key={
              String(openMaterial.id || openMaterial._id || 'saved-game') +
              '-' +
              String(openMaterial.gameSession || 0)
            }
            questions={questions}
            generating={false}
            onPlayAgain={() => {
              setOpenMaterial((previous: any) => previous
                ? {
                    ...previous,
                    gameSession:
                      Number(previous.gameSession || 0) + 1,
                  }
                : previous
              );
            }}
          />
        ) : (
          <>
            {questions.map((item, index) => {
              const picked = answers[index];
              const correct = Number(item.answer ?? 0);
              const reveal = kind === 'game'
                ? picked !== undefined
                : submitted;

              return (
                <View key={index}
                  style={[s.uploadCard, { marginBottom: 12, width: '100%' }]}>
                  <Text style={[s.cardTitle, {
                  width: '100%',
                  maxWidth: '100%',
                  alignSelf: 'stretch',
                  textAlign: 'left',
                }]}>
                  {index + 1}. {String(item.question || '')}
                </Text>

                  {(item.choices || []).map(
                    (choice: string, choiceIndex: number) => (
                      <Pressable
                        key={choiceIndex}
                        disabled={reveal}
                        onPress={() => setAnswers(previous => ({
                          ...previous,
                          [index]: choiceIndex,
                        }))}
                        style={[s.outline, {
                          width: '100%',
                          minWidth: '100%',
                          maxWidth: '100%',
                          alignSelf: 'stretch',
                          alignItems: 'flex-start',
                          marginTop: 9,
                          borderColor: reveal && choiceIndex === correct
                            ? '#24945D'
                            : picked === choiceIndex ? C.blue : C.line,
                          backgroundColor: reveal && choiceIndex === correct
                            ? '#E6F6ED'
                            : picked === choiceIndex ? C.softBlue : C.white,
                        }]}
                      >
                        <Text style={[s.outlineText, {
                          width: '100%',
                          minWidth: '100%',
                          maxWidth: '100%',
                          textAlign: 'left',
                          alignSelf: 'stretch',
                        }]}>
                          {String.fromCharCode(65 + choiceIndex)}. {String(choice)}
                        </Text>
                      </Pressable>
                    )
                  )}

                  {reveal && (
                    <Text style={[s.cardText, { marginTop: 12 }]}>
                      {picked === correct ? 'Correct!' : 'Not quite.'}
                      {' '}{String(item.explanation || '')}
                    </Text>
                  )}
                </View>
              );
            })}

            {!questions.length && <Empty text="No questions found." />}

            {kind === 'test' && questions.length > 0 && !submitted && (
              <Pressable style={s.primary}
                onPress={() => setSubmitted(true)}>
                <Text style={s.primaryText}>Submit Test</Text>
              </Pressable>
            )}

            {kind === 'test' && submitted && (
              <Text style={[s.section, { textAlign: 'center', color: s === darkStyles ? '#F8FAFC' : C.navy }]}>
                Score: {questions.filter((item, index) =>
                  answers[index] === Number(item.answer ?? 0)
                ).length} / {questions.length}
              </Text>
            )}
          </>
        )}
      </Page>
    );
  }
  if (openSet) {
    const cards = Array.isArray(openSet.flashcards) ? openSet.flashcards : [];

    return (
      <Page title={openSet.name || 'Flashcards'} sub="Tap the card to flip it.">
        <Pressable
          style={{
          alignSelf: 'flex-start',
          width: 40,
          height: 40,
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 12,
        }}
          onPress={() => {
            setOpenSet(null);
            setCardIndex(0);
            setShowAnswer(false);
          }}
        >
          <Ionicons name="arrow-back" size={22} color={C.blue} />
        </Pressable>

        {cards.length ? (
          <>
            <Text style={[s.section, { textAlign: 'center', color: s === darkStyles ? '#F8FAFC' : C.navy }]}>
              Flashcard {cardIndex + 1} of {cards.length}
            </Text>

            <SwipeStudyCard
              question={String(cards[cardIndex]?.question ||
                cards[cardIndex]?.front || '')}
              answer={String(cards[cardIndex]?.answer ||
                cards[cardIndex]?.back || '')}
              showAnswer={showAnswer}
              expanded={expanded}
              onFlip={() => setShowAnswer(value => !value)}
              onRate={rating => {
                const updated: Record<number, 'known' | 'learning'> = {
                  ...ratings,
                  [cardIndex]: rating,
                };
                setRatings(updated);
                setShowAnswer(false);
                for (let step = 1; step <= cards.length; step++) {
                  const next = (cardIndex + step) % cards.length;
                  if (!updated[next]) {
                    setCardIndex(next);
                    break;
                  }
                }
              }}
            />

            <Pressable
              style={[s.libraryButton, { alignSelf: 'center' }]}
              onPress={() => setExpanded(value => !value)}>
              <Text style={s.libraryButtonText}>
                {expanded ? 'Collapse Card' : 'Expand Card'}
              </Text>
            </Pressable>
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 16 }}>
              <Pressable
                style={[s.outline, {
                  flex: 1,
                  flexBasis: 0,
                  width: '100%',
                  minWidth: 0,
                  maxWidth: '100%',
                  marginTop: 0,
                  alignSelf: 'stretch',
                  justifyContent: 'center',
                }]}
                onPress={() => {
                  setCardIndex(index =>
                    (index - 1 + cards.length) % cards.length
                  );
                  setShowAnswer(false);
                }}
              >
                <Text style={s.outlineText}>Previous</Text>
              </Pressable>
              <Pressable
                style={[s.primary, { flex: 1, flexBasis: 0, width: '100%', minWidth: 0, maxWidth: '100%', marginTop: 0, alignSelf: 'stretch' }]}
                onPress={() => {
                  setCardIndex(index => (index + 1) % cards.length);
                  setShowAnswer(false);
                }}
              >
                <Text style={s.primaryText}>Next</Text>
              </Pressable>
            </View>
            <Text style={[s.cardText, {
              textAlign: 'center', marginTop: 14,
            }]}>
              Reviewed {Object.keys(ratings).length} of {cards.length}
            </Text>

            {Object.keys(ratings).length === cards.length && (
              <View style={[s.uploadCard, { marginTop: 12 }]}>
                <Text style={s.cardTitle}>Flashcard Result</Text>
                <Text style={[s.cardTitle, { fontSize: 24, marginTop: 10 }]}>
                  {Object.values(ratings).filter(
                    value => value === 'known'
                  ).length}/{cards.length} known
                </Text>
                <Text style={[s.cardText, { marginTop: 8 }]}>
                  Still Learning: {Object.values(ratings).filter(
                    value => value === 'learning'
                  ).length}
                </Text>
                <Pressable style={s.libraryButton} onPress={() => {
                  setRatings({});
                  setCardIndex(0);
                  setShowAnswer(false);
                }}>
                  <Text style={s.libraryButtonText}>Study Again</Text>
                </Pressable>
              </View>
            )}
          </>
        ) : (
          <Empty text="This set has no flashcards." />
        )}
      </Page>
    );
  }

  return (
    <Page
      title="My Library"
      sub="Your files and personal study tools."
      refresh={load}
    >
      

      {addingFolder && (
        <View style={[s.uploadCard, { marginBottom: 16, alignItems: 'stretch' }]}>
          <Text style={s.cardTitle}>New folder</Text>
          <TextInput value={folderName} onChangeText={setFolderName}
            placeholder="Folder name"
            style={{ borderWidth: 1, borderColor: C.line, borderRadius: 10,
              padding: 12, marginTop: 10, color: C.ink }} />
          <Pressable style={s.primary} disabled={saving}
            onPress={createFolder}>
            <Text style={s.primaryText}>Save Folder</Text>
          </Pressable>
        </View>
      )}

      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        style={{ marginBottom: 18 }}
        contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
        {[
          { id: 'all', name: 'All' },
          { id: 'uncategorized', name: 'Uncategorized' },
          ...(data.folders || []).map((entry: any) => ({
            id: String(entry.id), name: String(entry.name),
          })),
        ].map(entry => (
          <Pressable key={entry.id} onPress={() => setFolder(entry.id)}
            style={{
              paddingHorizontal: 16, paddingVertical: 10,
              borderRadius: 24, borderWidth: 1,
              borderColor: folder === entry.id ? C.blue : C.line,
              backgroundColor: folder === entry.id ? C.blue : C.white,
            }}>
            <Text style={{
              color: folder === entry.id ? C.white : C.ink,
              fontWeight: '700',
            }}>
              {entry.name}
            </Text>
          </Pressable>
        ))}
              <Pressable
          accessibilityLabel="Create new folder"
          onPress={() => {
            setAddingFolder(value => !value);
            setLibraryMessage('');
          }}
          style={{
            width: 42,
            height: 42,
            borderRadius: 21,
            borderWidth: 1,
            borderColor: C.blue,
            backgroundColor: addingFolder ? C.blue : C.white,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons
            name={addingFolder ? 'close' : 'add'}
            size={24}
            color={addingFolder ? C.white : C.blue}
          />
        </Pressable>
</ScrollView>

      {!!libraryMessage && <Notice text={libraryMessage} />}

      {creatingCards && (
        <View style={[s.uploadCard, {
          alignItems: 'stretch', marginBottom: 20,
        }]}>
          <Text style={s.cardTitle}>Create Flashcards</Text>
          <TextInput value={setName} onChangeText={setSetName}
            placeholder="Flashcard set name"
            style={{ borderWidth: 1, borderColor: C.line, borderRadius: 10,
              padding: 12, marginTop: 12, color: C.ink }} />

          {draftCards.map((card, index) => (
            <View key={index} style={{
              marginTop: 14, padding: 12, borderWidth: 1,
              borderColor: C.line, borderRadius: 12,
            }}>
              <Text style={s.cardTitle}>Card {index + 1}</Text>
              <TextInput value={card.question} placeholder="Question"
                onChangeText={value => setDraftCards(previous =>
                  previous.map((entry, i) =>
                    i === index ? { ...entry, question: value } : entry))}
                style={{ borderWidth: 1, borderColor: C.line,
                  borderRadius: 10, padding: 10, marginTop: 8,
                  color: C.ink }} />
              <TextInput value={card.answer} placeholder="Answer"
                onChangeText={value => setDraftCards(previous =>
                  previous.map((entry, i) =>
                    i === index ? { ...entry, answer: value } : entry))}
                style={{ borderWidth: 1, borderColor: C.line,
                  borderRadius: 10, padding: 10, marginTop: 8,
                  color: C.ink }} />
            </View>
          ))}

          <Pressable style={s.outline}
            onPress={() => setDraftCards(previous => [
              ...previous, { question: '', answer: '' },
            ])}>
            <Text style={s.outlineText}>+ Add Card</Text>
          </Pressable>
          <Pressable style={s.primary} disabled={saving}
            onPress={createFlashcards}>
            <Text style={s.primaryText}>Save Flashcards</Text>
          </Pressable>
        </View>
      )}

      {!!movingItem && (
        <View style={[s.uploadCard, {
          marginBottom: 16,
          alignItems: 'stretch',
          padding: 16,
        }]}>
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <Text style={s.cardTitle}>Move to Folder</Text>

            <Pressable
              onPress={() => setMovingItem(null)}
              accessibilityLabel="Close folder choices"
              style={{ padding: 6 }}
            >
              <Ionicons
                name="close"
                size={22}
                color={C.muted}
              />
            </Pressable>
          </View>

          <Text style={[s.cardText, { marginTop: 5 }]}>
            {movingItem.name ||
              movingItem.title ||
              'Library item'}
          </Text>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{
              gap: 8,
              paddingTop: 14,
              paddingBottom: 4,
            }}
          >
            <Pressable
              disabled={saving}
              onPress={() =>
                moveLibraryItem(movingItem, null)
              }
              style={[s.outline, {
                marginTop: 0,
                width: 'auto',
                minWidth: 110,
                paddingHorizontal: 14,
              }]}
            >
              <Text style={s.outlineText}>No Folder</Text>
            </Pressable>

            {(data.folders || []).map((entry: any) => (
              <Pressable
                key={entry.id}
                disabled={saving}
                onPress={() =>
                  moveLibraryItem(
                    movingItem,
                    String(entry.id)
                  )
                }
                style={[s.outline, {
                  marginTop: 0,
                  width: 'auto',
                  minWidth: 100,
                  paddingHorizontal: 14,
                }]}
              >
                <Text style={s.outlineText}>
                  {entry.name}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}
      {!creatingCards && (
        <>
      <Text style={s.toolSectionTitle}>My uploaded materials</Text>
      {openingFile && <ActivityIndicator color={C.blue} />}
      {!!fileError && <Notice text={fileError} />}

      {!!error && <Notice text={error} />}
      {busy ? (
        <ActivityIndicator color={C.blue} />
      ) : visibleItems.length ? (
        visibleItems.map((x: any, i: number) => (
          <View
            key={x.id || i}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <Pressable
              style={{ flex: 1, minWidth: 0 }}
              onPress={() => {
                if (x.kind === 'Flashcards') {
                  setOpenSet(x);
                  setRatings({});
                  setExpanded(false);
                  setCardIndex(0);
                  setShowAnswer(false);
                } else if (x.kind !== 'File') {
                  setOpenMaterial(x);
                  setAnswers({});
                  setSubmitted(false);
                } else {
                  openPrivateFile(x);
                }
              }}
            >
              <Row
                icon={
                  x.kind === 'File'
                    ? 'document-text-outline'
                    : 'albums-outline'
                }
                title={
                  x.name ||
                  x.title ||
                  (x.kind === 'File'
                    ? 'File'
                    : 'Study material')
                }
                meta={
                  x.kind === 'Flashcards'
                    ? `${(x.flashcards || []).length} cards · Tap to study`
                    : x.kind === 'File'
                      ? 'File · Tap to open'
                      : `${x.kind} · Tap to open`
                }
              />
            </Pressable>

            <Pressable
              accessibilityLabel="Move to folder"
              onPress={() => setMovingItem(x)}
              style={{
                width: 44,
                height: 44,
                marginBottom: 10,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: C.line,
                backgroundColor: C.white,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons
                name="folder-open-outline"
                size={21}
                color={C.blue}
              />
            </Pressable>
          </View>
        ))
      ) : (
        <Empty text="Nothing is saved here yet." />
      )}
        </>
      )}
    </Page>
  );
}
function Community({ api }: { api: any }) {
  const [items, setItems] = useState<any[]>([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [opened, setOpened] = useState<any>(null);
  const [fileText, setFileText] = useState('');
  const [opening, setOpening] = useState(false);
  const [cardIndex, setCardIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [ratings, setRatings] =
    useState<Record<number, 'known' | 'learning'>>({});
  const swipeStartX = useRef<number | null>(null);
  const didSwipe = useRef(false);

  function load() {
    setBusy(true);
    setError('');
    api('/api/community')
      .then((data: any) => setItems([
        ...(data.files || []),
        ...(data.flashcardSets || []),
      ]))
      .catch((err: any) => setError(err.message || 'Could not load Community Notes.'))
      .finally(() => setBusy(false));
  }

  useEffect(() => { load(); }, []);

  async function openItem(item: any) {
    setOpened(item);
    setFileText('');
    setError('');
    setCardIndex(0);
    setShowAnswer(false);

    if (item.type === 'file') {
      setOpening(true);
      try {
        const data = await api(
          `/api/community/file/${encodeURIComponent(String(item.id))}/content`
        );
        setFileText(String(data.material?.text || 'No readable text was found in this file.'));
      } catch (err: any) {
        setError(err.message || 'Could not open this material.');
      } finally {
        setOpening(false);
      }
    }
  }

  function rateCard(rating: 'known' | 'learning') {
    const cards = Array.isArray(opened?.flashcards)
      ? opened.flashcards : [];
    if (!cards.length) return;

    const updated: Record<number, 'known' | 'learning'> = {
      ...ratings,
      [cardIndex]: rating,
    };
    setRatings(updated);
    setShowAnswer(false);

    for (let step = 1; step <= cards.length; step++) {
      const next = (cardIndex + step) % cards.length;
      if (!updated[next]) {
        setCardIndex(next);
        break;
      }
    }
  }
  const viewer = opened ? (() => {
    const cards: any[] = Array.isArray(opened.flashcards)
      ? opened.flashcards : [];
    const card = cards[cardIndex];

    return (
      <Modal visible transparent animationType="fade"
        onRequestClose={() => setOpened(null)}>
        <View style={{
          flex: 1, backgroundColor: s === darkStyles ? 'rgba(0,0,0,0.72)' : 'rgba(15,23,42,0.25)',
          justifyContent: 'center', padding: 16,
        }}>
          <ScrollView contentContainerStyle={{
            width: '100%', maxWidth: 950, alignSelf: 'center',
            padding: 20, backgroundColor: s === darkStyles ? '#151E30' : C.white,
            borderRadius: 20,
          }}>
            <View style={{
              flexDirection: 'row', alignItems: 'center',
              justifyContent: 'space-between', gap: 12,
            }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: s === darkStyles ? C.white : C.navy, fontSize: 23, fontWeight: '800' }}>
                  {opened.name || 'Community Material'}
                </Text>
                <Text style={{ color: s === darkStyles ? '#ABB8D0' : C.muted, marginTop: 5 }}>
                  By {opened.author || 'STUDYante User'}
                </Text>
              </View>
              <Pressable onPress={() => { setOpened(null); setError(''); }}
                style={{ padding: 12, borderRadius: 10, backgroundColor: s === darkStyles ? '#263349' : C.softBlue }}>
                <Text style={{ color: s === darkStyles ? C.white : C.blue, fontWeight: '800' }}>Close</Text>
              </Pressable>
            </View>
        <Pressable accessibilityLabel='Back to Community Notes' style={{ alignSelf: 'flex-start', width: 40, height: 40, alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}
          onPress={() => {
            setOpened(null);
            setError('');
          }}>
          <Ionicons name="arrow-back" size={22} color={C.blue} />
        </Pressable>

        {opening && <ActivityIndicator color={C.blue} />}
        {!!error && <Notice text={error} />}

        {opened.type === 'file' && !opening && !error && (
          <View style={s.uploadCard}>
            <Text style={[s.cardText, { lineHeight: 24, alignSelf: 'stretch' }]}>
              {fileText}
            </Text>
          </View>
        )}

        {opened.type !== 'file' && (
          cards.length ? (
            <>
              <Text style={s.section}>
                {Object.keys(ratings).length === cards.length
                  ? `Finished: ${Object.values(ratings).filter(
                      value => value === 'known'
                    ).length} of ${cards.length} known`
                  : `Flashcard ${cardIndex + 1} of ${cards.length}`}
              </Text>

              {Object.keys(ratings).length === cards.length ? (
                <Pressable style={s.primary} onPress={() => {
                  setRatings({});
                  setCardIndex(0);
                  setShowAnswer(false);
                }}>
                  <Text style={s.primaryText}>Study Again</Text>
                </Pressable>
              ) : (
                <>
                  <SwipeStudyCard
                    question={String(card?.question || card?.front || '')}
                    answer={String(card?.answer || card?.back || '')}
                    showAnswer={showAnswer}
                    expanded={expanded}
                    onFlip={() => setShowAnswer(value => !value)}
                    onRate={rateCard}
                  />
                  <Pressable
                    style={[s.libraryButton, { alignSelf: 'center' }]}
                    onPress={() => setExpanded(value => !value)}>
                    <Text style={s.libraryButtonText}>
                      {expanded ? 'Collapse Card' : 'Expand Card'}
                    </Text>
                  </Pressable>

                  <View style={{ flexDirection: 'row', gap: 12, marginTop: 12, justifyContent: 'space-between' }}>
                    <Pressable style={[s.outline, { flex: undefined, width: '48%', maxWidth: '100%', minWidth: 0, marginTop: 0 }]} onPress={() => {
                      setCardIndex(index =>
                        (index - 1 + cards.length) % cards.length
                      );
                      setShowAnswer(false);
                    }}>
                      <Text style={s.outlineText}>Previous</Text>
                    </Pressable>
                    <Pressable style={[s.primary, { flex: 1, flexBasis: 0, width: '100%', maxWidth: '100%', minWidth: 0, marginTop: 0 }]} onPress={() => {
                      setCardIndex(index => (index + 1) % cards.length);
                      setShowAnswer(false);
                    }}>
                      <Text style={s.primaryText}>Next</Text>
                    </Pressable>
                  </View>
                  <Text style={[s.cardText, {
                    textAlign: 'center',
                    marginTop: 12,
                  }]}>
                    Swipe left: Still Learning · Swipe right: Know It
                  </Text>
                </>
              )}
            </>
          ) : <Empty text="This set has no flashcards." />
        )}
      </ScrollView></View></Modal>
    );
  })() : null;

  return (
    <Page title="Community Notes"
      sub="Materials approved for STUDYante learners."
      refresh={load}>
      {busy ? <ActivityIndicator color={C.blue} />
        : error ? <Notice text={error} />
        : items.length ? items.map((item, index) => (
          <Pressable key={item.id || index} onPress={() => openItem(item)}>
            <Row
              icon={item.type === 'file'
                ? 'document-outline' : 'layers-outline'}
              title={item.name}
              meta={`By ${item.author || 'STUDYante User'} · Tap to open`}
            />
          </Pressable>
        )) : <Empty text="No approved community materials yet." />}
          {viewer}
    </Page>
  );
}
function formatStudyNotes(value: unknown) {
  return String(value || '')
    .replace(/\r\n/g, '\n')
    .replace(/\\n/g, '\n')
    .replace(/\s*#{1,6}\s+/g, '\n\n')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\\\*/g, '')
    .replace(/`{1,3}/g, '')
    .replace(/\s+-\s+(?=\S)/g, '\n• ')
    .replace(/\s+(\d+)\.\s+(?=\S)/g, '\n$1. ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
function cleanAIText(value: string) {
  return String(value || '')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/`{1,3}/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function AI({ api }: { api: any }) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const compact = width < 700;
  const chatHeight = compact ? Math.max(280, height - insets.top - insets.bottom - 260) : 620;
  const welcome = {
    role: 'assistant',
    content: 'Hi! What would you like to study today?'
  };

  const [question, setQuestion] = useState('');
  const [chatId, setChatId] = useState('');
  const [chats, setChats] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([welcome]);
  const [busy, setBusy] = useState(false);
  const [historyError, setHistoryError] = useState('');
  const [attachment, setAttachment] =
    useState<DocumentPicker.DocumentPickerAsset | ImagePicker.ImagePickerAsset | null>(null);
  const [attachmentKind, setAttachmentKind] =
    useState<'file' | 'image' | null>(null);
  const [attachmentError, setAttachmentError] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  async function attachFile(kind: 'file' | 'image' = 'file') {
    try {
      const picked = await DocumentPicker.getDocumentAsync({
        type: kind === 'image' ? ['image/*'] : [
          'application/pdf',
          'text/plain',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        ],
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (picked.canceled) return;
      setAttachment(picked.assets[0]);
      setAttachmentKind(
        picked.assets[0].mimeType?.startsWith('image/')
          ? 'image' : 'file'
      );
      setAttachmentError('');
    } catch (error: any) {
      setAttachmentError(error.message || 'Could not choose a file.');
    }
  }

  async function generateImage() {
    const prompt = question.trim();
    if (!prompt || busy) {
      setAttachmentError('Describe the image you want first.');
      return;
    }

    setBusy(true);
    setAttachmentError('');
    try {
      const result = await api('/api/generate-image', {
        method: 'POST',
        body: JSON.stringify({ prompt }),
      });
      if (!result.imageData) {
        throw new Error(result.error || 'No image was returned.');
      }

      const uri = result.imageData.startsWith('data:')
        ? result.imageData
        : `data:${result.mimeType || 'image/png'};base64,${result.imageData}`;

      setMessages(current => [
        ...current,
        { role: 'user', content: `Generate an image: ${prompt}` },
        { role: 'assistant', content: result.text || 'Here is your image.', imageUri: uri },
      ]);
      setQuestion('');
    } catch (error: any) {
      setAttachmentError(error.message || 'Could not generate the image.');
    } finally {
      setBusy(false);
    }
  }

  async function takePhoto() {
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        setAttachmentError('Allow camera access to take a photo.');
        return;
      }
      const taken = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        quality: 0.8,
      });
      if (taken.canceled) return;
      setAttachment(taken.assets[0]);
      setAttachmentKind('image');
      setAttachmentError('');
    } catch (error: any) {
      setAttachmentError(error.message || 'Could not open the camera.');
    }
  }

  async function loadChats() {
    try {
      const result = await api('/api/chats');
      setChats(Array.isArray(result.chats) ? result.chats : []);
      setHistoryError('');
    } catch (error: any) {
      setHistoryError(error.message || 'Could not load chat history.');
    }
  }

  useEffect(() => { loadChats(); }, []);

  function newChat() {
    if (busy) return;
    setChatId('');
    setMessages([welcome]);
    setQuestion('');
  }

  async function openChat(id: string) {
    if (busy) return;
    setBusy(true);
    setHistoryError('');

    try {
      const result = await api(
        '/api/chats/' + encodeURIComponent(id)
      );
      const savedMessages = result.chat?.messages;
      setChatId(id);
      setMessages(
        Array.isArray(savedMessages) && savedMessages.length
          ? savedMessages
          : [welcome]
      );
      setQuestion('');
    } catch (error: any) {
      setHistoryError(error.message || 'Could not open chat.');
    } finally {
      setBusy(false);
    }
  }

  async function send() {
    if (busy || (!question.trim() && !attachment)) return;

    const selectedAttachment = attachment;
    const selectedKind = attachmentKind;

    const q = question.trim() || (
      selectedKind === 'image'
        ? 'Please explain this photo.'
        : 'Please summarize this file.'
    );

    const attachmentName = selectedAttachment
      ? (
          selectedKind === 'image'
            ? (selectedAttachment as ImagePicker.ImagePickerAsset).fileName || (selectedAttachment as DocumentPicker.DocumentPickerAsset).name
            : (selectedAttachment as DocumentPicker.DocumentPickerAsset).name
        ) || (selectedKind === 'image' ? 'Camera photo' : 'Study file')
      : '';

    const streamId = 'stream-' + Date.now();

    setMessages(current => [
      ...current,
      {
        id: 'user-' + Date.now(),
        role: 'user',
        content: selectedAttachment
          ? q + '\nAttached: ' + attachmentName
          : q,
      },
      {
        id: streamId,
        role: 'assistant',
        content: '',
        streaming: true,
      },
    ]);

    setQuestion('');
    setAttachment(null);
    setAttachmentKind(null);
    setBusy(true);
    setAttachmentError('');

    try {
      const form = new FormData();
      form.append('question', q);
      form.append('provider', 'gemini');

      if (chatId) {
        form.append('chatId', chatId);
      }

      if (selectedAttachment && selectedKind) {
        const name = attachmentName ||
          (selectedKind === 'image' ? 'camera.jpg' : 'lesson.pdf');

        const mime = selectedAttachment.mimeType ||
          (selectedKind === 'image'
            ? 'image/jpeg'
            : 'application/octet-stream');

        await attachUploadFile(form, selectedKind, { ...selectedAttachment, name, mimeType: mime });
      }

      const result = await api('/api/chat', {
        method: 'POST',
        body: form,
      });

      setChatId(result.chatId || '');

      const completeAnswer = cleanAIText(
        String(result.answer || 'No response was returned.')
      );

      const words = completeAnswer.match(/\S+\s*/g) ||
        [completeAnswer];

      let visibleAnswer = '';

      for (let index = 0; index < words.length; index += 3) {
        visibleAnswer += words.slice(index, index + 3).join('');

        setMessages(current =>
          current.map(message =>
            message.id === streamId
              ? {
                  ...message,
                  content: visibleAnswer,
                  streaming: true,
                }
              : message
          )
        );

        await new Promise(resolve => setTimeout(resolve, 18));
      }

      setMessages(current =>
        current.map(message =>
          message.id === streamId
            ? {
                ...message,
                content: completeAnswer,
                streaming: false,
              }
            : message
        )
      );

      await loadChats();
    } catch (error: any) {
      const errorMessage =
        error.message || 'Could not send to STUDYante AI.';

      setMessages(current =>
        current.map(message =>
          message.id === streamId
            ? {
                ...message,
                content: errorMessage,
                streaming: false,
                error: true,
              }
            : message
        )
      );

      setAttachmentError(errorMessage);
    } finally {
      setBusy(false);
    }
  }
  async function deleteChat(id: string) {
    if (busy) return;

    async function remove() {
      try {
        await api('/api/chats/' + encodeURIComponent(id), {
          method: 'DELETE',
        });
        if (chatId === id) {
          setChatId('');
          setMessages([welcome]);
        }
        await loadChats();
      } catch (error: any) {
        setHistoryError(error.message || 'Could not delete chat.');
      }
    }

    if (Platform.OS === 'web') {
      if (window.confirm('Delete this chat?')) await remove();
    } else {
      Alert.alert('Delete chat?', 'This chat will be removed.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: remove },
      ]);
    }
  }

  return (
    <Page title="STUDYante AI" sub="Ask questions, upload lessons, and continue previous chats.">
      <View style={{
        flexDirection: compact ? 'column' : 'row',
        flexWrap: 'wrap',
        alignItems: 'stretch',
        gap: 14,
        marginTop: 18,
        width: '100%',
      }}>
        {historyOpen && (
          <View style={{
            width: compact ? '100%' : 270,
            maxWidth: '100%',
            flexGrow: 0,
            flexShrink: 1,
            height: compact ? Math.min(300, chatHeight) : chatHeight,
            backgroundColor: C.white,
            borderWidth: 1,
            borderColor: C.line,
            borderRadius: 18,
            padding: 12,
          }}>
            <Pressable
              style={[s.primary, {
                width: '100%',
                maxWidth: undefined,
                marginTop: 0,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
              }]}
              onPress={newChat}
            >
              <Ionicons name="add" size={20} color={C.white} />
              <Text style={s.primaryText}>New Chat</Text>
            </Pressable>

            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginTop: 18,
              marginBottom: 8,
              paddingHorizontal: 5,
            }}>
              <Text style={s.cardTitle}>Chat History</Text>

              <Pressable
                onPress={loadChats}
                accessibilityLabel="Refresh chat history"
                style={{ padding: 7 }}
              >
                <Ionicons name="refresh" size={19} color={C.blue} />
              </Pressable>
            </View>

            {!!historyError && <Notice text={historyError} />}

            <ScrollView
              nestedScrollEnabled
              showsVerticalScrollIndicator={false}
              style={{ flex: 1 }}
            >
              {chats.length === 0 && (
                <Text style={{
                  color: C.muted,
                  textAlign: 'center',
                  marginTop: 24,
                }}>
                  No previous chats
                </Text>
              )}

              {chats.map((chat: any) => (
                <View
                  key={chat.id}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    borderBottomWidth: 1,
                    borderBottomColor: C.line,
                  }}
                >
                  <Pressable
                    onPress={() => {
                      setHistoryOpen(false);
                      openChat(chat.id);
                    }}
                    style={{
                      flex: 1,
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 9,
                      paddingVertical: 13,
                      paddingHorizontal: 5,
                    }}
                  >
                    <Ionicons
                      name="chatbubble-outline"
                      size={18}
                      color={C.blue}
                    />

                    <Text
                      style={{ color: C.ink, flex: 1 }}
                      numberOfLines={1}
                    >
                      {chat.title || 'Conversation'}
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={() => deleteChat(chat.id)}
                    accessibilityLabel="Delete chat"
                    style={{ padding: 10 }}
                  >
                    <Ionicons
                      name="trash-outline"
                      size={18}
                      color={C.red}
                    />
                  </Pressable>
                </View>
              ))}
            </ScrollView>
          </View>
        )}

        <View style={{
          flex: compact ? undefined : 1,
          flexGrow: 1,
          flexBasis: compact ? undefined : 0,
          width: compact ? '100%' : undefined,
          minWidth: 0,
          maxWidth: '100%',
          height: chatHeight,
          backgroundColor: C.white,
          borderWidth: 1,
          borderColor: C.line,
          borderRadius: 18,
          overflow: 'hidden',
        }}>
          <View style={{
            minHeight: 62,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 14,
            paddingVertical: 10,
            borderBottomWidth: 1,
            borderBottomColor: C.line,
          }}>
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 10,
              flex: 1,
            }}>
              <Pressable
                onPress={() => setHistoryOpen(value => !value)}
                accessibilityLabel="Open chat history"
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 12,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: C.softBlue,
                }}
              >
                <Ionicons
                  name={historyOpen ? 'close' : 'menu'}
                  size={23}
                  color={C.blue}
                />
              </Pressable>

              <View style={{ flex: 1 }}>
                <Text style={s.cardTitle}>STUDYante AI</Text>
                <Text
                  style={{ color: C.muted, fontSize: 12 }}
                  numberOfLines={1}
                >
                  Your study assistant
                </Text>
              </View>
            </View>

            <Pressable
              onPress={newChat}
              accessibilityLabel="Start new chat"
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: C.blue,
              }}
            >
              <Ionicons name="add" size={24} color={C.white} />
            </Pressable>
          </View>

          {!!historyError && !historyOpen && (
            <View style={{ paddingHorizontal: 14, paddingTop: 8 }}>
              <Notice text={historyError} />
            </View>
          )}

          <ScrollView
            nestedScrollEnabled
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{
              flexGrow: 1,
              paddingHorizontal: 14,
              paddingVertical: 18,
            }}
            style={{ flex: 1 }}
          >
            {messages.length === 0 && (
              <View style={{
                flex: 1,
                minHeight: 300,
                alignItems: 'center',
                justifyContent: 'center',
                padding: 24,
              }}>
                <View style={{
                  width: 58,
                  height: 58,
                  borderRadius: 18,
                  backgroundColor: C.softBlue,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <Ionicons
                    name="school-outline"
                    size={30}
                    color={C.blue}
                  />
                </View>

                <Text style={[s.section, {
                  marginTop: 16,
                  marginBottom: 6,
                  textAlign: 'center',
                }]}>
                  How can I help you study?
                </Text>

                <Text style={{
                  color: C.muted,
                  textAlign: 'center',
                  lineHeight: 20,
                  maxWidth: 430,
                }}>
                  Ask a question or upload a file, document, or picture.
                </Text>
              </View>
            )}

            {messages.map((message, index) => (
              <View
                key={message.id || index}
                style={{
                  width: '100%',
                  flexDirection: 'row',
                  justifyContent:
                    message.role === 'user' ? 'flex-end' : 'flex-start',
                  marginBottom: 16,
                }}
              >
                {message.role !== 'user' && (
                  <View style={{
                    width: 34,
                    height: 34,
                    borderRadius: 11,
                    marginRight: 9,
                    backgroundColor: C.blue,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    <Ionicons
                      name="school-outline"
                      size={19}
                      color={C.white}
                    />
                  </View>
                )}

                <View style={{
                  maxWidth: '82%',
                  minWidth: 0,
                  flexShrink: 1,
                  paddingHorizontal: 15,
                  paddingVertical: 12,
                  borderRadius: 18,
                  backgroundColor:
                    message.role === 'user' ? C.blue : C.softBlue,
                  borderBottomRightRadius:
                    message.role === 'user' ? 5 : 18,
                  borderBottomLeftRadius:
                    message.role === 'user' ? 18 : 5,
                }}>
                  {!!message.imageUri && (
                    <Image
                      source={{ uri: message.imageUri }}
                      style={{
                        width: 240,
                        maxWidth: '100%',
                        height: 220,
                        borderRadius: 12,
                        marginBottom: 10,
                      }}
                      resizeMode="contain"
                    />
                  )}

                  {message.role === 'user' ? (
                    <Text style={{
                      color: C.white,
                      fontSize: 15,
                      lineHeight: 22,
                    }}>
                      {cleanAIText(message.content)}
                    </Text>
                  ) : (
                    <Markdown
                      style={{
                        body: {
                          color: C.ink,
                          fontSize: 15,
                          lineHeight: 23,
                        },
                        heading1: {
                          color: C.navy,
                          fontSize: 23,
                          fontWeight: '900',
                          marginTop: 14,
                          marginBottom: 8,
                        },
                        heading2: {
                          color: C.navy,
                          fontSize: 20,
                          fontWeight: '900',
                          marginTop: 13,
                          marginBottom: 7,
                        },
                        heading3: {
                          color: C.navy,
                          fontSize: 17,
                          fontWeight: '800',
                          marginTop: 11,
                          marginBottom: 6,
                        },
                        paragraph: {
                          color: C.ink,
                          fontSize: 15,
                          lineHeight: 23,
                          marginTop: 3,
                          marginBottom: 9,
                        },
                        strong: {
                          color: C.ink,
                          fontWeight: '900',
                        },
                        bullet_list: {
                          marginTop: 4,
                          marginBottom: 9,
                        },
                        ordered_list: {
                          marginTop: 4,
                          marginBottom: 9,
                        },
                        list_item: {
                          color: C.ink,
                          marginBottom: 5,
                        },
                        link: {
                          color: C.blue,
                          textDecorationLine: 'underline',
                        },
                        code_inline: {
                          color: C.ink,
                          backgroundColor: C.white,
                          borderRadius: 5,
                          paddingHorizontal: 5,
                        },
                        fence: {
                          color: C.ink,
                          backgroundColor: C.white,
                          borderWidth: 1,
                          borderColor: C.line,
                          borderRadius: 10,
                          padding: 12,
                          marginVertical: 8,
                        },
                      }}
                    >
                      {String(message.content || '')}
                    </Markdown>
                  )}
                </View>
              </View>
            ))}

            {messages.length === 1 && messages[0].content === welcome.content && !busy && (
              <View style={{ gap: 10, marginTop: 8 }}>
                <Text style={s.promptLabel}>START WITH A LITTLE CURIOSITY</Text>
                {[
                  ['bulb-outline', 'Explain something simply', 'Help me understand a topic. Ask me what I am studying, then explain it simply with an example.'],
                  ['albums-outline', 'Turn a lesson into flashcards', 'Help me make flashcards. Ask me to share my lesson or topic first.'],
                  ['help-circle-outline', 'Quiz me on what I know', 'Quiz me on a topic. Ask me what subject and difficulty I want first.'],
                ].map(([icon, label, prompt]) => (
                  <Pressable key={label} accessibilityRole="button" onPress={() => setQuestion(prompt)} style={({ pressed }) => [s.promptCard, pressed && s.pressed]}>
                    <View style={s.promptIcon}><Ionicons name={icon as any} size={20} color={C.blue} /></View>
                    <Text style={[s.cardTitle, { flex: 1, minWidth: 0 }]}>{label}</Text>
                    <Ionicons name="arrow-forward" size={17} color={C.blue} />
                  </Pressable>
                ))}
              </View>
            )}

            {busy && (
              <View style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 9,
                marginBottom: 12,
              }}>
                <View style={{
                  width: 34,
                  height: 34,
                  borderRadius: 11,
                  backgroundColor: C.blue,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <Ionicons
                    name="school-outline"
                    size={19}
                    color={C.white}
                  />
                </View>

                <ActivityIndicator color={C.blue} />
              </View>
            )}
          </ScrollView>

          {!!attachmentError && (
            <View style={{ paddingHorizontal: 12 }}>
              <Notice text={attachmentError} />
            </View>
          )}

          {!!attachment && (
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              marginHorizontal: 12,
              marginBottom: 7,
              paddingHorizontal: 12,
              paddingVertical: 9,
              backgroundColor: C.softBlue,
              borderRadius: 12,
            }}>
              <Ionicons
                name={attachmentKind === 'image'
                  ? 'image-outline'
                  : 'document-outline'}
                size={20}
                color={C.blue}
              />

              <Text
                style={{
                  color: C.ink,
                  flex: 1,
                  marginHorizontal: 8,
                }}
                numberOfLines={1}
              >
                {(attachmentKind === 'image'
                  ? (attachment as ImagePicker.ImagePickerAsset).fileName
                  : (attachment as DocumentPicker.DocumentPickerAsset).name
                ) || 'Camera photo'}
              </Text>

              <Pressable
                onPress={() => {
                  setAttachment(null);
                  setAttachmentKind(null);
                }}
                accessibilityLabel="Remove attachment"
              >
                <Ionicons
                  name="close-circle"
                  size={23}
                  color={C.red}
                />
              </Pressable>
            </View>
          )}

          <View style={{
            position: 'relative',
            zIndex: 30,
            paddingHorizontal: 12,
            paddingTop: 8,
            paddingBottom: 12,
            borderTopWidth: 1,
            borderTopColor: C.line,
          }}>
            {menuOpen && (
              <View style={{
                position: 'absolute',
                left: 12,
                bottom: 74,
                width: 235,
                maxWidth: '90%',
                padding: 7,
                borderRadius: 16,
                backgroundColor: C.white,
                borderWidth: 1,
                borderColor: C.line,
                elevation: 10,
                zIndex: 40,
              }}>
                <Pressable
                  onPress={() => {
                    setMenuOpen(false);
                    attachFile();
                  }}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 11,
                    padding: 12,
                    borderRadius: 11,
                  }}
                >
                  <Ionicons
                    name="document-attach-outline"
                    size={22}
                    color={C.blue}
                  />
                  <View style={{flex:1}}><Text style={s.cardTitle}>Upload document</Text><Text style={{color:C.muted,fontSize:11,marginTop:3}}>PDF, Word, PowerPoint or TXT</Text></View>
                </Pressable>

                <Pressable accessibilityRole="button" accessibilityLabel="Choose photo" onPress={()=>{setMenuOpen(false);attachFile('image');}} style={{flexDirection:'row',alignItems:'center',gap:11,padding:12,borderRadius:11}}><Ionicons name="images-outline" size={22} color={C.blue}/><Text style={s.cardTitle}>Choose photo</Text></Pressable>

                <Pressable
                  onPress={() => {
                    setMenuOpen(false);
                    takePhoto();
                  }}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 11,
                    padding: 12,
                    borderRadius: 11,
                  }}
                >
                  <Ionicons
                    name="camera-outline"
                    size={22}
                    color={C.blue}
                  />
                  <Text style={s.cardTitle}>Camera</Text>
                </Pressable>

                <Pressable
                  onPress={() => {
                    setMenuOpen(false);
                    generateImage();
                  }}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 11,
                    padding: 12,
                    borderRadius: 11,
                  }}
                >
                  <Ionicons
                    name="image-outline"
                    size={22}
                    color={C.blue}
                  />
                  <Text style={s.cardTitle}>Generate Image</Text>
                </Pressable>
              </View>
            )}

            <View style={{
              width: '100%',
              minHeight: 56,
              maxHeight: 130,
              flexDirection: 'row',
              alignItems: 'center',
              paddingHorizontal: 7,
              paddingVertical: 6,
              borderRadius: 20,
              borderWidth: 1,
              borderColor: C.line,
              backgroundColor: C.softBlue,
            }}>
              <Pressable
                onPress={() => setMenuOpen(value => !value)}
                accessibilityLabel={
                  menuOpen ? 'Close AI actions' : 'Open AI actions'
                }
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 21,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons
                  name={menuOpen ? 'close' : 'add'}
                  size={26}
                  color={C.blue}
                />
              </Pressable>

              <TextInput
                style={{
                  flex: 1,
                  minWidth: 0,
                  minHeight: 42,
                  maxHeight: 110,
                  paddingHorizontal: 7,
                  paddingVertical: 10,
                  color: C.ink,
                  fontSize: 15,
                }}
                placeholder="Message STUDYante AI..."
                placeholderTextColor={C.muted}
                value={question}
                onChangeText={setQuestion}
                multiline
                submitBehavior="submit"
                onSubmitEditing={() => {
                  if (!busy && (question.trim() || attachment)) {
                    send();
                  }
                }}
              />

              <Pressable
                onPress={send}
                disabled={busy || (!question.trim() && !attachment)}
                accessibilityLabel="Send message"
                style={{
                  width: 43,
                  height: 43,
                  borderRadius: 22,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: C.blue,
                  opacity:
                    busy || (!question.trim() && !attachment) ? 0.45 : 1,
                }}
              >
                <Ionicons
                  name="arrow-up"
                  size={23}
                  color={C.white}
                />
              </Pressable>
            </View>
          </View>
        </View>
      </View>
    </Page>
  );
}function Profile({
  user, admin, logout, go, api, updated, darkMode, toggleDarkMode,
}: {
  user: User;
  admin: boolean;
  logout: () => void;
  go: (screen: Screen) => void;
  api: any;
  darkMode: boolean;
  toggleDarkMode: () => void;
  updated: (user: User, token?: string) => void;
}) {
  const [settings, setSettings] = useState(false);
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [picture, setPicture] =
    useState<DocumentPicker.DocumentPickerAsset | null>(null);

  async function choosePicture() {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'image/*',
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (result.canceled) return;
      const image = result.assets[0];
      if (image.size && image.size > 3 * 1024 * 1024) {
        setMessage('Choose an image smaller than 3 MB.');
        return;
      }
      setPicture(image);
      setMessage('');
    } catch (error: any) {
      setMessage(error.message || 'Could not choose a picture.');
    }
  }

  async function saveProfile() {
    if (!name.trim() || !email.trim() || busy) return;
    setBusy(true);
    setMessage('');
    try {
      const form = new FormData();
      form.append('name', name.trim());
      form.append('email', email.trim());
      if (picture) {
        await attachUploadFile(form, 'profilePicture', { ...picture, mimeType: picture.mimeType || 'image/jpeg' });
      }

      const result = await api('/api/account/profile', {
        method: 'PATCH',
        body: form,
      });
      updated(result.user, result.token);
      setPicture(null);
      setMessage('Profile saved.');
    } catch (error: any) {
      setMessage(error.message || 'Could not save profile.');
    } finally {
      setBusy(false);
    }
  }

  async function changePassword() {
    if (!currentPassword || !newPassword || busy) {
      setMessage('Enter both passwords.');
      return;
    }
    setBusy(true);
    setMessage('');
    try {
      await api('/api/account/password', {
        method: 'PATCH',
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      setCurrentPassword('');
      setNewPassword('');
      setMessage('Password changed.');
    } catch (error: any) {
      setMessage(error.message || 'Could not change password.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Page title={settings ? 'Account Settings' : 'My Account'}
      sub={settings ? 'Update your STUDYante account.' : 'Your STUDYante profile.'}>
      <View style={[s.profile, settings && { alignItems: 'stretch' }]}>
        {settings ? (
          <>
            <Pressable onPress={() => {
              setSettings(false);
              setMessage('');
            }} style={{ alignSelf: 'flex-start', width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="arrow-back" size={24} color={C.blue} />
            </Pressable>

            <Text style={[s.cardTitle, { alignSelf: 'flex-start', marginTop: 12 }]}>
              Profile
            </Text>
            <Pressable onPress={choosePicture}
              style={{ alignSelf: 'center', alignItems: 'center', marginBottom: 18 }}>
              {picture?.uri || user.profilePicture ? (
                <Image source={{ uri: picture?.uri || user.profilePicture }}
                  style={s.bigAvatar} />
              ) : (
                <View style={s.bigAvatar}>
                  <Text style={s.bigAvatarText}>
                    {user.name.charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}
              <Text style={[s.outlineText, { marginTop: 10 }]}>
                Change Profile Picture
              </Text>
            </Pressable>
            <TextInput style={[s.input, { width: '100%', maxWidth: 420, alignSelf: 'center' }]} value={name}
              onChangeText={setName} placeholder="Name" />
            <TextInput style={[s.input, { width: '100%', maxWidth: 420, alignSelf: 'center' }]} value={email}
              onChangeText={setEmail} placeholder="Email"
              autoCapitalize="none" keyboardType="email-address" />
            <Pressable style={[s.primary, { width: '100%', maxWidth: 420, alignSelf: 'center' }]} disabled={busy}
              onPress={saveProfile}>
              <Text style={s.primaryText}>Save Profile</Text>
            </Pressable>

            <Text style={[s.cardTitle, { alignSelf: 'flex-start', marginTop: 28 }]}>
              Change Password
            </Text>
            <TextInput style={[s.input, { width: '100%', maxWidth: 420, alignSelf: 'center' }]} value={currentPassword}
              onChangeText={setCurrentPassword}
              placeholder="Current password" secureTextEntry />
            <TextInput style={[s.input, { width: '100%', maxWidth: 420, alignSelf: 'center' }]} value={newPassword}
              onChangeText={setNewPassword}
              placeholder="New password" secureTextEntry />
            <Pressable style={[s.primary, { width: '100%', maxWidth: 420, alignSelf: 'center' }]} disabled={busy}
              onPress={changePassword}>
              <Text style={s.primaryText}>Change Password</Text>
            </Pressable>
          </>
        ) : (
          <>
            {user.profilePicture ? (
              <Image source={{ uri: user.profilePicture }}
                style={s.bigAvatar} />
            ) : (
              <View style={s.bigAvatar}>
                <Text style={s.bigAvatarText}>
                  {user.name.charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
            <Text style={s.profileName}>{user.name}</Text>
            <Text style={s.profileEmail}>{user.email}</Text>

            {admin && (
              <Pressable style={s.outline} onPress={() => go('admin')}>
                <Text style={s.outlineText}>Open Admin Dashboard</Text>
              </Pressable>
            )}

            <Pressable style={s.outline}
              onPress={() => setSettings(true)}>
              <Text style={s.outlineText}>⚙ Account Settings</Text>
            </Pressable>
            <Pressable style={s.outline} onPress={toggleDarkMode}>
              <Text style={s.outlineText}>
                {darkMode ? '☀ Light Mode' : '☾ Dark Mode'}
              </Text>
            </Pressable>
            <Pressable style={s.logout} onPress={logout}>
              <Text style={s.logoutText}>Log out</Text>
            </Pressable>
          </>
        )}

        {!!message && (
          <Text style={[s.cardText, { marginTop: 14 }]}>
            {message}
          </Text>
        )}
      </View>
    </Page>
  );
}
function presenceDuration(seconds: number) {
  const value = Math.max(0, Math.floor(seconds));
  if (value < 60) return `${value} second${value === 1 ? '' : 's'}`;
  if (value < 3600) { const minutes = Math.floor(value / 60); return `${minutes} minute${minutes === 1 ? '' : 's'}`; }
  const hours = Math.floor(value / 3600); return `${hours} hour${hours === 1 ? '' : 's'}`;
}
function Admin({ api }: { api: any }) {
  const [tab, setTab] =
    useState<'overview' | 'users' | 'materials' | 'announcements' | 'logs'>(
      'overview',
    );

  const [stats, setStats] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [materials, setMaterials] = useState<any[]>([]);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);

  const [announcementTitle, setAnnouncementTitle] = useState('');
  const [announcementMessage, setAnnouncementMessage] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [presenceNow, setPresenceNow] = useState(Date.now());

  useEffect(() => {
    if (tab !== 'users') return;
    loadUsers();
    const timer = setInterval(() => { setPresenceNow(Date.now()); loadUsers(); }, 15000);
    return () => clearInterval(timer);
  }, [tab]);

  async function confirmAction(text: string) {
    if (Platform.OS === 'web') {
      return window.confirm(text);
    }

    return new Promise<boolean>(resolve => {
      Alert.alert(
        'Confirm Action',
        text,
        [
          {
            text: 'Cancel',
            style: 'cancel',
            onPress: () => resolve(false),
          },
          {
            text: 'Continue',
            style: 'destructive',
            onPress: () => resolve(true),
          },
        ],
      );
    });
  }

  async function loadOverview() {
    try {
      const data =
        await api('/api/admin/dashboard');

      setStats(data.stats);
    } catch (error: any) {
      setMessage(error.message);
    }
  }

  async function loadUsers() {
    try {
      const data =
        await api('/api/admin/users');

      setUsers(data.users || []);
      setPresenceNow(Date.now());
    } catch (error: any) {
      setMessage(error.message);
    }
  }

  async function loadMaterials() {
    try {
      const data =
        await api('/api/admin/materials');

      setMaterials(data.materials || []);
    } catch (error: any) {
      setMessage(error.message);
    }
  }

  async function loadAnnouncements() {
    try {
      const data =
        await api('/api/announcements');

      setAnnouncements(
        data.announcements || [],
      );
    } catch (error: any) {
      setMessage(error.message);
    }
  }

  async function loadLogs() {
    try {
      const data =
        await api('/api/admin/logs');

      setLogs(data.logs || []);
    } catch (error: any) {
      setMessage(error.message);
    }
  }

  async function refreshAdmin() {
    setBusy(true);
    setMessage('');

    await Promise.all([
      loadOverview(),
      loadUsers(),
      loadMaterials(),
      loadAnnouncements(),
      loadLogs(),
    ]);

    setBusy(false);
  }

  useEffect(() => {
    refreshAdmin();
  }, []);

  async function suspendUser(user: any) {
    const action =
      user.suspended
        ? 'unsuspend'
        : 'suspend';

    const confirmed =
      await confirmAction(
        `Do you want to ${action} ${user.name}?`,
      );

    if (!confirmed) {
      return;
    }

    try {
      setBusy(true);

      const data =
        await api(
          `/api/admin/users/${encodeURIComponent(
            user.id,
          )}/suspension`,
          {
            method: 'PATCH',
            body: JSON.stringify({
              suspended:
                !user.suspended,
            }),
          },
        );

      setMessage(data.message);
      await loadUsers();
      await loadOverview();
    } catch (error: any) {
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  }

  async function deleteUser(user: any) {
    const confirmed =
      await confirmAction(
        `Delete ${user.name}'s account? This cannot be undone.`,
      );

    if (!confirmed) {
      return;
    }

    try {
      setBusy(true);

      const data =
        await api(
          `/api/admin/users/${encodeURIComponent(
            user.id,
          )}`,
          {
            method: 'DELETE',
          },
        );

      setMessage(data.message);
      await loadUsers();
      await loadOverview();
    } catch (error: any) {
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  }

  async function deleteMaterial(material: any) {
    const title =
      material.name ||
      material.title ||
      'this material';

    const confirmed =
      await confirmAction(
        `Delete "${title}"?`,
      );

    if (!confirmed) {
      return;
    }

    try {
      setBusy(true);

      const data =
        await api(
          `/api/admin/materials/${encodeURIComponent(
            material.adminType,
          )}/${encodeURIComponent(
            material.id,
          )}`,
          {
            method: 'DELETE',
          },
        );

      setMessage(data.message);
      await loadMaterials();
      await loadOverview();
    } catch (error: any) {
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  }

  async function unpublishMaterial(
    material: any,
  ) {
    const confirmed =
      await confirmAction(
        'Remove this material from Community Notes?',
      );

    if (!confirmed) {
      return;
    }

    try {
      setBusy(true);

      const data =
        await api(
          `/api/admin/materials/${encodeURIComponent(
            material.adminType,
          )}/${encodeURIComponent(
            material.id,
          )}/unpublish`,
          {
            method: 'PATCH',
          },
        );

      setMessage(data.message);
      await loadMaterials();
    } catch (error: any) {
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  }

  async function createAnnouncement() {
    if (
      !announcementTitle.trim() ||
      !announcementMessage.trim()
    ) {
      setMessage(
        'Enter the announcement title and message.',
      );

      return;
    }

    try {
      setBusy(true);

      const data =
        await api(
          '/api/admin/announcements',
          {
            method: 'POST',
            body: JSON.stringify({
              title:
                announcementTitle.trim(),
              message:
                announcementMessage.trim(),
            }),
          },
        );

      setAnnouncementTitle('');
      setAnnouncementMessage('');
      setMessage(data.message);

      await loadAnnouncements();
      await loadOverview();
    } catch (error: any) {
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  }

  async function deleteAnnouncement(
    announcement: any,
  ) {
    const confirmed =
      await confirmAction(
        `Delete "${announcement.title}"?`,
      );

    if (!confirmed) {
      return;
    }

    try {
      setBusy(true);

      const data =
        await api(
          `/api/admin/announcements/${encodeURIComponent(
            announcement.id,
          )}`,
          {
            method: 'DELETE',
          },
        );

      setMessage(data.message);

      await loadAnnouncements();
      await loadOverview();
    } catch (error: any) {
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  }

  const tabs = [
    ['overview', 'Overview'],
    ['users', 'Users'],
    ['materials', 'Materials'],
    ['announcements', 'Announcements'],
    ['logs', 'Activity Logs'],
  ] as const;

  return (
    <Page
      title="Admin"
      sub="Private owner dashboard."
      refresh={refreshAdmin}
    >
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={s.adminTabs}
        contentContainerStyle={s.adminTabsContent}
      >
        {tabs.map(([id, label]) => (
          <Pressable
            key={id}
            style={[
              s.adminTab,
              tab === id &&
                s.adminTabActive,
            ]}
            onPress={() => setTab(id)}
          >
            <Text
              style={[
                s.adminTabText,
                tab === id &&
                  s.adminTabTextActive,
              ]}
            >
              {label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {!!message && (
        <Notice text={message} />
      )}

      {busy && (
        <ActivityIndicator
          color={C.blue}
          style={{
            marginVertical: 15,
          }}
        />
      )}

      {tab === 'overview' && (
        <>
          {!stats ? (
            <ActivityIndicator
              color={C.blue}
            />
          ) : (
            <View style={s.stats}>
              {Object.entries(stats).map(
                ([key, value]) => (
                  <View
                    key={key}
                    style={s.stat}
                  >
                    <Text
                      style={s.statNumber}
                    >
                      {String(value)}
                    </Text>

                    <Text
                      style={s.statLabel}
                    >
                      {key}
                    </Text>
                  </View>
                ),
              )}
            </View>
          )}

          <Notice text="Only your owner email can access these controls." />
        </>
      )}

      {tab === 'users' && (
        <View>
          <Pressable accessibilityRole="button" disabled={busy} style={[s.adminResetButton, busy && { opacity: 0.5 }]} onPress={async () => { setBusy(true); try { const result = await api('/api/admin/email-status'); setMessage(result.message); } catch (e: any) { setMessage(e.message); } finally { setBusy(false); } }}><Text style={s.adminResetButtonText}>Check reset email service</Text></Pressable>
          {users.length === 0 ? (
            <Empty text="No users found." />
          ) : (
            users.map(user => (
              <View
                key={user.id}
                style={s.adminItem}
              >
                <Pressable accessibilityRole="button" accessibilityLabel={`Send password reset to ${user.name}`} disabled={busy} style={[s.adminResetButton, busy && { opacity: 0.5 }]} onPress={async () => { if (!(await confirmAction(`Send a password reset code to ${user.email}? The user chooses their own new password.`))) return; setBusy(true); try { const result = await api(`/api/admin/users/${encodeURIComponent(user.id)}/password-reset`, { method: 'POST', body: '{}' }); setMessage(result.message); } catch (e: any) { setMessage(e.message); } finally { setBusy(false); } }}><Text style={s.adminResetButtonText}>Send password reset</Text></Pressable>
                <View style={s.adminItemTop}>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={s.adminItemTitle}
                    >
                      {user.name}
                    </Text>

                    <Text
                      style={s.adminItemMeta}
                    >
                      {user.email}
                    </Text>

                    <Text style={[s.adminItemMeta, { color: user.online ? '#36765A' : C.muted }]}>
                      {user.online
                        ? `● Online · ${presenceDuration(user.onlineSeconds || 0)}`
                        : user.lastSeenAt
                          ? `○ Offline · Last seen ${presenceDuration((presenceNow - Date.parse(user.lastSeenAt)) / 1000)} ago`
                          : '○ Offline · No activity recorded yet'}
                    </Text>

                    <Text
                      style={s.adminStatus}
                    >
                      {user.suspended
                        ? 'Suspended'
                        : 'Active'}
                    </Text>
                  </View>
                </View>

                {!user.isAdmin && (
                  <View
                    style={s.adminActions}
                  >
                    <Pressable
                      style={s.adminWarning}
                      onPress={() =>
                        suspendUser(user)
                      }
                    >
                      <Text
                        style={
                          s.adminButtonText
                        }
                      >
                        {user.suspended
                          ? 'Unsuspend'
                          : 'Suspend'}
                      </Text>
                    </Pressable>

                    <Pressable
                      style={s.adminDanger}
                      onPress={() =>
                        deleteUser(user)
                      }
                    >
                      <Text
                        style={
                          s.adminButtonText
                        }
                      >
                        Delete
                      </Text>
                    </Pressable>
                  </View>
                )}
              </View>
            ))
          )}
        </View>
      )}

      {tab === 'materials' && (
        <View>
          {materials.length === 0 ? (
            <Empty text="No materials found." />
          ) : (
            materials.map(
              (material, index) => (
                <View
                  key={
                    material.id ||
                    index
                  }
                  style={s.adminItem}
                >
                  <Text
                    style={s.adminItemTitle}
                  >
                    {material.name ||
                      material.title ||
                      'Study material'}
                  </Text>

                  <Text
                    style={s.adminItemMeta}
                  >
                    Type:{' '}
                    {material.adminType}
                  </Text>

                  <Text
                    style={s.adminItemMeta}
                  >
                    Owner:{' '}
                    {material.owner?.name ||
                      'Unknown'}
                  </Text>

                  <Text
                    style={s.adminStatus}
                  >
                    Community:{' '}
                    {material.communityStatus ||
                      'private'}
                  </Text>

                  <View
                    style={s.adminActions}
                  >
                    {material.communityStatus ===
                      'approved' &&
                      material.adminType !==
                        'study-material' && (
                        <Pressable
                          style={
                            s.adminWarning
                          }
                          onPress={() =>
                            unpublishMaterial(
                              material,
                            )
                          }
                        >
                          <Text
                            style={
                              s.adminButtonText
                            }
                          >
                            Unpublish
                          </Text>
                        </Pressable>
                      )}

                    <Pressable
                      style={s.adminDanger}
                      onPress={() =>
                        deleteMaterial(
                          material,
                        )
                      }
                    >
                      <Text
                        style={
                          s.adminButtonText
                        }
                      >
                        Delete
                      </Text>
                    </Pressable>
                  </View>
                </View>
              ),
            )
          )}
        </View>
      )}

      {tab === 'announcements' && (
        <View>
          <View
            style={s.announcementForm}
          >
            <Text
              style={s.adminItemTitle}
            >
              Create Announcement
            </Text>

            <TextInput
              style={s.adminInput}
              placeholder="Announcement title"
              placeholderTextColor={C.muted}
              value={announcementTitle}
              onChangeText={
                setAnnouncementTitle
              }
            />

            <TextInput
              style={[
                s.adminInput,
                s.adminTextarea,
              ]}
              placeholder="Announcement message"
              placeholderTextColor={C.muted}
              multiline
              textAlignVertical="top"
              value={
                announcementMessage
              }
              onChangeText={
                setAnnouncementMessage
              }
            />

            <Pressable
              style={s.primary}
              onPress={createAnnouncement}
              disabled={busy}
            >
              <Text
                style={s.primaryText}
              >
                Publish Announcement
              </Text>
            </Pressable>
          </View>

          {announcements.map(
            announcement => (
              <View
                key={announcement.id}
                style={s.adminItem}
              >
                <Text
                  style={s.adminItemTitle}
                >
                  {announcement.title}
                </Text>

                <Text
                  style={s.adminMessage}
                >
                  {announcement.message}
                </Text>

                <Text
                  style={s.adminItemMeta}
                >
                  {announcement.createdAt
                    ? new Date(
                        announcement.createdAt,
                      ).toLocaleString()
                    : ''}
                </Text>

                <View
                  style={s.adminActions}
                >
                  <Pressable
                    style={s.adminDanger}
                    onPress={() =>
                      deleteAnnouncement(
                        announcement,
                      )
                    }
                  >
                    <Text
                      style={
                        s.adminButtonText
                      }
                    >
                      Delete
                    </Text>
                  </Pressable>
                </View>
              </View>
            ),
          )}
        </View>
      )}

      {tab === 'logs' && (
        <View>
          {logs.length === 0 ? (
            <Empty text="No activity logs found." />
          ) : (
            logs.map((log, index) => (
              <View
                key={log.id || index}
                style={s.adminItem}
              >
                <Text
                  style={s.adminItemTitle}
                >
                  {log.action ||
                    'Admin Activity'}
                </Text>

                <Text
                  style={s.adminItemMeta}
                >
                  Admin:{' '}
                  {log.adminName ||
                    log.adminEmail ||
                    'Owner'}
                </Text>

                <Text
                  style={s.adminItemMeta}
                >
                  {log.createdAt
                    ? new Date(
                        log.createdAt,
                      ).toLocaleString()
                    : ''}
                </Text>
              </View>
            ))
          )}
        </View>
      )}
    </Page>
  );
}
function Page({ title, sub, refresh, children }: any) { return <><View style={s.pageHead}><View style={{ flex: 1 }}><Text style={s.title}>{title}</Text><Text style={s.sub}>{sub}</Text></View>{refresh && <Pressable style={s.refresh} onPress={refresh}><Ionicons name="refresh" size={20} color={C.blue} /></Pressable>}</View>{children}</>; }
function Row({ icon, title, meta }: any) { return <View style={s.row}><View style={s.rowIcon}><Ionicons name={icon} size={22} color={C.blue} /></View><View style={{ flex: 1 }}><Text style={s.rowTitle}>{title}</Text><Text style={s.rowMeta}>{meta}</Text></View></View>; }
function Empty({ text }: { text: string }) { return <View style={s.empty}><Ionicons name="folder-open-outline" size={40} color={C.muted} /><Text style={s.emptyText}>{text}</Text></View>; }
function Notice({ text }: { text: string }) { return <View style={s.notice}><Ionicons name="information-circle-outline" size={20} color={C.blue} /><Text style={s.noticeText}>{text}</Text></View>; }
function Center({ text }: { text: string }) { return <SafeAreaView style={s.center}><ActivityIndicator size="large" color={C.blue} /><Text style={s.centerText}>{text}</Text></SafeAreaView>; }
function Nav({
  active,
  go,
  admin,
}: {
  active: Screen;
  go: (x: Screen) => void;
  admin: boolean;
}) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const tabs: [Screen, any, string][] = [
    ['dashboard', 'home', 'Today'],
    ['tasks', 'checkmark-circle', 'To-dos'],
    ['schedule', 'calendar', 'Week'],
    ['library', 'book', 'Desk'],
    ['friends', 'people', 'Circle'],
  ];

  return (
    <View style={[
      s.nav,
      {
        paddingBottom: Math.max(insets.bottom, 12),
        minHeight: 72 + Math.max(insets.bottom, 12),
      },
    ]}>
      {tabs.map(([id, icon, label]) => {
        const selected = active === id || (id === 'library' && ['upload', 'create', 'grades', 'ai', 'community'].includes(active));
        const isAI = false;

        if (isAI) {
          return (
            <Pressable
              key={id}
              style={s.navAiItem}
              onPress={() => go(id)}
              accessibilityLabel="Open STUDYante AI"
            >
              <View style={[
                s.navAiButton,
                selected && s.navAiButtonActive,
              ]}>
                <Ionicons
                  name="school"
                  size={28}
                  color={C.white}
                />
              </View>

              <Text style={[
                s.navAiLabel,
                selected && s.navActive,
              ]}>
                AI
              </Text>
            </Pressable>
          );
        }

        return (
          <Pressable
            key={id}
            style={s.navItem}
            onPress={() => go(id)}
          >
            <Ionicons
              name={selected ? icon : `${icon}-outline`}
              size={21}
              color={selected ? C.blue : C.muted}
            />

            <Text style={[
              s.navLabel,
              { fontSize: width < 360 ? 9 : 11 },
              selected && s.navActive,
            ]}>
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
let s: any = StyleSheet.create({
  homeLogo: {
    width: 235,
    height: 78,
    alignSelf: 'flex-start',
    marginLeft: 0,
    marginBottom: 18,
  },

  safe: { flex: 1, backgroundColor: C.white }, shell: { flex: 1, backgroundColor: C.bg }, content: { width: '100%', maxWidth: 900, alignSelf: 'center', padding: 20, paddingBottom: 135 }, center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg }, centerText: { marginTop: 14, color: C.muted },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }, logo: { width: 175, height: 52 }, avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: C.blue, alignItems: 'center', justifyContent: 'center' }, avatarText: { color: C.white, fontWeight: '900' },
  eyebrow: { color: '#1877F2', fontSize: 11, letterSpacing: 1.4, fontWeight: '900' }, title: { color: C.navy, fontSize: 29, fontWeight: '900', marginTop: 6 }, sub: { color: C.muted, fontSize: 14, lineHeight: 21, marginTop: 5 },
  hero: { backgroundColor: '#1548A6', borderRadius: 28, padding: 24, marginTop: 22, overflow: 'hidden' },
  heroOrbit: { position: 'absolute', width: 240, height: 240, borderRadius: 120, borderWidth: 38, borderColor: '#FFFFFF0D', top: -70, right: -100 },
  heroOrbitSmall: { position: 'absolute', width: 140, height: 140, borderRadius: 70, backgroundColor: '#5C8AFF25', bottom: -65, right: 30 },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  heroTag: { flex: 1, color: '#C7D9FF', fontSize: 10, lineHeight: 16, letterSpacing: 1.4, fontWeight: '800' },
  heroIcon: { width: 47, height: 47, borderRadius: 16, backgroundColor: '#F1765B', alignItems: 'center', justifyContent: 'center' },
  heroTitle: { color: C.white, fontSize: 32, lineHeight: 38, fontWeight: '900', marginTop: 22, letterSpacing: -0.8 },
  heroCopy: { color: '#DCE7FF', lineHeight: 22, marginTop: 10, maxWidth: 420 },
  heroButton: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 16, backgroundColor: C.white, borderRadius: 14, paddingHorizontal: 18, paddingVertical: 14, marginTop: 22 }, heroButtonText: { color: C.blue, fontWeight: '800' },
  sectionHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 28, marginBottom: 12 },
  pressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },
  cardArrow: { width: 32, height: 32, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  promptLabel: { color: C.muted, fontSize: 10, letterSpacing: 1.2, fontWeight: '800', marginBottom: 4 },
  promptCard: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, backgroundColor: C.white, borderWidth: 1, borderColor: C.line, borderRadius: 16 },
  promptIcon: { width: 36, height: 36, borderRadius: 12, backgroundColor: C.softBlue, alignItems: 'center', justifyContent: 'center' },
  section: { color: C.navy, fontSize: 19, fontWeight: '900', marginTop: 28, marginBottom: 12 }, grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 }, card: { minWidth: 250, width: '48%', flexGrow: 1, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.white, borderWidth: 1, borderColor: C.line, borderRadius: 18, padding: 15 }, cardIcon: { width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center' }, cardTitle: { color: C.ink, fontWeight: '800' }, cardText: { color: C.muted, fontSize: 12, marginTop: 3 },
  uploadCard: {
    alignItems: 'center',
    padding: 28,
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 22,
  },
  uploadIcon: {
    width: 82,
    height: 82,
    borderRadius: 24,
    backgroundColor: C.softBlue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadTitle: {
    color: C.navy,
    fontSize: 19,
    fontWeight: '900',
    textAlign: 'center',
    marginTop: 18,
  },
  uploadText: {
    color: C.muted,
    textAlign: 'center',
    lineHeight: 20,
    marginTop: 7,
    marginBottom: 4,
  },
  uploadMessage: {
    color: C.red,
    textAlign: 'center',
    marginTop: 14,
  },
  libraryButton: {
    padding: 12,
    marginTop: 4,
  },
  libraryButtonText: {
    color: C.blue,
    fontWeight: '800',
  },
  pageHead: { flexDirection: 'row', alignItems: 'center', marginBottom: 22 }, refresh: { width: 42, height: 42, borderRadius: 13, backgroundColor: C.softBlue, alignItems: 'center', justifyContent: 'center' }, row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 15, backgroundColor: C.white, borderWidth: 1, borderColor: C.line, borderRadius: 16, marginBottom: 10 }, rowIcon: { width: 44, height: 44, borderRadius: 13, backgroundColor: C.softBlue, alignItems: 'center', justifyContent: 'center' }, rowTitle: { color: C.ink, fontWeight: '800' }, rowMeta: { color: C.muted, fontSize: 12, marginTop: 4 },
  empty: { alignItems: 'center', padding: 35, backgroundColor: C.white, borderRadius: 18, borderWidth: 1, borderColor: C.line }, emptyText: { color: C.muted, lineHeight: 21, textAlign: 'center', marginTop: 12 }, notice: { flexDirection: 'row', gap: 9, padding: 14, backgroundColor: C.softBlue, borderRadius: 14, marginTop: 14 }, noticeText: { flex: 1, color: C.ink, lineHeight: 19 },
  chat: { gap: 10, minHeight: 300, backgroundColor: C.white, borderRadius: 18, borderWidth: 1, borderColor: C.line, padding: 14 }, bubble: { maxWidth: '84%', borderRadius: 16, padding: 12 }, aiBubble: { alignSelf: 'flex-start', backgroundColor: C.softBlue }, userBubble: { alignSelf: 'flex-end', backgroundColor: C.blue }, bubbleText: { color: C.ink, lineHeight: 20 }, composer: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12, backgroundColor: C.white, borderWidth: 1, borderColor: C.line, borderRadius: 18, padding: 6 }, composerInput: { flex: 1, minWidth: 0, minHeight: 42, maxHeight: 120, paddingHorizontal: 6, paddingVertical: 10, color: C.ink }, send: { width: 52, height: 52, borderRadius: 16, backgroundColor: C.red, alignItems: 'center', justifyContent: 'center' },
  profile: { alignItems: 'center', backgroundColor: C.white, borderWidth: 1, borderColor: C.line, borderRadius: 20, padding: 24 }, bigAvatar: { width: 82, height: 82, borderRadius: 41, backgroundColor: C.blue, alignItems: 'center', justifyContent: 'center' }, bigAvatarText: { color: C.white, fontSize: 30, fontWeight: '900' }, profileName: { color: C.navy, fontSize: 21, fontWeight: '900', marginTop: 15 }, profileEmail: { color: C.muted, marginTop: 5 }, badge: { flexDirection: 'row', gap: 7, backgroundColor: C.softRed, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 7, marginTop: 13 }, badgeText: { color: C.red, fontWeight: '800', fontSize: 12 }, outline: { width: '100%', maxWidth: 330, borderWidth: 1, borderColor: C.blue, borderRadius: 13, padding: 13, alignItems: 'center', marginTop: 24 }, outlineText: { color: C.blue, fontWeight: '800' }, logout: { width: '100%', maxWidth: 330, backgroundColor: C.softRed, borderRadius: 13, padding: 13, alignItems: 'center', marginTop: 10 }, logoutText: { color: C.red, fontWeight: '800' },
  adminTabs: {
    marginBottom: 16,
  },
  adminTabsContent: {
    gap: 8,
    paddingRight: 10,
  },
  adminTab: {
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: C.line,
  },
  adminTabActive: {
    backgroundColor: C.blue,
    borderColor: C.blue,
  },
  adminTabText: {
    color: C.muted,
    fontWeight: '800',
  },
  adminTabTextActive: {
    color: C.white,
  },
  adminItem: {
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 16,
    padding: 16,
    marginBottom: 11,
  },
  adminItemTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  adminItemTitle: {
    color: C.navy,
    fontSize: 16,
    fontWeight: '900',
  },
  adminItemMeta: {
    color: C.muted,
    fontSize: 12,
    marginTop: 5,
  },
  adminMessage: {
    color: C.ink,
    lineHeight: 20,
    marginTop: 9,
  },
  adminStatus: {
    color: C.blue,
    fontSize: 12,
    fontWeight: '800',
    marginTop: 7,
    textTransform: 'capitalize',
  },
  adminActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 14,
  },
  adminWarning: {
    backgroundColor: '#E39122',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  adminDanger: {
    backgroundColor: C.red,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  adminButtonText: {
    color: C.white,
    fontWeight: '900',
    fontSize: 12,
  },
  announcementForm: {
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 18,
    padding: 16,
    marginBottom: 16,
  },
  adminInput: {
    height: 50,
    backgroundColor: C.bg,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 12,
    paddingHorizontal: 14,
    color: C.ink,
    marginTop: 11,
  },
  adminTextarea: {
    height: 110,
    paddingTop: 13,
    marginBottom: 11,
  },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 }, stat: { minWidth: 120, flexGrow: 1, backgroundColor: C.white, borderWidth: 1, borderColor: C.line, borderRadius: 16, padding: 16 }, statNumber: { color: C.blue, fontSize: 25, fontWeight: '900' }, statLabel: { color: C.muted, textTransform: 'capitalize', marginTop: 4 },
  toolSectionTitle: {
    color: C.navy,
    fontSize: 18,
    fontWeight: '900',
    marginTop: 8,
    marginBottom: 12,
  },
  websiteToolNotice: {
    color: C.muted,
    lineHeight: 19,
    marginBottom: 14,
  },
  toolGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  toolCard: {
    width: '47%',
    minWidth: 140,
    flexGrow: 1,
    minHeight: 125,
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 18,
    padding: 16,
    justifyContent: 'center',
  },
  toolTitle: {
    color: C.navy,
    fontSize: 16,
    fontWeight: '900',
    marginTop: 10,
  },
  toolText: {
    color: C.muted,
    fontSize: 12,
    marginTop: 4,
  },
  toolPanel: {
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 20,
    padding: 18,
    marginBottom: 20,
  },
  toolBack: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginBottom: 18,
  },
  toolBackText: {
    color: C.blue,
    fontWeight: '800',
  },
  toolPanelTitle: {
    color: C.navy,
    fontSize: 21,
    fontWeight: '900',
    marginBottom: 15,
  },
  toolInput: {
    minHeight: 50,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 13,
    paddingHorizontal: 14,
    color: C.ink,
    marginBottom: 10,
  },
  noteInput: {
    minHeight: 220,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 14,
    padding: 14,
    color: C.ink,
    textAlignVertical: 'top',
    marginBottom: 12,
  },
  toolPrimary: {
    minHeight: 50,
    backgroundColor: C.blue,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  toolPrimaryText: {
    color: C.white,
    fontWeight: '900',
  },
  savedMessage: {
    color: C.blue,
    textAlign: 'center',
    marginTop: 12,
  },
  savedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 14,
    padding: 14,
    marginTop: 10,
  },
  savedCardQuestion: {
    color: C.navy,
    fontWeight: '900',
  },
  savedCardAnswer: {
    color: C.muted,
    marginTop: 5,
  },
  practiceCard: {
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 18,
    padding: 20,
  },
  practiceNumber: {
    color: C.muted,
    fontSize: 12,
  },
  practiceQuestion: {
    color: C.navy,
    fontSize: 21,
    fontWeight: '900',
    marginTop: 15,
    marginBottom: 18,
  },
  practiceAnswer: {
    color: C.blue,
    fontSize: 18,
    fontWeight: '800',
    backgroundColor: C.softBlue,
    borderRadius: 13,
    padding: 15,
    marginBottom: 15,
  },
  answerButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  answerButton: {
    flex: 1,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    paddingHorizontal: 8,
  },
  newChatButton: {
    alignSelf: 'flex-end',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    backgroundColor: C.white,
  },
  newChatText: {
    color: C.blue,
    fontWeight: '800',
  },
  nav: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: C.white,
    borderTopWidth: 1,
    borderTopColor: C.line,
    paddingTop: 10,
    overflow: 'visible',
  },
  navItem: {
    flex: 1,
    minWidth: 0,
    height: 58,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navAiItem: {
    flex: 1,
    minWidth: 58,
    height: 64,
    marginTop: -31,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  navAiButton: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: C.blue,
    borderWidth: 5,
    borderColor: C.bg,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 10,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 7,
  },
  navAiButtonActive: {
    backgroundColor: '#1877F2',
    transform: [{ scale: 1.06 }],
  },
  navAiLabel: {
    color: C.muted,
    fontSize: 11,
    fontWeight: '800',
    marginTop: 2,
  },
  navLabel: {
    color: C.muted,
    fontSize: 11,
    marginTop: 3,
    fontWeight: '700',
  },
  navActive: {
    color: C.blue,
  },
  adminResetButton: { alignSelf: 'flex-start', minHeight: 44, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, backgroundColor: C.blue, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  adminResetButtonText: { color: C.white, fontSize: 12, fontWeight: '700' },
  authSafe: { flex: 1, backgroundColor: C.bg }, authWrap: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 20 }, authCard: { width: '100%', maxWidth: 430, backgroundColor: C.white, borderRadius: 24, borderWidth: 1, borderColor: C.line, padding: 25 }, authLogo: { width: 210, height: 65, alignSelf: 'center' }, authTitle: { textAlign: 'center', color: C.navy, fontWeight: '900', fontSize: 25, marginTop: 15 }, authSub: { textAlign: 'center', color: C.muted, marginTop: 5, marginBottom: 20 }, input: { height: 52, borderRadius: 14, borderWidth: 1, borderColor: C.line, paddingHorizontal: 15, color: C.ink, marginBottom: 11, backgroundColor: '#FBFCFF' }, primary: { height: 52, borderRadius: 14, backgroundColor: C.blue, alignItems: 'center', justifyContent: 'center', marginTop: 4 }, primaryText: { color: C.white, fontWeight: '900' }, switchText: { color: C.blue, textAlign: 'center', fontWeight: '700', marginTop: 18 }, error: { color: C.red, marginBottom: 8, textAlign: 'center' },
});

const lightStyles = s;
const darkColors: Record<string, string> = {
  [C.white]: '#352920',
  [C.bg]: '#261D18',
  [C.softBlue]: '#4B3829',
  [C.softRed]: '#533A29',
  '#FBFCFF': '#352920',
};

const darkStyles: any = StyleSheet.create(
  Object.fromEntries(
    Object.entries(lightStyles).map(([name, original]) => {
      const style: Record<string, any> = { ...(original as object) };
      for (const key of Object.keys(style)) {
        const value = style[key];
        if (typeof value !== 'string') continue;

        if (key === 'backgroundColor' && darkColors[value]) {
          style[key] = darkColors[value];
        } else if (
          (key === 'borderColor' || key === 'borderTopColor') &&
          value === C.line
        ) {
          style[key] = '#594434';
        } else if (key === 'color') {
          if (value === C.navy || value === C.ink) {
            style[key] = '#FFF3DE';
          } else if (value === C.muted) {
            style[key] = '#C5B09A';
          } else if (value === C.blue) {
            style[key] = '#E2B481';
          }
        }
      }
      return [name, style];
    })
  ) as Record<string, any>
);





















































