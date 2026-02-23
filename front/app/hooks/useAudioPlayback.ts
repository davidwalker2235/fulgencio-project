import { useRef, useCallback } from "react";
import { AUDIO_PROCESSING } from "../constants";

interface UseAudioPlaybackReturn {
  playAudio: (audioData: Float32Array) => void;
  stopAllAudio: () => void;
  hasActiveAudio: () => boolean;
}

/**
 * Hook para manejar la reproducción de audio
 */
export function useAudioPlayback(): UseAudioPlaybackReturn {
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioQueueRef = useRef<Float32Array[]>([]);
  const isPlayingRef = useRef<boolean>(false);
  const nextPlayTimeRef = useRef<number>(0);
  const activeAudioSourcesRef = useRef<AudioBufferSourceNode[]>([]);
  const prebufferMsRef = useRef<number>(80);
  const fadeSecondsRef = useRef<number>(0.005);

  const initializeAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      const webkitAudioContext = (
        window as Window & { webkitAudioContext?: typeof AudioContext }
      ).webkitAudioContext;
      const AudioContextCtor = window.AudioContext || webkitAudioContext;
      if (!AudioContextCtor) {
        throw new Error("AudioContext no soportado en este navegador");
      }
      audioContextRef.current = new AudioContextCtor({
        sampleRate: AUDIO_PROCESSING.sampleRate,
      });
    }
    return audioContextRef.current;
  }, []);

  const stopAllAudio = useCallback(() => {
    console.log("Deteniendo todo el audio...");
    // Detener todas las fuentes de audio activas
    activeAudioSourcesRef.current.forEach((source) => {
      try {
        source.stop();
        source.disconnect();
      } catch {
        // Ignorar errores si ya está detenida
      }
    });
    activeAudioSourcesRef.current = [];
    // Limpiar cola
    audioQueueRef.current = [];
    isPlayingRef.current = false;
    nextPlayTimeRef.current = 0;
  }, []);

  const playAudioQueue = useCallback(() => {
    const audioContext = initializeAudioContext();

    if (audioQueueRef.current.length === 0) {
      return;
    }

    isPlayingRef.current = true;

    // Si nos hemos quedado atrás (gap), re-sincronizar con un pequeño prebuffer.
    const currentTime = audioContext.currentTime;
    if (nextPlayTimeRef.current < currentTime) {
      nextPlayTimeRef.current = currentTime + prebufferMsRef.current / 1000;
    }

    while (audioQueueRef.current.length > 0) {
      const float32 = audioQueueRef.current.shift();
      if (!float32) continue;

      try {
        const audioBuffer = audioContext.createBuffer(
          1,
          float32.length,
          AUDIO_PROCESSING.sampleRate
        );
        audioBuffer.getChannelData(0).set(float32);

        const source = audioContext.createBufferSource();
        source.buffer = audioBuffer;

        // Fade corto para evitar clicks al inicio/fin de cada chunk.
        const gainNode = audioContext.createGain();
        source.connect(gainNode);
        gainNode.connect(audioContext.destination);

        const startTime = Math.max(audioContext.currentTime, nextPlayTimeRef.current);
        const duration = audioBuffer.duration;
        const endTime = startTime + duration;
        const fade = Math.min(fadeSecondsRef.current, duration / 2);

        gainNode.gain.setValueAtTime(0, startTime);
        gainNode.gain.linearRampToValueAtTime(1, startTime + fade);
        gainNode.gain.setValueAtTime(1, Math.max(startTime + fade, endTime - fade));
        gainNode.gain.linearRampToValueAtTime(0, endTime);

        source.start(startTime);
        nextPlayTimeRef.current = endTime;

        activeAudioSourcesRef.current.push(source);
        source.onended = () => {
          activeAudioSourcesRef.current = activeAudioSourcesRef.current.filter(
            (s) => s !== source
          );
          if (activeAudioSourcesRef.current.length === 0 && audioQueueRef.current.length === 0) {
            isPlayingRef.current = false;
          }
          try {
            gainNode.disconnect();
          } catch {
            // no-op
          }
        };
      } catch (err) {
        console.error("Error reproduciendo chunk de audio:", err);
      }
    }
  }, [initializeAudioContext]);

  const playAudio = useCallback(
    (audioData: Float32Array) => {
      audioQueueRef.current.push(audioData);
      playAudioQueue();
    },
    [playAudioQueue]
  );

  const hasActiveAudio = useCallback(() => {
    return (
      isPlayingRef.current ||
      audioQueueRef.current.length > 0 ||
      activeAudioSourcesRef.current.length > 0
    );
  }, []);

  return {
    playAudio,
    stopAllAudio,
    hasActiveAudio,
  };
}

