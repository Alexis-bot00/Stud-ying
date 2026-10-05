import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { diagnosticStage } from '../diagnostics.js';

export const documentNames = new Set(['users.json', 'index.json', 'chats.json', 'admin-logs.json', 'announcements.json', 'cappy-friends.json', 'study-circles.json']);
export const buckets = new Set(['documents', 'images', 'circle-files', 'attachments', 'profile-images', 'migration-archive']);
export const checksum = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const clone = value => structuredClone(value);
function safeName(name) { if (!documentNames.has(name)) throw new Error('Unsupported document name'); return name; }
function objectPath(bucket, key) {
  if (!buckets.has(bucket) || typeof key !== 'string' || !key || key.includes('\\') || key.split('/').some(p => !p || p === '.' || p === '..') || /[\x00-\x1f]/.test(key)) throw new Error('Invalid storage path');
  return `${bucket}/${key.split('/').map(encodeURIComponent).join('/')}`;
}
function requireObjectAccess(bucket, key, actor, metadata, memberships) {
  if (metadata?.bucket !== bucket || metadata?.key !== key || !authorizeObject(actor, metadata, memberships)) throw new Error('Forbidden');
}
async function ensureNoSymlinks(target) {
  let current = path.parse(path.resolve(target)).root;
  for (const segment of path.resolve(target).slice(current.length).split(path.sep).filter(Boolean)) {
    current = path.join(current, segment);
    try { if ((await fs.lstat(current)).isSymbolicLink()) throw new Error('Symlink storage path is forbidden'); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
}
export function authorizeObject(actor, metadata, memberships = []) {
  if (!actor?.id || actor.suspended || !metadata) return false;
  if (metadata.circleId) return memberships.some(m => m.circleId === metadata.circleId && m.userId === actor.id && m.accepted === true);
  return metadata.userId === actor.id;
}

// Canonical lossless documents back both migration and runtime route persistence.
export function createRepository({ env = process.env, directory = path.resolve('library'), fetchImpl = globalThis.fetch, allowNetwork = false } = {}) {
  const driver = env.STORAGE_DRIVER || 'file';
  if (!['file', 'supabase'].includes(driver)) throw new Error('Unknown STORAGE_DRIVER');
  if (driver === 'file') {
    const resolve = name => path.join(directory, safeName(name));
    return {
      driver,
      async read(name, fallback) {
        try { await ensureNoSymlinks(resolve(name)); return JSON.parse(await fs.readFile(resolve(name), 'utf8')); }
        catch (error) { if (error.code === 'ENOENT' && fallback !== undefined) return clone(fallback); throw error; }
      },
      async write(name, value) {
        const target = resolve(name); await ensureNoSymlinks(target); await fs.mkdir(directory, { recursive: true });
        const temp = `${target}.${crypto.randomUUID()}.tmp`;
        try { await fs.writeFile(temp, JSON.stringify(value, null, 2), { flag: 'wx', mode: 0o600 }); await fs.rename(temp, target); }
        finally { await fs.unlink(temp).catch(error => { if (error.code !== 'ENOENT') throw error; }); }
      },
      async putObject(bucket, key, bytes) {
        objectPath(bucket, key); const target = path.join(directory, 'objects', bucket, ...key.split('/'));
        await ensureNoSymlinks(target);
        await fs.mkdir(path.dirname(target), { recursive: true });
        try { await fs.writeFile(target, bytes, { flag: 'wx', mode: 0o600 }); return { skipped: false, sha256: checksum(bytes) }; }
        catch (error) { if (error.code !== 'EEXIST') throw error; if (checksum(await fs.readFile(target)) !== checksum(bytes)) throw new Error('Existing object checksum differs'); return { skipped: true, sha256: checksum(bytes) }; }
      },
      async getObject(bucket, key, actor, metadata, memberships) {
        requireObjectAccess(bucket, key, actor, metadata, memberships);
        objectPath(bucket, key); const target = path.join(directory, 'objects', bucket, ...key.split('/')); await ensureNoSymlinks(target); return fs.readFile(target);
      },
    };
  }
  const url = env.SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key || !/^https:\/\//.test(url)) throw new Error('Supabase backend configuration is required');
  const base = new URL(url).origin;
  async function request(route, { method = 'GET', body, binary = false } = {}) {
    if (!allowNetwork) throw new Error('Supabase network access is disabled');
    const response = await fetchImpl(base + route, { method, headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': binary ? 'application/octet-stream' : 'application/json', ...(binary ? { 'x-upsert': 'false' } : {}) }, ...(body === undefined ? {} : { body: binary ? body : JSON.stringify(body) }), signal: AbortSignal.timeout(30000) });
    // Never echo provider bodies, keys, payloads or URLs into error logs.
    if (!response.ok) { const error = Object.assign(new Error(`Supabase request failed (${response.status})`), { status: response.status }); diagnosticStage('repository_failed', error); throw error; }
    return response;
  }
  return {
    driver,
    async readDocuments(namespace, defaults) {
      diagnosticStage('documents_read_begin');
      const names = [...documentNames].map(name => namespace ? `${namespace}/${name}` : name);
      const filter = names.map(n => `"${n}"`).join(',');
      const rows = await (await request(`/rest/v1/source_documents?name=in.(${encodeURIComponent(filter)})&select=name,payload,checksum`)).json();
      diagnosticStage('documents_read_complete');
      return Object.fromEntries([...documentNames].map(name => {
        const row = rows.find(r => r.name === (namespace ? `${namespace}/${name}` : name));
        return [name, row ? { payload: row.payload, checksum: row.checksum } : { payload: clone(defaults[name]), checksum: null }];
      }));
    },
    async commitDocuments(namespace, changes) {
      diagnosticStage('documents_commit_begin');
      await request('/rest/v1/rpc/commit_studyante_documents', { method:'POST',body:{p_namespace:namespace,p_changes:changes} });
      diagnosticStage('documents_commit_complete');
    },
    async deleteObject(bucket,key) {
      objectPath(bucket,key); await request(`/storage/v1/object/${bucket}`,{method:'DELETE',body:{prefixes:[key]}});
    },
    async read(name, fallback) {
      safeName(name); const response = await request(`/rest/v1/source_documents?name=eq.${encodeURIComponent(name)}&select=payload`);
      const rows = await response.json();
      if (!rows.length) { if (fallback !== undefined) return clone(fallback); throw new Error('Source document not found'); }
      return rows[0].payload;
    },
    async write(name, value, { expectedChecksum } = {}) {
      safeName(name);
      if (!expectedChecksum) throw new Error('Supabase writes require an expected checksum');
      const digest = checksum(Buffer.from(JSON.stringify(value)));
      await request('/rest/v1/rpc/replace_source_document', { method: 'POST', body: { p_name: name, p_payload: value, p_expected_checksum: expectedChecksum, p_checksum: digest } });
    },
    async importBundle(bundle) { return (await request('/rest/v1/rpc/import_studyante_bundle', { method: 'POST', body: { p_bundle: bundle } })).json(); },
    async putObject(bucket, key, bytes) {
      const encoded = objectPath(bucket, key), digest = checksum(bytes);
      try { await request('/storage/v1/object/' + encoded, { method: 'POST', body: bytes, binary: true }); return { skipped: false, sha256: digest }; }
      catch (error) {
        if (![400, 409].includes(error.status)) throw error;
        const existing = await request('/storage/v1/object/authenticated/' + encoded);
        if (checksum(Buffer.from(await existing.arrayBuffer())) !== digest) throw new Error('Existing object checksum differs');
        return { skipped: true, sha256: digest };
      }
    },
    async getObject(bucket, key, actor, metadata, memberships) {
      requireObjectAccess(bucket, key, actor, metadata, memberships);
      const response = await request('/storage/v1/object/authenticated/' + objectPath(bucket, key));
      return Buffer.from(await response.arrayBuffer());
    },
    async signedUrl(bucket, key, actor, metadata, memberships, expiresIn = 60) {
      requireObjectAccess(bucket, key, actor, metadata, memberships);
      if (!Number.isInteger(expiresIn) || expiresIn < 1 || expiresIn > 300) throw new Error('Invalid signed URL lifetime');
      const result = await (await request('/storage/v1/object/sign/' + objectPath(bucket, key), { method: 'POST', body: { expiresIn } })).json();
      if (typeof result.signedURL !== 'string' || !result.signedURL.startsWith('/object/sign/')) throw new Error('Invalid signed URL response');
      return base + '/storage/v1' + result.signedURL;
    },
  };
}
