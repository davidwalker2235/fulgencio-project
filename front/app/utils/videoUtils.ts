// Utilidades para el manejo de videos

// Función para extraer el número del nombre del archivo (ej: "idle_1.mp4" -> 1)
export const extractVideoNumber = (videoPath: string): number => {
  const match = videoPath.match(/_(\d+)\.mp4$/);
  return match ? parseInt(match[1], 10) : 0;
};

// Función para ordenar videos por su número incremental
export const sortVideosByNumber = (videos: string[]): string[] => {
  return [...videos].sort((a, b) => {
    const numA = extractVideoNumber(a);
    const numB = extractVideoNumber(b);
    return numA - numB;
  });
};

// Obtener el siguiente índice de video (con loop)
export const getNextVideoIndex = (currentIndex: number, totalVideos: number): number => {
  return (currentIndex + 1) % totalVideos;
};

// Función auxiliar para reproducir un video de forma segura
export const safePlayVideo = (video: HTMLVideoElement): void => {
  video.play().catch((error) => {
    if (error.name !== "AbortError") {
      console.error("Error al reproducir video:", error);
    }
  });
};

