"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { LogoutIcon, MenuIcon, UsersIcon, ChevronRightIcon } from "@/components/ui/app-icons";
import { sectionIcons } from "@/components/ui/app-icons";

const sections: Record<string, { label: string; icon: keyof typeof sectionIcons }> = {
  dashboard: { label: "Dashboard", icon: "dashboard" },
  pos: { label: "Point of Sale", icon: "pos" },
  sales: { label: "Sales", icon: "sales" },
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
  const router = useRouter();
  const pathname = usePathname();
  const { data } = useSession();
  const [menuOpen, setMenuOpen] = useState(false);
  const [currentUserName, setCurrentUserName] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const meta = pageMeta(pathname);
  const Icon = sectionIcons[meta.icon];
  const displayName = currentUserName ?? data?.user?.name ?? "User";

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMenuOpen(false);
      }
    }
    window.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("keydown", handleEscape);
    return () => {
      window.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("keydown", handleEscape);
    };
  }, []);

  useEffect(() => {
    setCurrentUserName(data?.user?.name?.trim() || null);
  }, [data?.user?.name]);

  useEffect(() => {
    const handleUserUpdated = (event: Event) => {
      const detail = event instanceof CustomEvent ? (event.detail as { name?: string } | undefined) : undefined;
      setCurrentUserName(detail?.name?.trim() || data?.user?.name?.trim() || null);
    };
    window.addEventListener("microbiz:user-updated", handleUserUpdated as EventListener);
    return () => {
      window.removeEventListener("microbiz:user-updated", handleUserUpdated as EventListener);
    };
  }, [data?.user?.name]);

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
        <div className="header-meta">{new Date().toLocaleDateString("en-PH")}</div>
        <div className="header-user-menu" ref={menuRef}>
          <button
            type="button"
            className="header-user-trigger"
            onClick={() => setMenuOpen((prev) => !prev)}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
          >
            <span className="header-user-avatar">
              <UsersIcon className="header-user-avatar-icon" />
            </span>
            <span className="header-user">
              <span className="header-user-name">{displayName}</span>
            </span>
            <ChevronRightIcon className={menuOpen ? "header-user-chevron open" : "header-user-chevron"} />
          </button>
          {menuOpen ? (
            <div className="header-user-dropdown" role="menu">
              <button
                type="button"
                className="header-user-dropdown-item"
                onClick={() => {
                  setMenuOpen(false);
                  router.push("/configuration");
                }}
              >
                Settings
              </button>
              <button
                type="button"
                className="header-user-dropdown-item header-user-dropdown-item-danger"
                onClick={() => signOut({ callbackUrl: "/login" })}
              >
                <LogoutIcon className="header-user-dropdown-icon" />
                <span>Logout</span>
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
