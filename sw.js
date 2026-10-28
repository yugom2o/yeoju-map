const ROOT=new URL('.',self.location.href);
const VERSION='f461ed6e4cd8334f';
const CACHE='yj-v3:'+ROOT.pathname+':'+VERSION;
const FILES=['./','./index.html','./login.mjs','./crypto.mjs','./passkey.mjs','./manifest.webmanifest','./icon-192.png','./icon-512.png'];
// Inspect the actual controlling worker and its cache; no network fetch is made.
self.addEventListener('message',event=>{
  if(event.data?.type!=='YJ_OFFLINE_STATUS'||!event.ports[0])return;
  event.waitUntil((async()=>{
    const cache=await caches.open(CACHE),entries=await Promise.all(FILES.map(path=>cache.match(new URL(path,ROOT))));
    event.ports[0].postMessage({version:VERSION,complete:entries.every(response=>response?.ok)});
  })());
});
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(FILES.map(path=>new Request(new URL(path,ROOT),{cache:'reload'}))))));
self.addEventListener('activate',event=>event.waitUntil((async()=>{
  const prefix='yj-v3:'+ROOT.pathname+':';
  for(const name of await caches.keys()) if(name.startsWith(prefix)&&name!==CACHE) await caches.delete(name);
  await self.clients.claim();
})()));
self.addEventListener('fetch',event=>{
  const url=new URL(event.request.url);
  if(event.request.method!=='GET'||url.origin!==ROOT.origin) return;
  const relative=url.pathname.slice(ROOT.pathname.length);
  if(!url.pathname.startsWith(ROOT.pathname)||!['','index.html','login.mjs','crypto.mjs','passkey.mjs','manifest.webmanifest','icon-192.png','icon-512.png'].includes(relative)) return;
  event.respondWith((async()=>{
    const cache=await caches.open(CACHE);
    return await cache.match(new URL(relative||'./',ROOT)) || fetch(event.request);
  })());
});
