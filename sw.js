const ROOT=new URL('.',self.location.href);
const CACHE='yj-v3:'+ROOT.pathname+':dc42c52ce9eb7c74';
const FILES=['./','./index.html','./login.mjs','./crypto.mjs','./manifest.webmanifest','./icon-192.png','./icon-512.png'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(FILES))));
self.addEventListener('activate',event=>event.waitUntil((async()=>{
  const prefix='yj-v3:'+ROOT.pathname+':';
  for(const name of await caches.keys()) if(name.startsWith(prefix)&&name!==CACHE) await caches.delete(name);
  await self.clients.claim();
})()));
self.addEventListener('fetch',event=>{
  const url=new URL(event.request.url);
  if(event.request.method!=='GET'||url.origin!==ROOT.origin) return;
  const relative=url.pathname.slice(ROOT.pathname.length);
  if(!url.pathname.startsWith(ROOT.pathname)||!['','index.html','login.mjs','crypto.mjs','manifest.webmanifest','icon-192.png','icon-512.png'].includes(relative)) return;
  event.respondWith((async()=>{
    const cache=await caches.open(CACHE);
    return await cache.match(new URL(relative||'./',ROOT)) || fetch(event.request);
  })());
});
