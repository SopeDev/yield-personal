/** Large amount entry; opens the decimal keypad on phones. */
export function AmountInput({ autoFocus, onChange, defaultValue }: { autoFocus?: boolean; onChange?: (value: string) => void; defaultValue?: string }) {
  return (
    <div className="flex items-center justify-center gap-1 py-2">
      <span aria-hidden="true" className="font-mono text-3xl text-muted-foreground">$</span>
      <input
        autoComplete="off"
        autoFocus={autoFocus}
        className="w-full max-w-60 bg-transparent text-center font-mono text-5xl outline-none placeholder:text-subtle"
        defaultValue={defaultValue}
        enterKeyHint="next"
        id="amount"
        inputMode="decimal"
        name="amount"
        onChange={onChange ? (event) => onChange(event.target.value) : undefined}
        placeholder="0"
        required
        type="text"
      />
    </div>
  );
}
