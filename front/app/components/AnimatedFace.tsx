"use client";

import { useEffect, useState, useRef } from "react";
import Image from "next/image";

const faces = [
  { src: "/faces/face_neutral.svg", duration: 1500 }, // 1.5s
  { src: "/faces/face_a.svg", duration: 1000 }, // 1s
  { src: "/faces/face_neutral.svg", duration: 500 }, // 0.5s
  { src: "/faces/face_o.svg", duration: 1000 }, // 1s
  { src: "/faces/face_neutral.svg", duration: 1000 }, // 1s
];

export default function AnimatedFace() {
  const [currentFaceIndex, setCurrentFaceIndex] = useState(0);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const scheduleNext = () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      
      timeoutRef.current = setTimeout(() => {
        setCurrentFaceIndex((prevIndex) => (prevIndex + 1) % faces.length);
      }, faces[currentFaceIndex].duration);
    };

    scheduleNext();

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [currentFaceIndex]);

  return (
    <div className="relative flex justify-center items-center w-[600px] h-[600px]">
      {faces.map((face, index) => (
        <Image
          key={`${face.src}-${index}`}
          src={face.src}
          alt={`Face ${index}`}
          width={600}
          height={600}
          className={`absolute transition-opacity duration-200 ${
            index === currentFaceIndex ? "opacity-100" : "opacity-0"
          }`}
        />
      ))}
    </div>
  );
}

