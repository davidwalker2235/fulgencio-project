export const WEBSOCKET_URL = "ws://localhost:8000/ws";

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

