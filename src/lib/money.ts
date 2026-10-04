// Mexican peso formatting ("$1,230.00") reads the same in English and Spanish, so one format serves both.
const pesoFormat = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" });

/** Parses user input like "1,230.50" or "$410" into centavos. Returns null when invalid or not positive. */
export function parseAmountToCents(input: string): number | null {
  const normalized = input.replace(/[$,\s]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  const [whole, fraction = ""] = normalized.split(".");
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  return cents > 0 && Number.isSafeInteger(cents) ? cents : null;
}

export function formatCents(cents: number) {
  return pesoFormat.format(cents / 100);
}

const wholePesoFormat = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 });

/** Whole pesos ("$1,230"), for dense grids where centavos don't fit. */
export function formatWholePesos(cents: number) {
  return wholePesoFormat.format(Math.round(cents / 100));
}
