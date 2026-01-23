"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { FirebaseService } from "../../services/firebaseService";
import { generateUserCode } from "../../utils/generateUserCode";

export default function PhotoCapturePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fullName = searchParams.get("name") || "";
  const email = searchParams.get("email") || "";

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Iniciar cámara al montar
  useEffect(() => {
    startCamera();
    return () => {
      stopCamera();
    };
  }, []);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" }, // Cámara frontal
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

  const handleShot = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const context = canvas.getContext("2d");

      if (context && video.readyState >= 2) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        context.drawImage(video, 0, 0);
        const photoData = canvas.toDataURL("image/jpeg");
        setPhoto(photoData);
        stopCamera();
      }
    }
  };

  const handleRepeat = () => {
    setPhoto(null);
    startCamera();
  };

  const handleSend = async () => {
    if (!photo) return;

    setIsLoading(true);
    try {
      // Generar código de 5 caracteres
      const userCode = generateUserCode();

      // Guardar en Firebase
      await FirebaseService.write(`users/${userCode}`, {
        fullName,
        email,
        photo: photo, // Foto en base64
        timestamp: new Date().toISOString(),
      });

      console.log(`Data saved to users/${userCode}`);

      // Navegar a la pantalla del código
      router.push(`/photo/code?code=${userCode}`);
    } catch (error) {
      console.error("Error saving to Firebase:", error);
      setIsLoading(false);
    }
  };

  return (
    <div 
      className="min-h-screen w-full flex flex-col"
      style={{ backgroundColor: "#033778" }}
    >
      {/* Header with Logo */}
      <div className="w-full flex justify-center pt-6 pb-4 px-4">
        <div className="relative w-full max-w-[200px] sm:max-w-[240px] aspect-[3/1]">
          <Image
            src="/erni_logo_white.png"
            alt="ERNI Logo"
            fill
            className="object-contain"
            priority
            sizes="(max-width: 640px) 200px, 240px"
          />
        </div>
      </div>

      {/* Camera/Photo Container */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 pb-8">
        <div className="w-full max-w-md flex flex-col items-center space-y-6">
          {/* Camera/Photo Box */}
          <div className="relative w-full aspect-square max-w-sm bg-black rounded-lg overflow-hidden shadow-2xl">
            {photo ? (
              <img
                src={photo}
                alt="Captured photo"
                className="w-full h-full object-cover"
              />
            ) : (
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
            )}
            <canvas ref={canvasRef} className="hidden" />
          </div>

          {/* Buttons */}
          {!photo ? (
            <button
              onClick={handleShot}
              className="w-full max-w-xs py-3 px-6 rounded-lg font-semibold text-base bg-white text-[#033778] hover:bg-gray-100 active:bg-gray-200 transition-colors"
            >
              Shot
            </button>
          ) : (
            <div className="w-full max-w-xs flex gap-4">
              <button
                onClick={handleSend}
                disabled={isLoading}
                className="flex-1 py-3 px-6 rounded-lg font-semibold text-base bg-green-500 text-white hover:bg-green-600 active:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? "Sending..." : "Send"}
              </button>
              <button
                onClick={handleRepeat}
                disabled={isLoading}
                className="flex-1 py-3 px-6 rounded-lg font-semibold text-base bg-red-500 text-white hover:bg-red-600 active:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Repeat
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
