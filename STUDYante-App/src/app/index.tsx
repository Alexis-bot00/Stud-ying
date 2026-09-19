import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Linking, Platform, Pressable, SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const API = 'https://stud-ying-production.up.railway.app';
const WEBSITE = 'https://alexis-bot00.github.io/Stud-ying/';
const C = { blue: '#185ABD', red: '#E53945', navy: '#14213D', ink: '#24324A', muted: '#73809A', bg: '#F3F6FC', white: '#FFFFFF', line: '#E3E8F2', softBlue: '#EAF1FF', softRed: '#FFF0F1' };
type User = { id: string; name: string; email: string };
type Screen = 'dashboard' | 'library' | 'community' | 'ai' | 'profile' | 'admin';

function savedToken() { return Platform.OS === 'web' && typeof window !== 'undefined' ? window.localStorage.getItem('studyingToken') || '' : ''; }
function saveToken(token: string) { if (Platform.OS !== 'web' || typeof window === 'undefined') return; token ? window.localStorage.setItem('studyingToken', token) : window.localStorage.removeItem('studyingToken'); }

export default function StudyanteApp() {
  const [token, setToken] = useState(savedToken);
  const [user, setUser] = useState<User | null>(null);
  const [admin, setAdmin] = useState(false);
  const [screen, setScreen] = useState<Screen>('dashboard');
  const [loading, setLoading] = useState(Boolean(token));

  async function api(path: string, options: RequestInit = {}) {
    const multipart = options.body instanceof FormData;
    const response = await fetch(`${API}${path}`, { ...options, headers: { ...(multipart ? {} : { 'Content-Type': 'application/json' }), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(options.headers || {}) } });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || 'Request failed.');
    return data;
  }

  useEffect(() => {
    if (!token) { setLoading(false); return; }
    Promise.all([api('/api/auth/me'), api('/api/admin/me')]).then(([me, owner]) => { setUser(me.user); setAdmin(owner.isAdmin === true); }).catch(() => { saveToken(''); setToken(''); }).finally(() => setLoading(false));
  }, [token]);

  if (loading) return <Center text="Opening STUDYante..." />;
  if (!token || !user) return <Auth done={(t, u) => { saveToken(t); setUser(u); setToken(t); }} />;
  const logout = () => { saveToken(''); setToken(''); setUser(null); setAdmin(false); };

  return <SafeAreaView style={s.safe}><StatusBar barStyle="dark-content" /><View style={s.shell}><ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
    <View style={s.header}><Image source={require('../../assets/images/studyante-logo.png')} style={s.logo} resizeMode="contain" /><View style={s.avatar}><Text style={s.avatarText}>{user.name.charAt(0).toUpperCase()}</Text></View></View>
    {screen === 'dashboard' && <Dashboard user={user} admin={admin} go={setScreen} />}
    {screen === 'library' && <Library api={api} />}
    {screen === 'community' && <Community api={api} />}
    {screen === 'ai' && <AI api={api} />}
    {screen === 'profile' && <Profile user={user} admin={admin} logout={logout} />}
    {screen === 'admin' && admin && <Admin api={api} />}
  </ScrollView><Nav active={screen} go={setScreen} admin={admin} /></View></SafeAreaView>;
}

function Auth({ done }: { done: (token: string, user: User) => void }) {
  const [register, setRegister] = useState(false), [name, setName] = useState(''), [email, setEmail] = useState(''), [password, setPassword] = useState(''), [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit() {
    if (!email.trim() || !password || (register && !name.trim())) return setMessage('Please complete all fields.');
    setBusy(true); setMessage('');
    try { const r = await fetch(`${API}/api/auth/${register ? 'register' : 'login'}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: name.trim(), email: email.trim(), password }) }); const d = await r.json().catch(() => ({})); if (!r.ok || !d.token) throw new Error(d.message || 'Could not continue.'); done(d.token, d.user); } catch (e: any) { setMessage(e.message); } finally { setBusy(false); }
  }
  return <SafeAreaView style={s.authSafe}><ScrollView contentContainerStyle={s.authWrap} keyboardShouldPersistTaps="handled"><View style={s.authCard}>
    <Image source={require('../../assets/images/studyante-logo.png')} style={s.authLogo} resizeMode="contain" /><Text style={s.authTitle}>{register ? 'Create your account' : 'Welcome back'}</Text><Text style={s.authSub}>Your personal study space</Text>
    {register && <TextInput style={s.input} placeholder="Full name" placeholderTextColor={C.muted} value={name} onChangeText={setName} />}
    <TextInput style={s.input} placeholder="Email address" placeholderTextColor={C.muted} autoCapitalize="none" value={email} onChangeText={setEmail} />
    <TextInput style={s.input} placeholder="Password" placeholderTextColor={C.muted} secureTextEntry value={password} onChangeText={setPassword} onSubmitEditing={submit} />
    {!!message && <Text style={s.error}>{message}</Text>}<Pressable style={s.primary} onPress={submit} disabled={busy}>{busy ? <ActivityIndicator color="white" /> : <Text style={s.primaryText}>{register ? 'Create Account' : 'Log In'}</Text>}</Pressable>
    <Pressable onPress={() => { setRegister(!register); setMessage(''); }}><Text style={s.switchText}>{register ? 'Already have an account? Log in' : 'New to STUDYante? Create an account'}</Text></Pressable>
  </View></ScrollView></SafeAreaView>;
}

function Dashboard({ user, admin, go }: { user: User; admin: boolean; go: (x: Screen) => void }) {
  return <><Text style={s.eyebrow}>STUDY SMARTER. LEARN BETTER.</Text><Text style={s.title}>Hello, {user.name.split(' ')[0]}!</Text><Text style={s.sub}>Upload lessons, create study materials, and learn with STUDYante AI.</Text>
    <View style={s.hero}><View style={s.heroIcon}><Ionicons name="sparkles" size={25} color={C.white} /></View><Text style={s.heroTitle}>Your study space is ready.</Text><Text style={s.heroCopy}>Your website and app now use the same STUDYante account and backend.</Text><Pressable style={s.heroButton} onPress={() => go('ai')}><Text style={s.heroButtonText}>Ask STUDYante AI</Text><Ionicons name="arrow-forward" size={18} color={C.blue} /></Pressable></View>
    <Text style={s.section}>Study tools</Text><View style={s.grid}>
      <Card icon="cloud-upload-outline" title="Upload Material" text="Add lessons and files" color={C.red} tap={() => Linking.openURL(WEBSITE)} />
      <Card icon="library-outline" title="My Library" text="Files and flashcards" color={C.blue} tap={() => go('library')} />
      <Card icon="globe-outline" title="Community Notes" text="Approved materials" color="#6E47C8" tap={() => go('community')} />
      <Card icon="chatbubble-ellipses-outline" title="STUDYante AI" text="Ask and review" color="#E18A20" tap={() => go('ai')} />
      {admin && <Card icon="shield-checkmark-outline" title="Admin" text="Private owner controls" color={C.navy} tap={() => go('admin')} />}
    </View></>;
}
function Card({ icon, title, text, color, tap }: any) { return <Pressable style={s.card} onPress={tap}><View style={[s.cardIcon, { backgroundColor: `${color}18` }]}><Ionicons name={icon} size={24} color={color} /></View><View style={{ flex: 1 }}><Text style={s.cardTitle}>{title}</Text><Text style={s.cardText}>{text}</Text></View><Ionicons name="chevron-forward" size={17} color={C.muted} /></Pressable>; }

function Library({ api }: { api: any }) {
  const [data, setData] = useState<any>({}), [busy, setBusy] = useState(true), [error, setError] = useState('');
  const load = () => { setBusy(true); api('/api/library').then(setData).catch((e: any) => setError(e.message)).finally(() => setBusy(false)); }; useEffect(load, []);
  const items = [...(data.files || []).map((x: any) => ({ ...x, kind: 'File' })), ...(data.flashcardSets || []).map((x: any) => ({ ...x, kind: 'Flashcards' })), ...(data.studyMaterials || []).map((x: any) => ({ ...x, kind: x.type || 'Study material' }))];
  return <Page title="My Library" sub="Your files, flashcards, notes, tests, and games." refresh={load}>{busy ? <ActivityIndicator color={C.blue} /> : error ? <Notice text={error} /> : items.length ? items.map((x: any, i: number) => <Row key={x.id || i} icon={x.kind === 'File' ? 'document-text-outline' : 'albums-outline'} title={x.name || x.title || 'Study material'} meta={x.kind} />) : <Empty text="Your library is empty. Upload a lesson to begin." />}</Page>;
}
function Community({ api }: { api: any }) {
  const [items, setItems] = useState<any[]>([]), [busy, setBusy] = useState(true), [error, setError] = useState('');
  const load = () => api('/api/community').then((d: any) => setItems([...(d.files || []), ...(d.flashcardSets || [])])).catch((e: any) => setError(e.message)).finally(() => setBusy(false)); useEffect(load, []);
  return <Page title="Community Notes" sub="Materials approved for STUDYante learners." refresh={load}>{busy ? <ActivityIndicator color={C.blue} /> : error ? <Notice text={error} /> : items.length ? items.map((x, i) => <Row key={x.id || i} icon={x.type === 'file' ? 'document-outline' : 'layers-outline'} title={x.name} meta={`By ${x.author || 'STUDYante User'}`} />) : <Empty text="No approved community materials yet." />}</Page>;
}
function AI({ api }: { api: any }) {
  const [question, setQuestion] = useState(''), [chatId, setChatId] = useState(''), [busy, setBusy] = useState(false); const [messages, setMessages] = useState<any[]>([{ role: 'assistant', content: 'Hi! What would you like to study today?' }]);
  async function send() { const q = question.trim(); if (!q || busy) return; setQuestion(''); setMessages(m => [...m, { role: 'user', content: q }]); setBusy(true); try { const form = new FormData(); form.append('question', q); form.append('provider', 'gemini'); if (chatId) form.append('chatId', chatId); const d = await api('/api/chat', { method: 'POST', body: form }); setChatId(d.chatId || ''); setMessages(m => [...m, { role: 'assistant', content: d.answer }]); } catch (e: any) { setMessages(m => [...m, { role: 'assistant', content: `Sorry, ${e.message}` }]); } finally { setBusy(false); } }
  return <Page title="STUDYante AI" sub="Ask questions about any lesson."><View style={s.chat}>{messages.map((m, i) => <View key={i} style={[s.bubble, m.role === 'user' ? s.userBubble : s.aiBubble]}><Text style={[s.bubbleText, m.role === 'user' && { color: C.white }]}>{m.content}</Text></View>)}{busy && <ActivityIndicator color={C.blue} style={{ alignSelf: 'flex-start' }} />}</View><View style={s.composer}><TextInput style={s.composerInput} placeholder="Ask STUDYante AI..." placeholderTextColor={C.muted} value={question} onChangeText={setQuestion} multiline /><Pressable style={s.send} onPress={send}><Ionicons name="send" size={20} color={C.white} /></Pressable></View></Page>;
}
function Profile({ user, admin, logout }: { user: User; admin: boolean; logout: () => void }) { return <Page title="My Account" sub="Your STUDYante profile."><View style={s.profile}><View style={s.bigAvatar}><Text style={s.bigAvatarText}>{user.name.charAt(0).toUpperCase()}</Text></View><Text style={s.profileName}>{user.name}</Text><Text style={s.profileEmail}>{user.email}</Text>{admin && <View style={s.badge}><Ionicons name="shield-checkmark" size={16} color={C.red} /><Text style={s.badgeText}>STUDYante Owner</Text></View>}<Pressable style={s.outline} onPress={() => Linking.openURL(WEBSITE)}><Text style={s.outlineText}>Open Website</Text></Pressable><Pressable style={s.logout} onPress={logout}><Text style={s.logoutText}>Log Out</Text></Pressable></View></Page>; }
function Admin({ api }: { api: any }) { const [stats, setStats] = useState<any>(null), [error, setError] = useState(''); useEffect(() => { api('/api/admin/dashboard').then((d: any) => setStats(d.stats)).catch((e: any) => setError(e.message)); }, []); return <Page title="Admin" sub="Private owner dashboard.">{error ? <Notice text={error} /> : !stats ? <ActivityIndicator color={C.blue} /> : <View style={s.stats}>{Object.entries(stats).map(([k, v]) => <View key={k} style={s.stat}><Text style={s.statNumber}>{String(v)}</Text><Text style={s.statLabel}>{k}</Text></View>)}</View>}<Notice text="Only the owner email configured in ADMIN_EMAILS can access Admin." /></Page>; }

function Page({ title, sub, refresh, children }: any) { return <><View style={s.pageHead}><View style={{ flex: 1 }}><Text style={s.title}>{title}</Text><Text style={s.sub}>{sub}</Text></View>{refresh && <Pressable style={s.refresh} onPress={refresh}><Ionicons name="refresh" size={20} color={C.blue} /></Pressable>}</View>{children}</>; }
function Row({ icon, title, meta }: any) { return <View style={s.row}><View style={s.rowIcon}><Ionicons name={icon} size={22} color={C.blue} /></View><View style={{ flex: 1 }}><Text style={s.rowTitle}>{title}</Text><Text style={s.rowMeta}>{meta}</Text></View></View>; }
function Empty({ text }: { text: string }) { return <View style={s.empty}><Ionicons name="folder-open-outline" size={40} color={C.muted} /><Text style={s.emptyText}>{text}</Text></View>; }
function Notice({ text }: { text: string }) { return <View style={s.notice}><Ionicons name="information-circle-outline" size={20} color={C.blue} /><Text style={s.noticeText}>{text}</Text></View>; }
function Center({ text }: { text: string }) { return <SafeAreaView style={s.center}><ActivityIndicator size="large" color={C.blue} /><Text style={s.centerText}>{text}</Text></SafeAreaView>; }
function Nav({ active, go, admin }: { active: Screen; go: (x: Screen) => void; admin: boolean }) { const tabs: [Screen, any, string][] = [['dashboard', 'home', 'Home'], ['library', 'library', 'Library'], ['community', 'globe', 'Community'], ['ai', 'sparkles', 'AI'], ...(admin ? [['admin', 'shield-checkmark', 'Admin'] as [Screen, any, string]] : []), ['profile', 'person', 'Account']]; return <View style={s.nav}>{tabs.map(([id, icon, label]) => <Pressable key={id} style={s.navItem} onPress={() => go(id)}><Ionicons name={active === id ? icon : `${icon}-outline`} size={21} color={active === id ? C.blue : C.muted} /><Text style={[s.navLabel, active === id && s.navActive]}>{label}</Text></Pressable>)}</View>; }

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.white }, shell: { flex: 1, backgroundColor: C.bg }, content: { width: '100%', maxWidth: 900, alignSelf: 'center', padding: 20, paddingBottom: 115 }, center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg }, centerText: { marginTop: 14, color: C.muted },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }, logo: { width: 175, height: 52 }, avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: C.blue, alignItems: 'center', justifyContent: 'center' }, avatarText: { color: C.white, fontWeight: '900' },
  eyebrow: { color: C.red, fontSize: 11, letterSpacing: 1.4, fontWeight: '900' }, title: { color: C.navy, fontSize: 29, fontWeight: '900', marginTop: 6 }, sub: { color: C.muted, fontSize: 14, lineHeight: 21, marginTop: 5 },
  hero: { backgroundColor: C.blue, borderRadius: 24, padding: 22, marginTop: 22 }, heroIcon: { width: 47, height: 47, borderRadius: 15, backgroundColor: C.red, alignItems: 'center', justifyContent: 'center' }, heroTitle: { color: C.white, fontSize: 24, fontWeight: '900', marginTop: 18 }, heroCopy: { color: '#DCE7FF', lineHeight: 21, marginTop: 7 }, heroButton: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.white, borderRadius: 12, paddingHorizontal: 15, paddingVertical: 11, marginTop: 18 }, heroButtonText: { color: C.blue, fontWeight: '800' },
  section: { color: C.navy, fontSize: 19, fontWeight: '900', marginTop: 28, marginBottom: 12 }, grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 }, card: { minWidth: 250, width: '48%', flexGrow: 1, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.white, borderWidth: 1, borderColor: C.line, borderRadius: 18, padding: 15 }, cardIcon: { width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center' }, cardTitle: { color: C.ink, fontWeight: '800' }, cardText: { color: C.muted, fontSize: 12, marginTop: 3 },
  pageHead: { flexDirection: 'row', alignItems: 'center', marginBottom: 22 }, refresh: { width: 42, height: 42, borderRadius: 13, backgroundColor: C.softBlue, alignItems: 'center', justifyContent: 'center' }, row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 15, backgroundColor: C.white, borderWidth: 1, borderColor: C.line, borderRadius: 16, marginBottom: 10 }, rowIcon: { width: 44, height: 44, borderRadius: 13, backgroundColor: C.softBlue, alignItems: 'center', justifyContent: 'center' }, rowTitle: { color: C.ink, fontWeight: '800' }, rowMeta: { color: C.muted, fontSize: 12, marginTop: 4 },
  empty: { alignItems: 'center', padding: 35, backgroundColor: C.white, borderRadius: 18, borderWidth: 1, borderColor: C.line }, emptyText: { color: C.muted, lineHeight: 21, textAlign: 'center', marginTop: 12 }, notice: { flexDirection: 'row', gap: 9, padding: 14, backgroundColor: C.softBlue, borderRadius: 14, marginTop: 14 }, noticeText: { flex: 1, color: C.ink, lineHeight: 19 },
  chat: { gap: 10, minHeight: 300, backgroundColor: C.white, borderRadius: 18, borderWidth: 1, borderColor: C.line, padding: 14 }, bubble: { maxWidth: '84%', borderRadius: 16, padding: 12 }, aiBubble: { alignSelf: 'flex-start', backgroundColor: C.softBlue }, userBubble: { alignSelf: 'flex-end', backgroundColor: C.blue }, bubbleText: { color: C.ink, lineHeight: 20 }, composer: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, marginTop: 12 }, composerInput: { flex: 1, minHeight: 52, maxHeight: 120, backgroundColor: C.white, borderWidth: 1, borderColor: C.line, borderRadius: 16, paddingHorizontal: 15, paddingVertical: 14, color: C.ink }, send: { width: 52, height: 52, borderRadius: 16, backgroundColor: C.red, alignItems: 'center', justifyContent: 'center' },
  profile: { alignItems: 'center', backgroundColor: C.white, borderWidth: 1, borderColor: C.line, borderRadius: 20, padding: 24 }, bigAvatar: { width: 82, height: 82, borderRadius: 41, backgroundColor: C.blue, alignItems: 'center', justifyContent: 'center' }, bigAvatarText: { color: C.white, fontSize: 30, fontWeight: '900' }, profileName: { color: C.navy, fontSize: 21, fontWeight: '900', marginTop: 15 }, profileEmail: { color: C.muted, marginTop: 5 }, badge: { flexDirection: 'row', gap: 7, backgroundColor: C.softRed, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 7, marginTop: 13 }, badgeText: { color: C.red, fontWeight: '800', fontSize: 12 }, outline: { width: '100%', maxWidth: 330, borderWidth: 1, borderColor: C.blue, borderRadius: 13, padding: 13, alignItems: 'center', marginTop: 24 }, outlineText: { color: C.blue, fontWeight: '800' }, logout: { width: '100%', maxWidth: 330, backgroundColor: C.softRed, borderRadius: 13, padding: 13, alignItems: 'center', marginTop: 10 }, logoutText: { color: C.red, fontWeight: '800' },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 }, stat: { minWidth: 120, flexGrow: 1, backgroundColor: C.white, borderWidth: 1, borderColor: C.line, borderRadius: 16, padding: 16 }, statNumber: { color: C.blue, fontSize: 25, fontWeight: '900' }, statLabel: { color: C.muted, textTransform: 'capitalize', marginTop: 4 },
  nav: { position: 'absolute', left: 0, right: 0, bottom: 0, minHeight: 82, flexDirection: 'row', backgroundColor: C.white, borderTopWidth: 1, borderTopColor: C.line, paddingBottom: 10 }, navItem: { flex: 1, minWidth: 54, alignItems: 'center', justifyContent: 'center' }, navLabel: { color: C.muted, fontSize: 10, marginTop: 4, fontWeight: '700' }, navActive: { color: C.blue },
  authSafe: { flex: 1, backgroundColor: C.bg }, authWrap: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 20 }, authCard: { width: '100%', maxWidth: 430, backgroundColor: C.white, borderRadius: 24, borderWidth: 1, borderColor: C.line, padding: 25 }, authLogo: { width: 210, height: 65, alignSelf: 'center' }, authTitle: { textAlign: 'center', color: C.navy, fontWeight: '900', fontSize: 25, marginTop: 15 }, authSub: { textAlign: 'center', color: C.muted, marginTop: 5, marginBottom: 20 }, input: { height: 52, borderRadius: 14, borderWidth: 1, borderColor: C.line, paddingHorizontal: 15, color: C.ink, marginBottom: 11, backgroundColor: '#FBFCFF' }, primary: { height: 52, borderRadius: 14, backgroundColor: C.blue, alignItems: 'center', justifyContent: 'center', marginTop: 4 }, primaryText: { color: C.white, fontWeight: '900' }, switchText: { color: C.blue, textAlign: 'center', fontWeight: '700', marginTop: 18 }, error: { color: C.red, marginBottom: 8, textAlign: 'center' },
});
