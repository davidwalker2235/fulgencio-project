"use client";

import { useState } from "react";
import { ref, set } from "firebase/database";
import { database } from "../../firebaseConfig";

export default function RefillPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleResetStatus = async () => {
    setIsLoading(true);
    setMessage(null);

    try {
      await set(ref(database, "status"), "idle");
      setMessage("Status actualizado a idle.");
    } catch (error) {
      console.error("Error actualizando status:", error);
      setMessage("No se pudo actualizar status.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen w-full flex items-center justify-center bg-[#033778] px-4">
      <div className="flex flex-col items-center gap-4">
        <button
          type="button"
          onClick={handleResetStatus}
          disabled={isLoading}
          className="rounded-lg bg-white text-[#033778] font-semibold px-8 py-4 text-lg hover:bg-gray-100 active:bg-gray-200 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
        >
          {isLoading ? "Resetting..." : "Reset Status"}
        </button>

        {message && <p className="text-white text-base text-center">{message}</p>}
      </div>
    </main>
  );
}
