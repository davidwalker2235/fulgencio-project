import { useMemo } from "react";
import { ConnectionStatus } from "../types";
import { sortVideosByNumber } from "../utils/videoUtils";

const idleVideos = ["/animations/idle_1.mp4", "/animations/idle_2.mp4", "/animations/idle_3.mp4", "/animations/idle_4.mp4"];
const speakVideos = ["/animations/speak_1.mp4", "/animations/speak_2.mp4"];

export type AnimationMode = "idle-loop" | "idle-single" | "speak-loop";

/**
 * Hook para determinar el modo de animación y obtener los videos correspondientes
 */
export function useAnimationMode(connectionStatus: ConnectionStatus, isSpeaking: boolean) {
  const mode = useMemo((): AnimationMode => {
    if (connectionStatus === "Disconnected") {
      return "idle-loop";
    } else if (connectionStatus === "Connected" && isSpeaking) {
      return "speak-loop";
    } else {
      return "idle-single";
    }
  }, [connectionStatus, isSpeaking]);

  const videos = useMemo(() => {
    const videoList = mode === "speak-loop" ? speakVideos : idleVideos;
    return sortVideosByNumber(videoList);
  }, [mode]);

  return { mode, videos };
}

