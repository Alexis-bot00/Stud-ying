import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createAccountCache, accountCacheKey } from '../src/components/account-cache.ts';
const fixture = () => {
  const data = new Map();
  const store = { getItem: async k => data.get(k) ?? null, setItem: async (k,v) => { data.set(k,v); }, removeItem: async k => { data.delete(k); }, getAllKeys: async () => [...data.keys()] };
  return { data, store, cache: createAccountCache(store) };
};
test('ambiguous legacy caches are discarded rather than assigned to a login', async () => {
  const {data,cache}=fixture();
  data.set('studyanteOfflineUser','legacy-private'); data.set('studyanteOfflineLibrary','legacy-private');
  await cache.bind('synthetic-a','token-a');
  assert.equal(await cache.read('library','synthetic-a'),null);
  assert.equal(data.has('studyanteOfflineUser'),false); assert.equal(data.has('studyanteOfflineLibrary'),false);
});
test('accounts only read their own envelopes and keys cannot alias', async () => {
  const {data,cache}=fixture(); await cache.bind('synthetic-a','token-a'); await cache.write('library','synthetic-a',{notes:['synthetic-a']});
  await cache.bind('synthetic-b','token-b'); assert.equal(await cache.read('library','synthetic-a'),null); assert.equal(await cache.read('library','synthetic-b'),null);
  data.set(accountCacheKey('library','synthetic-b'),JSON.stringify({userId:'synthetic-a',value:'private'})); assert.equal(await cache.read('library','synthetic-b'),null);
  assert.notEqual(accountCacheKey('user','a:b'),accountCacheKey('b:user','a'));
});
test('restart requires exact token binding and restores only the matching account', async () => {
  const {store,cache}=fixture();await cache.bind('synthetic-a','token-a');await cache.write('user','synthetic-a',{id:'synthetic-a'});
  const restarted=createAccountCache(store);assert.equal(await restarted.restore('token-b'),null);assert.equal(await restarted.read('user','synthetic-a'),null);
  assert.equal(await restarted.restore('token-a'),'synthetic-a');assert.deepEqual(await restarted.read('user','synthetic-a'),{id:'synthetic-a'});
});
test('logout removes sensitive account/session keys and rejects late writes', async () => {
  const {data,cache}=fixture();await cache.bind('synthetic-a','token-a');await cache.write('library','synthetic-a',{notes:['synthetic']});
  data.set('circle-jacket:synthetic-a:room','green');data.set('circle-jacket:synthetic-b:room','blue');data.set('cappy-planner:synthetic-a','unsynced-planner');
  const late=cache.write('user','synthetic-a',{id:'synthetic-a'});await cache.logout('synthetic-a');await late;await cache.write('library','synthetic-a',{});
  assert.equal(data.has(accountCacheKey('library','synthetic-a')),false);assert.equal(data.has(accountCacheKey('user','synthetic-a')),false);assert.equal(data.has('studyante-account-session'),false);
  assert.equal(data.has('circle-jacket:synthetic-a:room'),false);assert.equal(data.has('circle-jacket:synthetic-b:room'),true);assert.equal(data.get('cappy-planner:synthetic-a'),'unsynced-planner');
});
test('corrupt session and cache payloads fail closed', async () => {
  const {data,cache}=fixture();data.set('studyante-account-session','invalid');assert.equal(await cache.restore('token-a'),null);
  await cache.bind('synthetic-a','token-a');data.set(accountCacheKey('library','synthetic-a'),'invalid');assert.equal(await cache.read('library','synthetic-a'),null);
});
