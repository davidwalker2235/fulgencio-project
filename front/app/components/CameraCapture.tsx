"use client";

import { useRef, useEffect, useState } from "react";

interface CameraCaptureProps {
  isOpen: boolean;
  onClose: () => void;
  onPhotoTaken: (photoBase64: string) => void;
  onTakePhoto: () => void;
  onCancel: () => void;
  onSend: () => void;
  onTakePhotoAgain: () => void;
  photoState: "idle" | "takingPhoto" | "photoTaken";
  onPhotoReady?: (photoBase64: string | null) => void;
}

export default function CameraCapture({
  isOpen,
  onClose,
  onPhotoTaken,
  photoState,
  onPhotoReady,
}: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    if (isOpen && photoState === "takingPhoto" && !photo) {
      startCamera();
      // Trigger animation
      setIsAnimating(true);
      setTimeout(() => setIsAnimating(false), 600);
    }

    return () => {
      if (!isOpen) {
        stopCamera();
      }
    };
  }, [isOpen, photoState, photo]);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" }, // Front camera for selfie
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (error) {
      console.error("Error accessing camera:", error);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  useEffect(() => {
    if (photoState === "photoTaken" && videoRef.current && canvasRef.current && !photo) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const context = canvas.getContext("2d");

      if (context && video.readyState >= 2) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        context.drawImage(video, 0, 0);
        const photoData = canvas.toDataURL("image/jpeg");
        setPhoto(photoData);
        if (onPhotoReady) {
          onPhotoReady(photoData);
        }
        stopCamera();
      }
    } else if (photoState === "takingPhoto" && photo) {
      // Reset photo when taking photo again
      setPhoto(null);
      if (onPhotoReady) {
        onPhotoReady(null);
      }
    }
  }, [photoState, photo, onPhotoReady]);

  useEffect(() => {
    if (!isOpen) {
      setIsExiting(true);
      stopCamera();
      const timer = setTimeout(() => {
        setPhoto(null);
        setIsExiting(false);
      }, 400);
      return () => clearTimeout(timer);
    } else {
      setIsExiting(false);
    }
  }, [isOpen]);

  if (!isOpen && !isExiting) return null;

  return (
    <div
      className={`fixed top-[100px] left-[50px] w-[30%] z-50 ${
        isExiting ? "animate-camera-exit" : isAnimating ? "animate-camera-enter" : ""
      }`}
    >
      <div className="relative bg-black rounded-lg overflow-hidden shadow-2xl">
        {photoState === "photoTaken" && photo ? (
          <img
            src={photo}
            alt="Captured photo"
            className="w-full h-auto"
          />
        ) : (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-auto"
          />
        )}
        <canvas ref={canvasRef} className="hidden" />
      </div>
    </div>
  );
}

