import { ConnectionStatus } from "../types";

interface ConversationButtonProps {
  isRecording: boolean;
  connectionStatus: ConnectionStatus;
  onToggle: () => void;
}

export default function ConversationButton({
  isRecording,
  connectionStatus,
  onToggle,
}: ConversationButtonProps) {
  return (
    <div className="flex justify-center">
      <button
        onClick={onToggle}
        disabled={connectionStatus === "Connecting"}
        className={`px-8 py-4 rounded-full text-lg font-semibold transition-all ${
          isRecording
            ? "bg-red-500 hover:bg-red-600 text-white"
            : "bg-blue-500 hover:bg-blue-600 text-white"
        } disabled:opacity-50 disabled:cursor-not-allowed`}
      >
        {connectionStatus === "Connecting"
          ? "Conectando..."
          : isRecording
          ? "Detener Conversación"
          : "Iniciar Conversación"}
      </button>
    </div>
  );
}

