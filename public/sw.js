// One-time retirement of the previous caching worker.
// This script is not registered by new development builds.
// It remains at the prior worker URL so an installed older PWA can retire it.
self.addEventListener('install',event=>event.waitUntil(self.skipWaiting()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{
  await self.registration.unregister();
  const keys=await caches.keys();
  await Promise.all(keys.filter(key=>key.startsWith('workbox-precache')||key.startsWith('workbox-runtime')).map(key=>caches.delete(key)));
  const clientsList=await self.clients.matchAll({type:'window',includeUncontrolled:true});
  for(const client of clientsList){
    try{if(new URL(client.url).pathname.startsWith('/Game/'))client.navigate(client.url);}
    catch{}
  }
})()));
