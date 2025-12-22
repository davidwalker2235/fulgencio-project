import { useState, useEffect, useCallback, useRef } from "react";
import { database } from "../../firebaseConfig";
import {
  ref,
  set,
  get,
  push,
  update,
  remove,
  onValue,
  off,
  DataSnapshot,
  DatabaseReference,
  Query,
} from "firebase/database";

interface UseFirebaseReturn {
  // Operaciones básicas
  write: (path: string, data: any) => Promise<void>;
  read: <T = any>(path: string) => Promise<T | null>;
  update: (path: string, data: Partial<any>) => Promise<void>;
  remove: (path: string) => Promise<void>;
  
  // Operaciones con push (genera ID automático)
  push: (path: string, data: any) => Promise<string | null>;
  
  // Listeners en tiempo real
  subscribe: <T = any>(
    path: string,
    callback: (data: T | null) => void
  ) => () => void;
  
  // Estado
  loading: boolean;
  error: string | null;
  clearError: () => void;
}

/**
 * Hook para gestionar conexiones y operaciones con Firebase Realtime Database
 */
export function useFirebase(): UseFirebaseReturn {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listenersRef = useRef<Map<string, (snapshot: DataSnapshot) => void>>(
    new Map()
  );

  // Limpiar listeners al desmontar
  useEffect(() => {
    return () => {
      listenersRef.current.forEach((listener, path) => {
        const dbRef = ref(database, path);
        off(dbRef, "value", listener);
      });
      listenersRef.current.clear();
    };
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const write = useCallback(async (path: string, data: any) => {
    try {
      setLoading(true);
      setError(null);
      const dbRef = ref(database, path);
      await set(dbRef, data);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Error escribiendo en Firebase";
      setError(errorMessage);
      console.error("Error escribiendo en Firebase:", err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const read = useCallback(async <T = any>(path: string): Promise<T | null> => {
    try {
      setLoading(true);
      setError(null);
      const dbRef = ref(database, path);
      const snapshot = await get(dbRef);
      
      if (snapshot.exists()) {
        return snapshot.val() as T;
      }
      return null;
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Error leyendo de Firebase";
      setError(errorMessage);
      console.error("Error leyendo de Firebase:", err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const updateData = useCallback(
    async (path: string, data: Partial<any>) => {
      try {
        setLoading(true);
        setError(null);
        const dbRef = ref(database, path);
        await update(dbRef, data);
      } catch (err) {
        const errorMessage =
          err instanceof Error
            ? err.message
            : "Error actualizando en Firebase";
        setError(errorMessage);
        console.error("Error actualizando en Firebase:", err);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const removeData = useCallback(async (path: string) => {
    try {
      setLoading(true);
      setError(null);
      const dbRef = ref(database, path);
      await remove(dbRef);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Error eliminando de Firebase";
      setError(errorMessage);
      console.error("Error eliminando de Firebase:", err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const pushData = useCallback(
    async (path: string, data: any): Promise<string | null> => {
      try {
        setLoading(true);
        setError(null);
        const dbRef = ref(database, path);
        const newRef = push(dbRef);
        await set(newRef, data);
        return newRef.key;
      } catch (err) {
        const errorMessage =
          err instanceof Error
            ? err.message
            : "Error haciendo push en Firebase";
        setError(errorMessage);
        console.error("Error haciendo push en Firebase:", err);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const subscribe = useCallback(
    <T = any>(
      path: string,
      callback: (data: T | null) => void
    ): (() => void) => {
      try {
        setError(null);
        const dbRef = ref(database, path);

        const listener = (snapshot: DataSnapshot) => {
          if (snapshot.exists()) {
            callback(snapshot.val() as T);
          } else {
            callback(null);
          }
        };

        // Guardar listener para poder limpiarlo después
        listenersRef.current.set(path, listener);
        onValue(dbRef, listener);

        // Retornar función de limpieza
        return () => {
          off(dbRef, "value", listener);
          listenersRef.current.delete(path);
        };
      } catch (err) {
        const errorMessage =
          err instanceof Error
            ? err.message
            : "Error suscribiéndose a Firebase";
        setError(errorMessage);
        console.error("Error suscribiéndose a Firebase:", err);
        return () => {}; // Retornar función vacía si hay error
      }
    },
    []
  );

  return {
    write,
    read,
    update: updateData,
    remove: removeData,
    push: pushData,
    subscribe,
    loading,
    error,
    clearError,
  };
}

