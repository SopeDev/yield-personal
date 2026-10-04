import type { ErrorKey } from "@/i18n/dictionaries";

/** Result of a form action. `savedAt` marks a success for forms that stay on the page after saving. */
export type FormState = { error?: ErrorKey; fieldErrors?: Partial<Record<string, ErrorKey>>; savedAt?: number };
