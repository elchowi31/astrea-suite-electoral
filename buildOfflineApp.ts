import type {Plugin} from 'vite';
import {createHash} from 'node:crypto';
export function offlineAppPlugin():Plugin{
  return {name:'astrea-offline-app',apply:'build',generateBundle(_options,bundle){
    const files=['/','/index.html','/manifest.webmanifest','/astrea-icon.svg','/astrea-192.png','/astrea-512.png','/astrea-maskable-512.png','/ejemplo-ubicaciones.csv',...Object.keys(bundle).filter(name=>!name.endsWith('.map')).map(name=>`/${name}`)];
    const version=createHash('sha256').update(JSON.stringify(files)).digest('hex').slice(0,16);
    this.emitFile({type:'asset',fileName:'service-worker.js',source:`const CACHE=${JSON.stringify(`astrea-app-${version}`)};const FILES=${JSON.stringify([...new Set(files)])};
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(FILES))));
self.addEventListener('activate',event=>event.waitUntil(Promise.all([caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('astrea-app-')&&key!==CACHE).map(key=>caches.delete(key)))),self.clients.claim()])));
self.addEventListener('fetch',event=>{const request=event.request;const url=new URL(request.url);if(request.method!=='GET'||url.origin!==self.location.origin||url.pathname.startsWith('/api/'))return;
if(request.mode==='navigate'){event.respondWith(fetch(request).catch(()=>caches.match('/index.html')));return;}
if(FILES.includes(url.pathname)){event.respondWith(caches.match(request).then(cached=>cached||fetch(request)));}});`});
  }};
}
