import { prisma } from "@/lib/prisma";
import { CustomersScreen } from "@/components/customers-screen";

export const dynamic = "force-dynamic";

export default async function CustomersPage() {
  const customers = await prisma.customer.findMany({ orderBy: { createdAt: "desc" } });
  return (
    <div className="grid">
      <CustomersScreen initialCustomers={customers} />
    </div>
  );
}
