"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * A horizontal scroller that starts at its right edge, so the most recent month is in view on phones; or, given
 * `target`, with the element matching that selector at the right edge.
 */
export function ScrollToEnd({ children, className, target }: { children: ReactNode; className?: string; target?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const scroller = ref.current;
    if (!scroller) return;
    const element = target ? scroller.querySelector<HTMLElement>(target) : null;
    scroller.scrollLeft = element ? element.offsetLeft + element.offsetWidth - scroller.clientWidth : scroller.scrollWidth;
  }, [target]);
  return <div className={className} ref={ref}>{children}</div>;
}
