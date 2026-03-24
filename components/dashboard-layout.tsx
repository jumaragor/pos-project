import { Header } from "@/components/header";

export function DashboardLayout({
  children,
  collapsed
}: {
  children: React.ReactNode;
  collapsed: boolean;
}) {
  return (
    <div className={collapsed ? "content-shell collapsed" : "content-shell"}>
      <Header />
      <main className="main">{children}</main>
    </div>
  );
}
