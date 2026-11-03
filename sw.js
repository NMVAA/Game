// Versioned PWA cache. No remote libraries or API calls required.
const CACHE='football-life-v2';
const CORE=['./','./index.html','./styles.css','./ui.js','./engine.js','./story.js','./data.js','./manifest.webmanifest','./icon.svg'];
self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(CORE)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE&&k.startsWith('football-life-')).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  const url=new URL(event.request.url);
  const scope=new URL(self.registration.scope);
  if(url.origin!==scope.origin || !url.pathname.startsWith(scope.pathname))return;
  event.respondWith((async()=>{
    const cache=await caches.open(CACHE);
    if(event.request.mode==='navigate'){
      try{const response=await fetch(event.request);if(response.ok)cache.put(event.request,response.clone());return response;}
      catch{const saved=await cache.match(event.request)||await cache.match('./index.html')||await cache.match('./');return saved||Response.error();}
    }
    const cached=await cache.match(event.request,{ignoreSearch:true});
    if(cached)return cached;
    const network=await fetch(event.request);
    if(network.ok)cache.put(event.request,network.clone());
    return network;
  })());
});
