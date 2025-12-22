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
} from "firebase/database";

/**
 * Servicio para operaciones avanzadas con Firebase Realtime Database
 */
export class FirebaseService {
  /**
   * Escribe datos en una ruta específica
   */
  static async write<T>(path: string, data: T): Promise<void> {
    const dbRef = ref(database, path);
    await set(dbRef, data);
  }

  /**
   * Lee datos de una ruta específica
   */
  static async read<T>(path: string): Promise<T | null> {
    const dbRef = ref(database, path);
    const snapshot = await get(dbRef);
    return snapshot.exists() ? (snapshot.val() as T) : null;
  }

  /**
   * Actualiza datos parcialmente en una ruta específica
   */
  static async update(path: string, data: Partial<any>): Promise<void> {
    const dbRef = ref(database, path);
    await update(dbRef, data);
  }

  /**
   * Elimina datos de una ruta específica
   */
  static async delete(path: string): Promise<void> {
    const dbRef = ref(database, path);
    await remove(dbRef);
  }

  /**
   * Agrega datos con ID automático (push)
   */
  static async push<T>(path: string, data: T): Promise<string | null> {
    const dbRef = ref(database, path);
    const newRef = push(dbRef);
    await set(newRef, data);
    return newRef.key;
  }

  /**
   * Suscribe a cambios en tiempo real en una ruta
   */
  static subscribe<T>(
    path: string,
    callback: (data: T | null) => void
  ): () => void {
    const dbRef = ref(database, path);
    const listener = (snapshot: DataSnapshot) => {
      if (snapshot.exists()) {
        callback(snapshot.val() as T);
      } else {
        callback(null);
      }
    };

    onValue(dbRef, listener);

    // Retornar función de limpieza
    return () => {
      off(dbRef, "value", listener);
    };
  }

  /**
   * Obtiene una referencia a una ruta específica
   */
  static getRef(path: string): DatabaseReference {
    return ref(database, path);
  }
}

