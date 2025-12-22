import { useState, useRef, useCallback, useEffect } from "react";
import { useWebSocket } from "./useWebSocket";
import { useAudioRecording } from "./useAudioRecording";
import { useAudioPlayback } from "./useAudioPlayback";
import { WEBSOCKET_URL, VOICE_DETECTION } from "../constants";
import { Message, ConnectionStatus, WebSocketMessage } from "../types";
import {
  arrayBufferToFloat32,
  base64ToFloat32,
} from "../services/audioUtils";

interface UseVoiceConversationReturn {
  isConnected: boolean;
  isRecording: boolean;
  transcription: Message[];
  error: string;
  connectionStatus: ConnectionStatus;
  startConversation: () => Promise<void>;
  stopConversation: () => void;
  toggleConversation: () => void;
  clearError: () => void;
}

/**
 * Hook principal que orquesta toda la lógica de conversación de voz
 */
export function useVoiceConversation(): UseVoiceConversationReturn {
  const [isConnected, setIsConnected] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [transcription, setTranscription] = useState<Message[]>([]);
  const [error, setError] = useState<string>("");
  const [connectionStatus, setConnectionStatus] =
    useState<ConnectionStatus>("Desconectado");

  const {
    connect,
    disconnect,
    send,
    onMessage,
    onConnection,
    isConnected: wsIsConnected,
  } = useWebSocket();
  const { startRecording, stopRecording, isRecording: audioIsRecording } =
    useAudioRecording();
  const { playAudio, stopAllAudio, hasActiveAudio } = useAudioPlayback();

  const currentResponseIdRef = useRef<string | null>(null);
  const isUserSpeakingRef = useRef<boolean>(false);
  const isInterruptedRef = useRef<boolean>(false);
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Limpiar recursos al desmontar
  useEffect(() => {
    return () => {
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
      }
      // Detener grabación y desconectar
      stopRecording();
      disconnect();
      stopAllAudio();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAudioChunk = useCallback(
    (audioData: ArrayBuffer) => {
      if (wsIsConnected() && audioIsRecording()) {
        send(audioData);
      }
    },
    [send, wsIsConnected, audioIsRecording]
  );

  const handleUserSpeaking = useCallback(
    (isSpeaking: boolean, wasSpeaking: boolean) => {
      const audioIsActive = hasActiveAudio();

      // Si el usuario empieza a hablar mientras la IA está hablando, cancelar INMEDIATAMENTE
      if (isSpeaking && !wasSpeaking && audioIsActive) {
        console.log("🚨 INTERRUPCIÓN DETECTADA - Usuario hablando mientras IA habla");
        isInterruptedRef.current = true;
        stopAllAudio();

        // Si hay una respuesta activa, cancelarla en el servidor
        if (currentResponseIdRef.current) {
          try {
            send({
              type: "response.cancel",
              response_id: currentResponseIdRef.current,
            });
            console.log("✅ Comando de cancelación enviado al servidor");
          } catch (err) {
            console.error("❌ Error enviando cancelación:", err);
          }
        }

        // Limpiar timer de silencio si existe
        if (silenceTimerRef.current) {
          clearTimeout(silenceTimerRef.current);
          silenceTimerRef.current = null;
        }
      }

      // Si el usuario deja de hablar, quitar la marca de interrupción
      if (!isSpeaking && wasSpeaking) {
        isInterruptedRef.current = false;
      }

      // Si el usuario deja de hablar, esperar y solicitar respuesta
      if (!isSpeaking && wasSpeaking) {
        // Limpiar timer anterior si existe
        if (silenceTimerRef.current) {
          clearTimeout(silenceTimerRef.current);
        }
        // Esperar silencio antes de solicitar respuesta
        silenceTimerRef.current = setTimeout(() => {
          if (wsIsConnected() && !currentResponseIdRef.current) {
            console.log("Usuario dejó de hablar - solicitando respuesta");
            send({
              type: "response.create",
            });
          }
          silenceTimerRef.current = null;
        }, VOICE_DETECTION.silenceDurationMs);
      }
    },
    [send, wsIsConnected, stopAllAudio, hasActiveAudio]
  );

  const startConversation = useCallback(async () => {
    try {
      setError("");
      setConnectionStatus("Conectando");

      // Configurar handlers de mensajes WebSocket ANTES de conectar
      // Los handlers se guardarán y se aplicarán cuando se cree el servicio
      console.log("📝 Registrando handlers de mensajes...");
      
      onMessage("audio", async (blob: Blob) => {
        console.log("🔊 Handler de audio ejecutado");
        if (isInterruptedRef.current) {
          console.log("⏸️ Audio interrumpido, ignorando");
          return;
        }

        try {
          const arrayBuffer = await blob.arrayBuffer();
          const float32 = await arrayBufferToFloat32(arrayBuffer);
          console.log("▶️ Reproduciendo audio, tamaño:", float32.length);
          playAudio(float32);
        } catch (audioErr) {
          console.error("Error reproduciendo audio:", audioErr);
        }
      });

      onMessage("conversation.item.input_audio_transcription.completed", (data: WebSocketMessage) => {
        const userMessage: Message = {
          role: "user",
          content: (data.transcript as string) || "",
          timestamp: new Date(),
        };
        setTranscription((prev) => [...prev, userMessage]);
      });

      onMessage("response.audio.delta", (data: WebSocketMessage) => {
        console.log("🔊 Handler de audio delta ejecutado");
        if (isInterruptedRef.current) {
          console.log("⏸️ Audio interrumpido, ignorando delta");
          return;
        }

        try {
          const float32 = base64ToFloat32((data.delta as string) || "");
          console.log("▶️ Reproduciendo audio delta, tamaño:", float32.length);
          playAudio(float32);
        } catch (audioErr) {
          console.error("Error procesando audio delta:", audioErr);
        }
      });

      onMessage("conversation.item.output_text.delta", (data: WebSocketMessage) => {
        setTranscription((prev) => {
          const lastMessage = prev[prev.length - 1];
          if (lastMessage && lastMessage.role === "assistant") {
            return [
              ...prev.slice(0, -1),
              {
                ...lastMessage,
                content: lastMessage.content + ((data.delta as string) || ""),
              },
            ];
          } else {
            return [
              ...prev,
              {
                role: "assistant",
                content: (data.delta as string) || "",
                timestamp: new Date(),
              },
            ];
          }
        });
      });

      onMessage("conversation.item.output_text.done", (data: WebSocketMessage) => {
        setTranscription((prev) => {
          const lastMessage = prev[prev.length - 1];
          if (lastMessage && lastMessage.role === "assistant") {
            return [
              ...prev.slice(0, -1),
              {
                ...lastMessage,
                content: (data.text as string) || lastMessage.content,
              },
            ];
          } else {
            return [
              ...prev,
              {
                role: "assistant",
                content: (data.text as string) || "",
                timestamp: new Date(),
              },
            ];
          }
        });
      });

      onMessage("response.created", (data: WebSocketMessage) => {
        currentResponseIdRef.current =
          (data.response as { id?: string })?.id || null;
        console.log("Respuesta creada:", currentResponseIdRef.current);
      });

      onMessage("response.done", () => {
        console.log("Respuesta completada");
        currentResponseIdRef.current = null;
      });

      onMessage("response.cancelled", () => {
        console.log("Respuesta cancelada por el servidor");
        currentResponseIdRef.current = null;
        stopAllAudio();
        isInterruptedRef.current = false;
      });

      onMessage("error", (data: WebSocketMessage) => {
        setError((data.message as string) || "Error desconocido");
        setConnectionStatus("Desconectado");
      });

      // Configurar handlers de conexión ANTES de conectar
      // El hook guardará los handlers y los aplicará cuando se cree el servicio
      onConnection({
        onOpen: () => {
          console.log("✅ WebSocket conectado - actualizando estado");
          setIsConnected(true);
          setConnectionStatus("Conectado");
          setIsRecording(true);

          // Resetear estados
          currentResponseIdRef.current = null;
          isUserSpeakingRef.current = false;
          isInterruptedRef.current = false;
          if (silenceTimerRef.current) {
            clearTimeout(silenceTimerRef.current);
            silenceTimerRef.current = null;
          }
        },
        onClose: () => {
          console.log("❌ WebSocket cerrado");
          setIsConnected(false);
          setConnectionStatus("Desconectado");
          setIsRecording(false);
        },
        onError: (err: Error) => {
          console.error("❌ Error en WebSocket:", err);
          setError(err.message);
          setConnectionStatus("Desconectado");
        },
      });

      // Ahora conectar (el servicio se creará y aplicará los handlers guardados)
      await connect(WEBSOCKET_URL);

      // Iniciar grabación de audio
      await startRecording(handleAudioChunk, handleUserSpeaking);
    } catch (err) {
      console.error("Error iniciando conversación:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Error al acceder al micrófono o conectar con el servidor"
      );
      setConnectionStatus("Desconectado");
    }
  }, [
    connect,
    disconnect,
    send,
    onMessage,
    onConnection,
    startRecording,
    handleAudioChunk,
    playAudio,
    stopAllAudio,
    wsIsConnected,
    audioIsRecording,
    hasActiveAudio,
  ]);

  const stopConversation = useCallback(() => {
    console.log("Deteniendo conversación...");

    // Detener todo el audio inmediatamente
    stopAllAudio();

    // Cancelar respuesta activa si existe
    if (currentResponseIdRef.current && wsIsConnected()) {
      console.log("Cancelando respuesta activa antes de cerrar");
      send({
        type: "response.cancel",
        response_id: currentResponseIdRef.current,
      });
    }

    // Cerrar WebSocket
    disconnect();

    // Detener grabación
    stopRecording();

    // Limpiar timers
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }

    // Resetear estados
    setIsRecording(false);
    setIsConnected(false);
    setConnectionStatus("Desconectado");
    currentResponseIdRef.current = null;
    isUserSpeakingRef.current = false;
    setTranscription([]);
  }, [disconnect, stopRecording, stopAllAudio, send, wsIsConnected]);

  const toggleConversation = useCallback(() => {
    if (isRecording) {
      stopConversation();
    } else {
      startConversation();
    }
  }, [isRecording, startConversation, stopConversation]);

  const clearError = useCallback(() => {
    setError("");
  }, []);

  return {
    isConnected,
    isRecording,
    transcription,
    error,
    connectionStatus,
    startConversation,
    stopConversation,
    toggleConversation,
    clearError,
  };
}

