import type { Locale } from "./config";
import en from "./messages/en.json";
import es from "./messages/es.json";

export type Messages = typeof en;
export type ErrorKey = keyof Messages["errors"];

const dictionaries: Record<Locale, Messages> = { en, es };

export function getDictionary(locale: Locale) {
  return dictionaries[locale];
}

/** Fills `{name}` placeholders in a message. */
export function format(message: string, values: Record<string, string | number>) {
  return message.replace(/\{(\w+)\}/g, (match, key: string) => String(values[key] ?? match));
}
