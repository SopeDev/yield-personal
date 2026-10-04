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

/** Largest amount the amount input accepts: 9,999,999.99. */
export const MAX_INPUT_CENTS = 999_999_999;

const inputFormat = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** An amount as the amount input shows it ("1,234.56"); `parseAmountToCents` reads it back. */
export function formatAmountInput(cents: number) {
  return inputFormat.format(cents / 100);
}

/**
 * The amount after an edit to the amount input, which fills from the right like a cash register: each digit
 * shifts the others left, so typing 1, 2, 3 shows 0.01, 0.12, 1.23. Deleting removes the last digit, even when
 * only a separator was deleted. Anything but digits is ignored.
 */
export function amountAfterInput(previousCents: number, typed: string) {
  const previous = formatAmountInput(previousCents);
  const digits = typed.replace(/\D/g, "");
  const cents = typed.length < previous.length && digits === previous.replace(/\D/g, "")
    ? Math.floor(previousCents / 10)
    : Number(digits || "0");
  return cents > MAX_INPUT_CENTS ? previousCents : cents;
}
