/** Currencies a user can keep their accounts in. All have two decimal places, matching amounts stored in hundredths. */
export const CURRENCIES = ["MXN", "USD", "CAD", "EUR"] as const;

export type Currency = (typeof CURRENCIES)[number];

export const DEFAULT_CURRENCY: Currency = "MXN";

export function isCurrency(value: string): value is Currency {
  return (CURRENCIES as readonly string[]).includes(value);
}

/** A stored currency code as a known currency; anything else (or none, in records made before currencies) is the default. */
export function currencyOf(value: string | null | undefined): Currency {
  return value && isCurrency(value) ? value : DEFAULT_CURRENCY;
}

// One format for both languages ("$1,230.00"), with the currency's own short symbol ("$", "€"). An amount outside
// the main currency uses a distinct symbol instead ("US$", "MX$", "CA$", "€"), so dollars never read as pesos.
const formats = new Map<string, Intl.NumberFormat>();
function currencyFormat(code: string, { wholeUnits = false, distinct = false } = {}) {
  const currency = currencyOf(code);
  const key = `${currency}:${wholeUnits}:${distinct}`;
  let numberFormat = formats.get(key);
  if (!numberFormat) {
    numberFormat = distinct
      ? new Intl.NumberFormat("en-GB", { style: "currency", currency, currencyDisplay: "symbol", ...(wholeUnits ? { maximumFractionDigits: 0 } : {}) })
      : new Intl.NumberFormat("es-MX", { style: "currency", currency, currencyDisplay: "narrowSymbol", ...(wholeUnits ? { maximumFractionDigits: 0 } : {}) });
    formats.set(key, numberFormat);
  }
  return numberFormat;
}

/** The currency's symbol, as amounts show it: short ("$", "€"), or `distinct` ("US$") outside the main currency. */
export function currencySymbol(currency: string, distinct = false) {
  return currencyFormat(currency, { distinct }).formatToParts(0).find((part) => part.type === "currency")?.value ?? currency;
}

/** Parses user input like "1,230.50" or "$410" into cents (hundredths). Returns null when invalid or not positive. */
export function parseAmountToCents(input: string): number | null {
  const normalized = input.replace(/[$,\s]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  const [whole, fraction = ""] = normalized.split(".");
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  return cents > 0 && Number.isSafeInteger(cents) ? cents : null;
}

/**
 * An amount stored in hundredths ("cents"), in the given currency: "$1,230.00", or with a `distinct` symbol
 * ("US$1,230.00") when it isn't in the main currency.
 */
export function formatCents(cents: number, currency: string, distinct = false) {
  return currencyFormat(currency, { distinct }).format(cents / 100);
}

/** An amount in its own currency, with a distinct symbol unless that's the main currency. */
export function formatCentsIn(cents: number, currency: string, mainCurrency: string) {
  return formatCents(cents, currency, currencyOf(currency) !== currencyOf(mainCurrency));
}

/** Whole units ("$1,230"), for dense grids where cents don't fit. */
export function formatWholeUnits(cents: number, currency: string) {
  return currencyFormat(currency, { wholeUnits: true }).format(Math.round(cents / 100));
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
