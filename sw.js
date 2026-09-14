const CACHE='gith-meal-labels-v3';
const ASSETS=['./','./index.html','./manifest.webmanifest','./parser-fix.js'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET')return;
  if(e.request.mode==='navigate'){
    e.respondWith(fetch(e.request).then(async resp=>{
      let html=await resp.text();
      if(!html.includes('parser-fix.js')) html=html.replace('</body>','<script src="./parser-fix.js?v=3"></script></body>');
      return new Response(html,{status:resp.status,statusText:resp.statusText,headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-cache'}});
    }).catch(()=>caches.match('./index.html')));
    return;
  }
  e.respondWith(fetch(e.request).then(resp=>{const copy=resp.clone();caches.open(CACHE).then(c=>c.put(e.request,copy));return resp}).catch(()=>caches.match(e.request)));
});