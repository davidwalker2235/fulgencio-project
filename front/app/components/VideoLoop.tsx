"use client";

import { useRef, useEffect, useState } from "react";
import { ConnectionStatus } from "../types";

interface VideoLoopProps {
  connectionStatus: ConnectionStatus;
  isSpeaking: boolean;
}

const idleVideos = ["/animations/idle_1.mp4", "/animations/idle_2.mp4", "/animations/idle_3.mp4", "/animations/idle_4.mp4"];
const speakVideos = ["/animations/speak_1.mp4", "/animations/speak_2.mp4"];

// Función para extraer el número del nombre del archivo (ej: "idle_1.mp4" -> 1)
const extractVideoNumber = (videoPath: string): number => {
  const match = videoPath.match(/_(\d+)\.mp4$/);
  return match ? parseInt(match[1], 10) : 0;
};

// Función para ordenar videos por su número incremental
const sortVideosByNumber = (videos: string[]): string[] => {
  return [...videos].sort((a, b) => {
    const numA = extractVideoNumber(a);
    const numB = extractVideoNumber(b);
    return numA - numB;
  });
};

export default function VideoLoop({ connectionStatus, isSpeaking }: VideoLoopProps) {
  const backgroundVideoRef = useRef<HTMLVideoElement>(null);
  const video1Ref = useRef<HTMLVideoElement>(null);
  const video2Ref = useRef<HTMLVideoElement>(null);
  const [activeVideo, setActiveVideo] = useState<1 | 2>(1);
  const [video1Opacity, setVideo1Opacity] = useState(1);
  const [video2Opacity, setVideo2Opacity] = useState(0);
  const [currentMode, setCurrentMode] = useState<"idle-loop" | "idle-single" | "speak-loop">("idle-loop");
  const [currentVideoIndex, setCurrentVideoIndex] = useState(0);
  const [sortedVideos, setSortedVideos] = useState<string[]>([]);
  // Refs para rastrear qué índice está reproduciendo cada video
  const video1IndexRef = useRef<number>(0);
  const video2IndexRef = useRef<number>(0);

  // Determinar qué modo de animación usar
  const getCurrentMode = (): "idle-loop" | "idle-single" | "speak-loop" => {
    if (connectionStatus === "Disconnected") {
      return "idle-loop";
    } else if (connectionStatus === "Connected" && isSpeaking) {
      return "speak-loop";
    } else {
      return "idle-single";
    }
  };

  // Obtener los videos según el modo actual, ordenados por número
  const getVideosForMode = (mode: "idle-loop" | "idle-single" | "speak-loop"): string[] => {
    const videos = mode === "speak-loop" ? speakVideos : idleVideos;
    return sortVideosByNumber(videos);
  };

  // Obtener el siguiente índice de video (con loop)
  const getNextVideoIndex = (currentIndex: number, totalVideos: number): number => {
    return (currentIndex + 1) % totalVideos;
  };

  // Inicializar video de fondo al montar
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

  // Inicializar videos al montar
  useEffect(() => {
    const video1 = video1Ref.current;
    const video2 = video2Ref.current;
    if (!video1 || !video2) return;

    const initialMode = getCurrentMode();
    setCurrentMode(initialMode);
    const videos = getVideosForMode(initialMode);
    setSortedVideos(videos);
    setCurrentVideoIndex(0);

    // Cargar video inicial
    if (videos.length > 0) {
      video1.src = videos[0];
      video1IndexRef.current = 0;
      video1.load();
      
      // Pre-cargar el siguiente video si existe
      if (videos.length > 1) {
        video2.src = videos[1];
        video2IndexRef.current = 1;
        video2.load();
      }
    }

    // Reproducir el primero cuando esté listo
    const handleVideo1CanPlay = () => {
      video1.play().catch((error) => {
        if (error.name !== "AbortError") {
          console.error("Error al reproducir video 1:", error);
        }
      });
    };

    video1.addEventListener("canplay", handleVideo1CanPlay);

    return () => {
      video1.removeEventListener("canplay", handleVideo1CanPlay);
    };
  }, []);

  // Efecto para cambiar el modo cuando cambian las props
  useEffect(() => {
    const newMode = getCurrentMode();
    const video1 = video1Ref.current;
    const video2 = video2Ref.current;
    if (!video1 || !video2) return;

    // Si el modo cambió, actualizar los videos
    if (newMode !== currentMode) {
      const videos = getVideosForMode(newMode);
      setCurrentMode(newMode);
      setSortedVideos(videos);
      setCurrentVideoIndex(0);

      // Si es modo single (idle_1 solo), solo usar video1
      if (newMode === "idle-single") {
        if (videos.length > 0) {
          video1.src = videos[0];
          video1IndexRef.current = 0;
          video1.load();
        }
        // Ocultar video2
        setVideo2Opacity(0);
        setVideo1Opacity(1);
        setActiveVideo(1);
        video1.play().catch((error) => {
          if (error.name !== "AbortError") {
            console.error("Error al reproducir video 1:", error);
          }
        });
      } else {
        // Modo loop: usar todos los videos secuencialmente
        if (videos.length > 0) {
          video1.src = videos[0];
          video1IndexRef.current = 0;
          video1.load();
          
          // Pre-cargar el siguiente video si existe
          if (videos.length > 1) {
            video2.src = videos[1];
            video2IndexRef.current = 1;
            video2.load();
          }
        }
        // Reproducir el primero
        setVideo1Opacity(1);
        setVideo2Opacity(0);
        setActiveVideo(1);
        video1.play().catch((error) => {
          if (error.name !== "AbortError") {
            console.error("Error al reproducir video 1:", error);
          }
        });
      }
    }
  }, [connectionStatus, isSpeaking, currentMode]);

  // Manejar el final de los videos y hacer transición
  useEffect(() => {
    const video1 = video1Ref.current;
    const video2 = video2Ref.current;
    if (!video1 || !video2) return;

    const mode = currentMode;
    const videos = sortedVideos;

    if (videos.length === 0) return;

    // Si es modo single, hacer loop del mismo video
    if (mode === "idle-single") {
      const handleVideo1End = () => {
        video1.currentTime = 0;
        video1.play().catch((error) => {
          if (error.name !== "AbortError") {
            console.error("Error al reproducir video 1:", error);
          }
        });
      };

      video1.addEventListener("ended", handleVideo1End);

      return () => {
        video1.removeEventListener("ended", handleVideo1End);
      };
    }

    // Modo loop: recorrer todos los videos secuencialmente
    const handleVideo1End = () => {
      // Obtener el índice del video que acaba de terminar
      const currentIndex = video1IndexRef.current;
      
      // Calcular el siguiente índice
      const nextIndex = getNextVideoIndex(currentIndex, videos.length);
      setCurrentVideoIndex(nextIndex);
      
      // Cargar el siguiente video en video2
      video2.src = videos[nextIndex];
      video2IndexRef.current = nextIndex;
      video2.currentTime = 0;
      video2.load();
      
      // Esperar a que el video esté listo antes de reproducir
      const handleVideo2CanPlay = () => {
        video2.play().catch((error) => {
          if (error.name !== "AbortError") {
            console.error("Error al reproducir video 2:", error);
          }
        });
        video2.removeEventListener("canplay", handleVideo2CanPlay);
      };
      
      if (video2.readyState >= 3) {
        // El video ya está listo, reproducir inmediatamente
        video2.play().catch((error) => {
          if (error.name !== "AbortError") {
            console.error("Error al reproducir video 2:", error);
          }
        });
      } else {
        // Esperar a que el video esté listo
        video2.addEventListener("canplay", handleVideo2CanPlay);
      }

      // Fade suave: video1 fade out, video2 fade in
      setVideo1Opacity(0);
      setVideo2Opacity(1);
      setActiveVideo(2);
    };

    const handleVideo2End = () => {
      // Obtener el índice del video que acaba de terminar
      const currentIndex = video2IndexRef.current;
      
      // Calcular el siguiente índice
      const nextIndex = getNextVideoIndex(currentIndex, videos.length);
      setCurrentVideoIndex(nextIndex);
      
      // Cargar el siguiente video en video1
      video1.src = videos[nextIndex];
      video1IndexRef.current = nextIndex;
      video1.currentTime = 0;
      video1.load();
      
      // Esperar a que el video esté listo antes de reproducir
      const handleVideo1CanPlay = () => {
        video1.play().catch((error) => {
          if (error.name !== "AbortError") {
            console.error("Error al reproducir video 1:", error);
          }
        });
        video1.removeEventListener("canplay", handleVideo1CanPlay);
      };
      
      if (video1.readyState >= 3) {
        // El video ya está listo, reproducir inmediatamente
        video1.play().catch((error) => {
          if (error.name !== "AbortError") {
            console.error("Error al reproducir video 1:", error);
          }
        });
      } else {
        // Esperar a que el video esté listo
        video1.addEventListener("canplay", handleVideo1CanPlay);
      }

      // Fade suave: video2 fade out, video1 fade in
      setVideo2Opacity(0);
      setVideo1Opacity(1);
      setActiveVideo(1);
    };

    // Pre-cargar el siguiente video cuando el actual esté cerca del final
    const handleVideo1TimeUpdate = () => {
      if (video1.duration && video1.currentTime >= video1.duration - 0.5) {
        const currentIndex = video1IndexRef.current;
        const nextIndex = getNextVideoIndex(currentIndex, videos.length);
        // Cargar el siguiente video antes de que termine
        if (video2.readyState < 3 || video2IndexRef.current !== nextIndex) {
          video2.src = videos[nextIndex];
          video2IndexRef.current = nextIndex;
          video2.load();
        }
      }
    };

    const handleVideo2TimeUpdate = () => {
      if (video2.duration && video2.currentTime >= video2.duration - 0.5) {
        const currentIndex = video2IndexRef.current;
        const nextIndex = getNextVideoIndex(currentIndex, videos.length);
        // Cargar el siguiente video antes de que termine
        if (video1.readyState < 3 || video1IndexRef.current !== nextIndex) {
          video1.src = videos[nextIndex];
          video1IndexRef.current = nextIndex;
          video1.load();
        }
      }
    };

    video1.addEventListener("ended", handleVideo1End);
    video2.addEventListener("ended", handleVideo2End);
    video1.addEventListener("timeupdate", handleVideo1TimeUpdate);
    video2.addEventListener("timeupdate", handleVideo2TimeUpdate);

    return () => {
      video1.removeEventListener("ended", handleVideo1End);
      video2.removeEventListener("ended", handleVideo2End);
      video1.removeEventListener("timeupdate", handleVideo1TimeUpdate);
      video2.removeEventListener("timeupdate", handleVideo2TimeUpdate);
    };
  }, [currentMode, sortedVideos]);

  return (
    <div className="relative w-full h-full min-h-screen">
      {/* Video de fondo fijo en loop continuo */}
      <video
        ref={backgroundVideoRef}
        className="absolute inset-0 w-full h-full object-contain"
        style={{ zIndex: 0 }}
        playsInline
        muted
        loop={true}
        autoPlay
      />
      {/* Videos del loop en capas superiores */}
      <video
        ref={video1Ref}
        className="absolute inset-0 w-full h-full object-contain transition-opacity duration-300"
        style={{ opacity: video1Opacity, zIndex: activeVideo === 1 ? 2 : 1 }}
        playsInline
        muted
        loop={false}
      />
      <video
        ref={video2Ref}
        className="absolute inset-0 w-full h-full object-contain transition-opacity duration-300"
        style={{ opacity: video2Opacity, zIndex: activeVideo === 2 ? 2 : 1 }}
        playsInline
        muted
        loop={false}
      />
    </div>
  );
}

