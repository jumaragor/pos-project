"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Sidebar } from "@/components/sidebar";
import { applyThemeToDocument } from "@/lib/theme";

export function AppChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const isLogin = pathname.startsWith("/login");

  useEffect(() => {
    const saved = window.localStorage.getItem("microbiz.sidebarCollapsed");
    if (saved === "true") {
      setCollapsed(true);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    async function loadTheme() {
      try {
        const response = await fetch("/api/settings");
        if (!response.ok) return;
        const payload = await response.json();
        if (!mounted) return;
        applyThemeToDocument(payload);
      } catch {
        // Keep defaults from CSS variables.
      }
    }
    void loadTheme();
    const onSettingsUpdated = () => {
      void loadTheme();
    };
    window.addEventListener("microbiz:settings-updated", onSettingsUpdated);
    return () => {
      mounted = false;
      window.removeEventListener("microbiz:settings-updated", onSettingsUpdated);
    };
  }, []);

  function toggleSidebar() {
    setCollapsed((prev) => {
      const next = !prev;
      window.localStorage.setItem("microbiz.sidebarCollapsed", String(next));
      return next;
    });
  }

  if (isLogin) {
    return <main className="login-shell">{children}</main>;
  }
  return (
    <div className={collapsed ? "app-shell app-shell-collapsed" : "app-shell"}>
      <Sidebar collapsed={collapsed} onToggle={toggleSidebar} />
      <DashboardLayout collapsed={collapsed}>
        {children}
      </DashboardLayout>
    </div>
  );
}
