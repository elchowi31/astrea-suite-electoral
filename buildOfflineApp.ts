import type {Plugin} from 'vite';
import {createHash} from 'node:crypto';
import {readFileSync,existsSync} from 'node:fs';
import path from 'node:path';
export function offlineAppPlugin():Plugin{
  let publicDirectory=path.resolve('public');
  return {name:'astrea-offline-app',apply:'build',configResolved(config){publicDirectory=config.publicDir;},generateBundle(_options,bundle){
    const files=['/','/index.html','/manifest.webmanifest','/astrea-icon.svg','/astrea-192.png','/astrea-512.png','/astrea-maskable-512.png','/ejemplo-ubicaciones.csv',...Object.keys(bundle).filter(name=>!name.endsWith('.map')).map(name=>`/${name}`)];
    // HTML and public assets may change without changing their filenames.
    const digest=createHash('sha256').update('astrea-offline-v2').update(JSON.stringify([...files].sort()));
    for(const name of Object.keys(bundle).sort()){
      const item=bundle[name];
      digest.update(name).update(item.type==='chunk'?item.code:item.source);
    }
    if(publicDirectory)for(const file of files){
      const filename=path.join(publicDirectory,file.slice(1));
      if(file!=='/'&&!bundle[file.slice(1)]&&existsSync(filename))digest.update(file).update(readFileSync(filename));
    }
    const version=digest.digest('hex').slice(0,16);
    this.emitFile({type:'asset',fileName:'service-worker.js',source:`const CACHE=${JSON.stringify(`astrea-app-${version}`)};const FILES=${JSON.stringify([...new Set(files)])};
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(FILES))));
self.addEventListener('activate',event=>event.waitUntil(Promise.all([caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('astrea-app-')&&key!==CACHE).map(key=>caches.delete(key)))),self.clients.claim()])));
self.addEventListener('message',event=>{if(event.data?.type!=='ASTREA_OFFLINE_STATUS'||!event.ports?.[0])return;event.waitUntil(caches.open(CACHE).then(async cache=>{const results=await Promise.all(FILES.map(file=>cache.match(file)));event.ports[0].postMessage({ready:results.every(Boolean),files:results.filter(Boolean).length,total:FILES.length});}));});
self.addEventListener('fetch',event=>{const request=event.request;const url=new URL(request.url);if(request.method!=='GET'||url.origin!==self.location.origin||url.pathname==='/api'||url.pathname.startsWith('/api/')||request.headers.has('authorization'))return;
if(request.mode==='navigate'){event.respondWith(fetch(request).catch(()=>caches.open(CACHE).then(cache=>cache.match('/index.html'))));return;}
if(FILES.includes(url.pathname)){event.respondWith(caches.open(CACHE).then(cache=>cache.match(request)).then(cached=>cached||fetch(request)));}});`});
  }};
}

