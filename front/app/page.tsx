"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "./hooks/useAuth";
import VoiceConversation from "./components/VoiceConversation";

export default function Home() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    // Redirigir al login si no está autenticado (después de verificar)
    if (!isLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [isAuthenticated, isLoading, router]);

  // No renderizar nada hasta verificar la autenticación
  if (isLoading || !isAuthenticated) {
    return null;
  }

  return (
    <div className="relative w-full h-screen">
      <VoiceConversation />
    </div>
  );
}
