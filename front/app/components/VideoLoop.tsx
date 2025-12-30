"use client";

import { useRef, useEffect, useState } from "react";

const videos = ["/animations/idle_1.mp4", "/animations/idle_2.mp4"];

export default function VideoLoop() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [currentVideoIndex, setCurrentVideoIndex] = useState(0);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleVideoEnd = () => {
      // Cambiar al siguiente video en el array
      setCurrentVideoIndex((prevIndex) => (prevIndex + 1) % videos.length);
    };

    const handleCanPlay = () => {
      // Esperar a que el video esté listo antes de reproducir
      video.play().catch((error) => {
        // Ignorar errores de AbortError ya que pueden ocurrir durante transiciones
        if (error.name !== "AbortError") {
          console.error("Error al reproducir el video:", error);
        }
      });
    };

    video.addEventListener("ended", handleVideoEnd);
    video.addEventListener("canplay", handleCanPlay);

    // Cargar el video
    video.load();

    return () => {
      video.removeEventListener("ended", handleVideoEnd);
      video.removeEventListener("canplay", handleCanPlay);
    };
  }, [currentVideoIndex]);

  return (
    <video
      ref={videoRef}
      src={videos[currentVideoIndex]}
      className="w-full h-full object-contain"
      playsInline
      muted
    />
  );
}

