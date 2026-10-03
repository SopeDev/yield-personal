import type { ErrorKey } from "@/i18n/dictionaries";

export type FormState = { error?: ErrorKey; fieldErrors?: Partial<Record<string, ErrorKey>> };
