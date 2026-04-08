import { ExpensePaymentMethod, ExpenseStatus } from "@prisma/client";
import { ExpensesScreen } from "@/components/expenses-screen";
import { getExpenseCategories, getExpensesData } from "@/lib/expenses";

export const dynamic = "force-dynamic";

export default async function ExpensesPage() {
  const [expensesData, categories] = await Promise.all([
    getExpensesData(),
    getExpenseCategories()
  ]);

  return (
    <div className="grid">
      <ExpensesScreen
        initialExpenses={expensesData.items}
        initialPagination={expensesData.pagination}
        initialSummary={expensesData.summary}
        initialCategories={categories}
        statusOptions={Object.values(ExpenseStatus)}
        paymentMethodOptions={Object.values(ExpensePaymentMethod)}
      />
    </div>
  );
}
