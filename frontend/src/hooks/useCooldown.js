"use client";

import { useEffect, useState } from "react";

/**
 * A countdown used after an HTTP 429: start(seconds) begins it, `remaining`
 * ticks down once a second, and `active` is true until it reaches zero.
 */
export function useCooldown() {
  const [until, setUntil] = useState(0);
  const [now, setNow] = useState(0);

  useEffect(() => {
    if (!until) return undefined;
    const id = setInterval(() => {
      const current = Date.now();
      setNow(current);
      if (current >= until) setUntil(0);
    }, 1000);
    return () => clearInterval(id);
  }, [until]);

  const remaining = until ? Math.max(0, Math.ceil((until - now) / 1000)) : 0;
  return {
    remaining,
    active: remaining > 0,
    start(seconds) {
      const current = Date.now();
      setNow(current);
      setUntil(current + seconds * 1000);
    },
  };
}
