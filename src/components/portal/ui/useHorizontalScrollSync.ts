"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Keeps a real horizontally-scrollable container and a slim "fake" scrollbar
 * track in sync, and keeps the fake track's inner width matching the real
 * content width so its thumb stays proportionally sized.
 */
export function useHorizontalScrollSync() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const fakeRef = useRef<HTMLDivElement>(null);
  const [innerWidth, setInnerWidth] = useState(0);

  useEffect(() => {
    const real = scrollRef.current;
    const fake = fakeRef.current;
    if (!real || !fake) return;
    let lock = false;
    const onRealScroll = () => {
      if (lock) return;
      lock = true;
      fake.scrollLeft = real.scrollLeft;
      lock = false;
    };
    const onFakeScroll = () => {
      if (lock) return;
      lock = true;
      real.scrollLeft = fake.scrollLeft;
      lock = false;
    };
    real.addEventListener("scroll", onRealScroll);
    fake.addEventListener("scroll", onFakeScroll);
    return () => {
      real.removeEventListener("scroll", onRealScroll);
      fake.removeEventListener("scroll", onFakeScroll);
    };
  }, []);

  // Re-measure after every render (cheap) so content changes (filters,
  // scale toggle, collapse/expand) keep the fake scrollbar width accurate.
  // setState bails out automatically when the value hasn't changed, so this
  // intentionally has no dependency array.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const real = scrollRef.current;
    if (real) setInnerWidth(real.scrollWidth);
  });

  return { scrollRef, fakeRef, innerWidth };
}
