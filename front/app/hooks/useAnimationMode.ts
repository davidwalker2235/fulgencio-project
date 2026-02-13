import { useMemo } from "react";
import { ConnectionStatus } from "../types";

const idleVideo = ["/animations/idle_video.mp4"];
const speakVideo = ["/animations/speak_video.mp4"];

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
    return mode === "speak-loop" ? speakVideo : idleVideo;
  }, [mode]);

  return { mode, videos };
}

