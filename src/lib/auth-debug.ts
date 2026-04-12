const SERVER_AUTH_DEBUG = process.env.AUTH_DEBUG === "true";
const CLIENT_AUTH_DEBUG =
  process.env.NEXT_PUBLIC_AUTH_DEBUG === "true" || process.env.AUTH_DEBUG === "true";

export function authDebug(label: string, details?: Record<string, unknown>) {
  if (!SERVER_AUTH_DEBUG) return;
  console.info(`[auth] ${label}`, details ?? {});
}

export function authClientDebug(label: string, details?: Record<string, unknown>) {
  if (typeof window === "undefined" || !CLIENT_AUTH_DEBUG) return;
  console.info(`[auth-client] ${label}`, details ?? {});
}
