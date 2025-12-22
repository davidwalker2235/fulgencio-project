"use client";

import { useVoiceConversation } from "../hooks/useVoiceConversation";
import ConversationButton from "./ConversationButton";
import ConnectionStatus from "./ConnectionStatus";
import Transcription from "./Transcription";
import ErrorDisplay from "./ErrorDisplay";

export default function VoiceConversation() {
  const {
    isRecording,
    transcription,
    error,
    connectionStatus,
    toggleConversation,
    clearError,
  } = useVoiceConversation();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-8 bg-zinc-50 dark:bg-black">
      <main className="w-full max-w-4xl space-y-6">
        <h1 className="text-4xl font-bold text-center text-black dark:text-zinc-50 mb-8">
          Conversación de Voz con IA
        </h1>

        <ConversationButton
          isRecording={isRecording}
          connectionStatus={connectionStatus}
          onToggle={toggleConversation}
        />

        <ConnectionStatus status={connectionStatus} />

        <Transcription messages={transcription} />

        <ErrorDisplay error={error} onClose={clearError} />
      </main>
    </div>
  );
}
