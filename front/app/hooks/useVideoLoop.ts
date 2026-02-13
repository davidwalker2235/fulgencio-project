import { useRef, useEffect, useState } from "react";
import { safePlayVideo } from "../utils/videoUtils";

const IDLE_VIDEO = "/animations/idle_video.mp4";
const SPEAK_VIDEO = "/animations/speak_video.mp4";

export type VideoMode = "idle" | "speak";

interface UseVideoLoopProps {
  mode: VideoMode;
}

interface UseVideoLoopReturn {
  video1Ref: React.RefObject<HTMLVideoElement | null>;
  video2Ref: React.RefObject<HTMLVideoElement | null>;
  video1Opacity: number;
  video2Opacity: number;
}

/**
 * Estrategia sin parpadeos: dos elementos fijos, cada uno con su video.
 * Nunca cambiamos el src, solo la opacidad. Ambos preloaded desde el inicio.
 */
export function useVideoLoop({ mode }: UseVideoLoopProps): UseVideoLoopReturn {
  const video1Ref = useRef<HTMLVideoElement>(null);
  const video2Ref = useRef<HTMLVideoElement>(null);
  const [video1Opacity, setVideo1Opacity] = useState(1);
  const [video2Opacity, setVideo2Opacity] = useState(0);
  const isIdleRef = useRef(true);

  // Cargar ambos videos una sola vez al montar
  useEffect(() => {
    const video1 = video1Ref.current;
    const video2 = video2Ref.current;
    if (!video1 || !video2) return;

    video1.src = IDLE_VIDEO;
    video2.src = SPEAK_VIDEO;
    video1.preload = "auto";
    video2.preload = "auto";
    video1.load();
    video2.load();

    const playVideo1 = () => {
      safePlayVideo(video1);
      video1.removeEventListener("canplay", playVideo1);
    };

    video1.addEventListener("canplay", playVideo1);
    if (video1.readyState >= 3) safePlayVideo(video1);
    // video2 se preloada pero no se reproduce hasta que mode === "speak"

    return () => {
      video1.removeEventListener("canplay", playVideo1);
    };
  }, []);

  // Loop de idle cuando termina
  useEffect(() => {
    const video1 = video1Ref.current;
    if (!video1) return;

    const handleEnded = () => {
      video1.currentTime = 0;
      safePlayVideo(video1);
    };
    video1.addEventListener("ended", handleEnded);
    return () => video1.removeEventListener("ended", handleEnded);
  }, []);

  // Loop de speak cuando termina
  useEffect(() => {
    const video2 = video2Ref.current;
    if (!video2) return;

    const handleEnded = () => {
      video2.currentTime = 0;
      safePlayVideo(video2);
    };
    video2.addEventListener("ended", handleEnded);
    return () => video2.removeEventListener("ended", handleEnded);
  }, []);

  // Solo cambiar opacidad según modo (sin tocar src)
  useEffect(() => {
    const video1 = video1Ref.current;
    const video2 = video2Ref.current;
    if (!video1 || !video2) return;

    const showIdle = mode === "idle";

    if (showIdle !== isIdleRef.current) {
      isIdleRef.current = showIdle;
      setVideo1Opacity(showIdle ? 1 : 0);
      setVideo2Opacity(showIdle ? 0 : 1);

      if (showIdle) {
        safePlayVideo(video1);
        video2.pause();
      } else {
        video1.pause();
        if (video2.readyState >= 3) {
          safePlayVideo(video2);
        } else {
          const onCanPlay = () => {
            safePlayVideo(video2);
            video2.removeEventListener("canplay", onCanPlay);
          };
          video2.addEventListener("canplay", onCanPlay);
        }
      }
    }
  }, [mode]);

  return {
    video1Ref,
    video2Ref,
    video1Opacity,
    video2Opacity,
  };
}
