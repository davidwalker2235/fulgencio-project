import { ConnectionStatus as ConnectionStatusType } from "../types";

interface ConnectionStatusProps {
  status: ConnectionStatusType;
}

export default function ConnectionStatus({ status }: ConnectionStatusProps) {
  return (
    <div className="bg-transparent p-4 rounded-lg shadow">
      <div className="flex items-center gap-2">
        <div
          className={`w-3 h-3 rounded-full ${
            status === "Connected"
              ? "bg-green-500"
              : status === "Connecting"
              ? "bg-yellow-500"
              : "bg-red-500"
          }`}
        />
        <span className="text-black dark:text-zinc-50">{status}</span>
      </div>
    </div>
  );
}

