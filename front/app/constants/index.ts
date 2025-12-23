// URL del WebSocket - puede ser configurada mediante variable de entorno
// En producción (Azure), usa wss:// con el hostname del backend
// En desarrollo, usa ws:// con localhost
export const WEBSOCKET_URL = 
  process.env.NEXT_PUBLIC_WS_URL || 
  (typeof window !== "undefined" 
    ? (window.location.protocol === "https:" 
        ? `wss://${window.location.hostname.replace('fulgencio-frontend', 'fulgencio-backend')}/ws`
        : `ws://${window.location.hostname}:8000/ws`)
    : "ws://localhost:8000/ws");

export const AUDIO_CONFIG = {
  channelCount: 1,
  sampleRate: 24000,
  echoCancellation: true,
  noiseSuppression: true,
} as const;

export const AUDIO_PROCESSING = {
  bufferSize: 4096,
  sampleRate: 24000,
} as const;

export const VOICE_DETECTION = {
  speakingThreshold: 0.005,
  silenceDurationMs: 1000,
} as const;

export const SESSION_CONFIG = {
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
    silence_duration_ms: 1000,
  },
} as const;

