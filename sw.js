/* Service worker for the Formative Assessment page only.
   It keeps a copy of formative.html so that a reload while Wi-Fi is off still opens the test.
   It always tries the network first, so updates to the page arrive as normal when online. */
var CACHE = "formative-page-v1";
var PAGE = "formative.html";

self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.add(PAGE); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k.indexOf("formative-page-") === 0 && k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener("fetch", function (e) {
  var url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== self.location.origin) return;
  if (!/\/formative\.html$/.test(url.pathname)) return;
  e.respondWith(
    fetch(e.request).then(function (res) {
      if (res && res.ok) { var copy = res.clone(); caches.open(CACHE).then(function (c) { c.put(PAGE, copy); }); }
      return res;
    }).catch(function () {
      return caches.match(PAGE, { ignoreSearch: true }).then(function (r) { return r || Response.error(); });
    })
  );
});
