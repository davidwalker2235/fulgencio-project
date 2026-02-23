export interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

export type ConnectionStatus = "Disconnected" | "Connecting" | "Connected";
export type PhotoState = "idle" | "takingPhoto" | "photoTaken";

export interface WebSocketMessage {
  type: string;
  [key: string]: unknown;
}

export interface CurrentUserNode {
  caricatures: string[];
  caricaturesTimestamp: string;
  email: string;
  fullName: string;
  photo: string;
  timestamp: string;
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

