import { ConnectionStatus as ConnectionStatusType } from "../types";

interface ConnectionStatusProps {
  status: ConnectionStatusType;
}

export default function ConnectionStatus({ status }: ConnectionStatusProps) {
  return (
    <div className="bg-white dark:bg-zinc-900 p-4 rounded-lg shadow">
      <h2 className="text-xl font-semibold mb-2 text-black dark:text-zinc-50">
        Estado de Conexión
      </h2>
      <div className="flex items-center gap-2">
        <div
          className={`w-3 h-3 rounded-full ${
            status === "Conectado"
              ? "bg-green-500"
              : status === "Conectando"
              ? "bg-yellow-500"
              : "bg-red-500"
          }`}
        />
        <span className="text-black dark:text-zinc-50">{status}</span>
      </div>
    </div>
  );
}

