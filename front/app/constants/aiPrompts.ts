/**
 * Prompts y mensajes que se envían automáticamente a la IA
 * 
 * Este archivo centraliza todos los textos que se envían a GPT Realtime API
 * para facilitar el mantenimiento y ajuste de los prompts.
 */

/**
 * Mensaje que se envía automáticamente cuando se detecta que el usuario
 * quiere tomarse una foto y se necesita su autorización
 */
export const PHOTO_AUTHORIZATION_PROMPT = 
  "Necesitamos la autorización de un usuario para hacerse una foto, por lo que quiero que digas una frase graciosa que explique que, debido a la ley de protección de datos, necesitamos que nos autorice a hacerse una foto escribiendo su email y que, además, le enviaremos el resultado por email, pero SOLO dime la frase, no me des más explicaciones";

/**
 * Mapa de todos los prompts disponibles
 * Útil para referencia y para futuras expansiones
 */
export const AI_PROMPTS = {
  photoAuthorization: PHOTO_AUTHORIZATION_PROMPT,
  // Aquí puedes agregar más prompts en el futuro
  // ejemplo: "otroPrompt": "Texto del prompt...",
} as const;

/**
 * Tipo para los nombres de los prompts
 */
export type PromptName = keyof typeof AI_PROMPTS;

