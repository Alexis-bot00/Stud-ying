import { ClassTime } from './class-time';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { cappyPalette, darkPalette, PlannerStore } from './cappy';
import { makeId, mergeClasses, validTime } from './cappy-model';
import { syncReminders } from './cappy-notifications';
type Draft = { name: string; day: number | null; start: string; end: string; room: string; note: string; id: string };
const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export function ScheduleScan({ api, store, dark }: { api: any; store: PlannerStore; dark: boolean }) {
  const p = dark ? darkPalette : cappyPalette;
  const [photo, setPhoto] = useState<{ uri: string; base64: string; mimeType: string } | null>(null);
  const [rows, setRows] = useState<Draft[]>([]); const [warnings, setWarnings] = useState<string[]>([]);
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [message, setMessage] = useState('');
  const imageInput = useRef<HTMLInputElement>(null);
  const captureInput = useRef<HTMLInputElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const cameraRequest = useRef(0);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  useEffect(() => () => { cameraRequest.current++; stream.current?.getTracks().forEach(track => track.stop()); }, []);
  const closeCamera = () => { cameraRequest.current++; stream.current?.getTracks().forEach(track => track.stop()); stream.current = null; if (video.current) video.current.srcObject = null; setCameraOpen(false); setCameraReady(false); setCameraStream(null); };
  useEffect(() => { if (cameraOpen && video.current && cameraStream) video.current.srcObject = cameraStream; }, [cameraOpen, cameraStream]);
  const openWebCamera = async () => {
    setError('');
    if (!navigator.mediaDevices?.getUserMedia) { setMessage('Choose your camera in the photo picker, or use an existing image.'); captureInput.current?.click(); return; }
    const request = ++cameraRequest.current; setCameraOpen(true); setCameraReady(false);
    try {
      const media = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false });
      if (request !== cameraRequest.current) { media.getTracks().forEach(track => track.stop()); return; }
      stream.current = media; setCameraStream(media);
    } catch { if (request === cameraRequest.current) { closeCamera(); setError('Could not open the camera. Allow camera access in your browser, or choose an image instead.'); } }
  };
  const readWebPhoto = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; if (!file) return;
    if (file.size > 6 * 1024 * 1024) { setError('Choose a photo smaller than 6 MB.'); event.target.value = ''; return; }
    const reader = new FileReader(); reader.onerror = () => setError('Could not read this photo.'); reader.onload = () => select(String(reader.result).split(',')[1] || '', file.type); reader.readAsDataURL(file); event.target.value = '';
  };
  const select = (base64: string, mimeType: string) => {
    if (!base64 || base64.length > 8 * 1024 * 1024) { setError('Use a photo smaller than 6 MB. A screenshot or a cropped photo works well.'); return; }
    const actual = base64.startsWith('/9j/') ? 'image/jpeg' : base64.startsWith('iVBOR') ? 'image/png' : base64.startsWith('UklG') ? 'image/webp' : mimeType;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(actual)) { setError('Use a JPEG, PNG or WebP image.'); return; }
    setPhoto({ uri: `data:${actual};base64,${base64}`, base64, mimeType: actual }); setRows([]); setWarnings([]); setError(''); setMessage('');
  };
  const pick = async (camera: boolean) => {
    try {
      if (camera) { const permission = await ImagePicker.requestCameraPermissionsAsync(); if (!permission.granted) { setError('Allow camera access, or choose a photo instead.'); return; } }
      const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], base64: true, quality: 0.7, allowsEditing: true };
      const result = camera ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
      if (!result.canceled) { const asset = result.assets[0]; select(asset.base64 || '', asset.mimeType || 'image/jpeg'); }
    } catch { setError('Could not open the photo. Please try again.'); }
  };
  const update = (id: string, values: Partial<Draft>) => setRows(list => list.map(row => row.id === id ? { ...row, ...values } : row));
  const valid = (row: Draft) => row.name.trim() && row.day !== null && Number.isInteger(row.day) && row.day >= 0 && row.day <= 6 && validTime(row.start) && validTime(row.end) && row.end > row.start;
  const field = (row: Draft, key: 'name' | 'start' | 'end' | 'room', label: string) => <View style={{ flex: 1, minWidth: 100 }}><Text style={{ color: p.muted, fontSize: 12, marginBottom: 5 }}>{label}</Text><TextInput accessibilityLabel={`${label} ${rows.indexOf(row) + 1}`} value={row[key]} onChangeText={value => update(row.id, { [key]: value })} placeholder={key === 'start' || key === 'end' ? 'HH:MM' : label} placeholderTextColor={p.muted} style={[s.input, { color: p.ink, borderColor: p.line, backgroundColor: p.white }]} /></View>;
  return <View style={[s.panel, { backgroundColor: p.softBlue, borderColor: p.line }]}>
    <View style={s.row}><View style={{ flex: 1 }}><Text style={{ color: p.blue, fontWeight: '800', fontSize: 10, letterSpacing: 1.5 }}>SNAP & SORT</Text><Text style={{ color: p.navy, fontWeight: '900', fontSize: 24, marginTop: 6 }}>A photo. A little magic.</Text><Text style={{ color: p.muted, lineHeight: 21, marginTop: 6 }}>Cappy will help turn your timetable into a tidy week. Image or camera—you choose.</Text></View><Ionicons name={busy ? 'scan-outline' : rows.length ? 'checkmark-circle-outline' : 'camera-outline'} size={36} color={p.blue} /></View>
    <Text style={{ color: p.muted, fontSize: 12, lineHeight: 18, marginVertical: 10 }}>Use a clear, straight-on photo or screenshot. The photo is sent to STUDYante’s AI service for reading.</Text>
    <View style={s.row}>{[['images-outline', 'Choose image', false], ['camera-outline', 'Take photo', true]].map(([icon, label, camera]) => <Pressable key={String(label)} accessibilityRole="button" disabled={busy} onPress={() => Platform.OS === 'web' ? camera ? openWebCamera() : imageInput.current?.click() : pick(Boolean(camera))} style={({ pressed }) => [s.photoChoice, { backgroundColor: p.white, borderColor: p.line, opacity: busy ? 0.5 : pressed ? 0.7 : 1 }]}><View style={{ backgroundColor: camera ? '#E3F2EB' : p.softBlue, padding: 11, borderRadius: 16 }}><Ionicons name={icon as any} size={24} color={camera ? '#3E806B' : p.blue} /></View><Text style={{ color: p.ink, fontWeight: '800', fontSize: 14 }}>{label}</Text><Text style={{ color: p.muted, fontSize: 11 }}>{camera ? 'Snap your timetable' : 'Photo or screenshot'}</Text></Pressable>)}</View>
    {Platform.OS === 'web' && <>{React.createElement('input', { ref: imageInput, type: 'file', accept: 'image/jpeg,image/png,image/webp', 'aria-label': 'Choose schedule photo', disabled: busy, style: { display: 'none' }, onChange: readWebPhoto })}{React.createElement('input', { ref: captureInput, type: 'file', accept: 'image/*', capture: 'environment', 'aria-label': 'Take schedule photo', style: { display: 'none' }, onChange: readWebPhoto })}</>}
    <Modal visible={cameraOpen} transparent animationType="fade" onRequestClose={closeCamera}><View style={{ flex: 1, backgroundColor: '#231C36DD', justifyContent: 'center', padding: 20 }}><View style={{ backgroundColor: p.white, borderRadius: 24, padding: 20, maxWidth: 620, width: '100%', alignSelf: 'center' }}><Text style={{ color: p.navy, fontSize: 22, fontWeight: '800' }}>Let’s get the whole timetable</Text><Text style={{ color: p.muted, lineHeight: 21, marginVertical: 10 }}>Keep the page flat, well lit, and inside the camera view.</Text>{Platform.OS === 'web' && React.createElement('video', { ref: video, onLoadedData: () => setCameraReady(true), autoPlay: true, playsInline: true, muted: true, 'aria-label': 'Schedule camera preview', style: { width: '100%', maxHeight: '55vh', borderRadius: 16, background: '#211E32' } })}{!cameraReady && <ActivityIndicator color={p.blue} style={{ margin: 15 }} />}<Pressable accessibilityRole="button" accessibilityLabel="Capture schedule" disabled={!cameraReady} onPress={() => { const element = video.current; if (!element?.videoWidth || !element.videoHeight) { setError('Wait for the camera preview, then try again.'); return; } const canvas = document.createElement('canvas'); const scale = Math.min(1, 2000 / Math.max(element.videoWidth, element.videoHeight)); canvas.width = Math.round(element.videoWidth * scale); canvas.height = Math.round(element.videoHeight * scale); const context = canvas.getContext('2d'); if (!context) { setError('Could not capture the photo. Choose an image instead.'); closeCamera(); return; } context.drawImage(element, 0, 0, canvas.width, canvas.height); const data = canvas.toDataURL('image/jpeg', 0.85); select(data.split(',')[1], 'image/jpeg'); closeCamera(); }} style={[s.action, { backgroundColor: p.blue, opacity: cameraReady ? 1 : 0.5 }]}><Ionicons name="camera" size={23} color="#FFFFFF" /><Text style={{ color: '#FFFFFF', fontWeight: '800' }}>Capture schedule</Text></Pressable><Pressable accessibilityRole="button" onPress={closeCamera} style={[s.action, { backgroundColor: p.softBlue }]}><Text style={{ color: p.blue, fontWeight: '800' }}>Cancel camera</Text></Pressable></View></View></Modal>
    {photo && <><Image source={{ uri: photo.uri }} style={{ width: '100%', height: 180, borderRadius: 16, marginVertical: 12 }} resizeMode="contain" /><Pressable accessibilityRole="button" disabled={busy} style={[s.action, { backgroundColor: p.blue, opacity: busy ? 0.65 : 1 }]} onPress={async () => { setBusy(true); setError(''); setMessage(''); setRows([]); setWarnings([]); try { const result = await api('/api/schedule/scan', { method: 'POST', body: JSON.stringify({ imageBase64: photo.base64, mimeType: photo.mimeType }) }); if (!Array.isArray(result.classes)) throw new Error('No readable schedule was returned.'); setRows(result.classes.map((row: any) => ({ ...row, id: makeId(), name: row.name || '', start: row.start || '', end: row.end || '', room: row.room || '', note: row.note || '', day: Number.isInteger(row.day) ? row.day : null }))); setWarnings(result.warnings || []); if (!result.classes.length) setMessage('No classes found. Try a clearer photo or add classes manually.'); } catch (e: any) { setError(e.message || 'Could not read this schedule. Please try again.'); } finally { setBusy(false); } }}>
      {busy ? <ActivityIndicator color="#FFFFFF" /> : <Ionicons name="scan-outline" size={22} color="#FFFFFF" />}<Text style={{ color: '#FFFFFF', fontWeight: '800' }}>{busy ? 'Cappy is reading your timetable…' : 'Let Cappy read it'}</Text>
    </Pressable></>}
    {!!error && <Text accessibilityLiveRegion="polite" style={{ color: '#C34C55', marginTop: 10 }}>{error}</Text>}{!!message && <Text accessibilityLiveRegion="polite" style={{ color: p.ink, marginTop: 10 }}>{message}</Text>}
    {warnings.map((warning, i) => <Text key={i} style={{ color: p.ink, fontSize: 13, marginTop: 8 }}>ⓘ {warning}</Text>)}
    {!!rows.length && <><Text style={{ color: p.navy, fontSize: 18, fontWeight: '800', marginTop: 20 }}>Check Cappy’s draft</Text><Text style={{ color: p.muted, marginVertical: 8 }}>Nothing is saved yet. Correct the details below, then add them to your week.</Text>
      {rows.map(row => <View key={row.id} style={[s.draft, { backgroundColor: p.white, borderColor: valid(row) ? p.line : '#DFA66F' }]}><View style={s.row}>{field(row, 'name', 'Subject')}<Pressable accessibilityLabel={`Remove draft ${rows.indexOf(row) + 1}`} onPress={() => setRows(list => list.filter(r => r.id !== row.id))} style={{ padding: 12 }}><Ionicons name="close" size={22} color={p.muted} /></Pressable></View><View style={[s.row, { flexWrap: 'wrap', marginVertical: 10 }]}>{days.map((day, i) => <Pressable accessibilityRole="button" accessibilityLabel={`${day} for draft ${rows.indexOf(row) + 1}`} key={day} onPress={() => update(row.id, { day: i })} style={{ backgroundColor: row.day === i ? p.blue : p.softBlue, padding: 10, minHeight: 40, borderRadius: 12 }}><Text style={{ color: row.day === i ? '#FFFFFF' : p.ink, fontSize: 12 }}>{day}</Text></Pressable>)}</View><View style={s.row}><ClassTime label={'Start time ' + (rows.indexOf(row) + 1)} value={row.start} onChange={start => update(row.id, { start })} p={p} /><ClassTime label={'End time ' + (rows.indexOf(row) + 1)} value={row.end} onChange={end => update(row.id, { end })} p={p} /></View><View style={{ marginTop: 10 }}>{field(row, 'room', 'Room')}</View>{!!row.note && <Text style={{ color: p.muted, fontSize: 12, marginTop: 10 }}>{row.note}</Text>}{!valid(row) && <Text style={{ color: '#B46E32', fontSize: 12, marginTop: 10 }}>Choose a day, subject, and valid start/end times to save this class.</Text>}</View>)}
      <Pressable accessibilityRole="button" disabled={busy || !rows.every(valid) || !store.ready} onPress={async () => { const incoming = rows.map(row => ({ id: row.id, name: row.name.trim(), day: row.day!, start: row.start, end: row.end, room: row.room.trim() })); const classes = mergeClasses(store.data.classes, incoming); const added = classes.length - store.data.classes.length; const next = { ...store.data, classes }; store.update(() => next); try { await store.flush(); setRows([]); setPhoto(null); setWarnings([]); setMessage(`${added} class meeting${added === 1 ? '' : 's'} added. Existing classes were kept; duplicate meetings were skipped.`); await syncReminders(next); } catch { setError('Could not save the timetable or update reminders. Check your classes before retrying.'); } }} style={[s.action, { backgroundColor: p.blue, opacity: rows.every(valid) ? 1 : 0.45 }]}><Ionicons name="calendar-outline" color="#FFFFFF" size={22} /><Text style={{ color: '#FFFFFF', fontWeight: '800' }}>Add to my week</Text></Pressable>
    </>}
  </View>;
}
const s = StyleSheet.create({ panel: { padding: 18, borderRadius: 24, borderWidth: 1, marginVertical: 12 }, row: { flexDirection: 'row', alignItems: 'center', gap: 8 }, photoChoice: { flex: 1, minWidth: 0, alignItems: 'center', gap: 8, padding: 13, borderRadius: 20, borderWidth: 1, marginVertical: 10 }, action: { padding: 14, borderRadius: 16, minHeight: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginVertical: 6 }, input: { minHeight: 48, borderRadius: 12, borderWidth: 1, padding: 12, fontSize: 16 }, draft: { borderRadius: 18, borderWidth: 1, padding: 14, marginVertical: 8 } });
