"use client";

import { useParams } from "next/navigation";

const labels = { en: "Loading…", es: "Cargando…" } as const;

/** The screen-reader text for a loading screen, in the URL's language (loading screens receive no params). */
export function LoadingLabel() {
  const { locale } = useParams<{ locale?: string }>();
  return <span className="sr-only">{locale === "es" ? labels.es : labels.en}</span>;
}
