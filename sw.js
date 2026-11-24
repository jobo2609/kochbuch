/* Offline-Speicher für das Kochbuch.
   Die App-Seite selbst wird immer zuerst frisch aus dem Internet geholt (damit Updates sofort
   ankommen); nur ohne Netz oder bei sehr langsamer Verbindung kommt die gespeicherte Version.
   Bilder und Icons kommen sofort aus dem Speicher und werden im Hintergrund aufgefrischt.
   Bei Änderungen an der App VERSION erhöhen (und APP_VERSION in index.html). */
const VERSION = "kochbuch-v19";
const FILES = ["./", "index.html", "manifest.webmanifest", "icons/apple-touch-icon.png", "icons/icon-192.png", "icons/icon-512.png", "icons/favicon.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(FILES.map(f => new Request(f, {cache: "reload"})))).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== location.origin) return;
  /* Die Abo-App im Unterordner abos/ hat ihren eigenen Offline-Speicher */
  if (url.pathname.includes("/abos/")) return;
  const page = req.mode === "navigate" || url.pathname.endsWith("/") || url.pathname.endsWith(".html");
  e.respondWith(caches.open(VERSION).then(async cache => {
    const hit = await cache.match(req, {ignoreSearch: true}) || (page && await cache.match("./"));
    const net = fetch(req, {cache: "no-cache"}).then(res => { if (res.ok) cache.put(page ? "./" : req, res.clone()); return res });
    if (page) {
      /* Netz zuerst, nach 4 Sekunden ohne Antwort die gespeicherte Seite */
      const slow = new Promise(ok => setTimeout(() => ok(hit), 4000));
      try { return (await Promise.race([net, slow])) || await net } catch { return hit || Response.error() }
    }
    if (hit) { e.waitUntil(net.catch(() => {})); return hit }
    return net;
  }));
});
