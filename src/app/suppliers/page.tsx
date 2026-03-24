import { SuppliersScreen } from "@/components/suppliers-screen";
import { prisma } from "@/lib/prisma";
import { buildPagination, DEFAULT_PAGE_SIZE } from "@/lib/pagination";

export const dynamic = "force-dynamic";

export default async function SuppliersPage() {
  const [suppliers, total] = await Promise.all([
    prisma.supplier.findMany({
      select: {
        id: true,
        supplierCode: true,
        supplierName: true,
        contactPerson: true,
        mobileNumber: true,
        emailAddress: true,
        address: true,
        notes: true,
        status: true
      },
      orderBy: [{ status: "asc" }, { supplierName: "asc" }],
      take: DEFAULT_PAGE_SIZE
    }),
    prisma.supplier.count()
  ]);
  return (
    <div className="grid">
      <SuppliersScreen initialSuppliers={suppliers} initialPagination={buildPagination(1, DEFAULT_PAGE_SIZE, total)} />
    </div>
  );
}
