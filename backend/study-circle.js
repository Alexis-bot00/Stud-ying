import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { publicPresence } from './presence.js';
import multer from 'multer';
import { OfficeParser } from 'officeparser';
const stamp = () => new Date().toISOString();
const uid = () => crypto.randomUUID();
const bad = (status, message) => Object.assign(new Error(message), { status });
const str = (v, max = 2000, required = true) => { if (typeof v !== 'string' || v.trim().length > max || (required && !v.trim())) throw bad(400, 'Enter valid text (maximum ' + max + ' characters).'); return v.trim(); };
export function validateMaterial(b) {
  const title = str(b.title, 160), materialType = b.materialType, c = b.content;
  if (!c || JSON.stringify(c).length > 200000) throw bad(400, 'Provide content under 200,000 characters.');
  let content;
  if (materialType === 'notes') content = { notes: str(c.notes, 200000) };
  else if (materialType === 'flashcards' || materialType === 'games') {
    const items = materialType === 'flashcards' ? c.cards : c.pairs;
    if (!Array.isArray(items) || !items.length) throw bad(400, 'Add at least one question and answer.');
    const pairs = items.map(p => ({ front: str(p.front), back: str(p.back) }));
    if (materialType === 'games' && !['matching','quick-quiz','word-scramble','group-challenge'].includes(c.kind)) throw bad(400, 'Choose a game type.');
    content = materialType === 'flashcards' ? { cards: pairs } : { kind: c.kind, pairs };
  } else if (materialType === 'tests') {
    if (!Array.isArray(c.questions) || !c.questions.length) throw bad(400, 'Add at least one question.');
    content = { questions: c.questions.map(q => {
      if (!['multiple-choice','true-false','identification'].includes(q.type)) throw bad(400, 'Choose a question type.');
      const answer = str(q.answer), options = q.type === 'true-false' ? ['True','False'] : q.type === 'multiple-choice' && Array.isArray(q.options) ? q.options.map(o => str(o)) : [];
      if (q.type !== 'identification' && (options.length < 2 || !options.includes(answer))) throw bad(400, 'Correct answer must match an option.');
      return { type: q.type, question: str(q.question), answer, options };
    }) };
  } else throw bad(400, 'Unsupported material type.');
  return { title, materialType, content };
}
export function createStudyCircleRouter({ requireAuth, readUsers, readLibrary, directory }) {
  const router = express.Router(), file = path.join(directory, 'study-circles.json');
  const read = () => {
    const d = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : { sessions: [] };
    for (const s of d.sessions) if (!s.circleName) {
      s.circleName = s.title || 'Study Circle'; s.creatorId = s.ownerId; s.subject = ''; s.description = ''; s.privacy = 'private';
      s.members = [{ userId: s.ownerId, role: 'creator', joinedAt: s.createdAt }, ...(s.invites || []).filter(i => i.status === 'accepted').map(i => ({ userId: i.userId, role: 'member', joinedAt: s.createdAt }))];
      s.requests = []; s.activity = [];
      s.materials = s.notes ? [{ id: s.id + '-note', circleId: s.id, title: s.title, materialType: 'notes', content: { notes: s.notes }, resourceId: s.noteId, addedByUserId: s.ownerId, createdAt: s.createdAt, updatedAt: s.createdAt }] : [];
      s.messages = (s.messages || []).map(m => ({ id: m.id, circleId: s.id, senderUserId: m.userId, message: m.text, createdAt: m.sentAt }));
    }
    return d;
  };
  const write = d => { fs.mkdirSync(directory, { recursive: true }); fs.writeFileSync(file + '.tmp', JSON.stringify(d)); fs.renameSync(file + '.tmp', file); };
  let usersById = new Map();
  const profile = userId => { const u = usersById.get(userId); return { userId, name: u?.name || 'Classmate', ...publicPresence(u || {}) }; };
  const member = (s, u) => s.members.some(m => m.userId === u);
  const summary = (s, u) => ({ id: s.id, circleName: s.circleName, subject: s.subject, description: s.description, privacy: s.privacy, creatorId: s.creatorId, creatorName: profile(s.creatorId).name, memberCount: s.members.length, mine: s.creatorId === u, status: member(s,u) ? 'accepted' : s.requests.some(r => r.userId === u && r.status === 'pending') ? 'pending' : 'none' });
  const find = (d, req, creator = false) => { const s = d.sessions.find(s => s.id === req.params.id); if (!s || !member(s, req.user.id)) throw bad(403, 'Only accepted members can access this Circle.'); if (creator && s.creatorId !== req.user.id) throw bad(403, 'Only the Creator can manage this Circle.'); return s; };
  const log = (s,u,action,m) => s.activity.push({ id: uid(), circleId: s.id, userId: u, action, materialType: m.materialType, resourceId: m.id, title: m.title, createdAt: stamp() });
  const wrap = fn => (req,res,next) => { try { fn(req,res); } catch(e) { next(e); } };
  const metadata = b => { if (!['public','private'].includes(b.privacy)) throw bad(400,'Choose privacy.'); return { circleName: str(b.circleName,160), subject: str(b.subject || '',160,false), description: str(b.description || '',2000,false), privacy: b.privacy }; };
  router.use(requireAuth);
  router.use((req,res,next) => { usersById = new Map(readUsers().map(u => [u.id,u])); return usersById.has(req.user.id) ? next() : res.status(401).json({ message: 'Please sign in again.' }); });
  router.get('/', wrap((req,res) => {
    const circles = read().sessions.filter(s => s.circleName.toLowerCase().includes(String(req.query.search || '').toLowerCase()));
    res.json({ currentUserId: req.user.id, sessions: circles.filter(s => member(s,req.user.id)).map(s => summary(s,req.user.id)), discover: circles.filter(s => !member(s,req.user.id) && s.privacy === 'public').map(s => summary(s,req.user.id)), invitations: circles.filter(s => !member(s,req.user.id) && (s.invites || []).some(i => i.userId === req.user.id && i.status === 'pending')).map(s => summary(s,req.user.id)) });
  }));
  router.post('/', wrap((req,res) => { const d = read(), s = { ...metadata(req.body), id: uid(), creatorId: req.user.id, createdAt: stamp(), members: [{ userId: req.user.id, role: 'creator', joinedAt: stamp() }], requests: [], invites: [], messages: [], materials: [], activity: [] }; d.sessions.push(s); write(d); res.status(201).json({ session: summary(s,req.user.id) }); }));
  router.post('/:id/requests', wrap((req,res) => { const d = read(), s = d.sessions.find(s => s.id === req.params.id && s.privacy === 'public'); if (!s) throw bad(404,'Searchable Circle not found.'); if (member(s,req.user.id)) throw bad(409,'Already a member.'); if (!s.requests.some(r => r.userId === req.user.id && r.status === 'pending')) s.requests.push({ id: uid(), circleId: s.id, userId: req.user.id, status: 'pending', createdAt: stamp() }); write(d); res.json({ success: true }); }));
  router.post('/:id/requests/:requestId', wrap((req,res) => { const d = read(), s = find(d,req,true), r = s.requests.find(r => r.id === req.params.requestId && r.status === 'pending'); if (!r) throw bad(404,'Request not found.'); if (!['accepted','declined'].includes(req.body.status)) throw bad(400,'Accept or decline.'); r.status = req.body.status; if (r.status === 'accepted' && !member(s,r.userId)) s.members.push({ userId: r.userId, role: 'member', joinedAt: stamp() }); write(d); res.json({ success: true }); }));
  router.post('/:id/invitations', wrap((req,res) => { const d = read(), s = find(d,req,true), email = str(req.body.email,320).toLowerCase(), u = readUsers().find(u => u.email?.toLowerCase() === email); if (!u) throw bad(404,'No account found for that email.'); if (member(s,u.id)) throw bad(409,'Already a member.'); s.invites = (s.invites || []).filter(i => i.userId !== u.id); s.invites.push({ userId: u.id, status: 'pending' }); write(d); res.json({ success: true }); }));
  router.post('/:id/respond', wrap((req,res) => { const d = read(), s = d.sessions.find(s => s.id === req.params.id), i = s?.invites?.find(i => i.userId === req.user.id && i.status === 'pending'); if (!i) throw bad(404,'Invitation not found.'); if (!['accepted','declined'].includes(req.body.status)) throw bad(400,'Accept or decline.'); i.status = req.body.status; if (i.status === 'accepted' && !member(s,req.user.id)) s.members.push({ userId: req.user.id, role: 'member', joinedAt: stamp() }); write(d); res.json({ success: true }); }));
  router.get('/:id', wrap((req,res) => { const s = find(read(),req); res.json({ session: { ...summary(s,req.user.id), currentUserId: req.user.id, participants: s.members.map(m => ({ ...m, ...profile(m.userId) })), messages: s.messages.map(m => ({ ...m, name: profile(m.senderUserId).name })), materials: s.materials, activity: s.activity.slice(-100).map(a => ({ ...a, name: profile(a.userId).name })), requests: s.creatorId === req.user.id ? s.requests.filter(r => r.status === 'pending').map(r => ({ ...r, name: profile(r.userId).name })) : [] } }); }));
  router.patch('/:id', wrap((req,res) => { const d = read(), s = find(d,req,true); Object.assign(s,metadata(req.body)); write(d); res.json({ success: true }); }));
  router.delete('/:id/members/:userId', wrap((req,res) => { const d = read(), s = find(d,req,true); if (req.params.userId === s.creatorId) throw bad(400,'Cannot remove the Creator.'); s.members = s.members.filter(m => m.userId !== req.params.userId); write(d); res.json({ success: true }); }));
  router.post('/:id/messages', wrap((req,res) => { const d = read(), s = find(d,req), message = str(req.body.message ?? req.body.text); const last = s.messages.filter(m => m.senderUserId === req.user.id).at(-1); if (last && Date.now() - Date.parse(last.createdAt) < 1000) throw bad(429,'Please wait a moment.'); s.messages.push({ id: uid(), circleId: s.id, senderUserId: req.user.id, message, createdAt: stamp() }); write(d); res.status(201).json({ success: true }); }));
  const noteUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024, files: 1, fields: 0 } });
  router.post('/:id/notes/import', (req,res,next) => {
    // Check membership before accepting or parsing a file.
    try { find(read(),req); } catch (error) { return next(error); }
    noteUpload.single('file')(req,res,error => error ? next(bad(400,'Choose one Note file under 8 MB.')) : next());
  }, async (req,res,next) => {
    try {
      if (!req.file) throw bad(400,'Choose a Note file to upload.');
      const extension = path.extname(req.file.originalname).toLowerCase();
      if (!['.txt','.md','.pdf','.docx'].includes(extension)) throw bad(400,'Upload a TXT, Markdown, PDF, or DOCX file.');
      let notes;
      if (extension === '.txt' || extension === '.md') notes = req.file.buffer.toString('utf8');
      else {
        try {
          const parsed = await OfficeParser.parseOffice(req.file.buffer, { fileType: extension.slice(1) });
          const result = await parsed.to('text'); notes = result?.value || '';
        } catch { throw bad(400,'Could not read this document. Try a text-based PDF, DOCX, TXT, or Markdown file.'); }
      }
      find(read(),req); // Membership may change while a document is being parsed.
      res.json({ title: path.basename(req.file.originalname,extension).slice(0,160), notes: str(notes,200000), filename: req.file.originalname });
    } catch (error) { next(error); }
  });
  router.post('/:id/materials', wrap((req,res) => { const d = read(), s = find(d,req); let b = req.body; if (b.resourceId) { const n = (readLibrary().studyMaterials || []).find(n => n.id === b.resourceId && n.userId === req.user.id && n.type === 'notes'); if (!n) throw bad(404,'Choose your own Library Note.'); b = { materialType: 'notes', title: n.name, content: { notes: n.data?.notes } }; } const m = { ...validateMaterial(b), id: uid(), circleId: s.id, resourceId: req.body.resourceId || null, addedByUserId: req.user.id, createdAt: stamp(), updatedAt: stamp() }; s.materials.push(m); log(s,req.user.id,'added',m); write(d); res.status(201).json({ material: m }); }));
  router.put('/:id/materials/:materialId', wrap((req,res) => { const d = read(), s = find(d,req), m = s.materials.find(m => m.id === req.params.materialId); if (!m) throw bad(404,'Material not found.'); const b = validateMaterial(req.body); if (b.materialType !== m.materialType) throw bad(400,'Cannot change material type.'); Object.assign(m,b,{ updatedAt: stamp() }); delete m.results; log(s,req.user.id,req.body.replace ? 'replaced' : 'edited',m); write(d); res.json({ material: m }); }));
  router.delete('/:id/materials/:materialId', wrap((req,res) => { const d = read(), s = find(d,req), m = s.materials.find(m => m.id === req.params.materialId); if (!m) throw bad(404,'Material not found.'); s.materials = s.materials.filter(x => x.id !== m.id); log(s,req.user.id,'deleted',m); write(d); res.json({ success: true }); }));
  router.post('/:id/materials/:materialId/start', wrap((req,res) => { const d = read(), s = find(d,req), m = s.materials.find(m => m.id === req.params.materialId && m.materialType === 'games'); if (!m) throw bad(404,'Game not found.'); log(s,req.user.id,'started',m); write(d); res.json({ success: true }); }));
  router.post('/:id/materials/:materialId/results', wrap((req,res) => { const d = read(), s = find(d,req), m = s.materials.find(m => m.id === req.params.materialId && m.materialType === 'games' && m.content.kind === 'group-challenge'); if (!m || !Array.isArray(req.body.answers)) throw bad(400,'Submit Group Challenge answers.'); const score = m.content.pairs.reduce((n,p,i) => n + (String(req.body.answers[i] || '').trim().toLowerCase() === p.back.trim().toLowerCase() ? 1 : 0),0); m.results = (m.results || []).filter(r => r.userId !== req.user.id); m.results.push({ userId: req.user.id, score, total: m.content.pairs.length, createdAt: stamp() }); write(d); res.json({ score, total: m.content.pairs.length }); }));
  router.delete('/:id', wrap((req,res) => { const d = read(), s = find(d,req); if (s.creatorId === req.user.id) d.sessions = d.sessions.filter(x => x !== s); else s.members = s.members.filter(m => m.userId !== req.user.id); write(d); res.json({ success: true }); }));
  router.use((e,req,res,next) => res.status(e.status || 500).json({ message: e.status ? e.message : 'Could not load or save Circle. Try again.' }));
  return router;
}
