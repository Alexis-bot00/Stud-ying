import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { AsyncLocalStorage } from 'node:async_hooks';
import { createRepository, checksum, documentNames } from './repository.js';
import { diagnosticStage } from '../diagnostics.js';

const defaults = { 'users.json': [], 'index.json': { folders: [], files: [], flashcardSets: [], studyMaterials: [] }, 'chats.json': [], 'admin-logs.json': [], 'announcements.json': [], 'cappy-friends.json': { links: [], messages: [] }, 'study-circles.json': { sessions: [] } };
export function createRuntimeStore({ env = process.env, directory = path.resolve('library'), repository } = {}) {
  const repo = repository || createRepository({ env, directory, allowNetwork: (env.STORAGE_DRIVER || 'file') === 'supabase' });
  const context = new AsyncLocalStorage();
  const namespace = env.STORAGE_NAMESPACE || '';
  if (namespace && !/^synthetic_[a-z0-9_]+$/.test(namespace)) throw new Error('Only clearly marked synthetic namespaces are allowed');
  const nameOf = file => { const name = path.basename(file); if (!documentNames.has(name)) throw new Error('Invalid document'); return name; };
  const state = () => { const value = context.getStore(); if (!value) { diagnosticStage('storage_context_missing'); throw new Error('Storage access outside a request'); } return value; };
  let tail = Promise.resolve();
  const snapshots = new WeakMap();
  const store = {
    driver: repo.driver,
    bind(req, res, next) { diagnosticStage('storage_bind'); const snapshot = snapshots.get(req); if (snapshot) return context.run(snapshot, next); next(); },
    read(file) {
      const name = nameOf(file);
      if (repo.driver === 'file') return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : JSON.stringify(defaults[name]);
      return JSON.stringify(state().documents[name].payload);
    },
    exists(file) { return repo.driver === 'file' ? fs.existsSync(file) : !!state().documents[nameOf(file)]; },
    write(file, text) {
      if (repo.driver === 'file') { fs.writeFileSync(file, text, 'utf8'); return; }
      const name = nameOf(file), value = JSON.parse(text);
      state().documents[name].payload = name === 'index.json' ? { ...state().documents[name].payload, ...value } : value;
      state().dirty.add(name);
    },
    middleware(req, res, next) {
      if (repo.driver === 'file') return next();
      // The existing root route is a process-liveness response with no data
      // access. Health probes must not join the serialized document queue:
      // an AI request or slow database read could otherwise unroute the service.
      if ((req.method === 'GET' || req.method === 'HEAD') && req.path === '/') return next();
      diagnosticStage('storage_queued');
      // Serialize this process; atomic checksum validation rejects cross-process
      // conflicts instead of silently losing requests or retrying AI/email writes.
      const previous = tail; let unlock; tail = new Promise(resolve => { unlock = resolve; });
      let released = false; const release = () => { if (!released) { released = true; unlock(); } };
      previous.then(async () => {
        const documents = await repo.readDocuments(namespace, defaults);
        const snapshot = { documents, originalFiles: structuredClone(documents['index.json'].payload.files || []), dirty: new Set(), removals: [] };
        snapshots.set(req, snapshot);
        diagnosticStage('storage_context_ready');
        const end = res.end.bind(res); let ending = false;
        res.once('close', () => { if (!ending) release(); });
        res.end = function(...args) {
          if (ending) return res; ending = true;
          context.run(snapshot, async () => {
            try {
              if (snapshot.dirty.size) await repo.commitDocuments(namespace, [...snapshot.dirty].map(name => ({ name, payload: documents[name].payload, expectedChecksum: documents[name].checksum, checksum: checksum(Buffer.from(JSON.stringify(documents[name].payload))) })));
              for (const object of snapshot.removals) await repo.deleteObject(object.bucket, object.key);
              end(...args);
            } catch (error) {
              diagnosticStage('storage_failed', error);
              // Uploaded objects are safe to clean only when document commit
              // was rejected with certainty; otherwise leave recoverable orphans.
              if (!res.headersSent) {
                res.statusCode = 503; res.removeHeader('Content-Length'); res.setHeader('Content-Type', 'application/json');
                end(JSON.stringify({ success: false, message: 'Could not save your changes. Please try again.' }));
              } else res.destroy();
            } finally { release(); }
          });
          return res;
        };
        context.run(snapshot, next);
      }).catch(error => { diagnosticStage('storage_failed', error); release(); res.status(503).json({ success: false, message: 'Storage is temporarily unavailable. Please try again.' }); });
    },
    async saveLibraryFile(item, temporaryPath) {
      diagnosticStage('object_write_begin');
      if (repo.driver === 'file') { fs.renameSync(temporaryPath, path.join(directory, 'files', item.storedName)); return; }
      const bucket = ['.jpg','.jpeg','.png','.webp'].includes(item.extension.toLowerCase()) ? 'images' : 'documents';
      const key = `${namespace ? namespace + '/' : ''}${encodeURIComponent(item.userId)}/${encodeURIComponent(item.id)}/${item.storedName}`;
      await repo.putObject(bucket, key, fs.readFileSync(temporaryPath));
      diagnosticStage('object_write_complete');
      const index = state().documents['index.json'].payload;
      (index._storageObjects ||= {})[item.storedName] = { bucket, key };
      fs.unlinkSync(temporaryPath);
    },
    async saveProfilePicture(user, bytes, mimeType) {
      if (repo.driver === 'file') return;
      const key = `${namespace ? namespace + '/' : ''}${encodeURIComponent(user.id)}/${checksum(bytes)}`;
      await repo.putObject('profile-images', key, bytes);
    },
    removeLibraryFile(filePath) {
      const storedName = path.basename(filePath);
      if (repo.driver === 'file') { if (fs.existsSync(filePath)) fs.unlinkSync(filePath); return; }
      const index = state().documents['index.json'].payload;
      const item = (index.files || []).find(f => f.storedName === storedName) || state().originalFiles.find(f => f.storedName === storedName);
      if (item) state().removals.push(location(item));
    },
    async sendLibraryFile(item, actor, res) {
      if (repo.driver === 'file') {
        const file = path.join(directory,'files',item.storedName);
        if (!fs.existsSync(file)) return res.status(404).json({ success:false,message:'Saved file is missing.' });
        return res.sendFile(file);
      }
      const object = location(item);
      const bytes = await repo.getObject(object.bucket,object.key,actor,{...object,userId:item.userId});
      const temporary = fs.mkdtempSync(path.join(os.tmpdir(),'studyante-download-'));
      const file = path.join(temporary,path.basename(item.storedName)); fs.writeFileSync(file,bytes);
      if (item.uploadedAt && Number.isFinite(Date.parse(item.uploadedAt))) fs.utimesSync(file,new Date(item.uploadedAt),new Date(item.uploadedAt));
      return res.sendFile(file, error => { fs.rmSync(temporary,{recursive:true,force:true}); if (error && !res.headersSent) res.status(404).json({ success:false,message:'Saved file is missing.' }); });
    },
  };
  function location(item) { return state().documents['index.json'].payload._storageObjects?.[item.storedName] || item.storage || { bucket: ['.jpg','.jpeg','.png','.webp'].includes((item.extension || path.extname(item.storedName)).toLowerCase()) ? 'images':'documents', key: `${encodeURIComponent(item.userId)}/${encodeURIComponent(item.id)}/${item.storedName}` }; }
  return store;
}
