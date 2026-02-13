"use client";

import { ConnectionStatus } from "../types";
import { useBackgroundVideo } from "../hooks/useBackgroundVideo";
import { useAnimationMode } from "../hooks/useAnimationMode";
import { useVideoLoop } from "../hooks/useVideoLoop";

interface VideoLoopProps {
  connectionStatus: ConnectionStatus;
  isSpeaking: boolean;
}

export default function VideoLoop({ connectionStatus, isSpeaking }: VideoLoopProps) {
  // Hook para manejar el video de fondo
  const backgroundVideoRef = useBackgroundVideo();

  // Hook para determinar el modo de animación y obtener los videos
  const { mode, videos } = useAnimationMode(connectionStatus, isSpeaking);

  // Hook para manejar el loop de videos con transiciones
  const { video1Ref, video2Ref, activeVideo, video1Opacity, video2Opacity } = useVideoLoop({
    mode,
    videos,
  });

  return (
    <div
      className="relative w-full h-full min-h-screen overflow-hidden"
      style={{ contain: "layout" }}
    >
      {/* Video de fondo fijo en loop continuo */}
      <video
        ref={backgroundVideoRef}
        className="absolute inset-0 w-full h-full object-contain"
        style={{
          zIndex: 0,
          transform: "translateZ(0)",
          WebkitBackfaceVisibility: "hidden",
          backfaceVisibility: "hidden",
        }}
        playsInline
        muted
        loop={true}
        autoPlay
      />
      {/* Videos del loop en capas superiores - estilos para evitar glitch de reflow en iPad Safari */}
      <video
        ref={video1Ref}
        className="absolute inset-0 w-full h-full min-w-full min-h-full object-contain transition-opacity duration-300"
        style={{
          opacity: video1Opacity,
          zIndex: activeVideo === 1 ? 2 : 1,
          transform: "translateZ(0)",
          WebkitBackfaceVisibility: "hidden",
          backfaceVisibility: "hidden",
        }}
        playsInline
        muted
        loop={false}
      />
      <video
        ref={video2Ref}
        className="absolute inset-0 w-full h-full min-w-full min-h-full object-contain transition-opacity duration-300"
        style={{
          opacity: video2Opacity,
          zIndex: activeVideo === 2 ? 2 : 1,
          transform: "translateZ(0)",
          WebkitBackfaceVisibility: "hidden",
          backfaceVisibility: "hidden",
        }}
        playsInline
        muted
        loop={false}
      />
    </div>
  );
}

