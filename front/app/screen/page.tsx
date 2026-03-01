 "use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { onValue, ref } from "firebase/database";
import { database } from "../../firebaseConfig";

interface RobotActionNode {
  caricatureImage?: string;
  fullName?: string;
  timestamp?: number;
  type?: string;
  userId?: string | number;
}

export default function Screen() {
  const promoVideoRef = useRef<HTMLVideoElement>(null);
  const cameraVideoRef = useRef<HTMLVideoElement>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [isVideoVisible, setIsVideoVisible] = useState(false);
  const [hasRobotActionData, setHasRobotActionData] = useState(false);

  const stopCamera = useCallback(() => {
    const stream = cameraStreamRef.current;
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      cameraStreamRef.current = null;
    }
    if (cameraVideoRef.current) {
      cameraVideoRef.current.srcObject = null;
    }
  }, []);

  const startCamera = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      return;
    }

    stopCamera();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "environment",
        },
        audio: false,
      });
      cameraStreamRef.current = stream;
      if (cameraVideoRef.current) {
        cameraVideoRef.current.srcObject = stream;
      }
    } catch (error) {
      console.error("No se pudo iniciar la cámara:", error);
    }
  }, [stopCamera]);

  useEffect(() => {
    const robotActionRef = ref(database, "robot_action");
    const unsubscribe = onValue(robotActionRef, (snapshot) => {
      const data = snapshot.val() as unknown;

      if (
        data === null ||
        data === undefined ||
        (typeof data === "string" && data.trim() === "")
      ) {
        setHasRobotActionData(false);
        return;
      }

      if (typeof data === "object") {
        setHasRobotActionData(Object.keys(data).length > 0);
        return;
      }

      setHasRobotActionData(Boolean(data));
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const scheduleNextPlayback = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      const video = promoVideoRef.current;
      if (!video) return;

      video.currentTime = 0;
      setIsVideoVisible(true);
      void video.play().catch(() => {
        setIsVideoVisible(false);
        scheduleNextPlayback();
      });
    }, 120000);
  }, []);

  useEffect(() => {
    if (hasRobotActionData) {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      setIsVideoVisible(false);
      const promoVideo = promoVideoRef.current;
      if (promoVideo) {
        promoVideo.pause();
        promoVideo.currentTime = 0;
      }
      void startCamera();
      return;
    }

    stopCamera();
    scheduleNextPlayback();
  }, [hasRobotActionData, scheduleNextPlayback, startCamera, stopCamera]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      stopCamera();
    };
  }, [stopCamera]);

  const handleVideoEnded = () => {
    setIsVideoVisible(false);
    scheduleNextPlayback();
  };

  return (
    <div className="h-[100dvh] w-full overflow-hidden bg-black flex items-center justify-center">
      {/* Canvas con relación de aspecto fija 9:16 (vertical) que escala para caber en cualquier pantalla */}
      <div
        className="flex flex-col overflow-hidden bg-white shrink-0"
        style={{
          aspectRatio: "9/16",
          width: "min(56.25dvh, 100vw)",
          height: "min(100dvh, 177.78vw)",
        }}
      >
        {/* Parte superior: logo, título, QR y texto (aprox. 60% del canvas) */}
        <section className="flex-[0_0_50%] min-h-0 w-full bg-white flex flex-col px-[6%] pt-[3%] pb-[2%]">
          <div className="w-[45%]">
            <Image
              src="/erni-logo-dark-blue.png"
              alt="ERNI"
              width={1024}
              height={203}
              className="h-auto w-full object-contain"
              priority
              sizes="28vw"
            />
          </div>

          <h1
            className="mt-[6%] max-w-[90%] leading-[1.08] tracking-[-0.02em] font-semibold"
            style={{ color: "#003B88", fontSize: "5.2vh" }}
          >
            People passionate
          </h1>
          <h1
            className="max-w-[90%] leading-[1.08] tracking-[-0.02em] font-semibold"
            style={{ color: "#003B88", fontSize: "5.2vh" }}
          >
            about technology
          </h1>

          <div className="flex items-end gap-[1%] mt-[4%] flex-1 min-h-0 mb-[10%]">
            <div className="relative shrink-0 w-[35%] aspect-square max-w-[220px]">
              <Image
                src="/QRcode.png"
                alt="Código QR"
                fill
                className="object-contain"
                sizes="18vw"
              />
            </div>

            <div className="flex items-end gap-[2%] flex-1 min-w-0 h-full">
              <svg
                viewBox="0 0 180 90"
                className="shrink-0 w-[25%] h-auto max-w-[120px] h-full"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M165 70 C150 22, 88 18, 36 36"
                  stroke="#4B4F58"
                  strokeWidth="4"
                  strokeLinecap="round"
                />
                <path
                  d="M49 24 L30 36 L52 44"
                  stroke="#4B4F58"
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <p
                className="text-[#4B4F58] font-normal leading-[1.06] tracking-[-0.01em] pb-[0.5%]"
                style={{ fontSize: "3.2vh" }}
              >
                Build the future
                <br />
                with us
              </p>
            </div>
          </div>
        </section>

        {/* Parte inferior: imagen/vídeo (aprox. 40% del canvas) */}
        <section className="relative flex-[0_0_50%] min-h-0 w-full overflow-hidden bg-black">
          {hasRobotActionData ? (
            <video
              ref={cameraVideoRef}
              className="w-full h-full object-cover"
              autoPlay
              muted
              playsInline
            />
          ) : (
            <>
              {!isVideoVisible && (
                <Image
                  src="/screen-image.png"
                  alt="Fondo de pantalla"
                  fill
                  className="object-cover"
                  sizes="100vw"
                  priority
                />
              )}

              <video
                ref={promoVideoRef}
                className={`absolute inset-0 w-full h-full object-cover ${isVideoVisible ? "opacity-100" : "opacity-0"}`}
                src="/the-ernian-journey.mp4"
                muted
                playsInline
                onEnded={handleVideoEnded}
              />
            </>
          )}
        </section>
      </div>
    </div>
  );
}
