"use client";

import { useEffect, useState } from "react";
import { deleteSubscription, saveSubscription, sendTestNotification } from "@/app/actions/notifications";
import type { Messages } from "@/i18n/dictionaries";

type Status = "loading" | "unsupported" | "off" | "on";

/** The public VAPID key as the bytes `PushManager.subscribe` expects. */
function keyBytes(base64Url: string) {
  const base64 = (base64Url + "=".repeat((4 - (base64Url.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
}

function serviceWorker() {
  return navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" });
}

/**
 * Turns due payment reminders on or off for this device: registers the service worker, asks for permission, and
 * saves the push subscription. Once on, a test notification checks the whole path.
 */
export function NotificationsForm({ messages, locale, publicKey }: { messages: Messages["notifications"]; locale: string; publicKey: string | null }) {
  const [status, setStatus] = useState<Status>("loading");
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
    const found: Promise<Status> = supported
      ? serviceWorker().then((registration) => registration.pushManager.getSubscription()).then((subscription) => (subscription ? "on" : "off"))
      : Promise.resolve("unsupported");
    found.catch((): Status => "unsupported").then(setStatus);
  }, []);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setNotice(null);
    try {
      await action();
    } catch {
      setNotice(messages.failed);
    } finally {
      setBusy(false);
    }
  }

  const enable = () => run(async () => {
    if (!publicKey) return setNotice(messages.notConfigured);
    if ((await Notification.requestPermission()) !== "granted") return setNotice(messages.denied);
    const registration = await serviceWorker();
    const subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(publicKey) });
    await saveSubscription(subscription.toJSON(), locale);
    setStatus("on");
  });

  const disable = () => run(async () => {
    const subscription = await (await serviceWorker()).pushManager.getSubscription();
    if (subscription) {
      await deleteSubscription(subscription.endpoint);
      await subscription.unsubscribe();
    }
    setStatus("off");
  });

  const test = () => run(async () => {
    const reached = await sendTestNotification();
    setNotice(reached > 0 ? messages.testSent : messages.failed);
  });

  const buttonClass = "min-h-11 rounded-xl px-4 text-sm font-semibold transition disabled:opacity-60";

  return (
    <div className="space-y-3 p-4">
      <p className="text-sm text-muted-foreground">{messages.hint}</p>
      {status === "unsupported" ? <p className="text-sm text-warning">{messages.unsupported}</p> : null}
      {status === "off" ? (
        <button className={`${buttonClass} w-full bg-primary text-primary-foreground`} disabled={busy} onClick={enable} type="button">{messages.enable}</button>
      ) : null}
      {status === "on" ? (
        <>
          <p className="text-sm text-gain">{messages.on}</p>
          <div className="flex flex-wrap gap-2">
            <button className={`${buttonClass} bg-primary text-primary-foreground`} disabled={busy} onClick={test} type="button">{messages.test}</button>
            <button className={`${buttonClass} border border-border text-muted-foreground`} disabled={busy} onClick={disable} type="button">{messages.disable}</button>
          </div>
        </>
      ) : null}
      {notice ? <p aria-live="polite" className="text-sm text-muted-foreground">{notice}</p> : null}
    </div>
  );
}
