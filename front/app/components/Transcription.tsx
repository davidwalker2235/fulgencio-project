import { Message } from "../types";

interface TranscriptionProps {
  messages: Message[];
}

export default function Transcription({ messages }: TranscriptionProps) {
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
          {messages.map((message, index) => (
            <div
              key={index}
              className={`p-4 rounded-lg ${
                message.role === "user"
                  ? "bg-blue-100 dark:bg-blue-900 ml-8"
                  : "bg-gray-100 dark:bg-gray-800 mr-8"
              }`}
            >
              <div className="flex items-start gap-2">
                <span className="font-semibold text-black dark:text-zinc-50">
                  {message.role === "user" ? "Tú" : "Asistente"}:
                </span>
                <p className="text-black dark:text-zinc-50 flex-1 whitespace-pre-wrap">
                  {message.content}
                </p>
              </div>
              <span className="text-xs text-gray-500 dark:text-gray-400 mt-2 block">
                {message.timestamp.toLocaleTimeString()}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

