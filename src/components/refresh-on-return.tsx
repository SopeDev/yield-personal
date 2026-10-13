"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** How long the app has to be away before coming back reloads its figures. */
const AWAY_MS = 60_000;

/**
 * Reloads the current screen's figures when the installed app comes back to the foreground after a while, or on a
 * new day: phones restore the screen exactly as it was left, so without this last night's numbers would show as
 * today's. What's on screen stays as it was (scroll position, a search being typed) while the figures update.
 */
export function RefreshOnReturn() {
  const router = useRouter();

  useEffect(() => {
    const dayOf = (time: number) => new Date(time).toDateString();
    let hiddenAt: number | null = null;

    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        hiddenAt = Date.now();
        return;
      }
      if (hiddenAt === null) return;
      const now = Date.now();
      if (now - hiddenAt >= AWAY_MS || dayOf(now) !== dayOf(hiddenAt)) router.refresh();
      hiddenAt = null;
    };
    // A page restored from the browser's back/forward cache was frozen, not just hidden.
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) router.refresh();
    };

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pageshow", onPageShow);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pageshow", onPageShow);
    };
  }, [router]);

  return null;
}
