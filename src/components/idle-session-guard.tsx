"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { signOut, useSession } from "next-auth/react";

const DEFAULT_IDLE_TIMEOUT_MS = 15 * 60 * 1000;
const WARNING_LEAD_MS = 60 * 1000;
const ACTIVITY_EVENTS: Array<keyof WindowEventMap> = [
  "mousemove",
  "keydown",
  "click",
  "scroll",
  "touchstart"
];

function getIdleTimeoutMs() {
  const configured = Number(process.env.NEXT_PUBLIC_IDLE_TIMEOUT_MINUTES ?? 15);
  if (!Number.isFinite(configured) || configured <= 1) {
    return DEFAULT_IDLE_TIMEOUT_MS;
  }
  return configured * 60 * 1000;
}

export function IdleSessionGuard() {
  const { status } = useSession();
  const idleTimeoutMs = useMemo(() => getIdleTimeoutMs(), []);
  const warningAfterMs = Math.max(idleTimeoutMs - WARNING_LEAD_MS, 1_000);
  const warningTimerRef = useRef<number | null>(null);
  const logoutTimerRef = useRef<number | null>(null);
  const warningVisibleRef = useRef(false);
  const lastActivityAtRef = useRef(Date.now());
  const [warningOpen, setWarningOpen] = useState(false);

  const clearTimers = useCallback(() => {
    if (warningTimerRef.current) {
      window.clearTimeout(warningTimerRef.current);
      warningTimerRef.current = null;
    }
    if (logoutTimerRef.current) {
      window.clearTimeout(logoutTimerRef.current);
      logoutTimerRef.current = null;
    }
  }, []);

  const performLogout = useCallback(() => {
    clearTimers();
    setWarningOpen(false);
    warningVisibleRef.current = false;
    void signOut({ callbackUrl: "/login?reason=expired" });
  }, [clearTimers]);

  const scheduleTimers = useCallback(() => {
    clearTimers();
    warningTimerRef.current = window.setTimeout(() => {
      warningVisibleRef.current = true;
      setWarningOpen(true);
    }, warningAfterMs);
    logoutTimerRef.current = window.setTimeout(() => {
      performLogout();
    }, idleTimeoutMs);
  }, [clearTimers, idleTimeoutMs, performLogout, warningAfterMs]);

  const resetIdleTimer = useCallback(() => {
    lastActivityAtRef.current = Date.now();
    warningVisibleRef.current = false;
    setWarningOpen(false);
    scheduleTimers();
  }, [scheduleTimers]);

  useEffect(() => {
    if (status !== "authenticated") {
      clearTimers();
      setWarningOpen(false);
      warningVisibleRef.current = false;
      return;
    }

    const handleActivity = () => {
      if (warningVisibleRef.current) return;
      resetIdleTimer();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState !== "visible") return;

      const elapsed = Date.now() - lastActivityAtRef.current;
      if (elapsed >= idleTimeoutMs) {
        performLogout();
        return;
      }
      if (warningVisibleRef.current) return;
      if (elapsed >= warningAfterMs) {
        warningVisibleRef.current = true;
        setWarningOpen(true);
        return;
      }
      scheduleTimers();
    };

    resetIdleTimer();
    for (const eventName of ACTIVITY_EVENTS) {
      window.addEventListener(eventName, handleActivity, { passive: true });
    }
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      clearTimers();
      for (const eventName of ACTIVITY_EVENTS) {
        window.removeEventListener(eventName, handleActivity);
      }
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [
    clearTimers,
    idleTimeoutMs,
    performLogout,
    resetIdleTimer,
    scheduleTimers,
    status,
    warningAfterMs
  ]);

  if (status !== "authenticated" || !warningOpen) {
    return null;
  }

  return (
    <div className="session-expiry-overlay" role="presentation">
      <div
        className="session-expiry-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="session-expiry-title"
      >
        <h2 id="session-expiry-title" className="section-title">
          Session Expiring
        </h2>
        <p className="session-expiry-copy">
          Your session is about to expire due to inactivity.
        </p>
        <div className="session-expiry-actions">
          <button type="button" className="btn-secondary" onClick={performLogout}>
            Logout Now
          </button>
          <button type="button" className="btn-primary" onClick={resetIdleTimer}>
            Stay Logged In
          </button>
        </div>
      </div>
    </div>
  );
}
