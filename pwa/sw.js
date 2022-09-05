self.addEventListener('fetch', (e) => {
  //console.log(e);
  //r = fetch(e.request, {mode: 'cors',});
  //e.respondWith(r);
  e.respondWith(fetch(e.request));
});
