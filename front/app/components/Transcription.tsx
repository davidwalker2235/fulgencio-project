import { Message } from "../types";

interface TranscriptionProps {
  messages: Message[];
}

export default function Transcription({ messages }: TranscriptionProps) {
  // Debug: log messages
  console.log("📋 Transcription component - messages:", messages);
  
  return (
    <div className="bg-white dark:bg-zinc-900 p-6 rounded-lg shadow min-h-[400px] max-h-[600px] overflow-y-auto">
      <h2 className="text-xl font-semibold mb-4 text-black dark:text-zinc-50">
        Transcripción
      </h2>
      {messages.length === 0 ? (
        <p className="text-gray-500 dark:text-gray-400 italic">
          La transcripción aparecerá aquí cuando comiences a hablar...
        </p>
      ) : (
        <div className="space-y-4">
          {messages.map((message, index) => {
            const isUser = message.role === "user";
            // Renderizar incluso si está vacío para ver mensajes en progreso
            // Solo ocultar si está completamente vacío y no es un mensaje nuevo
            
            return (
              <div
                key={index}
                className={`flex ${isUser ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[75%] p-4 rounded-2xl ${
                    isUser
                      ? "bg-blue-50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/50"
                      : "bg-purple-50 dark:bg-purple-950/30 border border-purple-100 dark:border-purple-900/50"
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <span
                      className={`text-xs font-semibold ${
                        isUser
                          ? "text-blue-600 dark:text-blue-400"
                          : "text-purple-600 dark:text-purple-400"
                      }`}
                    >
                      {isUser ? "Tú" : "Asistente"}
                    </span>
                  </div>
                  <p
                    className={`mt-1 whitespace-pre-wrap break-words ${
                      isUser
                        ? "text-blue-900 dark:text-blue-100"
                        : "text-purple-900 dark:text-purple-100"
                    }`}
                  >
                    {message.content}
                  </p>
                  <span
                    className={`text-xs mt-2 block ${
                      isUser
                        ? "text-blue-500 dark:text-blue-400"
                        : "text-purple-500 dark:text-purple-400"
                    }`}
                  >
                    {message.timestamp.toLocaleTimeString()}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

