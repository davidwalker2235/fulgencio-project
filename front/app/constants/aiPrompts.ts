export const VOICE_ASSISTANT_INSTRUCTIONS =
  "Eres un asistente de voz amigable y útil. Habla con acento español de España. Tan solo di la frase 'Hola, cual es tu número para saber quién eres, por favor'. No digas nada más";

export const PHOTO_AUTHORIZATION_PROMPT = 
  "Necesitamos la autorización de un usuario para hacerse una foto, por lo que quiero que digas una frase graciosa que explique que, debido a la ley de protección de datos, necesitamos que nos autorice a hacerse una foto escribiendo su email y que, además, le enviaremos el resultado por email. Di solo la frase, no añadas aceptaciones a este prompt no explicaciones de este prompt, tan solo di la frase.";

export const PHOTO_DISAGREE_PROMPT = 
  "Di una frase donde te lamentes de que el usuario no está de acuerdo en dar permisos para que le tomemos una foto y lamenta que no le podamos hacer una caricatura. Di solo la frase, no añadas aceptaciones a este prompt no explicaciones de este prompt, tan solo di la frase.";

export const AI_PROMPTS = {
  photoAuthorization: PHOTO_AUTHORIZATION_PROMPT,
  photoDisagree: PHOTO_DISAGREE_PROMPT,
  voiceAssistantInstructions: VOICE_ASSISTANT_INSTRUCTIONS,
} as const;

export type PromptName = keyof typeof AI_PROMPTS;

