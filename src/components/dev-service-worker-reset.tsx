"use client";

import { useEffect } from "react";

const DEV_SW_RESET_FLAG = "microbiz.dev.sw-reset.v1";

export function DevServiceWorkerReset() {
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    const hostname = window.location.hostname;
    const isLocalhost = hostname === "localhost" || hostname === "127.0.0.1";
    if (!isLocalhost) return;

    let cancelled = false;

    async function resetServiceWorkers() {
      const registrations = await navigator.serviceWorker.getRegistrations();
      if (!registrations.length) return;

      let changed = false;

      for (const registration of registrations) {
        const activeScript = registration.active?.scriptURL ?? "";
        const waitingScript = registration.waiting?.scriptURL ?? "";
        const installingScript = registration.installing?.scriptURL ?? "";
        const looksLikeMicrobizWorker = [activeScript, waitingScript, installingScript].some((scriptUrl) =>
          scriptUrl.includes("/sw.js")
        );

        if (!looksLikeMicrobizWorker) continue;

        const unregistered = await registration.unregister();
        changed = changed || unregistered;
      }

      if (!changed || cancelled) return;

      const cacheKeys = await caches.keys();
      await Promise.all(cacheKeys.map((cacheKey) => caches.delete(cacheKey)));

      if (cancelled) return;

      const hasReloaded = window.sessionStorage.getItem(DEV_SW_RESET_FLAG) === "done";
      if (hasReloaded) return;

      window.sessionStorage.setItem(DEV_SW_RESET_FLAG, "done");
      window.location.reload();
    }

    void resetServiceWorkers().catch(() => {
      // Ignore cleanup errors so local login still remains usable.
    });

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
