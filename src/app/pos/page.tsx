import { PosWorkspace } from "@/components/pos/pos-workspace";
import { getPosSettings } from "@/lib/pos-settings";
import { listPosCatalog, listPosCategories } from "@/lib/pos-catalog";

export const dynamic = "force-dynamic";

export default async function POSPage() {
  const initialSettings = await getPosSettings();
  const [{ items, pagination }, categoryOptions] = await Promise.all([
    listPosCatalog({
      page: 1,
      pageSize: initialSettings.posProductsPerPage
    }),
    listPosCategories()
  ]);

  return (
    <div className="grid">
      <PosWorkspace
        initialProducts={items}
        initialPagination={pagination}
        initialCategoryOptions={categoryOptions}
        initialSettings={initialSettings}
      />
    </div>
  );
}
