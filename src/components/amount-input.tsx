"use client";

import { useEffect, useRef, useState, type SyntheticEvent } from "react";
import { amountAfterInput, formatAmountInput, parseAmountToCents } from "@/lib/money";

/** Keeps the caret at the end, where digits are entered. */
function caretToEnd(event: SyntheticEvent<HTMLInputElement>) {
  const input = event.currentTarget;
  const end = input.value.length;
  if (input.selectionStart !== end || input.selectionEnd !== end) input.setSelectionRange(end, end);
}

/**
 * Money entry that takes digits only and fills from the right, starting at 0.00: typing 1, 2, 3 shows 0.01, 0.12,
 * 1.23, with the caret always at the end. Opens the numeric keypad on phones. Pass `value` to control it;
 * `onChange` receives the shown amount (such as "1,234.56"). Resetting its form restores `defaultValue`.
 */
export function MoneyInput({ id, name, className, autoFocus, onChange, defaultValue, value }: {
  id: string;
  name: string;
  className?: string;
  autoFocus?: boolean;
  onChange?: (value: string) => void;
  defaultValue?: string;
  value?: string;
}) {
  const defaultCents = parseAmountToCents(defaultValue ?? "") ?? 0;
  const [ownCents, setOwnCents] = useState(defaultCents);
  const cents = value === undefined ? ownCents : (parseAmountToCents(value) ?? 0);
  const ref = useRef<HTMLInputElement>(null);

  // A form that clears itself after saving resets its fields; this one keeps its amount in state.
  useEffect(() => {
    const form = ref.current?.form;
    if (!form) return;
    const reset = () => {
      setOwnCents(defaultCents);
      onChange?.(formatAmountInput(defaultCents));
    };
    form.addEventListener("reset", reset);
    return () => form.removeEventListener("reset", reset);
  }, [defaultCents, onChange]);

  return (
    <input
      autoComplete="off"
      autoFocus={autoFocus}
      className={className}
      enterKeyHint="next"
      id={id}
      inputMode="numeric"
      name={name}
      onChange={(event) => {
        const next = amountAfterInput(cents, event.target.value);
        setOwnCents(next);
        onChange?.(formatAmountInput(next));
      }}
      onFocus={caretToEnd}
      onSelect={caretToEnd}
      ref={ref}
      required
      type="text"
      value={formatAmountInput(cents)}
    />
  );
}

/** The large amount entry of the add and edit forms. */
export function AmountInput({ autoFocus, onChange, defaultValue, value }: {
  autoFocus?: boolean;
  onChange?: (value: string) => void;
  defaultValue?: string;
  value?: string;
}) {
  return (
    <div className="flex items-center justify-center gap-1 py-2">
      <span aria-hidden="true" className="font-mono text-3xl text-muted-foreground">$</span>
      <MoneyInput
        autoFocus={autoFocus}
        className="w-full max-w-60 bg-transparent text-center font-mono text-5xl outline-none"
        defaultValue={defaultValue}
        id="amount"
        name="amount"
        onChange={onChange}
        value={value}
      />
    </div>
  );
}
