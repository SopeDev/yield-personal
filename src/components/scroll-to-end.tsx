"use client";

import { useEffect, useRef, type ReactNode } from "react";

/** A horizontal scroller that starts at its right edge, so the most recent month is in view on phones. */
export function ScrollToEnd({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.scrollLeft = ref.current.scrollWidth;
  }, []);
  return <div className={className} ref={ref}>{children}</div>;
}
