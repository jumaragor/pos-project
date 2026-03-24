import { describe, expect, test } from "vitest";
import { computeCartTotals } from "@/lib/pricing";

describe("pricing calculations", () => {
  test("applies item and order discounts correctly", () => {
    const result = computeCartTotals(
      [
        { qty: 2, price: 100, itemDiscount: { type: "PERCENT", value: 10 } },
        { qty: 1, price: 50 }
      ],
      { type: "FIXED", value: 20 }
    );
    expect(result.grossTotal).toBe(250);
    expect(result.totalDiscount).toBe(40);
    expect(result.total).toBe(210);
  });
});
