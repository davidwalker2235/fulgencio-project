"use client";

import { useState, useRef, useEffect } from "react";

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

export default function VoiceConversation() {
  const [isConnected, setIsConnected] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [transcription, setTranscription] = useState<Message[]>([]);
  const [error, setError] = useState<string>("");
  const [connectionStatus, setConnectionStatus] = useState<"Desconectado" | "Conectando" | "Conectado">("Desconectado");

  const wsRef = useRef<WebSocket | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioQueueRef = useRef<Float32Array[]>([]);
  const isPlayingRef = useRef<boolean>(false);
  const nextPlayTimeRef = useRef<number>(0);
  const currentResponseIdRef = useRef<string | null>(null);
  const isUserSpeakingRef = useRef<boolean>(false);
  const audioLevelRef = useRef<number>(0);
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isRecordingRef = useRef<boolean>(false);
  const activeAudioSourcesRef = useRef<AudioBufferSourceNode[]>([]);
  const isInterruptedRef = useRef<boolean>(false);

  // Función para detener todo el audio que se está reproduciendo
  const stopAllAudio = () => {
    console.log("Deteniendo todo el audio...");
    // Detener todas las fuentes de audio activas
    activeAudioSourcesRef.current.forEach((source) => {
      try {
        source.stop();
        source.disconnect();
      } catch (err) {
        // Ignorar errores si ya está detenida
      }
    });
    activeAudioSourcesRef.current = [];
    // Limpiar cola
    audioQueueRef.current = [];
    isPlayingRef.current = false;
    nextPlayTimeRef.current = 0;
  };

  // Función para reproducir la cola de audio de forma secuencial
  const playAudioQueue = (audioContext: AudioContext) => {
    if (isPlayingRef.current || audioQueueRef.current.length === 0) {
      return;
    }

    isPlayingRef.current = true;

    const playNext = () => {
      // Verificar si se canceló la reproducción
      if (!isPlayingRef.current) {
        return;
      }

      if (audioQueueRef.current.length === 0) {
        isPlayingRef.current = false;
        activeAudioSourcesRef.current = [];
        return;
      }

      const float32 = audioQueueRef.current.shift();
      if (!float32) {
        playNext();
        return;
      }

      try {
        const audioBuffer = audioContext.createBuffer(1, float32.length, 24000);
        audioBuffer.getChannelData(0).set(float32);
        
        const source = audioContext.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(audioContext.destination);
        
        // Guardar referencia para poder detenerla si es necesario
        activeAudioSourcesRef.current.push(source);
        
        // Programar la reproducción para que sea secuencial
        const currentTime = audioContext.currentTime;
        const startTime = Math.max(currentTime, nextPlayTimeRef.current);
        source.start(startTime);
        
        // Calcular el tiempo de finalización
        const duration = audioBuffer.duration;
        nextPlayTimeRef.current = startTime + duration;
        
        // Reproducir el siguiente chunk cuando termine este
        source.onended = () => {
          // Remover de la lista de fuentes activas
          activeAudioSourcesRef.current = activeAudioSourcesRef.current.filter(s => s !== source);
          // Solo continuar si aún se está reproduciendo
          if (isPlayingRef.current) {
            playNext();
          }
        };
      } catch (err) {
        console.error("Error reproduciendo chunk de audio:", err);
        if (isPlayingRef.current) {
          playNext();
        }
      }
    };

    playNext();
  };

  // Limpiar recursos al desmontar
  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
      // Limpiar cola de audio y timers
      audioQueueRef.current = [];
      isPlayingRef.current = false;
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
      }
    };
  }, []);

  const handleStartConversation = async () => {
    try {
      setError("");
      setConnectionStatus("Conectando");

      // Solicitar acceso al micrófono
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 24000,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });

      streamRef.current = stream;

      // Crear AudioContext para procesar el audio
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: 24000,
      });
      audioContextRef.current = audioContext;

      // Crear fuente de audio desde el stream
      const source = audioContext.createMediaStreamSource(stream);
      // ScriptProcessor está deprecado pero aún funciona
      // Usar bufferSize de 4096 para chunks pequeños y frecuentes
      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      
      console.log("ScriptProcessor creado");

      // Conectar al WebSocket del backend
      const ws = new WebSocket("ws://localhost:8000/ws");
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        setConnectionStatus("Conectado");
        setIsRecording(true);
        isRecordingRef.current = true; // Actualizar referencia también

        // Resetear cola de audio y estados
        audioQueueRef.current = [];
        isPlayingRef.current = false;
        nextPlayTimeRef.current = 0;
        currentResponseIdRef.current = null;
        isUserSpeakingRef.current = false;
        isInterruptedRef.current = false;
        if (silenceTimerRef.current) {
          clearTimeout(silenceTimerRef.current);
          silenceTimerRef.current = null;
        }

        // Inicializar la sesión con GPT Realtime
        ws.send(
          JSON.stringify({
            type: "session.update",
            session: {
              modalities: ["text", "audio"],
              instructions: "Eres un asistente de voz amigable y útil. Responde de forma natural y conversacional.",
              voice: "alloy",
              input_audio_format: "pcm16",
              output_audio_format: "pcm16",
              input_audio_transcription: {
                model: "whisper-1",
              },
              turn_detection: {
                type: "server_vad",
                threshold: 0.5,
                prefix_padding_ms: 300,
                silence_duration_ms: 500,
              },
            },
          })
        );

        // Solicitar respuesta inicial
        ws.send(
          JSON.stringify({
            type: "response.create",
          })
        );
      };

      ws.onmessage = async (event) => {
        try {
          if (event.data instanceof Blob) {
            // Audio recibido como Blob - es PCM16 sin formato de contenedor
            // Solo bloquear si hay una interrupción activa
            if (isInterruptedRef.current) {
              // Interrupción activa, ignorar este audio
              return;
            }
            
            try {
              const arrayBuffer = await event.data.arrayBuffer();
              const pcm16Data = new Int16Array(arrayBuffer);
              
              // Convertir PCM16 a Float32 para AudioContext
              const float32 = new Float32Array(pcm16Data.length);
              for (let i = 0; i < pcm16Data.length; i++) {
                float32[i] = pcm16Data[i] / 32768.0;
              }
              
              // Agregar a la cola de audio normalmente
              audioQueueRef.current.push(float32);
              playAudioQueue(audioContext);
            } catch (audioErr) {
              console.error("Error reproduciendo audio:", audioErr);
            }
          } else {
            // Mensaje JSON
            const data = JSON.parse(event.data);

            // Manejar diferentes tipos de eventos
            if (data.type === "conversation.item.input_audio_transcription.completed") {
              // Transcripción del usuario
              const userMessage: Message = {
                role: "user",
                content: data.transcript || "",
                timestamp: new Date(),
              };
              setTranscription((prev) => [...prev, userMessage]);
            } else if (data.type === "response.audio.delta" && data.delta) {
              // Audio delta en base64 - decodificar y agregar a la cola
              // Solo bloquear si hay una interrupción activa
              if (isInterruptedRef.current) {
                // Interrupción activa, ignorar este audio
                return;
              }
              
              try {
                const audioBytes = Uint8Array.from(atob(data.delta), (c) => c.charCodeAt(0));
                // Convertir bytes a Int16Array (little-endian)
                const pcm16 = new Int16Array(audioBytes.buffer);
                // Convertir PCM16 a Float32 para AudioContext
                const float32 = new Float32Array(pcm16.length);
                for (let i = 0; i < pcm16.length; i++) {
                  float32[i] = pcm16[i] / 32768.0;
                }
                // Agregar a la cola de audio normalmente
                audioQueueRef.current.push(float32);
                // Reproducir si no está reproduciendo
                playAudioQueue(audioContext);
              } catch (audioErr) {
                console.error("Error procesando audio delta:", audioErr);
              }
            } else if (data.type === "response.audio.done") {
              // Audio completado - asegurar que toda la cola se reproduzca
              console.log("Audio completado, reproduciendo cola restante");
            } else if (data.type === "conversation.item.output_text.delta") {
              // Texto parcial del asistente
              setTranscription((prev) => {
                const lastMessage = prev[prev.length - 1];
                if (lastMessage && lastMessage.role === "assistant") {
                  return [
                    ...prev.slice(0, -1),
                    { ...lastMessage, content: lastMessage.content + (data.delta || "") },
                  ];
                } else {
                  return [
                    ...prev,
                    {
                      role: "assistant",
                      content: data.delta || "",
                      timestamp: new Date(),
                    },
                  ];
                }
              });
            } else if (data.type === "conversation.item.output_text.done") {
              // Texto completo del asistente
              setTranscription((prev) => {
                const lastMessage = prev[prev.length - 1];
                if (lastMessage && lastMessage.role === "assistant") {
                  return [
                    ...prev.slice(0, -1),
                    { ...lastMessage, content: data.text || lastMessage.content },
                  ];
                } else {
                  return [
                    ...prev,
                    {
                      role: "assistant",
                      content: data.text || "",
                      timestamp: new Date(),
                    },
                  ];
                }
              });
            } else if (data.type === "error") {
              setError(data.message || "Error desconocido");
              setConnectionStatus("Desconectado");
            } else if (data.type === "response.audio_transcript.delta") {
              // Transcripción de audio del asistente (opcional)
              console.log("Audio transcript delta:", data.delta);
            } else if (data.type === "session.updated") {
              // Sesión actualizada correctamente
              console.log("Sesión actualizada:", data);
            } else if (data.type === "response.created") {
              // Respuesta creada - guardar el ID para poder cancelarla
              currentResponseIdRef.current = data.response?.id || null;
              console.log("Respuesta creada:", data.response?.id);
            } else if (data.type === "response.done") {
              // Respuesta completada
              console.log("Respuesta completada:", data);
              currentResponseIdRef.current = null;
            } else if (data.type === "response.cancelled") {
              // Respuesta cancelada
              console.log("Respuesta cancelada por el servidor");
              currentResponseIdRef.current = null;
              // Detener todo el audio cuando se cancela
              stopAllAudio();
              // Quitar la marca de interrupción cuando el servidor confirma la cancelación
              isInterruptedRef.current = false;
              // No solicitar nueva respuesta aquí - se solicitará cuando el usuario deje de hablar
            }
          }
        } catch (err) {
          console.error("Error procesando mensaje:", err);
          setError(`Error procesando mensaje: ${err instanceof Error ? err.message : "Desconocido"}`);
        }
      };

      ws.onerror = (err) => {
        console.error("Error en WebSocket:", err);
        setError("Error en la conexión WebSocket");
        setConnectionStatus("Desconectado");
      };

      ws.onclose = () => {
        setIsConnected(false);
        setConnectionStatus("Desconectado");
        setIsRecording(false);
        isRecordingRef.current = false; // Actualizar referencia también
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((track) => track.stop());
        }
      };

      // Procesar audio y enviarlo al servidor
      // IMPORTANTE: Asignar el handler ANTES de conectar el processor
      let audioChunkCount = 0;
      processor.onaudioprocess = (e) => {
        audioChunkCount++;
        
        // Log el primer chunk para verificar que se está ejecutando
        if (audioChunkCount === 1) {
          console.log("✅ onaudioprocess se está ejecutando! Primer chunk recibido");
        }
        
        const inputData = e.inputBuffer.getChannelData(0);
        
        // Calcular nivel de audio
        let sum = 0;
        for (let i = 0; i < inputData.length; i++) {
          sum += Math.abs(inputData[i]);
        }
        const averageLevel = sum / inputData.length;
        audioLevelRef.current = averageLevel;
        
        // Log cada 100 chunks para verificar que se está procesando audio
        if (audioChunkCount % 100 === 0) {
          console.log(`Audio procesado: chunk ${audioChunkCount}, nivel: ${averageLevel.toFixed(4)}, muestras: ${inputData.length}, WS: ${ws.readyState}, Recording: ${isRecordingRef.current}`);
        }
        
        // Solo enviar si el WebSocket está abierto y está grabando
        // Usar la referencia en lugar del estado para evitar problemas de closure
        if (ws.readyState === WebSocket.OPEN && isRecordingRef.current) {
          // Si el nivel de audio es alto (usuario hablando) y la IA está hablando, cancelar respuesta
          const speakingThreshold = 0.005; // Threshold más bajo para detectar más rápido
          const wasUserSpeaking = isUserSpeakingRef.current;
          isUserSpeakingRef.current = averageLevel > speakingThreshold;
          
          // Si el usuario empieza a hablar mientras la IA está hablando, cancelar INMEDIATAMENTE
          // Verificar si hay audio reproduciéndose (cola no vacía o isPlaying activo o fuentes activas)
          const hasActiveAudio = isPlayingRef.current || audioQueueRef.current.length > 0 || activeAudioSourcesRef.current.length > 0;
          
          // Detectar interrupción: usuario habla Y hay audio activo
          // Solo interrumpir cuando el usuario EMPIEZA a hablar mientras hay audio
          if (isUserSpeakingRef.current && !wasUserSpeaking && hasActiveAudio) {
            console.log("🚨 INTERRUPCIÓN DETECTADA - Usuario hablando mientras IA habla");
            // Marcar que hay una interrupción activa
            isInterruptedRef.current = true;
            // Detener todo el audio INMEDIATAMENTE
            stopAllAudio();
            
            // Si hay una respuesta activa, cancelarla en el servidor
            if (currentResponseIdRef.current) {
              try {
                ws.send(
                  JSON.stringify({
                    type: "response.cancel",
                    response_id: currentResponseIdRef.current,
                  })
                );
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
          if (!isUserSpeakingRef.current && wasUserSpeaking) {
            isInterruptedRef.current = false;
          }
          
          // Si el usuario sigue hablando después de interrumpir, mantener la cola limpia
          if (isInterruptedRef.current && audioQueueRef.current.length > 0) {
            // Usuario sigue hablando después de interrumpir - limpiar cola pendiente
            audioQueueRef.current = [];
          }
          
          // Si el usuario deja de hablar, esperar medio segundo y solicitar respuesta
          if (!isUserSpeakingRef.current && wasUserSpeaking) {
            // Limpiar timer anterior si existe
            if (silenceTimerRef.current) {
              clearTimeout(silenceTimerRef.current);
            }
            // Esperar 500ms de silencio antes de solicitar respuesta
            silenceTimerRef.current = setTimeout(() => {
              if (ws.readyState === WebSocket.OPEN && !currentResponseIdRef.current) {
                console.log("Usuario dejó de hablar - solicitando respuesta");
                ws.send(
                  JSON.stringify({
                    type: "response.create",
                  })
                );
              }
              silenceTimerRef.current = null;
            }, 500);
          }
          
          // Convertir Float32Array a Int16Array (PCM16)
          const pcm16 = new Int16Array(inputData.length);
          for (let i = 0; i < inputData.length; i++) {
            const s = Math.max(-1, Math.min(1, inputData[i]));
            pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
          }
          
          // Enviar audio directamente como bytes (sin acumular)
          // GPT Realtime espera chunks pequeños y frecuentes
          try {
            // Enviar como ArrayBuffer
            ws.send(pcm16.buffer);
            // Log cada 100 chunks para no saturar la consola
            if (Math.random() < 0.01) {
              console.log(`Audio enviado: ${pcm16.length} muestras, nivel: ${averageLevel.toFixed(4)}`);
            }
          } catch (err) {
            console.error("Error enviando audio:", err);
          }
        }
      };

      // Verificar que el stream tenga tracks activos
      const audioTracks = stream.getAudioTracks();
      console.log(`Stream tiene ${audioTracks.length} track(s) de audio`);
      audioTracks.forEach((track, index) => {
        console.log(`Track ${index}: ${track.label}, enabled: ${track.enabled}, muted: ${track.muted}, readyState: ${track.readyState}`);
      });
      
      // Conectar el procesador de audio
      source.connect(processor);
      processor.connect(audioContext.destination);
      console.log("Audio processor conectado y listo para capturar audio");
      console.log("Estado del AudioContext:", audioContext.state);
      console.log("Sample rate:", audioContext.sampleRate);
    } catch (err) {
      console.error("Error iniciando conversación:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Error al acceder al micrófono o conectar con el servidor"
      );
      setConnectionStatus("Desconectado");
    }
  };

  const handleStopConversation = () => {
    console.log("Deteniendo conversación...");
    
    // Detener todo el audio inmediatamente
    stopAllAudio();
    
    // Cancelar respuesta activa si existe
    if (currentResponseIdRef.current && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      console.log("Cancelando respuesta activa antes de cerrar");
      wsRef.current.send(
        JSON.stringify({
          type: "response.cancel",
          response_id: currentResponseIdRef.current,
        })
      );
    }
    
    // Cerrar WebSocket
    if (wsRef.current) {
      wsRef.current.close();
    }
    
    // Detener media recorder si existe
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    
    // Detener stream de audio
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
    }
    
    // Limpiar timers
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    
    // Resetear estados
    setIsRecording(false);
    isRecordingRef.current = false;
    setIsConnected(false);
    setConnectionStatus("Desconectado");
    currentResponseIdRef.current = null;
    isUserSpeakingRef.current = false;
  };

  const handleToggleConversation = () => {
    if (isRecording) {
      handleStopConversation();
    } else {
      handleStartConversation();
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-8 bg-zinc-50 dark:bg-black">
      <main className="w-full max-w-4xl space-y-6">
        <h1 className="text-4xl font-bold text-center text-black dark:text-zinc-50 mb-8">
          Conversación de Voz con IA
        </h1>

        {/* Botón de control */}
        <div className="flex justify-center">
          <button
            onClick={handleToggleConversation}
            disabled={connectionStatus === "Conectando"}
            className={`px-8 py-4 rounded-full text-lg font-semibold transition-all ${
              isRecording
                ? "bg-red-500 hover:bg-red-600 text-white"
                : "bg-blue-500 hover:bg-blue-600 text-white"
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {connectionStatus === "Conectando"
              ? "Conectando..."
              : isRecording
              ? "Detener Conversación"
              : "Iniciar Conversación"}
          </button>
        </div>

        {/* Estado de conexión */}
        <div className="bg-white dark:bg-zinc-900 p-4 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-2 text-black dark:text-zinc-50">
            Estado de Conexión
          </h2>
          <div className="flex items-center gap-2">
            <div
              className={`w-3 h-3 rounded-full ${
                connectionStatus === "Conectado"
                  ? "bg-green-500"
                  : connectionStatus === "Conectando"
                  ? "bg-yellow-500"
                  : "bg-red-500"
              }`}
            />
            <span className="text-black dark:text-zinc-50">{connectionStatus}</span>
          </div>
        </div>

        {/* Transcripción */}
        <div className="bg-white dark:bg-zinc-900 p-6 rounded-lg shadow min-h-[400px] max-h-[600px] overflow-y-auto">
          <h2 className="text-xl font-semibold mb-4 text-black dark:text-zinc-50">
            Transcripción
          </h2>
          {transcription.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400 italic">
              La transcripción aparecerá aquí cuando comiences a hablar...
            </p>
          ) : (
            <div className="space-y-4">
              {transcription.map((message, index) => (
                <div
                  key={index}
                  className={`p-4 rounded-lg ${
                    message.role === "user"
                      ? "bg-blue-100 dark:bg-blue-900 ml-8"
                      : "bg-gray-100 dark:bg-gray-800 mr-8"
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <span className="font-semibold text-black dark:text-zinc-50">
                      {message.role === "user" ? "Tú" : "Asistente"}:
                    </span>
                    <p className="text-black dark:text-zinc-50 flex-1 whitespace-pre-wrap">
                      {message.content}
                    </p>
                  </div>
                  <span className="text-xs text-gray-500 dark:text-gray-400 mt-2 block">
                    {message.timestamp.toLocaleTimeString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Errores */}
        {error && (
          <div className="bg-red-100 dark:bg-red-900 border border-red-400 dark:border-red-700 text-red-700 dark:text-red-200 px-4 py-3 rounded-lg">
            <h2 className="text-xl font-semibold mb-2">Error</h2>
            <p>{error}</p>
            <button
              onClick={() => setError("")}
              className="mt-2 text-sm underline hover:no-underline"
            >
              Cerrar
            </button>
          </div>
        )}
      </main>
    </div>
  );
}

