"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { onValue, ref } from "firebase/database";
import { database } from "../../firebaseConfig";
import NextUserIndicator from "../components/NextUserIndicator";

const CENTER_ALTERNATE_MS = 5_000;

export default function Screen() {
  const promoVideoRef = useRef<HTMLVideoElement>(null);
  const cameraVideoRef = useRef<HTMLVideoElement>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const [isScreenOn, setIsScreenOn] = useState(false);
  const [centerShowsMetaquestGif, setCenterShowsMetaquestGif] = useState(false);

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
    const statusRef = ref(database, "status");
    const unsubscribe = onValue(statusRef, (snapshot) => {
      const status = snapshot.val();
      setIsScreenOn(
        status !== null &&
          status !== undefined &&
          String(status).toLowerCase() !== "idle" && String(status).toLowerCase() !== "offline"
      );
    });

    return () => {
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    const promoVideo = promoVideoRef.current;

    if (isScreenOn) {
      if (promoVideo) {
        promoVideo.pause();
        promoVideo.currentTime = 0;
      }
      void startCamera();
      return;
    }

    stopCamera();
    if (!promoVideo) {
      return;
    }

    let cancelled = false;
    const playPromo = () => {
      if (cancelled) return;
      void promoVideo.play().catch((error) => {
        console.error("No se pudo reproducir el vídeo promocional:", error);
      });
    };

    // Mismo nodo <video> siempre montado; si aún no hay datos suficientes, esperar a canplay
    if (promoVideo.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
      playPromo();
    } else {
      promoVideo.addEventListener("canplay", playPromo, { once: true });
    }

    return () => {
      cancelled = true;
      promoVideo.removeEventListener("canplay", playPromo);
    };
  }, [isScreenOn, startCamera, stopCamera]);

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  useEffect(() => {
    const id = window.setInterval(() => {
      setCenterShowsMetaquestGif((prev) => !prev);
    }, CENTER_ALTERNATE_MS);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="flex h-[100dvh] min-h-0 w-full max-w-none flex-row overflow-hidden bg-black">
      {/* Ancho completo del viewport en cualquier tamaño de pantalla (sin bandas laterales) */}
      <section className="flex min-h-0 min-w-0 flex-[0_0_46%] flex-col bg-white px-[4%] py-[3%] pl-[5%]">
        <header className="shrink-0 pb-[3%]">
          <div className="flex flex-row items-end gap-[7%]">
            <div className="w-[55%] max-w-[280px] shrink-0">
              <Image
                src="/erni-logo-dark-blue.png"
                alt="ERNI"
                width={1024}
                height={203}
                className="h-auto w-full object-contain"
                priority
                sizes="22vw"
              />
            </div>
            <NextUserIndicator
              className="max-w-[95%] min-w-0 flex-1 tracking-[-0.02em] font-semibold"
              style={{ color: "#003B88", fontSize: "min(2.2vw, 3.8dvh)" }}
            />
          </div>
        </header>

        <div className="flex min-h-0 flex-1 flex-col justify-center py-[1%]">
          {centerShowsMetaquestGif || !centerShowsMetaquestGif ? (
            <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-0 px-[2%] text-center">
              <p
                className="mb-0 w-full max-w-full shrink-0 pb-0 leading-[1.05] tracking-[-0.02em] font-semibold text-[#003B88]"
                style={{ fontSize: "min(3.8vw, 6.5dvh)" }}
              >
                Participate and win a
              </p>
              <div className="relative -mt-[min(1.2vw,2dvh)] flex min-h-0 w-full max-w-full flex-1 min-w-0 items-center justify-center">
                <img
                  src="/metaquest.gif"
                  alt="Meta Quest 3S"
                  className="max-h-full max-w-full object-contain"
                  draggable={false}
                />
                <div
                  className="pointer-events-none absolute inset-x-0 bottom-0 pt-[min(14vw,18dvh)] pb-[min(1.2vw,2dvh)]"
                  style={{
                    background:
                      "linear-gradient(to top, rgb(255 255 255 / 0.98) 0%, rgb(255 255 255 / 0.9) 32%, rgb(255 255 255 / 0.55) 58%, transparent 100%)",
                  }}
                >
                  <p
                    className="text-center font-semibold leading-[1.02] tracking-[-0.02em] text-[#003B88]"
                    style={{ fontSize: "min(7.6vw, 13dvh)" }}
                  >
                    Meta Quest 3S!
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col justify-center gap-[4%]">
              <div className="flex flex-col gap-[2%]">
                <h1
                  className="max-w-[95%] leading-[1.08] tracking-[-0.02em] font-semibold"
                  style={{ color: "#003B88", fontSize: "min(3.8vw, 6.5dvh)" }}
                >
                  Get your caricature!
                </h1>
              </div>

              <div className="flex min-h-0 items-end gap-[2%]">
                <div className="relative aspect-square w-[64%] max-w-[min(320px,44vw)] shrink-0">
                  <Image
                    src="/photoQRcode.png"
                    alt="Código QR"
                    fill
                    className="object-contain"
                    sizes="28vw"
                  />
                </div>

                <div className="flex min-h-0 min-w-0 flex-1 items-end gap-[3%]">
                  <svg
                    viewBox="0 0 180 90"
                    className="h-auto max-h-[45%] w-[22%] max-w-[100px] shrink-0"
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
                    className="pb-[0.5%] font-normal leading-[1.06] tracking-[-0.01em] text-[#4B4F58]"
                    style={{ fontSize: "min(2.2vw, 3.8dvh)" }}
                  >
                    Scan the QR code
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        <footer className="shrink-0 border-t border-[#e8ecf2] pt-[3%]">
          <p
            className="font-semibold tracking-tight text-[#003B88]"
            style={{ fontSize: "min(2.4vw, 4.2dvh)" }}
          >
            #ERNIxCodemotion
          </p>
        </footer>
      </section>

      <section className="relative min-h-0 min-w-0 flex-1 overflow-hidden bg-black">
        {/* Los dos vídeos permanecen montados para que el ref del promocional no se pierda al alternar con la cámara */}
        <video
          ref={promoVideoRef}
          className={`absolute inset-0 h-full w-full object-cover ${isScreenOn ? "z-0 opacity-0" : "z-10 opacity-100"}`}
          src="/the-ernian-journey.mp4"
          muted
          playsInline
          loop
        />
        <video
          ref={cameraVideoRef}
          className={`absolute inset-0 h-full w-full object-cover ${isScreenOn ? "z-10 opacity-100" : "z-0 opacity-0"}`}
          autoPlay
          muted
          playsInline
        />
      </section>
    </div>
  );
}
