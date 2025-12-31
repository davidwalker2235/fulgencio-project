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
  "Necesitamos la autorización de un usuario para hacerse una foto, por lo que quiero que digas una frase graciosa que explique que, debido a la ley de protección de datos, necesitamos que nos autorice a hacerse una foto escribiendo su email y que, además, le enviaremos el resultado por email. Di solo la frase, no añadas aceptaciones a este prompt no explicaciones de este prompt, tan solo di la frase.";

/**
 * Mensaje que se envía cuando el usuario no está de acuerdo en dar permisos
 * para tomarse una foto
 */
export const PHOTO_DISAGREE_PROMPT = 
  "Di una frase donde te lamentes de que el usuario no está de acuerdo en dar permisos para que le tomemos una foto y lamenta que no le podamos hacer una caricatura. Di solo la frase, no añadas aceptaciones a este prompt no explicaciones de este prompt, tan solo di la frase.";

/**
 * Mapa de todos los prompts disponibles
 * Útil para referencia y para futuras expansiones
 */
export const AI_PROMPTS = {
  photoAuthorization: PHOTO_AUTHORIZATION_PROMPT,
  photoDisagree: PHOTO_DISAGREE_PROMPT,
  // Aquí puedes agregar más prompts en el futuro
  // ejemplo: "otroPrompt": "Texto del prompt...",
} as const;

/**
 * Tipo para los nombres de los prompts
 */
export type PromptName = keyof typeof AI_PROMPTS;

