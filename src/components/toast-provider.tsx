"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";

type ToastType = "success" | "error" | "warning" | "info";

type ToastItem = {
  id: string;
  type: ToastType;
  message: string;
};

type ToastOptions = {
  type?: ToastType;
  duration?: number;
};

type ToastContextValue = {
  showToast: (message: string, options?: ToastOptions) => void;
  success: (message: string, options?: Omit<ToastOptions, "type">) => void;
  error: (message: string, options?: Omit<ToastOptions, "type">) => void;
  warning: (message: string, options?: Omit<ToastOptions, "type">) => void;
  info: (message: string, options?: Omit<ToastOptions, "type">) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

function toastTypeLabel(type: ToastType) {
  switch (type) {
    case "success":
      return "Success";
    case "error":
      return "Error";
    case "warning":
      return "Warning";
    case "info":
      return "Info";
  }
}

function toastSymbol(type: ToastType) {
  switch (type) {
    case "success":
      return "✓";
    case "error":
      return "!";
    case "warning":
      return "!";
    case "info":
      return "i";
  }
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timeoutMap = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const dismissToast = useCallback((id: string) => {
    const activeTimeout = timeoutMap.current.get(id);
    if (activeTimeout) {
      clearTimeout(activeTimeout);
      timeoutMap.current.delete(id);
    }
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback(
    (message: string, options?: ToastOptions) => {
      const id = crypto.randomUUID();
      const type = options?.type ?? "success";
      const duration = options?.duration ?? 3600;
      setToasts((prev) => [...prev, { id, type, message }]);
      const timeout = setTimeout(() => {
        dismissToast(id);
      }, duration);
      timeoutMap.current.set(id, timeout);
    },
    [dismissToast]
  );

  const value = useMemo<ToastContextValue>(
    () => ({
      showToast,
      success: (message, options) => showToast(message, { ...options, type: "success" }),
      error: (message, options) => showToast(message, { ...options, type: "error" }),
      warning: (message, options) => showToast(message, { ...options, type: "warning" }),
      info: (message, options) => showToast(message, { ...options, type: "info" })
    }),
    [showToast]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-viewport" aria-live="polite" aria-atomic="true">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast toast-${toast.type}`} role="status">
            <div className="toast-icon" aria-hidden="true">
              {toastSymbol(toast.type)}
            </div>
            <div className="toast-content">
              <div className="toast-title">{toastTypeLabel(toast.type)}</div>
              <div className="toast-message">{toast.message}</div>
            </div>
            <button
              type="button"
              className="toast-close"
              aria-label="Dismiss notification"
              onClick={() => dismissToast(toast.id)}
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}
