"use client";

import { Suspense, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import NextUserIndicator from "../../components/NextUserIndicator";

function PhotoCodeContent() {
  const searchParams = useSearchParams();
  const code = searchParams.get("code") || "";

  useEffect(() => {
    const pushCodeLockState = () => {
      window.history.pushState({ lockCodePage: true }, "", window.location.href);
    };

    const handlePopState = () => {
      // Intenta bloquear el retroceso también en navegadores móviles.
      window.history.go(1);
    };

    const handlePageShow = () => {
      // Re-arma el lock al volver desde bfcache (común en iOS Safari).
      pushCodeLockState();
    };

    pushCodeLockState();
    window.addEventListener("popstate", handlePopState);
    window.addEventListener("pageshow", handlePageShow);

    return () => {
      window.removeEventListener("popstate", handlePopState);
      window.removeEventListener("pageshow", handlePageShow);
    };
  }, []);

  const handleFinish = () => {
    window.location.href = "https://www.linkedin.com/company/erni/";
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
      <div className="w-full flex justify-center px-4">
        <NextUserIndicator className="text-white text-center text-3xl sm:text-5xl font-semibold leading-snug [&>span]:justify-center" />
      </div>
      <div className="flex-1 flex flex-col items-center px-4 pb-8 pt-8">
        <div className="w-full max-w-md flex flex-col items-center space-y-8">
          <div className="w-full flex justify-center px-2">
            <span className="text-white text-center text-xl sm:text-2xl font-semibold leading-snug">
              Remember this number and wait for your turn to have your caricature drawn.
            </span>
          </div>
          <div 
            className="text-white text-center font-bold"
            style={{
              fontSize: "clamp(8rem, 15vw, 8rem)",
              letterSpacing: "0.1em",
              lineHeight: "1",
            }}
          >
            {code}
          </div>
          <div className="w-full flex justify-center px-2">
            <span className="text-white text-center text-xl sm:text-2xl font-semibold leading-snug">
              If you miss your turn, you will need to take another photo to get a new number.
         
            </span>
          </div>{/* Finish Button */}
          <button
            onClick={handleFinish}
            className="w-full max-w-xs py-3 px-6 rounded-lg font-semibold text-base bg-white text-[#033778] hover:bg-gray-100 active:bg-gray-200 transition-colors"
          >
            Know more about ERNI
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PhotoCodePage() {
  return (
    <Suspense fallback={
      <div 
        className="min-h-screen w-full flex flex-col items-center justify-center"
        style={{ backgroundColor: "#033778" }}
      >
        <p className="text-white">Cargando...</p>
      </div>
    }>
      <PhotoCodeContent />
    </Suspense>
  );
}
