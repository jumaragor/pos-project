"use client";

import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { LogoutIcon, MenuIcon } from "@/components/ui/app-icons";
import { sectionIcons } from "@/components/ui/app-icons";

const sections: Record<string, { label: string; icon: keyof typeof sectionIcons }> = {
  dashboard: { label: "Dashboard", icon: "dashboard" },
  pos: { label: "Point of Sale", icon: "pos" },
  inventory: { label: "Inventory", icon: "inventory" },
  purchases: { label: "Purchases", icon: "purchases" },
  suppliers: { label: "Suppliers", icon: "suppliers" },
  customers: { label: "Customers", icon: "customers" },
  reports: { label: "Reports", icon: "reports" },
  configuration: { label: "Configuration", icon: "configuration" },
  users: { label: "Configuration", icon: "configuration" },
  settings: { label: "Configuration", icon: "configuration" },
  login: { label: "Login", icon: "login" }
};

function pageMeta(pathname: string) {
  const segment = pathname.split("/").filter(Boolean)[0] ?? "dashboard";
  return sections[segment] ?? { label: "MicroBiz", icon: "login" as const };
}

export function Header({ onMenuToggle }: { onMenuToggle?: () => void }) {
  const pathname = usePathname();
  const { data } = useSession();
  const meta = pageMeta(pathname);
  const Icon = sectionIcons[meta.icon];
  const displayName = data?.user?.name ?? "User";
  const displayRole = data?.user?.role ?? "USER";

  return (
    <header className="header">
      <div className="header-left">
        <button
          type="button"
          className="header-menu-btn"
          aria-label="Open navigation"
          title="Open navigation"
          onClick={onMenuToggle}
        >
          <MenuIcon className="header-menu-icon" />
        </button>
        <h1 className="header-title">
          <span className="header-title-wrap">
          <Icon className="header-title-icon" />
          <span>{meta.label}</span>
          </span>
        </h1>
      </div>
      <div className="header-actions">
        <div className="header-user">
          <span className="header-user-name">{displayName}</span>
          <span className="badge">{displayRole}</span>
        </div>
        <div className="header-meta">{new Date().toLocaleDateString("en-PH")}</div>
        <button
          type="button"
          className="header-logout-btn"
          title="Logout"
          aria-label="Logout"
          onClick={() => signOut({ callbackUrl: "/login" })}
        >
          <LogoutIcon className="header-logout-icon" />
        </button>
      </div>
    </header>
  );
}
