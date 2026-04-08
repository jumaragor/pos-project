"use client";

import { SessionProvider } from "next-auth/react";
import { ToastProvider } from "@/components/toast-provider";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider refetchOnWindowFocus={false} refetchWhenOffline={false}>
      <ToastProvider>{children}</ToastProvider>
    </SessionProvider>
  );
}
