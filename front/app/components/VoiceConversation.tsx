"use client";

import { useVoiceConversation } from "../hooks/useVoiceConversation";
import ConversationButton from "./ConversationButton";
import ConnectionStatus from "./ConnectionStatus";
import ErrorDisplay from "./ErrorDisplay";
import VideoLoop from "./VideoLoop";
import Subtitles from "./Subtitles";

export default function VoiceConversation() {
  const {
    isRecording,
    transcription,
    error,
    connectionStatus,
    isSpeaking,
    toggleConversation,
    clearError,
  } = useVoiceConversation();

  return (
    <div className="relative min-h-screen bg-zinc-50 dark:bg-black">
      <div className="fixed inset-0 w-full h-full z-0">
        <VideoLoop connectionStatus={connectionStatus} isSpeaking={isSpeaking} />
      </div>
      <div className="fixed top-0 left-0 left-0 z-10 flex flex-col items-center p-8 pointer-events-none">
        <ConnectionStatus status={connectionStatus} />
      </div>
      <div className="fixed bottom-0 left-0 right-0 z-10 flex flex-col items-center p-8 pointer-events-none">
        <div className="w-full max-w-4xl space-y-4 pointer-events-auto">
          <Subtitles messages={transcription} isSpeaking={isSpeaking} isRecording={isRecording} />
          <ConversationButton
            isRecording={isRecording}
            connectionStatus={connectionStatus}
            onToggle={() => toggleConversation(transcription)}
          />
          <ErrorDisplay error={error} onClose={clearError} />
        </div>
      </div>
    </div>
  );
}
