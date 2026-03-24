"use client";

import { useEffect, useState } from "react";

interface TimedProgressBarProps {
  active: boolean;
  durationMs?: number;
}

export default function TimedProgressBar({
  active,
  durationMs = 60_000,
}: TimedProgressBarProps) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!active) {
      setProgress(0);
      return;
    }

    const start = Date.now();
    const intervalId = window.setInterval(() => {
      const elapsed = Date.now() - start;
      const nextProgress = Math.min((elapsed / durationMs) * 100, 100);
      setProgress(nextProgress);
    }, 100);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [active, durationMs]);

  return (
    <div
      className="w-full max-w-xs h-2 rounded-full bg-white/30 overflow-hidden"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(progress)}
      aria-label="Generating caricature progress"
    >
      <div
        className="h-full rounded-full bg-white"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}
