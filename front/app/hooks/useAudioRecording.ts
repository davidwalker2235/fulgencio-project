import { useRef, useCallback } from "react";
import { AUDIO_CONFIG, AUDIO_PROCESSING, VOICE_DETECTION } from "../constants";
import { float32ToPCM16, calculateAudioLevel } from "../services/audioUtils";

interface UseAudioRecordingReturn {
  startRecording: (
    onAudioChunk: (audioData: ArrayBuffer) => void,
    onUserSpeakingChange?: (isSpeaking: boolean, wasSpeaking: boolean) => void
  ) => Promise<void>;
  stopRecording: () => void;
  getAudioLevel: () => number;
  isRecording: () => boolean;
}

/**
 * Hook para manejar la grabación de audio del micrófono
 */
export function useAudioRecording(): UseAudioRecordingReturn {
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const isRecordingRef = useRef<boolean>(false);
  const audioLevelRef = useRef<number>(0);
  const isUserSpeakingRef = useRef<boolean>(false);

  const startRecording = useCallback(
    async (
      onAudioChunk: (audioData: ArrayBuffer) => void,
      onUserSpeakingChange?: (isSpeaking: boolean, wasSpeaking: boolean) => void
    ) => {
      try {
        // Solicitar acceso al micrófono
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: AUDIO_CONFIG,
        });

        streamRef.current = stream;

        // Crear AudioContext para procesar el audio
        const audioContext = new (window.AudioContext ||
          (window as any).webkitAudioContext)({
          sampleRate: AUDIO_PROCESSING.sampleRate,
        });
        audioContextRef.current = audioContext;

        // Crear fuente de audio desde el stream
        const source = audioContext.createMediaStreamSource(stream);
        const processor = audioContext.createScriptProcessor(
          AUDIO_PROCESSING.bufferSize,
          1,
          1
        );
        processorRef.current = processor;

        processor.onaudioprocess = (e) => {
          if (!isRecordingRef.current) return;

          const inputData = e.inputBuffer.getChannelData(0);

          // Calcular nivel de audio
          const averageLevel = calculateAudioLevel(inputData);
          audioLevelRef.current = averageLevel;

          // Detectar si el usuario está hablando
          const wasUserSpeaking = isUserSpeakingRef.current;
          isUserSpeakingRef.current =
            averageLevel > VOICE_DETECTION.speakingThreshold;

          // Notificar cambio en el estado de habla
          if (onUserSpeakingChange && wasUserSpeaking !== isUserSpeakingRef.current) {
            onUserSpeakingChange(isUserSpeakingRef.current, wasUserSpeaking);
          }

          // Convertir Float32Array a Int16Array (PCM16)
          const pcm16 = float32ToPCM16(inputData);

          // Enviar audio al callback - convertir a ArrayBuffer
          const buffer = new ArrayBuffer(pcm16.byteLength);
          new Int16Array(buffer).set(pcm16);
          onAudioChunk(buffer);
        };

        // Conectar el procesador de audio
        source.connect(processor);
        processor.connect(audioContext.destination);

        isRecordingRef.current = true;

        console.log("Grabación de audio iniciada");
      } catch (error) {
        console.error("Error iniciando grabación:", error);
        throw error;
      }
    },
    []
  );

  const stopRecording = useCallback(() => {
    isRecordingRef.current = false;

    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close().catch(console.error);
      audioContextRef.current = null;
    }

    audioLevelRef.current = 0;
    isUserSpeakingRef.current = false;

    console.log("Grabación de audio detenida");
  }, []);

  const getAudioLevel = useCallback(() => {
    return audioLevelRef.current;
  }, []);

  const isRecording = useCallback(() => {
    return isRecordingRef.current;
  }, []);

  return {
    startRecording,
    stopRecording,
    getAudioLevel,
    isRecording,
  };
}

