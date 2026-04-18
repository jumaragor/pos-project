import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { listSales } from "@/lib/sales";
import { SalesScreen } from "@/components/sales-screen";

export const dynamic = "force-dynamic";

export default async function SalesPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect("/login");
  }

  if (!["OWNER", "MANAGER"].includes(session.user.role ?? "")) {
    redirect("/dashboard");
  }

  const initialSales = await listSales();

  return <SalesScreen initialSales={initialSales} />;
}
