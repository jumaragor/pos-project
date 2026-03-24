export type DiscountInput = {
  type: "PERCENT" | "FIXED";
  value: number;
};

export type CartLine = {
  qty: number;
  price: number;
  itemDiscount?: DiscountInput;
};

export function applyDiscount(base: number, discount?: DiscountInput) {
  if (!discount) {
    return { amount: 0, final: base };
  }
  const rawAmount = discount.type === "PERCENT" ? (base * discount.value) / 100 : discount.value;
  const amount = Math.min(Math.max(rawAmount, 0), base);
  return { amount, final: base - amount };
}

export function computeCartTotals(lines: CartLine[], orderDiscount?: DiscountInput) {
  const lineResults = lines.map((line) => {
    const base = line.qty * line.price;
    const discount = applyDiscount(base, line.itemDiscount);
    return {
      subtotal: base,
      discount: discount.amount,
      net: discount.final
    };
  });
  const beforeOrderDiscount = lineResults.reduce((acc, line) => acc + line.net, 0);
  const orderDiscountResult = applyDiscount(beforeOrderDiscount, orderDiscount);
  return {
    grossTotal: lineResults.reduce((acc, line) => acc + line.subtotal, 0),
    lineDiscountTotal: lineResults.reduce((acc, line) => acc + line.discount, 0),
    orderDiscount: orderDiscountResult.amount,
    totalDiscount: lineResults.reduce((acc, line) => acc + line.discount, 0) + orderDiscountResult.amount,
    total: orderDiscountResult.final
  };
}
