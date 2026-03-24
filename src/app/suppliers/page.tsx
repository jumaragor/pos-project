import { SuppliersScreen } from "@/components/suppliers-screen";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function SuppliersPage() {
  const suppliers = await prisma.supplier.findMany({
    orderBy: [{ status: "asc" }, { supplierName: "asc" }]
  });
  return (
    <div className="grid">
      <SuppliersScreen initialSuppliers={suppliers} />
    </div>
  );
}
