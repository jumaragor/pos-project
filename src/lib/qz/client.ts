import { applyQzSecurity } from "@/lib/qz/security";

export type QzConfig = unknown;

export type QzTrayLike = {
  websocket: {
    isActive: () => boolean;
    connect: (options?: Record<string, unknown>) => Promise<void>;
    disconnect?: () => Promise<void>;
  };
  printers: {
    find: (query: string) => Promise<unknown>;
    getDefault: () => Promise<string | null>;
    details?: () => Promise<Array<{ name?: string } | string>>;
  };
  configs: {
    create: (printer: string, options?: Record<string, unknown>) => QzConfig;
  };
  print: (config: QzConfig, data: unknown[]) => Promise<void>;
  security?: {
    setCertificatePromise?: (factory: (...args: unknown[]) => unknown) => void;
    setSignaturePromise?: (factory: (...args: unknown[]) => unknown) => void;
  };
};

declare global {
  interface Window {
    qz?: QzTrayLike;
  }
}

const QZ_SCRIPT_URLS = [
  process.env.NEXT_PUBLIC_QZ_SCRIPT_URL,
  "/qz-tray.js",
  "https://cdn.jsdelivr.net/npm/qz-tray@2.2.4/qz-tray.js"
].filter((value): value is string => Boolean(value));

let loadPromise: Promise<QzTrayLike> | null = null;
let connectPromise: Promise<QzTrayLike> | null = null;
let securityApplied = false;

function ensureClient() {
  if (typeof window === "undefined") {
    throw new Error("QZ Tray is available only in the browser.");
  }
}

function configureSecurity(qz: QzTrayLike) {
  if (!securityApplied) {
    applyQzSecurity(qz);
    securityApplied = true;
  }
}

async function loadScript() {
  ensureClient();
  if (window.qz) {
    configureSecurity(window.qz);
    return window.qz;
  }
  if (loadPromise) {
    return loadPromise;
  }

  loadPromise = (async () => {
    let lastError: unknown = null;
    for (const scriptUrl of QZ_SCRIPT_URLS) {
      try {
        await new Promise<void>((resolve, reject) => {
          const existing = document.querySelector<HTMLScriptElement>(`script[src="${scriptUrl}"]`);
          if (existing) {
            resolve();
            return;
          }

          const script = document.createElement("script");
          script.src = scriptUrl;
          script.async = true;
          script.onload = () => resolve();
          script.onerror = () => reject(new Error(`Unable to load QZ script from ${scriptUrl}.`));
          document.head.appendChild(script);
        });

        if (!window.qz) {
          throw new Error(`QZ script loaded from ${scriptUrl}, but window.qz is unavailable.`);
        }
        configureSecurity(window.qz);
        return window.qz;
      } catch (error) {
        lastError = error;
      }
    }

    throw lastError ?? new Error("Unable to load QZ Tray.");
  })().catch((error) => {
    loadPromise = null;
    throw error;
  });

  return loadPromise;
}

export async function ensureQzConnected() {
  if (connectPromise) {
    return connectPromise;
  }

  connectPromise = (async () => {
    const qz = await loadScript();
    if (!qz.websocket.isActive()) {
      await qz.websocket.connect({ retries: 2, delay: 1 });
    }
    return qz;
  })().catch((error) => {
    connectPromise = null;
    throw error;
  });

  return connectPromise;
}

export async function connectQz() {
  return ensureQzConnected();
}

export async function disconnectQz() {
  if (!connectPromise) return;
  try {
    const qz = await connectPromise;
    if (qz.websocket.isActive()) {
      await qz.websocket.disconnect?.();
    }
  } finally {
    connectPromise = null;
  }
}
