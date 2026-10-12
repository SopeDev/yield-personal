// Receives Web Push notifications (due payment reminders) and opens the app on the page they point to when tapped.
// It handles no requests, so it never changes how the app loads.

self.addEventListener("push", (event) => {
  const data = event.data ? event.data.json() : {};
  event.waitUntil(
    self.registration.showNotification(data.title || "Yield", {
      body: data.body,
      icon: "/icons/icon-192.png",
      tag: data.tag,
      data: { url: data.url || "/" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      const open = windows.find((client) => "focus" in client);
      if (open) return open.navigate(url).then((client) => (client ?? open).focus());
      return self.clients.openWindow(url);
    }),
  );
});
