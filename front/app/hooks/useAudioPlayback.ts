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

  const initializeAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext ||
        (window as any).webkitAudioContext)({
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
      } catch (err) {
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

    if (isPlayingRef.current || audioQueueRef.current.length === 0) {
      return;
    }

    isPlayingRef.current = true;

    const playNext = () => {
      // Verificar si se canceló la reproducción
      if (!isPlayingRef.current) {
        return;
      }

      if (audioQueueRef.current.length === 0) {
        isPlayingRef.current = false;
        activeAudioSourcesRef.current = [];
        return;
      }

      const float32 = audioQueueRef.current.shift();
      if (!float32) {
        playNext();
        return;
      }

      try {
        const audioBuffer = audioContext.createBuffer(
          1,
          float32.length,
          AUDIO_PROCESSING.sampleRate
        );
        audioBuffer.getChannelData(0).set(float32);

        const source = audioContext.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(audioContext.destination);

        // Guardar referencia para poder detenerla si es necesario
        activeAudioSourcesRef.current.push(source);

        // Programar la reproducción para que sea secuencial
        const currentTime = audioContext.currentTime;
        const startTime = Math.max(currentTime, nextPlayTimeRef.current);
        source.start(startTime);

        // Calcular el tiempo de finalización
        const duration = audioBuffer.duration;
        nextPlayTimeRef.current = startTime + duration;

        // Reproducir el siguiente chunk cuando termine este
        source.onended = () => {
          // Remover de la lista de fuentes activas
          activeAudioSourcesRef.current = activeAudioSourcesRef.current.filter(
            (s) => s !== source
          );
          // Solo continuar si aún se está reproduciendo
          if (isPlayingRef.current) {
            playNext();
          }
        };
      } catch (err) {
        console.error("Error reproduciendo chunk de audio:", err);
        if (isPlayingRef.current) {
          playNext();
        }
      }
    };

    playNext();
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

