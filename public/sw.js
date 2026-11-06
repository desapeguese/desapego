// Service worker da carteira. Não guarda páginas nem dados: o app exige
// conexão. Só troca o erro do navegador pela tela "sem conexão".
const CACHE = "desapego-v1";
const SEM_CONEXAO = "/sem-conexao.html";

self.addEventListener("install", (evento) => {
  evento.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.add(new Request(SEM_CONEXAO, { cache: "reload" })))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (evento) => {
  evento.waitUntil(
    caches
      .keys()
      .then((nomes) => Promise.all(nomes.filter((n) => n !== CACHE).map((n) => caches.delete(n))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (evento) => {
  if (evento.request.mode !== "navigate") return;
  evento.respondWith(fetch(evento.request).catch(() => caches.match(SEM_CONEXAO)));
});
