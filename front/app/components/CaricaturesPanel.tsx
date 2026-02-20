"use client";

import { useMemo, useState } from "react";
import Image from "next/image";

interface CaricaturesPanelProps {
  images: string[];
  userPhoto?: string | null;
}

export default function CaricaturesPanel({ images, userPhoto }: CaricaturesPanelProps) {
  const validImages = useMemo(
    () => images.filter((img) => typeof img === "string" && img.trim().length > 0),
    [images]
  );
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  if (validImages.length === 0 && !userPhoto) return null;

  const selectedImage =
    selectedIndex !== null && selectedIndex >= 0 && selectedIndex < validImages.length
      ? validImages[selectedIndex]
      : null;

  return (
    <div className="fixed left-4 top-1/2 -translate-y-1/2 z-20 pointer-events-auto flex gap-4">
      {/* Panel de foto del usuario */}
      {userPhoto && (
        <div className="relative w-48 h-48 rounded-xl bg-black/35 backdrop-blur-sm border border-white/20 overflow-hidden shadow-2xl">
          <div className="absolute top-2 left-2 z-30 px-2 py-1 rounded bg-black/50 text-white text-xs">
            Foto original
          </div>
          <Image
            src={userPhoto}
            alt="Foto del usuario"
            fill
            unoptimized
            className="absolute inset-0 w-full h-full object-cover"
          />
        </div>
      )}

      {/* Panel de caricaturas */}
      {validImages.length > 0 && (
        <div className="relative w-100 h-100 rounded-xl bg-black/35 backdrop-blur-sm border border-white/20 overflow-hidden shadow-2xl">
          {selectedImage ? (
            <>
              <button
                type="button"
                onClick={() => setSelectedIndex(null)}
                className="absolute left-2 top-2 z-30 w-9 h-9 rounded-full bg-black/45 text-white text-xl leading-none hover:bg-black/60 transition-colors"
                aria-label="Volver a cuadrícula"
                title="Volver"
              >
                ←
              </button>

              <Image
                src={selectedImage}
                alt="Caricatura seleccionada"
                fill
                unoptimized
                className="absolute inset-0 w-full h-full object-contain"
              />

              <button
                type="button"
                onClick={() => window.print()}
                className="absolute bottom-3 left-1/2 -translate-x-1/2 z-30 px-5 py-2 rounded-full bg-blue-500/50 text-black font-semibold border border-blue-700/50 hover:bg-blue-500/70 transition-colors"
              >
                Print
              </button>
            </>
          ) : validImages.length === 1 ? (
            <>
              <div className="absolute top-2 left-2 z-30 px-2 py-1 rounded bg-black/50 text-white text-xs">
                Caricatura
              </div>
              <Image
                src={validImages[0]}
                alt="Caricatura"
                fill
                unoptimized
                className="absolute inset-0 w-full h-full object-contain"
              />
              <button
                type="button"
                onClick={() => window.print()}
                className="absolute bottom-3 left-1/2 -translate-x-1/2 z-30 px-5 py-2 rounded-full bg-blue-500/50 text-black font-semibold border border-blue-700/50 hover:bg-blue-500/70 transition-colors"
              >
                Print
              </button>
            </>
          ) : (
            <div className="grid grid-cols-2 grid-rows-2 gap-2 p-2 w-full h-full">
              {validImages.slice(0, 4).map((img, index) => (
                <button
                  key={`${index}-${img.slice(0, 24)}`}
                  type="button"
                  onClick={() => setSelectedIndex(index)}
                  className="relative rounded-lg overflow-hidden border border-white/25 bg-black/30 hover:border-white/50 transition-colors"
                  aria-label={`Seleccionar caricatura ${index + 1}`}
                  title={`Caricatura ${index + 1}`}
                >
                  <Image
                    src={img}
                    alt={`Caricatura ${index + 1}`}
                    fill
                    unoptimized
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

