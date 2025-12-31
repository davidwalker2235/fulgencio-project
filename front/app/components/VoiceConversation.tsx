"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useVoiceConversation } from "../hooks/useVoiceConversation";
import ConversationButton from "./ConversationButton";
import ConnectionStatus from "./ConnectionStatus";
import ErrorDisplay from "./ErrorDisplay";
import AnimatedFace from "./AnimatedFace";
import FaceMorphTargets from './face/FaceMorphTargets';
import VideoLoop from "./VideoLoop";
import Subtitles from "./Subtitles";
import CameraCapture from "./CameraCapture";
import TextInput from "./TextInput";
import { PhotoState } from "../types";
import { FirebaseService } from "../services/firebaseService";
import { useFirebase } from "../hooks/useFirebase";
import { PHOTO_AUTHORIZATION_PROMPT } from "../constants/aiPrompts";

export default function VoiceConversation() {
  const {
    isRecording,
    transcription,
    error,
    connectionStatus,
    isSpeaking,
    activeUserId,
    toggleConversation,
    clearError,
    sendTextMessage,
  } = useVoiceConversation();

  const { subscribe, write } = useFirebase();
  const [photoState, setPhotoState] = useState<PhotoState>("idle");
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [currentPhoto, setCurrentPhoto] = useState<string | null>(null);
  const photoStateRef = useRef<PhotoState>("idle");
  const previousStatusRef = useRef<PhotoState | null>(null);
  const messageSentRef = useRef<boolean>(false);

  // Mantener la referencia actualizada
  useEffect(() => {
    photoStateRef.current = photoState;
  }, [photoState]);

  // Obtener userId del localStorage
  const userId = useMemo(() => {
    try {
      const savedCredentials = localStorage.getItem("savedCredentials");
      if (savedCredentials) {
        const credentials = JSON.parse(savedCredentials);
        return credentials.user;
      }
    } catch (error) {
      console.error("Error obteniendo userId:", error);
    }
    return null;
  }, []);

  // Suscribirse al nodo status en Firebase
  useEffect(() => {
    const statusPath = `status`;
    const unsubscribe = subscribe<PhotoState>(statusPath, (status) => {
      if (status) {
        // Si Firebase cambia a idle, resetear todo (incluso si estamos en photoTaken)
        if (status === "idle") {
          setPhotoState("idle");
          setCurrentPhoto(null);
          previousStatusRef.current = "idle";
          messageSentRef.current = false;
          // Esperar a que termine la animación antes de cerrar
          setTimeout(() => {
            setIsCameraOpen(false);
          }, 400);
        } else if (status === "takingPhoto") {
          // Solo actualizar si no estamos en estado photoTaken (estado temporal)
          // Esto permite que el estado photoTaken persista hasta que se cancele o envíe
          if (photoStateRef.current !== "photoTaken") {
            setPhotoState("takingPhoto");
            setIsCameraOpen(true);
            
            // Enviar mensaje automático cuando cambia a "takingPhoto" y hay conexión activa
            if (
              previousStatusRef.current !== "takingPhoto" &&
              connectionStatus === "Connected" &&
              !messageSentRef.current
            ) {
              sendTextMessage(PHOTO_AUTHORIZATION_PROMPT);
              messageSentRef.current = true;
              console.log("📤 Mensaje automático enviado al cambiar a takingPhoto");
            }
          }
        }
        previousStatusRef.current = status;
      } else {
        // Si no hay estado, establecer como idle
        setPhotoState("idle");
        setIsCameraOpen(false);
        previousStatusRef.current = null;
        messageSentRef.current = false;
      }
    });

    return () => {
      unsubscribe();
    };
  }, [subscribe, connectionStatus, sendTextMessage]);

  const handleStartTakingPhoto = async () => {
    try {
      await write("status", "takingPhoto");
    } catch (error) {
      console.error("Error escribiendo status en Firebase:", error);
    }
  };

  const handleTakePhoto = () => {
    // El estado photoTaken se maneja localmente ya que es temporal
    setPhotoState("photoTaken");
  };

  const handleCancel = async () => {
    try {
      await write("status", "idle");
    } catch (error) {
      console.error("Error escribiendo status en Firebase:", error);
    }
  };

  const handleTakePhotoAgain = async () => {
    // Resetear el estado local primero para que la cámara se reinicie
    setPhotoState("takingPhoto");
    setCurrentPhoto(null);
    // Luego escribir en Firebase para mantener la sincronización
    try {
      await write("status", "takingPhoto");
    } catch (error) {
      console.error("Error escribiendo status en Firebase:", error);
    }
  };

  const handleSend = async () => {
    if (currentPhoto) {
      await handlePhotoTaken(currentPhoto);
    }
    try {
      await write("status", "idle");
    } catch (error) {
      console.error("Error escribiendo status en Firebase:", error);
    }
  };

  const handlePhotoTaken = async (photoBase64: string) => {
    try {
      // Usar el ID del usuario activo de la conversación si existe
      // Si no hay conversación activa, generar un ID nuevo para esta foto
      let userIdToUse = activeUserId;
      
      if (!userIdToUse) {
        // Generar ID único si no hay uno activo
        const timestamp = Date.now();
        const random = Math.random().toString(36).substring(2, 15);
        userIdToUse = `user_${timestamp}_${random}`;
        console.log("🆔 ID generado para foto (sin conversación activa):", userIdToUse);
      }
      
      // Enviar foto a Firebase en la estructura users/{userId}/photo
      await FirebaseService.write(`users/${userIdToUse}/photo`, {
        photo: photoBase64,
        timestamp: new Date().toISOString(),
      });
      console.log(`📸 Foto guardada en users/${userIdToUse}/photo`);
    } catch (error) {
      console.error("Error sending photo to Firebase:", error);
    }
  };

  return (
    <div className="relative min-h-screen bg-zinc-50 dark:bg-black">
      <div className="fixed inset-0 w-full h-full z-0">
        <VideoLoop connectionStatus={connectionStatus} isSpeaking={isSpeaking} />
      </div>
      <div className="fixed top-0 left-0 left-0 z-10 flex flex-col items-center p-8 pointer-events-none">
        <ConnectionStatus status={connectionStatus} />
      </div>
      {isCameraOpen && (
        <CameraCapture
          isOpen={isCameraOpen}
          onClose={handleCancel}
          onPhotoTaken={handlePhotoTaken}
          onTakePhoto={handleTakePhoto}
          onCancel={handleCancel}
          onSend={handleSend}
          onTakePhotoAgain={handleTakePhotoAgain}
          photoState={photoState}
          onPhotoReady={setCurrentPhoto}
        />
      )}
      {/* <div className="flex justify-center items-center">
        <AnimatedFace />
      </div> */}
      {/* <div className="fixed inset-0 w-full h-full z-0">
        <FaceMorphTargets />
      </div> */}
      <div className="fixed bottom-0 left-0 right-0 z-10 flex flex-col items-center p-8 pointer-events-none">
        <div className="w-full max-w-4xl space-y-4 pointer-events-auto">
          <Subtitles messages={transcription} isSpeaking={isSpeaking} isRecording={isRecording} />
          {connectionStatus === "Connected" && (
            <TextInput
              onSend={sendTextMessage}
              disabled={isSpeaking}
              placeholder="Escribe tu mensaje o habla..."
            />
          )}
          <ConversationButton
            isRecording={isRecording}
            connectionStatus={connectionStatus}
            photoState={photoState}
            onToggle={() => toggleConversation(transcription)}
            onStartTakingPhoto={handleStartTakingPhoto}
            onTakePhoto={handleTakePhoto}
            onCancel={handleCancel}
            onSend={handleSend}
            onTakePhotoAgain={handleTakePhotoAgain}
          />
          <ErrorDisplay error={error} onClose={clearError} />
        </div>
      </div>
    </div>
  );
}
