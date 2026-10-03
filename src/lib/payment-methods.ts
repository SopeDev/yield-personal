/** Cash keeps the spreadsheet's convention of green meaning "paid in cash". */
export const CASH_COLOR = "#00c896";

/** Card colors avoid green (cash) and red (losses) so they never read as a status. */
export const CARD_COLORS = ["#8b5cf6", "#f97316", "#14b8a6", "#9ca3af", "#3b82f6", "#ec4899", "#eab308"] as const;

export const MAX_STATEMENT_DAY = 31;

type LabelledPaymentMethod = { kind: "CASH" | "CARD"; name: string };

export function paymentMethodLabel(method: LabelledPaymentMethod, cashLabel: string) {
  return method.kind === "CASH" ? cashLabel : method.name;
}
