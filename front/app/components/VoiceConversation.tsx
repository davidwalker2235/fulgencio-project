"use client";

import { useState } from "react";
import { useVoiceConversation } from "../hooks/useVoiceConversation";
import ConversationButton from "./ConversationButton";
import ConnectionStatus from "./ConnectionStatus";
import ErrorDisplay from "./ErrorDisplay";
import AnimatedFace from "./AnimatedFace";
import FaceMorphTargets from './face/FaceMorphTargets';
import VideoLoop from "./VideoLoop";
import Subtitles from "./Subtitles";
import CameraCapture from "./CameraCapture";
import { PhotoState } from "../types";
import { FirebaseService } from "../services/firebaseService";

export default function VoiceConversation() {
  const {
    isRecording,
    transcription,
    error,
    connectionStatus,
    isSpeaking,
    toggleConversation,
    clearError,
  } = useVoiceConversation();

  const [photoState, setPhotoState] = useState<PhotoState>("idle");
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [currentPhoto, setCurrentPhoto] = useState<string | null>(null);

  const handleStartTakingPhoto = () => {
    setPhotoState("takingPhoto");
    setIsCameraOpen(true);
  };

  const handleTakePhoto = () => {
    setPhotoState("photoTaken");
  };

  const handleCancel = () => {
    setIsCameraOpen(false);
    // Esperar a que termine la animación antes de resetear el estado
    setTimeout(() => {
      setPhotoState("idle");
      setCurrentPhoto(null);
    }, 400);
  };

  const handleTakePhotoAgain = () => {
    setPhotoState("takingPhoto");
  };

  const handleSend = async () => {
    if (currentPhoto) {
      await handlePhotoTaken(currentPhoto);
    }
    setIsCameraOpen(false);
    // Esperar a que termine la animación antes de resetear el estado
    setTimeout(() => {
      setPhotoState("idle");
      setCurrentPhoto(null);
    }, 400);
  };

  const handlePhotoTaken = async (photoBase64: string) => {
    try {
      // Obtener el usuario desde localStorage
      const savedCredentials = localStorage.getItem("savedCredentials");
      if (savedCredentials) {
        const credentials = JSON.parse(savedCredentials);
        const userId = credentials.user;
        
        // Enviar foto a Firebase
        await FirebaseService.write(`user/${userId}/photo`, {
          photo: photoBase64,
          timestamp: new Date().toISOString(),
        });
      }
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
