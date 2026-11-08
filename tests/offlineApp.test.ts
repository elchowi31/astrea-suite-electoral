import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, unlinkSync, rmdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { offlineAppPlugin } from '../buildOfflineApp.ts';

function worker(html = '<html>v1</html>', publicDir = '', reverse = false) {
  const plugin = offlineAppPlugin();
  (plugin.configResolved as Function)({ publicDir });
  const entries = [
    ['index.html', { type: 'asset', source: html }],
    ['assets/app.js', { type: 'chunk', code: 'console.log("loaded")' }]
  ];
  let source = '';
  (plugin.generateBundle as Function).call({ emitFile(item: { source: string }) { source = item.source; } }, {}, Object.fromEntries(reverse ? entries.reverse() : entries));
  return source;
}
function cacheName(source: string) { return /const CACHE=("[^"]+")/.exec(source)?.[1]; }
function runtime(source: string) {
  const handlers: Record<string, Function> = {};
  const opened: string[] = [];
  const removed: string[] = [];
  const current = JSON.parse(cacheName(source)!);
  const context = {
    URL,
    self: { location: { origin: 'https://app.invalid' }, clients: { claim: async () => undefined }, addEventListener(name: string, handler: Function) { handlers[name] = handler; } },
    fetch: async () => { throw new Error('offline'); },
    caches: {
      open: async (name: string) => { opened.push(name); return { match: async () => 'CURRENT_VERSION', addAll: async () => undefined }; },
      keys: async () => [current, 'astrea-app-old', 'other-application'],
      delete: async (name: string) => { removed.push(name); return true; },
      match: async () => { throw new Error('Cross-version cache lookup is forbidden'); }
    }
  };
  vm.runInNewContext(source, context);
  return { handlers, opened, removed, current };
}

test('offline cache changes when HTML content changes without renaming files', () => {
  assert.notEqual(cacheName(worker('<html>v1</html>')), cacheName(worker('<html>v2</html>')));
});
test('offline cache version is deterministic regardless of bundle iteration order', () => {
  assert.equal(cacheName(worker('same', '', false)), cacheName(worker('same', '', true)));
});
test('offline cache changes when a public manifest changes without renaming it', () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'astrea-offline-test-'));
  const filename = path.join(directory, 'manifest.webmanifest');
  try {
    writeFileSync(filename, '{"name":"v1"}');
    const first = worker('same', directory);
    writeFileSync(filename, '{"name":"v2"}');
    assert.notEqual(cacheName(first), cacheName(worker('same', directory)));
  } finally { unlinkSync(filename); rmdirSync(directory); }
});
test('service worker never intercepts API, authorized, external or non-GET requests', () => {
  const { handlers } = runtime(worker());
  for (const [url, method, authenticated] of [
    ['/api', 'GET', false], ['/api/health', 'GET', false], ['/assets/app.js', 'GET', true],
    ['https://other.invalid/assets/app.js', 'GET', false], ['/assets/app.js', 'POST', false]
  ] as const) {
    handlers.fetch({ request: { url: new URL(url, 'https://app.invalid').href, method, headers: new Headers(authenticated ? { Authorization: 'Bearer fake' } : {}), mode: 'cors' }, respondWith() { assert.fail('Sensitive request was intercepted'); } });
  }
});
test('offline navigation and assets resolve only from the current release cache', async () => {
  const { handlers, opened, current } = runtime(worker());
  for (const [pathname, mode] of [['/page', 'navigate'], ['/assets/app.js', 'cors']]) {
    let response: Promise<unknown> | undefined;
    handlers.fetch({ request: { url: `https://app.invalid${pathname}`, method: 'GET', headers: new Headers(), mode }, respondWith(value: Promise<unknown>) { response = value; } });
    assert.equal(await response, 'CURRENT_VERSION');
  }
  assert.deepEqual(opened, [current, current]);
});
test('activating a release removes old application caches while preserving unrelated caches', async () => {
  const { handlers, removed } = runtime(worker());
  let completion: Promise<unknown> | undefined;
  handlers.activate({ waitUntil(value: Promise<unknown>) { completion = value; } });
  await completion;
  assert.deepEqual(removed, ['astrea-app-old']);
});

test('offline preparation is confirmed using every asset of the active worker release',async()=>{
  const {handlers}=runtime(worker());
  let completion:Promise<unknown>|undefined;let response:any;
  handlers.message({data:{type:'ASTREA_OFFLINE_STATUS'},ports:[{postMessage(value:unknown){response=value;}}],waitUntil(value:Promise<unknown>){completion=value;}});
  await completion;
  assert.equal(response.ready,true);assert.ok(response.total>2);assert.equal(response.files,response.total);
  let called=false;
  handlers.message({data:{type:'UNKNOWN'},ports:[{postMessage(){called=true;}}],waitUntil(){called=true;}});
  assert.equal(called,false);
});
