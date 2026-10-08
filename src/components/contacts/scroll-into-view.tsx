"use client";

import { useEffect, useRef } from "react";

/** Scrolls the page so that the parent element is in view */
export function ScrollIntoView() {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    ref.current?.parentElement?.scrollIntoView({
      block: "center",
      behavior: "smooth",
    });
  }, []);

  return <span ref={ref} hidden />;
}
