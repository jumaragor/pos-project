export const PURCHASE_VOID_MARKER = "[VOIDED]";

export function isVoidedPurchaseNote(notes: string | null | undefined) {
  return typeof notes === "string" && notes.includes(PURCHASE_VOID_MARKER);
}

export function buildVoidedPurchaseNote(existingNotes: string | null | undefined) {
  const base = (existingNotes ?? "").trim();
  if (isVoidedPurchaseNote(base)) return base;
  return base ? `${PURCHASE_VOID_MARKER} ${base}` : PURCHASE_VOID_MARKER;
}
