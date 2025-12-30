"use client";

import { useRef, useEffect, useState } from "react";
import { ConnectionStatus } from "../types";

interface VideoLoopProps {
  connectionStatus: ConnectionStatus;
  isSpeaking: boolean;
}

const idleVideos = ["/animations/idle_1.mp4", "/animations/idle_2.mp4"];
const speakVideos = ["/animations/speak_1.mp4", "/animations/speak_2.mp4"];

export default function VideoLoop({ connectionStatus, isSpeaking }: VideoLoopProps) {
  const video1Ref = useRef<HTMLVideoElement>(null);
  const video2Ref = useRef<HTMLVideoElement>(null);
  const [activeVideo, setActiveVideo] = useState<1 | 2>(1);
  const [video1Opacity, setVideo1Opacity] = useState(1);
  const [video2Opacity, setVideo2Opacity] = useState(0);
  const [currentMode, setCurrentMode] = useState<"idle-loop" | "idle-single" | "speak-loop">("idle-loop");

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

  // Obtener los videos según el modo actual
  const getVideosForMode = (mode: "idle-loop" | "idle-single" | "speak-loop"): string[] => {
    if (mode === "speak-loop") {
      return speakVideos;
    }
    return idleVideos;
  };

  // Inicializar videos al montar
  useEffect(() => {
    const video1 = video1Ref.current;
    const video2 = video2Ref.current;
    if (!video1 || !video2) return;

    const initialMode = getCurrentMode();
    setCurrentMode(initialMode);
    const videos = getVideosForMode(initialMode);

    // Cargar videos iniciales
    video1.src = videos[0];
    video2.src = videos[1];
    video1.load();
    video2.load();

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

      // Si es modo single (idle_1 solo), solo usar video1
      if (newMode === "idle-single") {
        video1.src = videos[0];
        video1.load();
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
        // Modo loop: usar ambos videos
        video1.src = videos[0];
        video2.src = videos[1];
        video1.load();
        video2.load();
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

    // Modo loop: alternar entre dos videos
    const handleVideo1End = () => {
      // Pre-cargar y reproducir video 2
      video2.currentTime = 0;
      video2.play().catch((error) => {
        if (error.name !== "AbortError") {
          console.error("Error al reproducir video 2:", error);
        }
      });

      // Fade suave: video1 fade out, video2 fade in
      setVideo1Opacity(0);
      setVideo2Opacity(1);
      setActiveVideo(2);
    };

    const handleVideo2End = () => {
      // Pre-cargar y reproducir video 1
      video1.currentTime = 0;
      video1.play().catch((error) => {
        if (error.name !== "AbortError") {
          console.error("Error al reproducir video 1:", error);
        }
      });

      // Fade suave: video2 fade out, video1 fade in
      setVideo2Opacity(0);
      setVideo1Opacity(1);
      setActiveVideo(1);
    };

    // Pre-cargar el siguiente video cuando el actual esté cerca del final
    const handleVideo1TimeUpdate = () => {
      if (video1.duration && video1.currentTime >= video1.duration - 0.5) {
        // Cargar el siguiente video antes de que termine
        if (video2.readyState < 3) {
          video2.load();
        }
      }
    };

    const handleVideo2TimeUpdate = () => {
      if (video2.duration && video2.currentTime >= video2.duration - 0.5) {
        // Cargar el siguiente video antes de que termine
        if (video1.readyState < 3) {
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
  }, [currentMode]);

  return (
    <div className="relative w-full h-full min-h-screen">
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

