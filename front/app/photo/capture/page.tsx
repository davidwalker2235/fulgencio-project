"use client";

import { Suspense, useState, useRef, useEffect, ChangeEvent } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { API_BASE_URL } from "../../constants";

function PhotoCaptureContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fullName = searchParams.get("name") || "";
  const email = searchParams.get("email") || "";
  const realNameParam = searchParams.get("realName")?.trim() || "";
  const workNameParam = searchParams.get("workName")?.trim() || "";
  const photoSource = searchParams.get("source") || "camera";

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [isPhotoFromGallery, setIsPhotoFromGallery] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState<string>("Sending...");
  const [submitError, setSubmitError] = useState<string>("");
  const [cameraError, setCameraError] = useState<string>("");
  const [isCameraStarting, setIsCameraStarting] = useState(false);

  // Iniciar cámara al montar
  useEffect(() => {
    const storedImage = sessionStorage.getItem("photo:selectedImageDataUrl");
    if (photoSource === "gallery" && storedImage) {
      setPhoto(storedImage);
      setIsPhotoFromGallery(true);
    } else {
      setIsPhotoFromGallery(false);
      startCamera();
    }
    return () => {
      stopCamera();
    };
  }, [photoSource]);

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
        // Evita efecto espejo en la foto final con cámara frontal.
        context.save();
        context.translate(canvas.width, 0);
        context.scale(-1, 1);
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        context.restore();
        const photoData = canvas.toDataURL("image/jpeg");
        setPhoto(photoData);
        setIsPhotoFromGallery(false);
        stopCamera();
      }
    }
  };

  const handleGalleryFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || "");
      if (!dataUrl) {
        return;
      }
      setPhoto(dataUrl);
      setIsPhotoFromGallery(true);
      setSubmitError("");
      stopCamera();
      e.target.value = "";
    };
    reader.onerror = () => {
      setSubmitError("No se pudo leer la imagen seleccionada.");
      e.target.value = "";
    };
    reader.readAsDataURL(file);
  };

  const handleRepeat = () => {
    setPhoto(null);
    setSubmitError("");
    startCamera();
  };

  const handleChooseAnotherImage = () => {
    setSubmitError("");
    galleryInputRef.current?.click();
  };

  const handleSend = async () => {
    if (!photo || !email) return;

    setSubmitError("");
    setIsLoading(true);
    setLoadingMessage("Saving data...");

    try {
      const requestId =
        globalThis.crypto?.randomUUID?.() ??
        `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      let registerErrorMessage = "";
      let orderNumber = "";
      for (let attempt = 1; attempt <= 5; attempt += 1) {
        const registerRes = await fetch(`${API_BASE_URL}/photo/register`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fullName,
            email,
            realName: realNameParam || undefined,
            workName: workNameParam || undefined,
            requestId,
          }),
        });

        if (registerRes.ok) {
          const data = (await registerRes.json()) as { orderNumber?: string };
          orderNumber = data.orderNumber || "";
          break;
        }

        const errData = await registerRes.json().catch(() => ({}));
        registerErrorMessage = String(errData.detail || `HTTP ${registerRes.status}`);
        const isTransientDbError =
          registerErrorMessage.includes("HYT00") ||
          registerErrorMessage.includes("08001") ||
          registerErrorMessage.includes("08S01") ||
          registerErrorMessage.includes("40613") ||
          registerErrorMessage.includes("40197") ||
          registerErrorMessage.includes("40501") ||
          registerErrorMessage.toLowerCase().includes("temporalmente no disponible") ||
          registerErrorMessage.toLowerCase().includes("not currently available") ||
          registerErrorMessage.toLowerCase().includes("timeout");
        if (isTransientDbError && attempt < 5) {
          setLoadingMessage("Connecting to database, retrying...");
          const delayMs = 800 * 2 ** (attempt - 1);
          await new Promise((resolve) => setTimeout(resolve, delayMs));
          setLoadingMessage("Saving data...");
          continue;
        }
        throw new Error(`Error registrando usuario: ${registerErrorMessage}`);
      }

      if (!orderNumber) {
        throw new Error("El backend no devolvió orderNumber");
      }
      console.log("User registered, orderNumber:", orderNumber);

      setLoadingMessage("Generating caricature...");
      const response = await fetch(`${API_BASE_URL}/photo/generate-caricature`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderNumber,
          photoBase64: photo,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error("Error generating caricature:", errorData);
        throw new Error(
          `Error generando caricatura: ${errorData.detail || `HTTP ${response.status}`}`
        );
      }

      const result = await response.json();
      console.log("Caricature generated successfully:", result);

      router.push(`/photo/code?code=${orderNumber}`);
    } catch (error) {
      console.error("Error in handleSend:", error);
      const baseMessage =
        error instanceof Error ? error.message : "Error inesperado enviando la foto";
      const lower = baseMessage.toLowerCase();
      const message =
        lower.includes("failed to fetch")
          ? "No se pudo conectar con el servidor. Verifica que backend y frontend estén accesibles desde el móvil (misma red) y que CORS esté permitido."
          :
        lower.includes("timeout") || lower.includes("not currently available") || lower.includes("temporalmente no disponible")
          ? "La base de datos está arrancando o tardó en responder. Ya lo intentamos varias veces automáticamente; espera unos segundos e inténtalo de nuevo."
          : baseMessage;
      setSubmitError(message);
      setLoadingMessage("Error");
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
      {isLoading && (
        <div className="fixed inset-0 z-50 bg-black/70 flex flex-col items-center justify-center gap-4">
          <div className="w-12 h-12 rounded-full border-4 border-white/30 border-t-white animate-spin" />
          <p className="text-white text-base font-medium">
            Processing photo, please wait...
          </p>
        </div>
      )}
      {submitError && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center px-4">
          <div className="w-full max-w-md rounded-lg bg-white shadow-2xl p-5">
            <h2 className="text-lg font-semibold text-gray-900">Error</h2>
            <p className="mt-3 text-sm text-gray-700 break-words">{submitError}</p>
            <button
              onClick={() => setSubmitError("")}
              className="mt-5 w-full py-2 px-4 rounded-lg font-semibold text-sm bg-[#033778] text-white hover:bg-[#022b5f] transition-colors"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}

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
                  className="w-full h-full object-cover -scale-x-100"
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
            <input
              ref={galleryInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleGalleryFileChange}
            />
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
            <div className="w-full max-w-xs flex flex-col gap-3">
              <div className="w-full flex gap-4">
                <button
                  onClick={handleSend}
                  disabled={isLoading}
                  className="flex-1 py-3 px-6 rounded-lg font-semibold text-base bg-green-500 text-white hover:bg-green-600 active:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? loadingMessage : "Send"}
                </button>
                <button
                  onClick={isPhotoFromGallery ? handleChooseAnotherImage : handleRepeat}
                  disabled={isLoading}
                  className="flex-1 py-3 px-6 rounded-lg font-semibold text-base bg-red-500 text-white hover:bg-red-600 active:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isPhotoFromGallery ? "Choose another image" : "Repeat"}
                </button>
              </div>
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
