"use client";

import { useVoiceConversation } from "../hooks/useVoiceConversation";
import ConversationButton from "./ConversationButton";
import ConnectionStatus from "./ConnectionStatus";
import ErrorDisplay from "./ErrorDisplay";
import AnimatedFace from "./AnimatedFace";
import FaceMorphTargets from './face/FaceMorphTargets';
import VideoLoop from "./VideoLoop";

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
    <div className="relative bg-zinc-50 dark:bg-black">
      <div className="fixed top-0 left-0 left-0 z-10 flex flex-col items-center p-8 pointer-events-none">
        <ConnectionStatus status={connectionStatus} />
      </div>
      {/* <div className="flex justify-center items-center">
        <AnimatedFace />
      </div> */}
      {/* <div className="fixed inset-0 w-full h-full z-0">
        <FaceMorphTargets />
      </div> */}
      <div className="fixed bottom-0 left-0 right-0 z-10 flex flex-col items-center p-8 pointer-events-none">
        <div className="w-full max-w-4xl space-y-4 pointer-events-auto">
          <ConversationButton
            isRecording={isRecording}
            connectionStatus={connectionStatus}
            onToggle={() =>toggleConversation(transcription)}
          />
          <ErrorDisplay error={error} onClose={clearError} />
        </div>
      </div>
    </div>
  );
}
