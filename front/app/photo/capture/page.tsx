"use client";

import { Suspense, useState, useRef, useEffect } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { API_BASE_URL } from "../../constants";

function PhotoCaptureContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fullName = searchParams.get("name") || "";
  const email = searchParams.get("email") || "";

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState<string>("Sending...");
  const [cameraError, setCameraError] = useState<string>("");
  const [isCameraStarting, setIsCameraStarting] = useState(false);

  // Iniciar cámara al montar
  useEffect(() => {
    startCamera();
    return () => {
      stopCamera();
    };
  }, []);

  const startCamera = async () => {
    try {
      setCameraError("");
      setIsCameraStarting(true);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" }, // Cámara frontal
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        // En algunos navegadores, aunque exista `autoPlay`, conviene forzar `play()`.
        // Si el navegador requiere gesto de usuario, capturamos el error y mostramos un CTA.
        try {
          await videoRef.current.play();
        } catch (err) {
          console.warn("No se pudo iniciar reproducción automática del vídeo:", err);
        }
      }
    } catch (error) {
      console.error("Error accessing camera:", error);
      const message =
        error instanceof Error
          ? error.message
          : "No se pudo acceder a la cámara. Revisa permisos y que la página esté en un contexto seguro (HTTPS o localhost).";
      setCameraError(message);
    } finally {
      setIsCameraStarting(false);
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
    if (!photo || !email) return;

    setIsLoading(true);
    setLoadingMessage("Saving data...");
    
    try {
      // Import lazy para evitar que la ruta falle al cargar si Firebase no está disponible
      const { FirebaseService } = await import("../../services/firebaseService");
      
      // Obtener el siguiente número correlativo desde Firebase users
      const usersData = await FirebaseService.read<Record<string, unknown>>("users");
      const keys = usersData ? Object.keys(usersData) : [];
      const numericKeys = keys.filter((k) => /^\d+$/.test(k)).map(Number);
      const nextId = numericKeys.length === 0 ? 1 : Math.max(...numericKeys) + 1;
      const userKey = String(nextId);

      // Guardar datos básicos en Firebase
      await FirebaseService.write(`users/${userKey}`, {
        fullName,
        email,
        photo: photo,
        timestamp: new Date().toISOString(),
      });

      console.log(`Data saved to users/${userKey}`);

      // Generar caricatura llamando al backend
      setLoadingMessage("Generating caricature...");
      console.log("Calling caricature generation endpoint...");
      
      const response = await fetch(`${API_BASE_URL}/photo/generate-caricature`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          orderNumber: userKey,
          photoBase64: photo,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error("Error generating caricature:", errorData);
        throw new Error(errorData.detail || `HTTP ${response.status}`);
      }

      const result = await response.json();
      console.log("Caricature generated successfully:", result);

      // Navegar a la pantalla del código solo después de generar la caricatura
      router.push(`/photo/code?code=${userKey}`);
    } catch (error) {
      console.error("Error in handleSend:", error);
      setLoadingMessage("Error occurred");
      setTimeout(() => {
        setIsLoading(false);
        setLoadingMessage("Sending...");
      }, 2000);
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
              <>
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
                {(isCameraStarting || cameraError) && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/60 p-4 text-center">
                    {isCameraStarting && (
                      <p className="text-white text-sm">Iniciando cámara…</p>
                    )}
                    {cameraError && (
                      <p className="text-white text-sm break-words">
                        {cameraError}
                      </p>
                    )}
                  </div>
                )}
              </>
            )}
            <canvas ref={canvasRef} className="hidden" />
          </div>

          {/* Buttons */}
          {!photo ? (
            <div className="w-full max-w-xs flex flex-col gap-3">
              {(cameraError || !streamRef.current) && (
                <button
                  onClick={startCamera}
                  className="w-full py-3 px-6 rounded-lg font-semibold text-base bg-white text-[#033778] hover:bg-gray-100 active:bg-gray-200 transition-colors"
                >
                  Activar cámara
                </button>
              )}
              <button
                onClick={handleShot}
                disabled={!streamRef.current || !!cameraError || isCameraStarting}
                className="w-full py-3 px-6 rounded-lg font-semibold text-base bg-white text-[#033778] hover:bg-gray-100 active:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Shot
              </button>
            </div>
          ) : (
            <div className="w-full max-w-xs flex gap-4">
              <button
                onClick={handleSend}
                disabled={isLoading}
                className="flex-1 py-3 px-6 rounded-lg font-semibold text-base bg-green-500 text-white hover:bg-green-600 active:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? loadingMessage : "Send"}
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

export default function PhotoCapturePage() {
  return (
    <Suspense fallback={
      <div 
        className="min-h-screen w-full flex flex-col items-center justify-center"
        style={{ backgroundColor: "#033778" }}
      >
        <p className="text-white">Cargando...</p>
      </div>
    }>
      <PhotoCaptureContent />
    </Suspense>
  );
}
