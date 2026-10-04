import fs from 'node:fs/promises';
import path from 'node:path';
import { checksum, documentNames } from '../storage/repository.js';

const stableId = (table, location) => `migration_${checksum(Buffer.from(`${table}:${location}`))}`;
const mime = { '.pdf': 'application/pdf', '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation', '.txt': 'text/plain', '.md': 'text/markdown', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' };
export async function buildMigrationPlan(source) {
  const root = path.resolve(source), documents = [], records = [], objects = [], issues = [];
  const payloads = {};
  async function walk(directory, prefix = '') {
    for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
      const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
      const absolute = path.join(directory, entry.name);
      if (entry.isSymbolicLink()) throw new Error('Source contains a symlink; review it separately');
      if (entry.isDirectory()) { await walk(absolute, relative); continue; }
      if (!entry.isFile()) throw new Error('Source contains a special filesystem entry');
      const bytes = await fs.readFile(absolute), sha256 = checksum(bytes);
      // Archive every source byte, including unknown/orphan files and formatting.
      objects.push({ bucket: 'migration-archive', key: `${sha256}/${relative}`, relative, sha256, size: bytes.length, contentType: mime[path.extname(relative).toLowerCase()] || 'application/octet-stream' });
      if (!prefix && documentNames.has(entry.name)) {
        let payload; try { payload = JSON.parse(bytes.toString('utf8')); } catch { throw new Error('Source JSON is invalid; no migration plan created'); }
        payloads[entry.name] = payload;
        documents.push({ name: entry.name, payload, checksum: checksum(Buffer.from(JSON.stringify(payload))), sourceChecksum: sha256 });
      }
    }
  }
  await walk(root);
  if (!Array.isArray(payloads['users.json'])) throw new Error('A users.json array is required');
  if (!payloads['index.json'] || typeof payloads['index.json'] !== 'object') throw new Error('An index.json is required');
  if (!Array.isArray(payloads['chats.json'])) throw new Error('A chats.json array is required');
  const knownUsers = new Set(payloads['users.json'].map(u => u.id));
  const knownEmails = new Set();
  const keys = new Set();
  function add(table, payload, location, { userId = payload.userId ?? null, folderId = payload.folderId ?? null, circleId = null, id = payload.id ?? stableId(table, location) } = {}) {
    if (typeof id !== 'string' || !id) throw new Error('A record ID is invalid');
    const key = table + ':' + id;
    if (keys.has(key)) throw new Error('Duplicate source record ID');
    keys.add(key);
    if (userId && !knownUsers.has(userId)) issues.push({ type: 'missing-user', table, id });
    const createdAt = payload.createdAt ?? payload.uploadedAt ?? payload.sentAt ?? null, updatedAt = payload.updatedAt ?? null;
    for (const value of [createdAt, updatedAt]) if (value !== null && (typeof value !== 'string' || !Number.isFinite(Date.parse(value)))) throw new Error('Invalid source timestamp');
    records.push({ table, id, userId, folderId, circleId, createdAt, updatedAt, payload: structuredClone(payload) });
  }
  for (const user of payloads['users.json']) {
    if (!user.password || !/^\$2[aby]\$\d\d\$/.test(user.password) || typeof user.email !== 'string' || !user.email) throw new Error('User authentication data is invalid');
    const email = user.email.toLowerCase();
    if (knownEmails.has(email)) throw new Error('Duplicate source record ID or email');
    knownEmails.add(email);
    add('users', user, `users/${user.id}`, { userId: null });
    add('profiles', user, `profiles/${user.id}`, { id: user.id, userId: user.id });
  }
  const sourceIndex = payloads['index.json'] ?? { folders: [], files: [], flashcardSets: [], studyMaterials: [] };
  const index = Array.isArray(sourceIndex) ? { files: sourceIndex } : sourceIndex;
  for (const [collection, table] of Object.entries({ folders: 'folders', files: 'uploaded_files', flashcardSets: 'flashcard_sets', studyMaterials: 'study_materials' })) {
    for (const [i, item] of (index[collection] || []).entries()) {
      if (!item.userId) issues.push({ type: 'ownerless-record', table, id: item.id });
      add(table, item, `${collection}/${i}`);
      if (item.communityStatus) add('community_materials', item, `${table}/${item.id}`, { id: stableId('community_materials',`${table}/${item.id}`) });
      if (table === 'study_materials') {
        const type = { notes: 'notes', flashcards: 'flashcards', test: 'tests', game: 'games' }[item.type];
        if (type) add(type, item, `studyMaterials/${i}`);
      }
      if (table === 'uploaded_files') {
        if (typeof item.storedName !== 'string' || path.basename(item.storedName) !== item.storedName || item.storedName.includes('\\')) throw new Error('Invalid stored filename');
        const relative = 'files/' + item.storedName;
        const object = objects.find(o => o.relative === relative);
        if (!object) issues.push({ type: 'missing-binary', table, id: item.id });
        else {
          const ext = path.extname(item.storedName).toLowerCase();
          const bucket = ['.jpg','.jpeg','.png','.webp'].includes(ext) ? 'images' : 'documents';
          objects.push({ ...object, bucket, key: `${encodeURIComponent(item.userId)}/${encodeURIComponent(item.id)}/${item.storedName}`, ownerId: item.userId });
        }
      }
    }
  }
  for (const [i, chat] of (payloads['chats.json'] || []).entries()) {
    add('ai_chats', chat, `chats/${i}`);
    for (const [j, message] of (chat.messages || []).entries()) add('ai_messages', { ...message, chatId: chat.id }, `chats/${i}/messages/${j}`, { userId: chat.userId });
  }
  for (const [i, circle] of (payloads['study-circles.json']?.sessions || []).entries()) {
    const creator = circle.creatorId ?? circle.ownerId;
    add('circles', circle, `circles/${i}`, { userId: creator });
    // Legacy membership is projected without mutating the original JSON.
    const members = circle.members ?? [{ userId: creator, role: 'creator', joinedAt: circle.createdAt }, ...(circle.invites || []).filter(v => v.status === 'accepted').map(v => ({ userId: v.userId, role: 'member', joinedAt: circle.createdAt }))];
    for (const [collection, table] of Object.entries({ members: 'circle_members', requests: 'circle_join_requests', invites: 'circle_invitations', messages: 'circle_messages', materials: 'circle_materials', activity: 'circle_activity' })) {
      const items = collection === 'members' ? members : circle[collection] || [];
      for (const [j, item] of items.entries()) {
        const userId = item.userId ?? item.senderUserId ?? item.addedByUserId ?? null;
        const identity = collection === 'members' ? `${circle.id}/${userId}` : `${circle.id}/${collection}/${j}`;
        add(table, item, identity, { userId, circleId: circle.id, id: item.id ?? stableId(table, identity) });
        if (collection === 'materials') for (const [k, result] of (item.results || []).entries()) add('circle_game_results', { ...result, materialId: item.id ?? stableId(table,identity) }, `${identity}/results/${k}`, { circleId: circle.id });
      }
    }
    if (!circle.circleName && circle.notes) add('circle_materials', { id: circle.id + '-note', title: circle.title, materialType: 'notes', content: { notes: circle.notes }, resourceId: circle.noteId, addedByUserId: creator, createdAt: circle.createdAt }, `circles/${i}/legacy-note`, { userId: creator, circleId: circle.id });
  }
  const friends = payloads['cappy-friends.json'] || {};
  for (const [i, link] of (friends.links || []).entries()) {
    if (!knownUsers.has(link.to)) issues.push({ type: 'missing-friend-user', table: 'friendships' });
    add('friendships', link, `friends/${[link.from,link.to].sort().join('/')}`, { userId: link.from });
  }
  for (const [i, message] of (friends.messages || []).entries()) {
    if (!knownUsers.has(message.to)) issues.push({ type: 'missing-friend-user', table: 'friend_messages' });
    add('friend_messages', message, `friends/messages/${i}`, { userId: message.from });
  }
  for (const [name, table] of [['announcements.json','announcements'],['admin-logs.json','admin_logs']]) for (const [i,item] of (payloads[name] || []).entries()) add(table,item,`${name}/${i}`,{userId:item.adminId??null});
  const folders = new Set((index.folders || []).map(f => f.id));
  for (const r of records) if (r.folderId && !folders.has(r.folderId)) issues.push({ type: 'missing-folder', table: r.table, id: r.id });
  const sourceChecksum = checksum(Buffer.from(JSON.stringify(objects.filter(o => o.bucket === 'migration-archive').map(o => [o.relative,o.sha256]).sort())));
  const counts = {}; for (const r of records) counts[r.table] = (counts[r.table] || 0) + 1;
  return { root, bundle: { id: `source_${sourceChecksum}`, sourceChecksum, documents, records, report: { counts, objects: objects.length, issues } }, objects, issues };
}

export async function executeMigration(plan, repository, { dryRun = true } = {}) {
  if (plan.issues.length) throw new Error('Unresolved source relationships/files; inspect the private dry-run report');
  if (dryRun) return { dryRun: true, migrated: 0, skipped: 0, failed: 0, plannedRecords: plan.bundle.records.length, plannedObjects: plan.objects.length };
  if (repository.driver !== 'supabase') throw new Error('Imports require the Supabase adapter');
  // Verify ALL sources before any write. A changed backup is not an import input.
  const inputs = new Map();
  for (const object of plan.objects) {
    if (!inputs.has(object.relative)) inputs.set(object.relative, await fs.readFile(path.join(plan.root, object.relative)));
    if (checksum(inputs.get(object.relative)) !== object.sha256) throw new Error('Source changed after planning');
  }
  let uploaded = 0, skippedObjects = 0;
  for (const object of plan.objects) {
    const result = await repository.putObject(object.bucket, object.key, inputs.get(object.relative));
    result.skipped ? skippedObjects++ : uploaded++;
  }
  // Storage and PostgreSQL cannot share a transaction. Content-addressed uploads
  // precede the atomic DB import; safe reruns reuse checksummed objects.
  const report = await repository.importBundle(plan.bundle);
  return { ...report, uploaded, skippedObjects };
}
