import { useState, useRef, useCallback, useEffect } from "react";
import { useWebSocket } from "./useWebSocket";
import { useAudioRecording } from "./useAudioRecording";
import { useAudioPlayback } from "./useAudioPlayback";
import { WEBSOCKET_URL, VOICE_DETECTION } from "../constants";
import {
  Message,
  ConnectionStatus,
  WebSocketMessage,
  CurrentUserNode,
} from "../types";
import {
  arrayBufferToFloat32,
  base64ToFloat32,
} from "../services/audioUtils";
import { useFirebase } from "./useFirebase";

interface UseVoiceConversationReturn {
  isConnected: boolean;
  isRecording: boolean;
  transcription: Message[];
  error: string;
  connectionStatus: ConnectionStatus;
  isSpeaking: boolean;
  currentUserPhoto: string | null;
  activeUserId: string | null;
  startConversation: () => Promise<void>;
  stopConversation: (transcripción: Message[]) => void;
  toggleConversation: (transcripción: Message[]) => void;
  clearError: () => void;
  sendTextMessage: (text: string) => void;
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
    useState<ConnectionStatus>("Disconnected");
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [currentUserPhoto, setCurrentUserPhoto] = useState<string | null>(null);
  const [currentUserNodeUserId, setCurrentUserNodeUserId] = useState<string | null>(null);

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
  const { write, subscribe } = useFirebase();

  const currentResponseIdRef = useRef<string | null>(null);
  const isUserSpeakingRef = useRef<boolean>(false);
  const isInterruptedRef = useRef<boolean>(false);
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const audioCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [activeUserId, setActiveUserId] = useState<string | null>(null);

  // Monitorear el estado del audio para actualizar isSpeaking
  useEffect(() => {
    audioCheckIntervalRef.current = setInterval(() => {
      const hasAudio = hasActiveAudio();
      setIsSpeaking(hasAudio);
    }, 100); // Verificar cada 100ms

    return () => {
      if (audioCheckIntervalRef.current) {
        clearInterval(audioCheckIntervalRef.current);
      }
    };
  }, [hasActiveAudio]);

  // Suscripción a currentUser para mostrar/ocultar panel de foto.
  useEffect(() => {
    const unsubscribe = subscribe<CurrentUserNode>("currentUser", (data) => {
      if (data && typeof data === "object") {
        const maybeUserId = (data as CurrentUserNode).userId;
        if (typeof maybeUserId === "string" && maybeUserId.trim().length > 0) {
          setCurrentUserNodeUserId(maybeUserId.trim());
        } else if (typeof maybeUserId === "number" && Number.isFinite(maybeUserId)) {
          setCurrentUserNodeUserId(String(maybeUserId));
        } else {
          setCurrentUserNodeUserId(null);
        }

        if (typeof data.photo === "string" && data.photo.trim().length > 0) {
          setCurrentUserPhoto(data.photo);
          return;
        }
      }
      setCurrentUserNodeUserId(null);
      setCurrentUserPhoto(null);
    });

    return () => {
      unsubscribe();
    };
  }, [subscribe]);

  // Limpiar recursos al desmontar
  useEffect(() => {
    return () => {
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
      }
      if (audioCheckIntervalRef.current) {
        clearInterval(audioCheckIntervalRef.current);
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

  // Función para generar un ID de usuario único
  const generateUserId = useCallback((): string => {
    // Generar ID único usando timestamp y random
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 15);
    return `user_${timestamp}_${random}`;
  }, []);

  const startConversation = useCallback(async () => {
    try {
      setError("");
      setConnectionStatus("Connecting");

      // Generar ID único para este usuario/sesión
      const userId = generateUserId();
      setActiveUserId(userId);
      console.log("🆔 ID de usuario generado:", userId);

      // Configurar handlers de mensajes WebSocket ANTES de conectar
      // Los handlers se guardarán y se aplicarán cuando se cree el servicio
      console.log("📝 Registrando handlers de mensajes...");
      
      // Handler genérico para debug - capturar todos los mensajes
      onMessage("*", (data: WebSocketMessage) => {
        console.log("🔍 Mensaje genérico recibido:", data.type, data);
      });
      
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

      // Handler para cuando se completa el procesamiento de un mensaje de texto
      onMessage("conversation.item.input_text.done", (data: WebSocketMessage) => {
        console.log("✅ Mensaje de texto procesado:", data);
        // El mensaje ya debería estar en la transcripción, solo confirmamos
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
        console.log("📝 Delta de texto recibido:", data);
        const deltaText = (data.delta as string) || "";
        console.log("📝 Contenido delta:", deltaText);
        
        if (!deltaText || deltaText.trim() === "") {
          console.log("⚠️ Delta vacío, ignorando");
          return;
        }
        
        setTranscription((prev) => {
          console.log("📝 Estado anterior:", prev);
          const lastMessage = prev[prev.length - 1];
          console.log("📝 Último mensaje:", lastMessage);
          
          if (lastMessage && lastMessage.role === "assistant") {
            const updated = [
              ...prev.slice(0, -1),
              {
                ...lastMessage,
                content: lastMessage.content + deltaText,
              },
            ];
            console.log("📝 Actualizando mensaje existente de asistente, nuevo contenido:", updated[updated.length - 1].content);
            return updated;
          } else {
            const newMessage = {
              role: "assistant" as const,
              content: deltaText,
              timestamp: new Date(),
            };
            console.log("📝 Creando nuevo mensaje de asistente:", newMessage);
            return [...prev, newMessage];
          }
        });
      });

      onMessage("conversation.item.output_text.done", (data: WebSocketMessage) => {
        console.log("✅ Texto completo recibido:", data);
        const fullText = (data.text as string) || "";
        console.log("✅ Contenido completo:", fullText);
        
        setTranscription((prev) => {
          const lastMessage = prev[prev.length - 1];
          console.log("✅ Último mensaje antes de done:", lastMessage);
          
          if (lastMessage && lastMessage.role === "assistant") {
            const updated = [
              ...prev.slice(0, -1),
              {
                ...lastMessage,
                content: fullText || lastMessage.content,
              },
            ];
            console.log("✅ Actualizando mensaje final de asistente");
            return updated;
          } else {
            const newMessage = {
              role: "assistant" as const,
              content: fullText,
              timestamp: new Date(),
            };
            console.log("✅ Creando nuevo mensaje final de asistente:", newMessage);
            return [...prev, newMessage];
          }
        });
      });

      // Handler para transcripción de audio de la IA (si viene como audio_transcript)
      onMessage("response.audio_transcript.delta", (data: WebSocketMessage) => {
        console.log("🎤 Transcripción de audio delta recibida:", data);
        const transcriptDelta = (data.delta as string) || "";
        console.log("🎤 Contenido delta de transcripción:", transcriptDelta);
        
        if (!transcriptDelta || transcriptDelta.trim() === "") {
          return;
        }
        
        setTranscription((prev) => {
          const lastMessage = prev[prev.length - 1];
          
          if (lastMessage && lastMessage.role === "assistant") {
            return [
              ...prev.slice(0, -1),
              {
                ...lastMessage,
                content: lastMessage.content + transcriptDelta,
              },
            ];
          } else {
            return [
              ...prev,
              {
                role: "assistant",
                content: transcriptDelta,
                timestamp: new Date(),
              },
            ];
          }
        });
      });

      onMessage("response.audio_transcript.done", (data: WebSocketMessage) => {
        console.log("🎤 Transcripción de audio completa recibida:", data);
        const fullTranscript = (data.transcript as string) || "";
        console.log("🎤 Contenido completo de transcripción:", fullTranscript);
        
        if (!fullTranscript || fullTranscript.trim() === "") {
          return;
        }
        
        setTranscription((prev) => {
          const lastMessage = prev[prev.length - 1];
          
          if (lastMessage && lastMessage.role === "assistant") {
            return [
              ...prev.slice(0, -1),
              {
                ...lastMessage,
                content: fullTranscript || lastMessage.content,
              },
            ];
          } else {
            return [
              ...prev,
              {
                role: "assistant",
                content: fullTranscript,
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
        const directMessage =
          typeof data.message === "string" ? data.message : "";
        const nestedMessage =
          typeof data.error === "object" &&
          data.error !== null &&
          "message" in data.error &&
          typeof (data.error as { message?: unknown }).message === "string"
            ? (data.error as { message: string }).message
            : "";
        setError(directMessage || nestedMessage || "Error desconocido");
        setConnectionStatus("Disconnected");
      });

      // ========== Handlers para Erni Agent ==========
      
      // Transcripción parcial del usuario (STT en tiempo real)
      onMessage("stt_chunk", (data: WebSocketMessage) => {
        console.log("🎤 [Erni] STT chunk:", data.transcript);
      });

      // Transcripción final del usuario
      onMessage("stt_output", (data: WebSocketMessage) => {
        console.log("🎤 [Erni] STT final:", data.transcript);
        const userMessage: Message = {
          role: "user",
          content: (data.transcript as string) || "",
          timestamp: new Date(),
        };
        setTranscription((prev) => [...prev, userMessage]);
      });

      // Texto de respuesta del agente (streaming)
      onMessage("agent_chunk", (data: WebSocketMessage) => {
        console.log("💬 [Erni] Agent chunk:", data.text);
        const chunkText = (data.text as string) || "";
        
        if (!chunkText) return;
        
        setTranscription((prev) => {
          const lastMessage = prev[prev.length - 1];
          
          if (lastMessage && lastMessage.role === "assistant") {
            return [
              ...prev.slice(0, -1),
              {
                ...lastMessage,
                content: lastMessage.content + chunkText,
              },
            ];
          } else {
            return [
              ...prev,
              {
                role: "assistant",
                content: chunkText,
                timestamp: new Date(),
              },
            ];
          }
        });
      });

      // Fin de respuesta del agente
      onMessage("agent_end", () => {
        console.log("✅ [Erni] Agent respuesta completada");
        currentResponseIdRef.current = null;
      });

      // Llamada a herramienta
      onMessage("tool_call", (data: WebSocketMessage) => {
        console.log("🔧 [Erni] Tool call:", data.name, data.args);
      });

      // Resultado de herramienta
      onMessage("tool_result", (data: WebSocketMessage) => {
        console.log("🔧 [Erni] Tool result:", data.name, data.result);
      });

      // Audio de respuesta (TTS) - base64 PCM 24kHz
      onMessage("tts_chunk", (data: WebSocketMessage) => {
        console.log("🔊 [Erni] TTS chunk recibido");
        if (isInterruptedRef.current) {
          console.log("⏸️ Audio interrumpido, ignorando TTS chunk");
          return;
        }

        try {
          const audioBase64 = (data.audio as string) || "";
          if (audioBase64) {
            const float32 = base64ToFloat32(audioBase64);
            console.log("▶️ Reproduciendo TTS chunk, tamaño:", float32.length);
            playAudio(float32);
          }
        } catch (audioErr) {
          console.error("Error procesando TTS chunk:", audioErr);
        }
      });

      // Configurar handlers de conexión ANTES de conectar
      // El hook guardará los handlers y los aplicará cuando se cree el servicio
      onConnection({
        onOpen: () => {
          console.log("✅ WebSocket conectado - actualizando estado");
          setIsConnected(true);
          setConnectionStatus("Connected");
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
          setConnectionStatus("Disconnected");
          setIsRecording(false);
        },
        onError: (err: Error) => {
          console.error("❌ Error en WebSocket:", err);
          setError(err.message);
          setConnectionStatus("Disconnected");
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
      setConnectionStatus("Disconnected");
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
    generateUserId,
    handleUserSpeaking,
  ]);

  const stopConversation = useCallback((transcription: Message[]) => {
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

    // Guardar transcripción priorizando userId de currentUser; fallback a activeUserId.
    const storageUserId = currentUserNodeUserId || activeUserId;
    if (storageUserId) {
      const timestamp = Date.now();
      write(`users/${storageUserId}/transcriptions/${timestamp}`, transcription);
      console.log(`Transcripción guardada en users/${storageUserId}/transcriptions/${timestamp}`);
      
      // Limpiar el ID del usuario activo después de guardar
      setActiveUserId(null);
    } else {
      console.warn("⚠️ No hay ID de usuario activo, no se guardará la transcripción");
    }

    // Al detener conversación, limpiar siempre currentUser.
    write("currentUser", "null").catch((err) => {
      console.error("❌ Error reseteando currentUser a null:", err);
    });

    // Resetear estados
    setIsRecording(false);
    setIsConnected(false);
    setConnectionStatus("Disconnected");
    currentResponseIdRef.current = null;
    isUserSpeakingRef.current = false;
    setCurrentUserNodeUserId(null);
    setTranscription([]);
  }, [disconnect, stopRecording, stopAllAudio, send, wsIsConnected, write, currentUserNodeUserId, activeUserId]);

  const toggleConversation = useCallback((transcription: Message[]) => {
    if (isRecording) {
      stopConversation(transcription);
    } else {
      startConversation();
    }
  }, [isRecording, startConversation, stopConversation]);

  const clearError = useCallback(() => {
    setError("");
  }, []);

  const sendTextMessage = useCallback(
    (text: string) => {
      if (!wsIsConnected() || !text.trim()) {
        console.warn("No se puede enviar texto: WebSocket no conectado o texto vacío");
        if (!wsIsConnected()) {
          setError("No hay conexión activa. Por favor, inicia una conversación primero.");
        }
        return;
      }

      // Agregar mensaje del usuario a la transcripción inmediatamente
      const userMessage: Message = {
        role: "user",
        content: text.trim(),
        timestamp: new Date(),
      };
      setTranscription((prev) => [...prev, userMessage]);

      // Enviar texto a GPT Realtime usando conversation.item.create
      const textMessage: WebSocketMessage = {
        type: "conversation.item.create",
        item: {
          type: "message",
          role: "user",
          content: [
            {
              type: "input_text",
              text: text.trim(),
            },
          ],
        },
      };

      send(textMessage);
      console.log("📤 Texto enviado a GPT Realtime:", text.trim());

      // Solicitar respuesta después de enviar el texto
      // Esperar un momento para que el mensaje se procese
      setTimeout(() => {
        if (wsIsConnected() && !currentResponseIdRef.current) {
          send({
            type: "response.create",
          });
          console.log("✅ Solicitud de respuesta enviada después de texto");
        }
      }, 100);
    },
    [send, wsIsConnected]
  );

  return {
    isConnected,
    isRecording,
    transcription,
    error,
    connectionStatus,
    isSpeaking,
    currentUserPhoto,
    activeUserId,
    startConversation,
    stopConversation,
    toggleConversation,
    clearError,
    sendTextMessage,
  };
}

