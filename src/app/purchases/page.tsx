import { PurchasesScreen } from "@/components/purchases-screen";
import { buildPagination, DEFAULT_PAGE_SIZE } from "@/lib/pagination";
import { getPurchaseSummaries } from "@/lib/purchases-data";

export const dynamic = "force-dynamic";

export default async function PurchasesPage() {
  const { items, total } = await getPurchaseSummaries(DEFAULT_PAGE_SIZE);

  return (
    <div className="grid">
      <PurchasesScreen
        initialPurchases={items}
        initialPagination={buildPagination(1, DEFAULT_PAGE_SIZE, total)}
      />
    </div>
  );
}
