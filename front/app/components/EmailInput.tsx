"use client";

import { useState, KeyboardEvent, useEffect } from "react";

interface EmailInputProps {
  onEmailSubmit: (email: string) => void;
  onCancel: () => void;
  onEmailChange?: (email: string, isValid: boolean) => void;
  currentEmail?: string;
}

export default function EmailInput({ onEmailSubmit, onCancel, onEmailChange, currentEmail }: EmailInputProps) {
  const [email, setEmail] = useState(currentEmail || "");
  const [isValid, setIsValid] = useState(false);
  
  // Validar email
  const validateEmail = (emailValue: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(emailValue);
  };

  // Sincronizar con currentEmail si cambia externamente (solo al montar)
  useEffect(() => {
    if (currentEmail !== undefined && currentEmail !== email) {
      setEmail(currentEmail);
      const valid = validateEmail(currentEmail);
      setIsValid(valid);
      if (onEmailChange) {
        onEmailChange(currentEmail, valid);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const valid = validateEmail(value);
    setEmail(value);
    setIsValid(valid);
    if (onEmailChange) {
      onEmailChange(value, valid);
    }
  };

  const handleSubmit = () => {
    if (isValid && email.trim()) {
      onEmailSubmit(email.trim());
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && isValid) {
      handleSubmit();
    }
  };

  return (
    <div className="fixed top-30 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50 w-[30%] pointer-events-auto">
      <div className="flex flex-col gap-4">
        <input
          id="email-input"
          type="email"
          value={email}
          onChange={handleEmailChange}
          onKeyDown={handleKeyDown}
          placeholder="tu@email.com"
          className="w-full px-6 py-4 text-lg bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-full border-2 border-zinc-300 dark:border-zinc-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
          autoFocus
        />
        {email && !isValid && (
          <p className="text-sm text-red-500 text-center">Por favor, introduce un email válido</p>
        )}
      </div>
    </div>
  );
}

