import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export const friendCode = id => crypto.createHash('sha256').update(`cappy:${id}`).digest('hex').slice(0, 10).toUpperCase();

export function createFriendsRouter({ requireAuth, readUsers, directory, store }) {
  const router = express.Router();
  const file = path.join(directory, 'cappy-friends.json');
  function read() {
    if (store) return JSON.parse(store.read(file));
    if (!fs.existsSync(file)) return { links: [], messages: [] };
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  }
  function write(data) {
    if (store) return store.write(file, JSON.stringify(data, null, 2));
    fs.mkdirSync(directory, { recursive: true });
    const temporary = `${file}.tmp`;
    fs.writeFileSync(temporary, JSON.stringify(data, null, 2), 'utf8');
    fs.renameSync(temporary, file);
  }
  const pair = (link, a, b) => (link.from === a && link.to === b) || (link.from === b && link.to === a);
  const publicUser = user => ({ id: user.id, name: user.name || 'Classmate' });
  router.use(requireAuth);
  router.use((req, res, next) => {
    if (!readUsers().some(u => u.id === req.user.id)) return res.status(401).json({ message: 'Please sign in again.' });
    next();
  });
  router.get('/', (req, res) => {
    const data = read(); const me = req.user.id; const users = readUsers();
    const find = id => users.find(u => u.id === id);
    res.json({ code: friendCode(me), friends: data.links.filter(l => l.accepted && (l.from === me || l.to === me)).map(l => find(l.from === me ? l.to : l.from)).filter(Boolean).map(publicUser), incoming: data.links.filter(l => !l.accepted && l.to === me).map(l => find(l.from)).filter(Boolean).map(publicUser), pending: data.links.filter(l => !l.accepted && l.from === me).map(l => find(l.to)).filter(Boolean).map(publicUser) });
  });
  router.post('/request', (req, res) => {
    const code = typeof req.body.code === 'string' ? req.body.code.trim().toUpperCase() : '';
    if (!/^[A-F0-9]{10}$/.test(code)) return res.status(400).json({ message: 'Enter a valid 10-character Cappy friend code.' });
    const target = readUsers().find(u => friendCode(u.id) === code);
    if (!target) return res.status(404).json({ message: 'No classmate found with that code.' });
    if (target.id === req.user.id) return res.status(400).json({ message: 'That’s your own friend code.' });
    const data = read();
    if (data.links.some(l => pair(l, req.user.id, target.id))) return res.status(409).json({ message: 'You already have a request or friendship with this classmate.' });
    if (data.links.filter(l => l.from === req.user.id && !l.accepted).length >= 30) return res.status(429).json({ message: 'Please wait for your outstanding friend requests to be answered.' });
    data.links.push({ from: req.user.id, to: target.id, accepted: false }); write(data);
    res.status(201).json({ success: true });
  });
  for (const action of ['accept', 'decline']) router.post(`/${action}`, (req, res) => {
    const data = read(); const link = data.links.find(l => l.from === req.body.id && l.to === req.user.id && !l.accepted);
    if (!link) return res.status(404).json({ message: 'Friend request not found.' });
    if (action === 'accept') link.accepted = true;
    else data.links = data.links.filter(l => l !== link);
    write(data); res.json({ success: true });
  });
  router.delete('/:id', (req, res) => {
    const data = read(); data.links = data.links.filter(l => !pair(l, req.user.id, req.params.id));
    data.messages = data.messages.filter(m => !pair(m, req.user.id, req.params.id)); write(data);
    res.json({ success: true });
  });
  const conversation = (data, me, other) => data.messages.filter(m => pair(m, me, other)).slice(-100).map(m => ({ id: m.id, text: m.text, sentAt: m.sentAt, mine: m.from === me }));
  router.route('/:id/messages').all((req, res, next) => {
    const data = read();
    if (!data.links.some(l => l.accepted && pair(l, req.user.id, req.params.id))) return res.status(403).json({ message: 'Accept a friend request before chatting.' });
    req.cappyData = data; next();
  }).get((req, res) => res.json({ messages: conversation(req.cappyData, req.user.id, req.params.id) })).post((req, res) => {
    const text = typeof req.body.text === 'string' ? req.body.text.trim() : '';
    if (!text || text.length > 2000) return res.status(400).json({ message: 'Messages must contain 1–2000 characters.' });
    const data = req.cappyData;
    const latest = data.messages.filter(m => m.from === req.user.id).at(-1);
    if (latest && Date.now() - new Date(latest.sentAt).getTime() < 1000) return res.status(429).json({ message: 'Please wait a moment before sending again.' });
    data.messages.push({ id: crypto.randomUUID(), from: req.user.id, to: req.params.id, text, sentAt: new Date().toISOString() });
    write(data); res.status(201).json({ messages: conversation(data, req.user.id, req.params.id) });
  });
  router.use((error, req, res, next) => { console.error('Cappy friends:', error.message); res.status(500).json({ message: 'Could not save or load friends. Please try again.' }); });
  return router;
}
