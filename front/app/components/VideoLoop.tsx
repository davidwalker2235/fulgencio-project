"use client";

import { useRef, useEffect, useState } from "react";

const videos = ["/animations/idle_1.mp4", "/animations/idle_2.mp4"];

export default function VideoLoop() {
  const video1Ref = useRef<HTMLVideoElement>(null);
  const video2Ref = useRef<HTMLVideoElement>(null);
  const [activeVideo, setActiveVideo] = useState<1 | 2>(1);
  const [video1Opacity, setVideo1Opacity] = useState(1);
  const [video2Opacity, setVideo2Opacity] = useState(0);

  // Inicializar ambos videos
  useEffect(() => {
    const video1 = video1Ref.current;
    const video2 = video2Ref.current;
    if (!video1 || !video2) return;

    // Cargar ambos videos
    video1.src = videos[0];
    video2.src = videos[1];
    video1.load();
    video2.load();

    // Reproducir el primer video cuando esté listo
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

  // Manejar el final de los videos y hacer transición
  useEffect(() => {
    const video1 = video1Ref.current;
    const video2 = video2Ref.current;
    if (!video1 || !video2) return;

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
  }, []);

  return (
    <div className="relative w-full h-full">
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

