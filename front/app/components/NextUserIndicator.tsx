"use client";

import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { onValue, ref } from "firebase/database";
import { database } from "../../firebaseConfig";

type NextUserIndicatorProps = {
  className?: string;
  style?: CSSProperties;
};

function extractCurrentUserId(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  if (typeof value === "object" && value !== null && "id" in value) {
    const idValue = (value as { id?: unknown }).id;
    const parsed = Number(idValue);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

export default function NextUserIndicator({ className, style }: NextUserIndicatorProps) {
  const [snakeCurrentUserId, setSnakeCurrentUserId] = useState<number | null>(null);
  const [camelCurrentUserId, setCamelCurrentUserId] = useState<number | null>(null);

  useEffect(() => {
    const snakeCaseCurrentUserRef = ref(database, "current_user");
    const camelCaseCurrentUserRef = ref(database, "currentUser");

    const unsubscribeSnakeCase = onValue(
      snakeCaseCurrentUserRef,
      (snapshot) => {
        const currentId = extractCurrentUserId(snapshot.val());
        setSnakeCurrentUserId(currentId);
      },
      (error) => {
        console.error("Error suscribiéndose a current_user:", error);
        setSnakeCurrentUserId(null);
      }
    );

    const unsubscribeCamelCase = onValue(
      camelCaseCurrentUserRef,
      (snapshot) => {
        const currentId = extractCurrentUserId(snapshot.val());
        setCamelCurrentUserId(currentId);
      },
      (error) => {
        console.error("Error suscribiéndose a currentUser:", error);
        setCamelCurrentUserId(null);
      }
    );

    return () => {
      unsubscribeSnakeCase();
      unsubscribeCamelCase();
    };
  }, []);

  const currentUserId = snakeCurrentUserId ?? camelCurrentUserId;
  const nextUserId = currentUserId !== null ? currentUserId + 1 : null;

  return (
    <p className={["m-0", className].filter(Boolean).join(" ")} style={style}>
      {/* flex interno + leading-none: evita el hueco bajo el texto del line-height en bloque */}
      <span className="flex max-w-full flex-row flex-wrap items-end gap-x-1 leading-none">
        <span className="shrink-0">Next number:</span>
        <span
          className="shrink-0 font-semibold leading-none"
          style={{ color: "red", fontSize: "200%", lineHeight: 1 }}
        >
          {nextUserId ?? "-"}
        </span>
      </span>
    </p>
  );
}
