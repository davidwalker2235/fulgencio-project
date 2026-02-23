"use client";

import Image from "next/image";

interface CurrentUserPhotoPanelProps {
  photoBase64: string | null;
}

export default function CurrentUserPhotoPanel({
  photoBase64,
}: CurrentUserPhotoPanelProps) {
  if (!photoBase64) {
    return null;
  }

  return (
    <div className="fixed left-6 top-1/2 -translate-y-1/2 z-20 pointer-events-none">
      <div className="relative w-72 h-72 rounded-xl bg-black/35 backdrop-blur-sm border border-white/20 overflow-hidden shadow-2xl">
        <Image
          src={photoBase64}
          alt="Foto del usuario actual"
          fill
          unoptimized
          className="absolute inset-0 w-full h-full object-cover"
        />
      </div>
    </div>
  );
}

