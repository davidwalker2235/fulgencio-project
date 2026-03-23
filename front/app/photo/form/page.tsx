"use client";

import { useEffect, useRef, useState, FormEvent, ChangeEvent } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";

export default function PhotoFormPage() {
  const router = useRouter();
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [linkedIn, setLinkedIn] = useState("");
  const [emailError, setEmailError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Prefetch para que el cambio a /photo/capture sea inmediato
  useEffect(() => {
    router.prefetch("/photo/capture");
  }, [router]);

  // Validar email con regex
  const validateEmail = (emailValue: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(emailValue);
  };

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setEmail(value);
    if (emailError && value) {
      // Limpiar error si el usuario está escribiendo
      setEmailError("");
    }
  };

  const handleEmailBlur = () => {
    if (email && !validateEmail(email)) {
      setEmailError("Invalid email address");
    } else {
      setEmailError("");
    }
  };

  const isFormValid = fullName.trim() !== "" && email.trim() !== "" && validateEmail(email);

  const buildCaptureParams = () => {
    const params = new URLSearchParams({
      name: fullName.trim(),
      email: email.trim(),
    });
    const linkedInTrimmed = linkedIn.trim();
    if (linkedInTrimmed) {
      params.set("linkedIn", linkedInTrimmed);
    }
    return params;
  };

  const navigateToCapture = (source: "camera" | "gallery") => {
    const params = buildCaptureParams();
    params.set("source", source);
    const targetUrl = `/photo/capture?${params.toString()}`;

    // Si por cualquier motivo la navegación SPA falla (p.ej. error cargando el chunk),
    // no dejamos el botón bloqueado para siempre.
    const unlockTimer = window.setTimeout(() => {
      setIsSubmitting(false);
    }, 1500);

    try {
      router.push(targetUrl);
    } catch (err) {
      console.error("Error navegando a /photo/capture:", err);
      window.location.assign(targetUrl);
    } finally {
      window.clearTimeout(unlockTimer);
    }
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!validateEmail(email)) {
      setEmailError("Invalid email address");
      return;
    }

    setIsSubmitting(true);
    navigateToCapture("camera");
  };

  const handleGalleryButton = () => {
    if (!isFormValid || isSubmitting) {
      return;
    }
    galleryInputRef.current?.click();
  };

  const handleGalleryFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      return;
    }

    setIsSubmitting(true);
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const dataUrl = String(reader.result || "");
        if (!dataUrl) {
          throw new Error("No se pudo leer la imagen seleccionada");
        }
        sessionStorage.setItem("photo:selectedImageDataUrl", dataUrl);
        navigateToCapture("gallery");
      } catch (error) {
        console.error("Error preparando imagen de galería:", error);
        setIsSubmitting(false);
      } finally {
        // Permite seleccionar la misma imagen de nuevo si hace falta.
        e.target.value = "";
      }
    };
    reader.onerror = () => {
      console.error("Error leyendo archivo de galería");
      setIsSubmitting(false);
      e.target.value = "";
    };
    reader.readAsDataURL(file);
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

      {/* Form Container */}
      <div className="flex-1 flex flex-col items-center justify-start px-4 pb-8">
        <form onSubmit={handleSubmit} className="w-full max-w-md space-y-6 mt-4" noValidate>
          {/* Lorem Ipsum Text */}
          <div className="text-white text-sm sm:text-base leading-relaxed text-center px-2">
            <p>
            Please enter your name and email so that our robot can identify you.
            </p>
            <p className="mt-2">
            Your photo will be deleted once the experience is finished.
            </p>
            <p className="mt-2">
            Once the photo has been processed, you will be given a number that you will need to provide to the robot.
            </p>
            <p className="mt-2">
            Please, don't forget the number.
            </p>
          </div>

          {/* Full Name Input */}
          <div className="w-full">
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Your Nickname"
              className="w-full px-4 py-3 rounded-lg bg-white text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-[#033778]"
              required
            />
          </div>

          {/* Email Input */}
          <div className="w-full">
            <input
              type="email"
              value={email}
              onChange={handleEmailChange}
              onBlur={handleEmailBlur}
              placeholder="Your email"
              className={`w-full px-4 py-3 rounded-lg bg-white text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-[#033778] ${
                emailError ? "border-2 border-red-500" : ""
              }`}
              required
            />
            {emailError && (
              <p className="mt-2 text-red-400 text-sm">{emailError}</p>
            )}
          </div>

          {/* LinkedIn URL Input (opcional) */}
          <div className="w-full">
            <input
              type="url"
              value={linkedIn}
              onChange={(e) => setLinkedIn(e.target.value)}
              placeholder="LinkedIn profile URL (optional)"
              className="w-full px-4 py-3 rounded-lg bg-white text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-[#033778]"
            />
          </div>

          <input
            ref={galleryInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleGalleryFileChange}
          />

          {/* Action Buttons */}
          <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="submit"
              disabled={!isFormValid || isSubmitting}
              className={`w-full py-3 px-4 rounded-lg font-semibold text-base transition-all ${
                isFormValid && !isSubmitting
                  ? "bg-white text-[#033778] hover:bg-gray-100 active:bg-gray-200"
                  : "bg-gray-400 text-gray-600 cursor-not-allowed"
              }`}
            >
              {isSubmitting ? "Processing..." : "Take a photo"}
            </button>
            <button
              type="button"
              onClick={handleGalleryButton}
              disabled={!isFormValid || isSubmitting}
              className={`w-full py-3 px-4 rounded-lg font-semibold text-base transition-all ${
                isFormValid && !isSubmitting
                  ? "bg-white text-[#033778] hover:bg-gray-100 active:bg-gray-200"
                  : "bg-gray-400 text-gray-600 cursor-not-allowed"
              }`}
            >
              {isSubmitting ? "Processing..." : "Choose from your gallery"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
