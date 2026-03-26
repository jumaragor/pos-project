type FormatNumberOptions = {
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
};

function toFiniteNumber(value: unknown) {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : value != null && typeof value === "object" && "toString" in value
          ? Number(String(value))
          : Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function formatNumber(
  value: unknown,
  options: FormatNumberOptions = {}
) {
  const numericValue = toFiniteNumber(value);
  const minimumFractionDigits = options.minimumFractionDigits ?? 0;
  const maximumFractionDigits =
    options.maximumFractionDigits ?? (Number.isInteger(numericValue) ? 0 : 2);

  return new Intl.NumberFormat("en-PH", {
    minimumFractionDigits,
    maximumFractionDigits
  }).format(numericValue);
}

export function formatCurrency(value: unknown) {
  return `PHP ${formatNumber(value, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
