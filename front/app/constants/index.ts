import { VOICE_ASSISTANT_INSTRUCTIONS } from "./aiPrompts";

export const WEBSOCKET_URL = 
  process.env.NEXT_PUBLIC_WS_URL || 
  (typeof window !== "undefined" 
    ? (window.location.protocol === "https:" 
        ? `wss://${window.location.hostname.replace('fulgencio-frontend', 'fulgencio-backend')}/ws`
        : `ws://${window.location.hostname}:8000/ws`)
    : "ws://localhost:8000/ws");

export const AUDIO_CONFIG = {
  channelCount: 1,
  sampleRate: 16000,
  echoCancellation: true,
  noiseSuppression: true,
} as const;

export const AUDIO_PROCESSING = {
  bufferSize: 4096,
  inputSampleRate: 16000,
  outputSampleRate: 24000,
  sampleRate: 24000,
} as const;

export const VOICE_DETECTION = {
  speakingThreshold: 0.005,
  silenceDurationMs: 1000,
} as const;

export const SESSION_CONFIG = {
  modalities: ["text", "audio"],
  instructions: VOICE_ASSISTANT_INSTRUCTIONS,
  voice: "shimmer",
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

// Re-exportar prompts de IA para facilitar el acceso
export * from "./aiPrompts";

