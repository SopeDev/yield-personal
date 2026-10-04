"use client";

import { useState, type SyntheticEvent } from "react";
import { amountAfterInput, formatAmountInput, parseAmountToCents } from "@/lib/money";

/** Keeps the caret at the end, where digits are entered. */
function caretToEnd(event: SyntheticEvent<HTMLInputElement>) {
  const input = event.currentTarget;
  const end = input.value.length;
  if (input.selectionStart !== end || input.selectionEnd !== end) input.setSelectionRange(end, end);
}

/**
 * Large amount entry that takes digits only and fills from the right, starting at 0.00: typing 1, 2, 3 shows
 * 0.01, 0.12, 1.23. Opens the numeric keypad on phones. Pass `value` to control it; `onChange` receives the
 * shown amount (such as "1,234.56").
 */
export function AmountInput({ autoFocus, onChange, defaultValue, value }: {
  autoFocus?: boolean;
  onChange?: (value: string) => void;
  defaultValue?: string;
  value?: string;
}) {
  const [ownCents, setOwnCents] = useState(() => parseAmountToCents(defaultValue ?? "") ?? 0);
  const cents = value === undefined ? ownCents : (parseAmountToCents(value) ?? 0);

  return (
    <div className="flex items-center justify-center gap-1 py-2">
      <span aria-hidden="true" className="font-mono text-3xl text-muted-foreground">$</span>
      <input
        autoComplete="off"
        autoFocus={autoFocus}
        className="w-full max-w-60 bg-transparent text-center font-mono text-5xl outline-none"
        enterKeyHint="next"
        id="amount"
        inputMode="numeric"
        name="amount"
        onChange={(event) => {
          const next = amountAfterInput(cents, event.target.value);
          setOwnCents(next);
          onChange?.(formatAmountInput(next));
        }}
        onFocus={caretToEnd}
        onSelect={caretToEnd}
        required
        type="text"
        value={formatAmountInput(cents)}
      />
    </div>
  );
}
