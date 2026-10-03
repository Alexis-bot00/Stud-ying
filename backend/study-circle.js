import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export function createStudyCircleRouter({ requireAuth, readUsers, readLibrary, directory }) {
  const router = express.Router();
  const file = path.join(directory, 'study-circles.json');
  const read = () => fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : { sessions: [] };
  const write = data => { fs.mkdirSync(directory, { recursive: true }); fs.writeFileSync(`${file}.tmp`, JSON.stringify(data)); fs.renameSync(`${file}.tmp`, file); };
  const friends = (a, b) => {
    const file = path.join(directory, 'cappy-friends.json');
    const links = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')).links : [];
    return links.some(l => l.accepted && ((l.from === a && l.to === b) || (l.from === b && l.to === a)));
  };
  const name = id => readUsers().find(u => u.id === id)?.name || 'Classmate';
  const member = (session, id) => session.ownerId === id || session.invites.some(i => i.userId === id && i.status === 'accepted');
  const summary = (s, id) => ({ id: s.id, title: s.title, ownerName: name(s.ownerId), mine: s.ownerId === id, status: s.ownerId === id ? 'owner' : s.invites.find(i => i.userId === id)?.status, participants: [s.ownerId, ...s.invites.filter(i => i.status === 'accepted').map(i => i.userId)].map(id => ({ id, name: name(id) })) });
  router.use(requireAuth);
  router.use((req, res, next) => readUsers().some(u => u.id === req.user.id) ? next() : res.status(401).json({ message: 'Please sign in again.' }));
  router.get('/', (req, res) => res.json({ sessions: read().sessions.filter(s => s.ownerId === req.user.id || s.invites.some(i => i.userId === req.user.id && i.status !== 'declined')).map(s => summary(s, req.user.id)) }));
  router.post('/', (req, res) => {
    const note = (readLibrary().studyMaterials || []).find(n => n.id === req.body.noteId && n.userId === req.user.id && n.type === 'notes');
    if (!note) return res.status(404).json({ message: 'Choose notes you created in your library.' });
    const ids = [...new Set(Array.isArray(req.body.friendIds) ? req.body.friendIds : [])];
    if (!ids.length || ids.length > 20 || ids.some(id => typeof id !== 'string' || !friends(req.user.id, id) || !readUsers().some(u => u.id === id))) return res.status(400).json({ message: 'Invite 1–20 accepted friends.' });
    const notes = String(note.data?.notes || '');
    if (!notes.trim() || notes.length > 200000) return res.status(400).json({ message: 'Choose nonempty notes under 200,000 characters.' });
    const data = read();
    if (data.sessions.filter(s => s.ownerId === req.user.id).length >= 100) return res.status(429).json({ message: 'You have reached the limit of 100 study circles.' });
    const session = { id: crypto.randomUUID(), ownerId: req.user.id, noteId: note.id, title: String(note.name || 'Study notes').slice(0, 160), notes, invites: ids.map(userId => ({ userId, status: 'pending' })), messages: [], createdAt: new Date().toISOString() };
    data.sessions.push(session); write(data); res.status(201).json({ session: summary(session, req.user.id) });
  });
  router.post('/:id/respond', (req, res) => {
    const data = read(); const session = data.sessions.find(s => s.id === req.params.id);
    const invite = session?.invites.find(i => i.userId === req.user.id && i.status === 'pending');
    if (!invite) return res.status(404).json({ message: 'Study invitation not found.' });
    if (!['accepted', 'declined'].includes(req.body.status)) return res.status(400).json({ message: 'Accept or decline the invitation.' });
    invite.status = req.body.status; write(data); res.json({ success: true });
  });
  router.get('/:id', (req, res) => {
    const session = read().sessions.find(s => s.id === req.params.id);
    if (!session || !member(session, req.user.id)) return res.status(403).json({ message: 'Accept an invitation to open these notes.' });
    res.json({ session: { ...summary(session, req.user.id), notes: session.notes, messages: session.messages.slice(-100).map(m => ({ ...m, name: name(m.userId), mine: m.userId === req.user.id })) } });
  });
  router.post('/:id/messages', (req, res) => {
    const data = read(); const session = data.sessions.find(s => s.id === req.params.id);
    if (!session || !member(session, req.user.id)) return res.status(403).json({ message: 'Accept an invitation before chatting.' });
    const text = typeof req.body.text === 'string' ? req.body.text.trim() : '';
    if (!text || text.length > 2000) return res.status(400).json({ message: 'Messages must contain 1–2000 characters.' });
    const latest = session.messages.filter(m => m.userId === req.user.id).at(-1);
    if (latest && Date.now() - Date.parse(latest.sentAt) < 1000) return res.status(429).json({ message: 'Please wait a moment before sending again.' });
    session.messages.push({ id: crypto.randomUUID(), userId: req.user.id, text, sentAt: new Date().toISOString() });
    session.messages = session.messages.slice(-500); write(data); res.status(201).json({ success: true });
  });
  router.delete('/:id', (req, res) => {
    const data = read(); const session = data.sessions.find(s => s.id === req.params.id);
    if (!session || !member(session, req.user.id)) return res.status(403).json({ message: 'This study circle is not available.' });
    if (session.ownerId === req.user.id) data.sessions = data.sessions.filter(s => s !== session);
    else session.invites.find(i => i.userId === req.user.id).status = 'declined';
    write(data); res.json({ success: true });
  });
  router.use((error, req, res, next) => { console.error('Study Circle:', error.message); res.status(500).json({ message: 'Could not load or save this study circle. Try again.' }); });
  return router;
}
