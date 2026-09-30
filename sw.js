const CACHE="fitness-v8.4.3-iphone14";
const ASSETS=[
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./ai.js",
  "./foods.js",
  "./health.js",
  "./integrations.js",
  "./gpx-report.js",
  "./manifest.webmanifest",
  "./assets/icons/icon-192.png",
  "./assets/icons/icon-512.png",
  "./assets/icons/apple-touch-icon-180.png",
  "./assets/icons/apple-touch-icon-167.png"
];

// Install - pre-cache core assets (iOS limit ~50MB, keep small)
self.addEventListener("install",e=>{
  e.waitUntil(
    caches.open(CACHE).then(c=>c.addAll(ASSETS).catch(err=>{console.log("cache add failed",err);}))
  );
  self.skipWaiting();
});

// Activate - clean old caches (critical for iOS storage)
self.addEventListener("activate",e=>{
  e.waitUntil(
    caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())
  );
});

// Fetch - iOS friendly: network first for API, cache first for assets
self.addEventListener("fetch",e=>{
  if(e.request.method!=="GET") return;
  const url = new URL(e.request.url);
  
  // NEVER cache supabase API or puter AI - always network
  if(url.hostname.includes("supabase.co") || url.hostname.includes("puter.com") || url.hostname.includes("openstreetmap.org")){
    e.respondWith(fetch(e.request).catch(()=>caches.match(e.request)));
    return;
  }
  
  // For navigation requests (iPhone PWA launch) - return index.html
  if(e.request.mode === "navigate"){
    e.respondWith(
      fetch(e.request).then(r=>{
        const clone=r.clone();
        caches.open(CACHE).then(c=>c.put(e.request,clone));
        return r;
      }).catch(()=>caches.match("./index.html").then(r=>r||caches.match("/")))
    );
    return;
  }
  
  // For assets - cache first, network fallback
  if(e.request.url.startsWith(self.location.origin)){
    e.respondWith(
      caches.match(e.request).then(cached=>{
        if(cached) return cached;
        return fetch(e.request).then(r=>{
          // Only cache 200 OK, same-origin
          if(r.ok){
            const clone=r.clone();
            caches.open(CACHE).then(c=>c.put(e.request,clone));
          }
          return r;
        }).catch(()=>caches.match(e.request));
      })
    );
  }
});

// Handle skipWaiting message from app.js (for update)
self.addEventListener("message", e=>{
  if(e.data && e.data.type==="SKIP_WAITING"){
    self.skipWaiting();
  }
});
