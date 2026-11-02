// Every release changes VERSION. Only this application's caches are removed.
const VERSION='0.3.0',PREFIX='game:'+new URL(self.registration.scope).pathname+':',CACHE=PREFIX+VERSION;
const CORE=['./','./index.html','./src/ui.css','./src/core.mjs','./src/world.mjs','./src/game.mjs','./src/navigation.mjs','./vendor/three.module.js','./map/pokrov.json','./manifest.webmanifest','./icon.svg','./icons/icon-192.png','./icons/icon-512.png'];
self.addEventListener('install',event=>event.waitUntil((async()=>{const cache=await caches.open(CACHE);await cache.addAll(CORE.map(path=>new Request(new URL(path,self.registration.scope),{cache:'reload'})));await self.skipWaiting();})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{for(const key of await caches.keys())if((key.startsWith(PREFIX)&&key!==CACHE)||key==='pokrov-3d-v1')await caches.delete(key);await self.clients.claim();})()));
self.addEventListener('fetch',event=>{
  const url=new URL(event.request.url),scope=new URL(self.registration.scope);
  if(event.request.method!=='GET'||url.origin!==scope.origin||!url.pathname.startsWith(scope.pathname))return;
  const key=url.origin+url.pathname;
  event.respondWith((async()=>{const cache=await caches.open(CACHE);
    if(event.request.mode==='navigate'||url.pathname.endsWith('manifest.webmanifest')){
      try{const response=await fetch(event.request);if(response.ok){await cache.put(key,response.clone());return response;}const old=await cache.match(key);return old||response;}
      catch(error){const old=await cache.match(key)||await cache.match(new URL('./index.html',scope).href);if(old)return old;throw error;}
    }
    const stored=await cache.match(key);if(stored)return stored;
    const response=await fetch(event.request);if(response.ok)await cache.put(key,response.clone());return response;
  })());
});
