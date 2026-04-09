import { ConnectionStatus } from "../types";
import { useEffect, useRef, useState } from "react";

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
  const NUMERIC_CODE_API_PATH = "/api/draw-robot-caricature";

  const [showKeyboardInput, setShowKeyboardInput] = useState(false);
  const [numericInput, setNumericInput] = useState("");
  const numericInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (showKeyboardInput) {
      numericInputRef.current?.focus();
    }
  }, [showKeyboardInput]);

  const handleNumericChange = (value: string) => {
    // Permite solo dígitos.
    setNumericInput(value.replace(/\D/g, ""));
  };

  const sendNumericCode = async (code: string) => {
    const response = await fetch(`${NUMERIC_CODE_API_PATH}?user_id=${encodeURIComponent(code)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });

    if (!response.ok) {
      throw new Error(`Failed to send numeric code. Status: ${response.status}`);
    }
  };

  const handleSubmitNumericInput = async () => {
    const code = numericInput.trim();

    if (!code) {
      numericInputRef.current?.focus();
      return;
    }

    try {
      await sendNumericCode(code);
    } catch (error) {
      console.error("Error sending numeric code:", error);
      numericInputRef.current?.focus();
      return;
    }

    // Mantiene el input abierto y listo para el siguiente código.
    setNumericInput("");
    numericInputRef.current?.focus();
  };

  return (
    <div className="flex flex-col items-center gap-3">
      {showKeyboardInput && (
        <div className="w-full max-w-md px-2">
          <div className="relative">
            <input
              ref={numericInputRef}
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={numericInput}
              onChange={(e) => handleNumericChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void handleSubmitNumericInput();
                }
              }}
              placeholder="Enter numeric code"
              className="w-full rounded-full border border-white/30 bg-white/95 text-zinc-900 px-4 py-3 pr-12 shadow-md outline-none focus:ring-2 focus:ring-blue-400"
            />
            <button
              type="button"
              onClick={() => {
                void handleSubmitNumericInput();
              }}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-2 text-blue-600 hover:bg-blue-50"
              aria-label="Send code"
              title="Send"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="h-5 w-5"
              >
                <path d="M22 2L11 13" />
                <path d="M22 2L15 22L11 13L2 9L22 2Z" />
              </svg>
            </button>
          </div>
        </div>
      )}

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
            ? "Connecting..."
            : isRecording
            ? "Stop Conversation"
            : "Start Conversation"}
        </button>

        <button
          type="button"
          onClick={() => setShowKeyboardInput((prev) => !prev)}
          className="px-4 py-4 rounded-full bg-white/95 text-zinc-900 hover:bg-white transition-colors shadow-md"
          aria-label="Open keyboard input"
          title="Keyboard input"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="h-6 w-6"
          >
            <rect x="2" y="6" width="20" height="12" rx="2" />
            <path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M8 14h8" />
          </svg>
        </button>
      </div>
    </div>
  );
}

