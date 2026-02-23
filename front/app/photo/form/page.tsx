"use client";

import { useEffect, useState, FormEvent } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";

export default function PhotoFormPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
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

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    if (!validateEmail(email)) {
      setEmailError("Invalid email address");
      return;
    }

    setIsSubmitting(true);
    
    // Navegar a la pantalla de captura con los datos del formulario
    const params = new URLSearchParams({
      name: fullName.trim(),
      email: email.trim(),
    });

    // Si por cualquier motivo la navegación SPA falla (p.ej. error cargando el chunk),
    // no dejamos el botón bloqueado para siempre.
    const unlockTimer = window.setTimeout(() => {
      setIsSubmitting(false);
    }, 1500);

    try {
      router.push(`/photo/capture?${params.toString()}`);
    } catch (err) {
      console.error("Error navegando a /photo/capture:", err);
      window.location.assign(`/photo/capture?${params.toString()}`);
    } finally {
      window.clearTimeout(unlockTimer);
    }
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
              placeholder="Your full name"
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

          {/* Take a Photo Button */}
          <button
            type="submit"
            disabled={!isFormValid || isSubmitting}
            className={`w-full py-3 px-6 rounded-lg font-semibold text-base transition-all ${
              isFormValid && !isSubmitting
                ? "bg-white text-[#033778] hover:bg-gray-100 active:bg-gray-200"
                : "bg-gray-400 text-gray-600 cursor-not-allowed"
            }`}
          >
            {isSubmitting ? "Processing..." : "Take a photo"}
          </button>
        </form>
      </div>
    </div>
  );
}
