export interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

export interface UserContextResolvedPayload {
  type: "user.context.resolved";
  orderNumber: string;
  fullName: string;
  caricatures: string[];
}

export type ConnectionStatus = "Disconnected" | "Connecting" | "Connected";
export type PhotoState = "idle" | "takingPhoto" | "photoTaken";

export interface WebSocketMessage {
  type: string;
  [key: string]: any;
}

export interface SessionConfig {
  modalities: string[];
  instructions: string;
  voice: string;
  input_audio_format: string;
  output_audio_format: string;
  input_audio_transcription: {
    model: string;
  };
  turn_detection: {
    type: string;
    threshold: number;
    prefix_padding_ms: number;
    silence_duration_ms: number;
  };
}

