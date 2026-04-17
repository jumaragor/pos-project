"use client";

import { SessionProvider } from "next-auth/react";
import { ToastProvider } from "@/components/toast-provider";
import { DevServiceWorkerReset } from "@/components/dev-service-worker-reset";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider refetchOnWindowFocus={false} refetchWhenOffline={false}>
      <DevServiceWorkerReset />
      <ToastProvider>{children}</ToastProvider>
    </SessionProvider>
  );
}
