"use client";

import { Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Image from "next/image";

function PhotoCodeContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const code = searchParams.get("code") || "";

  const handleFinish = () => {
    router.push("/photo");
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

      {/* Code Display */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 pb-8">
        <div className="w-full max-w-md flex flex-col items-center space-y-8">
          <div 
            className="text-white text-center font-bold"
            style={{
              fontSize: "clamp(3rem, 15vw, 8rem)",
              letterSpacing: "0.1em",
              lineHeight: "1.2",
            }}
          >
            {code}
          </div>
          
          {/* Finish Button */}
          <button
            onClick={handleFinish}
            className="w-full max-w-xs py-3 px-6 rounded-lg font-semibold text-base bg-white text-[#033778] hover:bg-gray-100 active:bg-gray-200 transition-colors"
          >
            Finish
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
