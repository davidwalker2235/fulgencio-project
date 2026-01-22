"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";

export default function PhotoPage() {
  const [agreed, setAgreed] = useState(false);
  const router = useRouter();

  const handleEnter = () => {
    if (agreed) {
      router.push("/photo/form");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && agreed) {
      handleEnter();
    }
  };

  return (
    <div 
      className="h-screen w-full flex flex-col items-center justify-center px-4 py-6 overflow-hidden"
      style={{ backgroundColor: "#033778" }}
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
      <div className="flex flex-col items-center justify-center space-y-6 sm:space-y-8 w-full flex-1 -mt-16">
        {/* Logo */}
        <div className="w-full flex justify-center flex-shrink-0 px-2">
          <div className="relative w-full max-w-[280px] sm:max-w-[320px] md:max-w-[360px] aspect-[3/1]">
            <Image
              src="/erni_logo_white.png"
              alt="ERNI Logo"
              fill
              className="object-contain"
              priority
              sizes="(max-width: 640px) 280px, (max-width: 768px) 320px, 360px"
            />
          </div>
        </div>

        {/* Text */}
        <h1 
          className="text-white text-center font-bold text-xl sm:text-2xl md:text-3xl leading-tight px-2 flex-shrink-0"
          style={{ 
            fontFamily: 'sans-serif',
            fontWeight: 'bold'
          }}
        >
          People Passionate about Technology
        </h1>

        {/* Checkbox and Button Container */}
        <div className="flex flex-col items-center space-y-3 sm:space-y-4 w-full mt-8 sm:mt-12 pb-4">
          {/* Checkbox */}
          <label className="flex items-center space-x-2 cursor-pointer flex-shrink-0">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="w-4 h-4 rounded border-2 border-white bg-transparent checked:bg-white checked:border-white focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-[#033778] cursor-pointer"
              style={{ accentColor: "white" }}
            />
            <span className="text-white text-xs sm:text-sm">
              Agree the <a href="https://www.betterask.erni/es-es/privacy-statement/" target="_blank" rel="noopener noreferrer" className="underline text-white hover:text-gray-200 transition-colors">terms and conditions</a>
            </span>
          </label>

          {/* Enter Button */}
          <button
            onClick={handleEnter}
            disabled={!agreed}
            className={`w-full max-w-[200px] py-2.5 sm:py-3 px-6 rounded-lg font-semibold text-sm sm:text-base transition-all flex-shrink-0 ${
              agreed
                ? "bg-white text-[#033778] hover:bg-gray-100 active:bg-gray-200"
                : "bg-gray-400 text-gray-600 cursor-not-allowed"
            }`}
          >
            Enter
          </button>
        </div>
      </div>
    </div>
  );
}
