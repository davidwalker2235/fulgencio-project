import { ConnectionStatus, PhotoState } from "../types";

interface ConversationButtonProps {
  isRecording: boolean;
  connectionStatus: ConnectionStatus;
  photoState: PhotoState;
  emailAccepted?: boolean;
  isValidEmail?: boolean;
  onToggle: () => void;
  onStartTakingPhoto?: () => void;
  onTakePhoto: () => void;
  onCancel: () => void;
  onSend: () => void;
  onTakePhotoAgain: () => void;
  onAgree?: () => void;
  onDisagree?: () => void;
}

export default function ConversationButton({
  isRecording,
  connectionStatus,
  photoState,
  emailAccepted = false,
  isValidEmail = false,
  onToggle,
  onStartTakingPhoto,
  onTakePhoto,
  onCancel,
  onSend,
  onTakePhotoAgain,
  onAgree,
  onDisagree,
}: ConversationButtonProps) {
  // Si estamos en modo de tomar foto pero aún no se ha aceptado el email, mostrar Agree/Disagree
  if (photoState === "takingPhoto" && !emailAccepted) {
    return (
      <div className="flex justify-center gap-4">
        <button
          onClick={onAgree}
          disabled={!isValidEmail}
          className={`px-8 py-4 rounded-full text-lg font-semibold transition-all ${
            isValidEmail
              ? "bg-green-500 hover:bg-green-600 text-white"
              : "bg-gray-400 text-white cursor-not-allowed"
          } disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          Agree
        </button>
        <button
          onClick={onDisagree || onCancel}
          className="px-8 py-4 rounded-full text-lg font-semibold transition-all bg-red-500 hover:bg-red-600 text-white"
        >
          Disagree
        </button>
      </div>
    );
  }

  // Si estamos en modo de tomar foto (y ya se aceptó el email), mostrar botones de foto
  if (photoState === "takingPhoto" && emailAccepted) {
    return (
      <div className="flex justify-center gap-4">
        <button
          onClick={onTakePhoto}
          className="px-8 py-4 rounded-full text-lg font-semibold transition-all bg-green-500 hover:bg-green-600 text-white"
        >
          Take photo
        </button>
        <button
          onClick={onCancel}
          className="px-8 py-4 rounded-full text-lg font-semibold transition-all bg-gray-500 hover:bg-gray-600 text-white"
        >
          Cancel
        </button>
      </div>
    );
  }

  // Si ya se tomó la foto, mostrar botones de enviar/repetir/cancelar
  if (photoState === "photoTaken") {
    return (
      <div className="flex justify-center gap-4">
        <button
          onClick={onSend}
          className="px-8 py-4 rounded-full text-lg font-semibold transition-all bg-blue-500 hover:bg-blue-600 text-white"
        >
          Send
        </button>
        <button
          onClick={onTakePhotoAgain}
          className="px-8 py-4 rounded-full text-lg font-semibold transition-all bg-yellow-500 hover:bg-yellow-600 text-white"
        >
          Take photo again
        </button>
        <button
          onClick={onCancel}
          className="px-8 py-4 rounded-full text-lg font-semibold transition-all bg-gray-500 hover:bg-gray-600 text-white"
        >
          Cancel
        </button>
      </div>
    );
  }

  // Estado normal: mostrar botón de conversación y opcionalmente botón de foto
  return (
    <div className="flex justify-center gap-4">
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
      {onStartTakingPhoto && (
        <button
          onClick={onStartTakingPhoto}
          disabled={connectionStatus === "Connecting"}
          className="px-8 py-4 rounded-full text-lg font-semibold transition-all bg-purple-500 hover:bg-purple-600 text-white disabled:opacity-50 disabled:cursor-not-allowed"
        >
          📷 Tomar Foto
        </button>
      )}
    </div>
  );
}

