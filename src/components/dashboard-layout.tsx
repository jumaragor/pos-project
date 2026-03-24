import { Header } from "@/components/header";

export function DashboardLayout({
  children,
  collapsed,
  onMenuToggle
}: {
  children: React.ReactNode;
  collapsed: boolean;
  onMenuToggle?: () => void;
}) {
  return (
    <div className={collapsed ? "content-shell collapsed" : "content-shell"}>
      <Header onMenuToggle={onMenuToggle} />
      <main className="main">{children}</main>
    </div>
  );
}
