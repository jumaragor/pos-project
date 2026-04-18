"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  CustomersIcon,
  DashboardIcon,
  ExpensesIcon,
  InventoryIcon,
  LogoMarkIcon,
  PosIcon,
  PurchasesIcon,
  ReportsIcon,
  SettingsIcon
} from "@/components/ui/app-icons";

const links = [
  { href: "/dashboard", label: "Dashboard", Icon: DashboardIcon, roles: ["OWNER", "MANAGER"] },
  { href: "/pos", label: "POS", Icon: PosIcon, roles: ["OWNER", "MANAGER", "CASHIER"] },
  { href: "/sales", label: "Sales", Icon: ReportsIcon, roles: ["OWNER", "MANAGER"] },
  { href: "/inventory", label: "Inventory", Icon: InventoryIcon, roles: ["OWNER", "MANAGER"] },
  { href: "/purchases", label: "Purchases", Icon: PurchasesIcon, roles: ["OWNER", "MANAGER"] },
  { href: "/expenses", label: "Expenses", Icon: ExpensesIcon, roles: ["OWNER", "MANAGER"] },
  { href: "/suppliers", label: "Suppliers", Icon: CustomersIcon, roles: ["OWNER", "MANAGER"] },
  { href: "/customers", label: "Customers", Icon: CustomersIcon, roles: ["OWNER", "MANAGER", "CASHIER"] },
  { href: "/reports", label: "Reports", Icon: ReportsIcon, roles: ["OWNER", "MANAGER"] },
  { href: "/configuration", label: "Configuration", Icon: SettingsIcon, roles: ["OWNER", "MANAGER"] }
];

export function Sidebar({
  collapsed,
  onToggle,
  mobileOpen,
  onMobileClose,
  storeName,
  storeLogoUrl
}: {
  collapsed: boolean;
  onToggle: () => void;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
  storeName: string;
  storeLogoUrl: string;
}) {
  const { data } = useSession();
  const pathname = usePathname();
  const role = data?.user?.role;
  const effectiveCollapsed = mobileOpen ? false : collapsed;
  const visibleLinks = links.filter((link) => (!role ? true : link.roles.includes(role)));
  const [logoFailed, setLogoFailed] = useState(false);

  useEffect(() => {
    setLogoFailed(false);
  }, [storeLogoUrl]);

  const resolvedStoreName = useMemo(() => {
    const trimmed = storeName.trim();
    return trimmed.length ? trimmed : "MicroBiz POS";
  }, [storeName]);

  return (
    <>
    <div
      className={mobileOpen ? "sidebar-backdrop open" : "sidebar-backdrop"}
      onClick={onMobileClose}
      aria-hidden="true"
    />
    <aside
      className={
        mobileOpen
          ? effectiveCollapsed
            ? "sidebar collapsed mobile-open"
            : "sidebar mobile-open"
          : effectiveCollapsed
            ? "sidebar collapsed"
            : "sidebar"
      }
    >
      <div className="sidebar-logo">
        <div className="sidebar-brand">
          <div className="sidebar-logo-slot" aria-hidden="true">
            {storeLogoUrl && !logoFailed ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={storeLogoUrl}
                alt={resolvedStoreName}
                className="sidebar-logo-image"
                onError={() => setLogoFailed(true)}
              />
            ) : (
              <LogoMarkIcon className="sidebar-logo-mark" />
            )}
          </div>
          {!effectiveCollapsed ? (
            <div>
              <h2 className="sidebar-title">{resolvedStoreName}</h2>
            </div>
          ) : null}
        </div>
        <button
          type="button"
          className="sidebar-toggle"
          onClick={onToggle}
          title={effectiveCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-label={effectiveCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {effectiveCollapsed ? <ChevronRightIcon className="sidebar-icon" /> : <ChevronLeftIcon className="sidebar-icon" />}
        </button>
      </div>
      <nav className="sidebar-nav">
        {visibleLinks.map(({ href, label, Icon }) => {
          const active = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              title={effectiveCollapsed ? label : undefined}
              className={active ? "nav-item active" : "nav-item"}
              onClick={onMobileClose}
            >
              <Icon className="sidebar-icon" />
              <span className="nav-label">{label}</span>
              {effectiveCollapsed ? <span className="nav-tooltip">{label}</span> : null}
            </Link>
          );
        })}
      </nav>
    </aside>
    </>
  );
}
