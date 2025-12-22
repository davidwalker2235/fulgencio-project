/**
 * Ejemplos de uso del hook useFirebase
 * 
 * Este archivo muestra cómo usar el hook useFirebase para diferentes operaciones
 */

import { useFirebase } from "./useFirebase";
import { Message } from "../types";

// Ejemplo 1: Guardar una conversación
export function useSaveConversation() {
  const { write, push, loading, error } = useFirebase();

  const saveConversation = async (userId: string, messages: Message[]) => {
    try {
      // Opción 1: Guardar con ID específico
      await write(`conversations/${userId}/current`, {
        messages,
        updatedAt: new Date().toISOString(),
      });

      // Opción 2: Guardar con ID automático (push)
      const conversationId = await push(`conversations/${userId}/history`, {
        messages,
        createdAt: new Date().toISOString(),
      });

      return conversationId;
    } catch (err) {
      console.error("Error guardando conversación:", err);
      throw err;
    }
  };

  return { saveConversation, loading, error };
}

// Ejemplo 2: Leer datos
export function useLoadConversation() {
  const { read, loading, error } = useFirebase();

  const loadConversation = async (userId: string, conversationId: string) => {
    try {
      const conversation = await read<{ messages: Message[] }>(
        `conversations/${userId}/history/${conversationId}`
      );
      return conversation?.messages || [];
    } catch (err) {
      console.error("Error cargando conversación:", err);
      throw err;
    }
  };

  return { loadConversation, loading, error };
}

// Ejemplo 3: Suscripción en tiempo real
// import { useState, useEffect } from "react";
// export function useRealtimeConversation(userId: string) {
//   const { subscribe, loading, error } = useFirebase();
//
//   const [messages, setMessages] = useState<Message[]>([]);
//
//   useEffect(() => {
//     const unsubscribe = subscribe<{ messages: Message[] }>(
//       `conversations/${userId}/current`,
//       (data) => {
//         if (data?.messages) {
//           setMessages(data.messages);
//         }
//       }
//     );
//
//     return unsubscribe;
//   }, [userId, subscribe]);
//
//   return { messages, loading, error };
// }

// Ejemplo 4: Actualizar datos parcialmente
export function useUpdateConversation() {
  const { update, loading, error } = useFirebase();

  const updateLastMessage = async (
    userId: string,
    message: Message
  ) => {
    try {
      await update(`conversations/${userId}/current/lastMessage`, {
        content: message.content,
        timestamp: message.timestamp.toISOString(),
      });
    } catch (err) {
      console.error("Error actualizando mensaje:", err);
      throw err;
    }
  };

  return { updateLastMessage, loading, error };
}

// Ejemplo 5: Eliminar datos
export function useDeleteConversation() {
  const { remove, loading, error } = useFirebase();

  const deleteConversation = async (
    userId: string,
    conversationId: string
  ) => {
    try {
      await remove(`conversations/${userId}/history/${conversationId}`);
    } catch (err) {
      console.error("Error eliminando conversación:", err);
      throw err;
    }
  };

  return { deleteConversation, loading, error };
}

