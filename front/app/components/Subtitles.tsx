"use client";

import { useEffect, useState, useRef } from "react";
import { Message } from "../types";

interface SubtitlesProps {
  messages: Message[];
  isSpeaking: boolean;
  isRecording: boolean;
}

export default function Subtitles({ messages, isSpeaking, isRecording }: SubtitlesProps) {
  const [visibleText, setVisibleText] = useState<string>("");
  const [isVisible, setIsVisible] = useState<boolean>(false);
  const hideTimerRef = useRef<NodeJS.Timeout | null>(null);
  const previousIsSpeakingRef = useRef<boolean>(false);

  // Obtener el último mensaje del asistente
  const lastAssistantMessage = [...messages]
    .reverse()
    .find((msg) => msg.role === "assistant");

  const currentText = lastAssistantMessage?.content.trim() || "";

  useEffect(() => {
    // Si hay texto nuevo del asistente, actualizar y mostrar
    if (currentText) {
      setVisibleText(currentText);
      setIsVisible(true);

      // Limpiar timer anterior si existe
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
      }
    }
  }, [currentText]);

  useEffect(() => {
    const wasSpeaking = previousIsSpeakingRef.current;
    previousIsSpeakingRef.current = isSpeaking;

    // Si la IA acaba de terminar de hablar (cambió de true a false)
    if (wasSpeaking && !isSpeaking && visibleText) {
      // Limpiar timer anterior si existe
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
      }

      // Esperar 1 segundo antes de ocultar
      hideTimerRef.current = setTimeout(() => {
        setIsVisible(false);
        // Limpiar el texto después de un pequeño delay para la transición
        setTimeout(() => {
          setVisibleText("");
        }, 300);
      }, 1000);
    }

    // Si la IA empieza a hablar de nuevo, cancelar el timer de ocultar
    if (!wasSpeaking && isSpeaking && hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }

    return () => {
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
      }
    };
  }, [isSpeaking, visibleText]);

  // Si se detiene la conversación, ocultar subtítulos inmediatamente
  useEffect(() => {
    if (!isRecording) {
      // Limpiar timer si existe
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
      }
      // Ocultar subtítulos inmediatamente
      setIsVisible(false);
      setVisibleText("");
    }
  }, [isRecording]);

  // Limpiar timer al desmontar
  useEffect(() => {
    return () => {
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
      }
    };
  }, []);

  if (!isVisible || !visibleText) {
    return null;
  }

  return (
    <div className="flex justify-center mb-4">
      <div className="px-6 py-3 rounded-lg bg-black/60 backdrop-blur-sm">
        <p className="text-white text-lg font-medium text-center max-w-2xl">
          {visibleText}
        </p>
      </div>
    </div>
  );
}

