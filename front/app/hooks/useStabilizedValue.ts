import { useState, useEffect, useRef } from "react";

/**
 * Retorna un valor que se actualiza con un pequeño retraso.
 * Útil para evitar glitches de render en iPad Safari cuando un cambio
 * de estado coincide con interacciones del usuario (tap, click).
 * El valor se "estabiliza" ~400ms después del cambio.
 */
export function useStabilizedValue<T>(value: T, delayMs: number = 400): T {
  const [stabilized, setStabilized] = useState<T>(value);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      setStabilized(value);
      return;
    }

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      setStabilized(value);
      timeoutRef.current = null;
    }, delayMs);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [value, delayMs]);

  return stabilized;
}
