import { useRef, useEffect, useState } from "react";
import { getNextVideoIndex, safePlayVideo } from "../utils/videoUtils";
import { AnimationMode } from "./useAnimationMode";

interface UseVideoLoopProps {
  mode: AnimationMode;
  videos: string[];
}

interface UseVideoLoopReturn {
  video1Ref: React.RefObject<HTMLVideoElement | null>;
  video2Ref: React.RefObject<HTMLVideoElement | null>;
  activeVideo: 1 | 2;
  video1Opacity: number;
  video2Opacity: number;
}

/**
 * Hook para manejar el loop de videos con transiciones suaves
 */
export function useVideoLoop({ mode, videos }: UseVideoLoopProps): UseVideoLoopReturn {
  const video1Ref = useRef<HTMLVideoElement>(null);
  const video2Ref = useRef<HTMLVideoElement>(null);
  const [activeVideo, setActiveVideo] = useState<1 | 2>(1);
  const [video1Opacity, setVideo1Opacity] = useState(1);
  const [video2Opacity, setVideo2Opacity] = useState(0);
  const [currentVideoIndex, setCurrentVideoIndex] = useState(0);
  const video1IndexRef = useRef<number>(0);
  const video2IndexRef = useRef<number>(0);

  // Cargar video en un elemento de video
  const loadVideo = useRef(
    (
      videoElement: HTMLVideoElement,
      videoIndex: number,
      indexRef: React.MutableRefObject<number>,
      videoList: string[]
    ) => {
      if (videoList.length > 0 && videoIndex < videoList.length) {
        videoElement.src = videoList[videoIndex];
        indexRef.current = videoIndex;
        videoElement.load();
      }
    }
  ).current;

  // Efecto para inicializar y cambiar el modo cuando cambian las props
  useEffect(() => {
    const video1 = video1Ref.current;
    const video2 = video2Ref.current;
    if (!video1 || !video2 || videos.length === 0) return;

    // Si es modo single o hay un solo video, solo usar video1 (sin transiciones)
    if (mode === "idle-single" || videos.length === 1) {
      loadVideo(video1, 0, video1IndexRef, videos);
      setVideo2Opacity(0);
      setVideo1Opacity(1);
      setActiveVideo(1);
      setCurrentVideoIndex(0);
      
      // Reproducir cuando esté listo
      const handleVideo1CanPlay = () => {
        safePlayVideo(video1);
        video1.removeEventListener("canplay", handleVideo1CanPlay);
      };
      
      if (video1.readyState >= 3) {
        safePlayVideo(video1);
      } else {
        video1.addEventListener("canplay", handleVideo1CanPlay);
      }
    } else {
      // Modo loop: usar todos los videos secuencialmente
      loadVideo(video1, 0, video1IndexRef, videos);
      setCurrentVideoIndex(0);

      if (videos.length > 1) {
        loadVideo(video2, 1, video2IndexRef, videos);
      }

      setVideo1Opacity(1);
      setVideo2Opacity(0);
      setActiveVideo(1);
      
      // Reproducir cuando esté listo
      const handleVideo1CanPlay = () => {
        safePlayVideo(video1);
        video1.removeEventListener("canplay", handleVideo1CanPlay);
      };
      
      if (video1.readyState >= 3) {
        safePlayVideo(video1);
      } else {
        video1.addEventListener("canplay", handleVideo1CanPlay);
      }
    }
  }, [mode, videos]);

  // Manejar el final de los videos y hacer transición
  useEffect(() => {
    const video1 = video1Ref.current;
    const video2 = video2Ref.current;
    if (!video1 || !video2 || videos.length === 0) return;

    // Si es modo single o hay un solo video, hacer loop del mismo video sin transiciones
    if (mode === "idle-single" || videos.length === 1) {
      const handleVideo1End = () => {
        video1.currentTime = 0;
        safePlayVideo(video1);
      };

      video1.addEventListener("ended", handleVideo1End);

      return () => {
        video1.removeEventListener("ended", handleVideo1End);
      };
    }

    // Modo loop: recorrer todos los videos secuencialmente
    const handleVideo1End = () => {
      const currentIndex = video1IndexRef.current;
      const nextIndex = getNextVideoIndex(currentIndex, videos.length);
      setCurrentVideoIndex(nextIndex);

      // Cargar el siguiente video en video2
      loadVideo(video2, nextIndex, video2IndexRef, videos);
      video2.currentTime = 0;

      // Esperar a que el video esté listo antes de reproducir
      const handleVideo2CanPlay = () => {
        safePlayVideo(video2);
        video2.removeEventListener("canplay", handleVideo2CanPlay);
      };

      if (video2.readyState >= 3) {
        safePlayVideo(video2);
      } else {
        video2.addEventListener("canplay", handleVideo2CanPlay);
      }

      // Fade suave: video1 fade out, video2 fade in
      setVideo1Opacity(0);
      setVideo2Opacity(1);
      setActiveVideo(2);
    };

    const handleVideo2End = () => {
      const currentIndex = video2IndexRef.current;
      const nextIndex = getNextVideoIndex(currentIndex, videos.length);
      setCurrentVideoIndex(nextIndex);

      // Cargar el siguiente video en video1
      loadVideo(video1, nextIndex, video1IndexRef, videos);
      video1.currentTime = 0;

      // Esperar a que el video esté listo antes de reproducir
      const handleVideo1CanPlay = () => {
        safePlayVideo(video1);
        video1.removeEventListener("canplay", handleVideo1CanPlay);
      };

      if (video1.readyState >= 3) {
        safePlayVideo(video1);
      } else {
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
          loadVideo(video2, nextIndex, video2IndexRef, videos);
        }
      }
    };

    const handleVideo2TimeUpdate = () => {
      if (video2.duration && video2.currentTime >= video2.duration - 0.5) {
        const currentIndex = video2IndexRef.current;
        const nextIndex = getNextVideoIndex(currentIndex, videos.length);
        // Cargar el siguiente video antes de que termine
        if (video1.readyState < 3 || video1IndexRef.current !== nextIndex) {
          loadVideo(video1, nextIndex, video1IndexRef, videos);
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
  }, [mode, videos]);

  return {
    video1Ref,
    video2Ref,
    activeVideo,
    video1Opacity,
    video2Opacity,
  };
}

