interface ErrorDisplayProps {
  error: string;
  onClose: () => void;
}

export default function ErrorDisplay({ error, onClose }: ErrorDisplayProps) {
  if (!error) return null;

  return (
    <div className="bg-red-100 dark:bg-red-900 border border-red-400 dark:border-red-700 text-red-700 dark:text-red-200 px-4 py-3 rounded-lg">
      <h2 className="text-xl font-semibold mb-2">Error</h2>
      <p>{error}</p>
      <button
        onClick={onClose}
        className="mt-2 text-sm underline hover:no-underline"
      >
        Cerrar
      </button>
    </div>
  );
}

