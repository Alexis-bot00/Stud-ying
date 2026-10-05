import React, { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { attachUploadFile } from '../lib/upload-file';
import type { PlannerStore } from './cappy';
import { cappyPalette, darkPalette } from './cappy';
import { makeId, SchoolActivity, validDate } from './cappy-model';

export function SchoolCalendar({ api, store, dark }: { api: any; store: PlannerStore; dark: boolean }) {
  const p = dark ? darkPalette : cappyPalette;
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [rows, setRows] = useState<SchoolActivity[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [warnings, setWarnings] = useState<string[]>([]);
  const action = (label: string, press: () => void, secondary = false) => <Pressable accessibilityRole="button" disabled={busy} onPress={press} style={{ padding: 14, borderRadius: 12, marginTop: 10, backgroundColor: secondary ? p.softBlue : p.blue, opacity: busy ? 0.5 : 1 }}><Text style={{ color: secondary ? p.ink : '#fff', fontWeight: '700' }}>{label}</Text></Pressable>;
  const field = (label: string, value: string, change: (text: string) => void) => <View style={{ marginTop: 10 }}><Text style={{ color: p.muted, marginBottom: 5 }}>{label}</Text><TextInput accessibilityLabel={label} editable={!busy} value={value} onChangeText={change} style={{ padding: 12, borderWidth: 1, borderColor: p.line, borderRadius: 10, color: p.ink }} /></View>;
  const upload = async () => {
    if (!/^\d{4}$/.test(year) || Number(year) < 2000 || Number(year) > 2100) { setMessage('Enter a starting year between 2000 and 2100.'); return; }
    try {
      const picked = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'text/plain', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.openxmlformats-officedocument.presentationml.presentation'], copyToCacheDirectory: true, multiple: false });
      if (picked.canceled) return;
      const file = picked.assets[0];
      if ((file.size || 0) > 8 * 1024 * 1024) { setMessage('Choose a file smaller than 8 MB.'); return; }
      setBusy(true); setMessage(''); setRows([]); setWarnings([]);
      const form = new FormData(); form.append('year', year);
      await attachUploadFile(form, 'file', file);
      const result = await api('/api/schedule/calendar', { method: 'POST', body: form });
      if (!Array.isArray(result.activities)) throw new Error('No readable activities returned.');
      setRows(result.activities.map((row: any) => ({ id: makeId(), title: String(row.title || ''), start: String(row.start || ''), end: String(row.end || ''), note: String(row.note || '') })));
      setWarnings(Array.isArray(result.warnings) ? result.warnings : []);
      setMessage(result.activities.length ? 'Review the names and dates below, then add them to Monthly.' : 'No activities found. Try a calendar with readable dates and text.');
    } catch (error: any) { setMessage(/404|Could not complete this request \(404\)/.test(error.message || '') ? 'Calendar upload needs the updated server. Please try again after the server update.' : error.message || 'Could not read your school calendar.'); }
    finally { setBusy(false); }
  };
  return <View style={{ padding: 18, marginVertical: 12, borderWidth: 1, borderColor: p.line, borderRadius: 18, backgroundColor: p.white }}>
    <Text style={{ color: p.navy, fontSize: 18, fontWeight: '800' }}>School-year activities</Text>
    <Text style={{ color: p.muted, marginTop: 8 }}>Upload your school calendar. Review exams, holidays and events before adding them. PDF, Word, PowerPoint or TXT · up to 8 MB.</Text>
    {field('School year starts in', year, setYear)}
    {action(busy ? 'Reading calendar…' : 'Upload school calendar', upload)}
    {!!message && <Text accessibilityLiveRegion="polite" style={{ color: p.ink, marginTop: 12 }}>{message}</Text>}
    {warnings.map((warning, index) => <Text key={index} style={{ color: p.muted, marginTop: 8 }}>{warning}</Text>)}
    {rows.map((row, index) => {
      const change = (key: keyof SchoolActivity, value: string) => setRows(items => items.map(item => item.id === row.id ? { ...item, [key]: value } : item));
      return <View key={row.id} style={{ marginTop: 16, padding: 12, borderWidth: 1, borderColor: p.line, borderRadius: 12 }}>
        <Text style={{ color: p.navy, fontWeight: '700' }}>Activity {index + 1}</Text>
        {field(`Activity ${index + 1} name`, row.title, text => change('title', text))}
        {field(`Activity ${index + 1} start (YYYY-MM-DD)`, row.start, text => change('start', text))}
        {field(`Activity ${index + 1} end (YYYY-MM-DD)`, row.end, text => change('end', text))}
        {!!row.note && <Text style={{ color: p.muted, marginTop: 8 }}>{row.note}</Text>}
        {action('Remove this activity', () => setRows(items => items.filter(item => item.id !== row.id)), true)}
      </View>;
    })}
    {!!rows.length && <>{action(`Add ${rows.length} activities to Monthly`, async () => {
      if (rows.some(row => !row.title.trim() || !validDate(row.start) || !validDate(row.end) || row.end < row.start)) { setMessage('Check every activity has a name and valid dates. End date must be on or after start date.'); return; }
      const merged = [...(store.data.activities || [])];
      for (const row of rows) if (!merged.some(item => item.title.trim().toLowerCase() === row.title.trim().toLowerCase() && item.start === row.start && item.end === row.end)) merged.push({ ...row, title: row.title.trim() });
      const added = merged.length - (store.data.activities || []).length;
      store.update(current => ({ ...current, activities: merged }));
      setBusy(true);
      try { await store.flush(); setRows([]); setWarnings([]); setMessage(`${added} activities added. Select a date in Monthly to see them. Already saved activities are skipped.`); }
      catch { setMessage('Activities could not be saved. Please try again.'); }
      finally { setBusy(false); }
    })}{action('Cancel import', () => { setRows([]); setWarnings([]); setMessage(''); }, true)}</>}
  </View>;
}
