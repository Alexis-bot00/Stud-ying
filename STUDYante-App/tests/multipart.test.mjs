import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import http from 'node:http';
import { appendUploadFile } from '../src/lib/multipart.ts';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const multer = require('../../backend/node_modules/multer');
const source = path => fs.readFileSync(new URL(path, import.meta.url), 'utf8');
// Exercise the installed Expo serializer, without loading native modules or credentials.
const exports = {};
vm.runInNewContext(ts.transpileModule(
  source('../node_modules/expo/src/winter/fetch/convertFormData.ts'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS } },
).outputText, {
  exports, Blob, Uint8Array, TextEncoder, FormData,
  require: () => ({ blobToArrayBufferAsync: blob => blob.arrayBuffer() }),
});
const { convertFormDataAsync } = exports;
const asset = { uri: 'file:///synthetic-cache/opaque', name: 'synthetic.txt', mimeType: 'text/plain' };
const read = async () => new TextEncoder().encode('Synthetic transport fixture.');
class NativeFormData {
  _parts = [];
  append(name, value) { this._parts.push([name, value]); }
  entries() { return this._parts.values(); }
  getAll(name) { return this._parts.filter(part => part[0] === name).map(part => part[1]); }
}
const formDataExports = {};
vm.runInNewContext(ts.transpileModule(
  source('../node_modules/expo/src/winter/FormData.ts'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS } },
).outputText, { exports: formDataExports, Blob, Symbol });
formDataExports.installFormDataPatch(NativeFormData);

for (const [operation, fields, field, type] of [
  ['upload', {}, 'file', 'text/plain'],
  ['generation', { type: 'notes', provider: 'gemini' }, 'file', 'text/plain'],
  ['AI text', { question: 'Synthetic greeting.', provider: 'gemini' }, null, null],
  ['AI file', { question: 'Synthetic summary.' }, 'file', 'text/plain'],
  ['AI image', { question: 'Synthetic image.' }, 'image', 'image/png'],
  ['schedule calendar', { year: '2026' }, 'file', 'text/plain'],
  ['profile', { name: 'Synthetic' }, 'profilePicture', 'image/png'],
]) {
  test(`${operation}: Expo and Node multipart reach the same local parser`, async () => {
    const form = new NativeFormData();
    for (const [key, value] of Object.entries(fields)) form.append(key, value);
    if (field) await appendUploadFile(form, field, { ...asset, mimeType: type }, 'android', read);
    const serialized = await convertFormDataAsync(form);
    assert.match(serialized.boundary, /^----ExpoFetchFormBoundary[A-Za-z0-9]{16}$/);
    assert.ok(new TextDecoder().decode(serialized.body).endsWith(`--${serialized.boundary}--\r\n`));
    const summaries = [];
    const parser = multer({ storage: multer.memoryStorage(), limits: { fileSize: 1024 } }).any();
    const server = http.createServer((req, res) => parser(req, res, error => {
      if (error) { res.writeHead(400).end(); return; }
      // Only structural metadata is retained. Never print request contents.
      summaries.push({ fields: Object.keys(req.body).sort(), files: req.files.map(file => ({
        field: file.fieldname, name: file.originalname, type: file.mimetype, size: file.size,
      })) });
      res.writeHead(204).end();
    }));
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    try {
      const url = `http://127.0.0.1:${server.address().port}/synthetic`;
      const expoResponse = await fetch(url, { method: 'POST', body: serialized.body,
        headers: { 'Content-Type': `multipart/form-data; boundary=${serialized.boundary}` } });
      const nodeForm = new FormData();
      for (const [key, value] of form.entries()) {
        if (typeof value === 'string') nodeForm.append(key, value);
        else nodeForm.append(key, new Blob([await value.bytes()], { type: value.type }), value.name);
      }
      const nodeResponse = await fetch(url, { method: 'POST', body: nodeForm });
      assert.equal(expoResponse.status, 204);
      assert.equal(nodeResponse.status, 204);
      assert.deepEqual(summaries[0], summaries[1]);
      if (field) { assert.equal(summaries[0].files[0].name, asset.name); assert.equal(summaries[0].files[0].type, type); }
    } finally { await new Promise(resolve => server.close(resolve)); }
  });
}

test('web preserves browser File and never reads a native URI', async () => {
  const file = new File(['Synthetic.'], 'synthetic.txt', { type: 'text/plain' });
  const form = new FormData();
  await appendUploadFile(form, 'file', { ...asset, file }, 'web', () => { throw Error('Native read on web'); });
  assert.equal(form.get('file').name, file.name);
  assert.equal(form.get('file').type, file.type);
  assert.deepEqual(await form.get('file').arrayBuffer(), await file.arrayBuffer());
});

test('multiple attachments preserve selection order and MIME metadata', async () => {
  const form = new NativeFormData();
  for (const name of ['synthetic-a.txt', 'synthetic-b.txt']) await appendUploadFile(form, 'file', { ...asset, name }, 'android', read);
  assert.deepEqual(form.getAll('file').map(file => file.name), ['synthetic-a.txt', 'synthetic-b.txt']);
});

test('Expo rejects the previous native URI-only profile descriptor', async () => {
  const legacy = { entries: () => [['profilePicture', { uri: asset.uri, name: asset.name, type: asset.mimeType }]] };
  await assert.rejects(convertFormDataAsync(legacy), /Unsupported FormDataPart implementation/);
});

test('ExpoFile-like parts ignore an external filename argument', async () => {
  const cached = { name: 'opaque', type: 'application/octet-stream', bytes: read };
  const legacy = new NativeFormData();
  legacy.append('file', cached, 'synthetic.txt');
  const encoded = await convertFormDataAsync(legacy);
  assert.ok(new TextDecoder().decode(encoded.body).includes('filename="opaque"'));
});

test('all file callers await the shared helper; schedule scan retains JSON contract', () => {
  const app = source('../src/app/index.tsx');
  assert.match(app, /await attachFile\(form, selectedAsset\)/);
  assert.match(app, /await attachFile\(form\)/);
  assert.match(app, /await attachUploadFile\(form, selectedKind/);
  assert.match(app, /await attachUploadFile\(form, 'profilePicture'/);
  assert.match(source('../src/components/circle-materials.tsx'), /await attachUploadFile\(body, 'file'/);
  assert.match(source('../src/components/school-calendar.tsx'), /await attachUploadFile\(form, 'file'/);
  assert.match(source('../src/components/schedule-scan.tsx'), /body: JSON.stringify\(\{ imageBase64: photo.base64, mimeType: photo.mimeType \}\)/);
  assert.doesNotMatch(app, /['"]Content-(?:Length|Type)['"]\s*:\s*['"]multipart\/form-data/);
});
