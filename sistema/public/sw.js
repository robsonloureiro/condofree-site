// Service worker do CondoFree: recebe as notificações push e abre o
// painel quando a pessoa toca na notificação. Não faz cache — o painel
// sempre busca os dados atuais do servidor.
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }
  const titulo = data.titulo || "CondoFree";
  const corpo = data.corpo || "Você tem uma novidade no CondoFree.";
  const url = data.url || "/painel";
  event.waitUntil(
    self.registration.showNotification(titulo, {
      body: corpo,
      icon: "/api/icone/192",
      badge: "/api/icone/192",
      data: { url },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/painel";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if (client.url.includes(url)) return client.focus();
      }
      return self.clients.openWindow(url);
    }),
  );
});
