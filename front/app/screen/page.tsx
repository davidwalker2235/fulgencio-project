 "use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";

export default function Screen() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [isVideoVisible, setIsVideoVisible] = useState(false);

  const scheduleNextPlayback = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      const video = videoRef.current;
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
    scheduleNextPlayback();

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [scheduleNextPlayback]);

  const handleVideoEnded = () => {
    setIsVideoVisible(false);
    scheduleNextPlayback();
  };

  return (
    <div className="h-screen w-full flex flex-col overflow-hidden">
      <section className="flex-1 min-h-0 w-full bg-white px-6 py-2 md:px-12 md:py-8">
        <div className="mx-auto flex h-full w-full max-w-[1100px] flex-col">
          <div className="w-[170px] md:w-[270px] pt-6">
            <Image
              src="/erni-logo-dark-blue.png"
              alt="ERNI"
              width={1024}
              height={203}
              className="h-auto w-full object-contain"
              priority
              sizes="(max-width: 768px) 190px, 270px"
            />
          </div>

          <h1
            className="mt-12 max-w-[560px] text-[38px] leading-[1.08] tracking-[-0.02em] font-semibold md:mt-7 md:text-[58px]"
            style={{ color: "#003B88" }}
          >
            People passionate
          </h1>
          <h1
            className="max-w-[560px] text-[38px] leading-[1.08] tracking-[-0.02em] font-semibold md:mt-7 md:text-[58px]"
            style={{ color: "#003B88" }}
          >
            about technology
          </h1>

          <div className="flex items-end gap-1 md:mt-8 md:gap-10">
            <div className="relative h-[125px] w-[125px] md:h-[210px] md:w-[210px] shrink-0">
              <Image
                src="/QRcode.png"
                alt="Código QR"
                fill
                className="object-contain"
                sizes="(max-width: 768px) 160px, 210px"
              />
            </div>

            <div className="flex h-[160px] md:h-[210px] flex-row justify-center">
              <div className="flex flex-col items-center justify-center">
                <svg
                  viewBox="0 0 180 90"
                  className="h-[44px] w-[74px] md:h-[58px] md:w-[116px]"
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
              </div>
              <div className="flex flex-col items-center justify-end h-full">
                <p className="mb-2 mt-6 text-[28px] font-normal leading-[1.06] tracking-[-0.01em] text-[#4B4F58] md:text-[52px]">
                  Build the future
                  <br />
                  with us
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="relative flex-1 min-h-0 w-full overflow-hidden bg-black">
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
          ref={videoRef}
          className={`w-full h-full object-cover ${isVideoVisible ? "opacity-100" : "opacity-0"}`}
          src="/the-ernian-journey.mp4"
          muted
          playsInline
          onEnded={handleVideoEnded}
        />
      </section>
    </div>
  );
}
