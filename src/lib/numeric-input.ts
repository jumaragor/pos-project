export function sanitizeIntegerInput(value: string) {
  return value.replace(/[^\d]/g, "");
}

export function sanitizeDecimalInput(value: string) {
  const cleaned = value.replace(/[^\d.]/g, "");
  const firstDot = cleaned.indexOf(".");
  if (firstDot === -1) return cleaned;
  const left = cleaned.slice(0, firstDot + 1);
  const right = cleaned.slice(firstDot + 1).replace(/\./g, "");
  return `${left}${right}`;
}

export function normalizeIntegerInput(value: string) {
  if (!value || value === ".") return "0";
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed < 0) return "0";
  return String(parsed);
}

export function normalizeDecimalInput(value: string) {
  if (!value || value === ".") return "0";
  const parsed = Number.parseFloat(value);
  if (Number.isNaN(parsed) || parsed < 0) return "0";
  return String(parsed);
}

export function toNumber(value: string) {
  const parsed = Number.parseFloat(value);
  return Number.isNaN(parsed) || parsed < 0 ? 0 : parsed;
}
