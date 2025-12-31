import { useRef, useEffect } from "react";

/**
 * Hook para manejar el video de fondo que se reproduce en loop continuo
 */
export function useBackgroundVideo() {
  const backgroundVideoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const backgroundVideo = backgroundVideoRef.current;
    if (!backgroundVideo) return;

    backgroundVideo.src = "/animations/video_background.mp4";
    backgroundVideo.load();

    const handleBackgroundCanPlay = () => {
      backgroundVideo.play().catch((error) => {
        if (error.name !== "AbortError") {
          console.error("Error al reproducir video de fondo:", error);
        }
      });
    };

    backgroundVideo.addEventListener("canplay", handleBackgroundCanPlay);

    // Asegurar que el video se reinicie cuando termine (loop)
    const handleBackgroundEnd = () => {
      backgroundVideo.currentTime = 0;
      backgroundVideo.play().catch((error) => {
        if (error.name !== "AbortError") {
          console.error("Error al reproducir video de fondo:", error);
        }
      });
    };

    backgroundVideo.addEventListener("ended", handleBackgroundEnd);

    return () => {
      backgroundVideo.removeEventListener("canplay", handleBackgroundCanPlay);
      backgroundVideo.removeEventListener("ended", handleBackgroundEnd);
    };
  }, []);

  return backgroundVideoRef;
}

