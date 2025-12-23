import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useFirebase } from "./useFirebase";

interface Credentials {
  user: string;
  pass: string;
}

interface UseAuthReturn {
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  error: string | null;
  clearError: () => void;
}

const AUTH_KEY = "isAuthenticated";
const CREDENTIALS_KEY = "savedCredentials";

/**
 * Hook para gestionar la autenticación y el localStorage
 */
export function useAuth(): UseAuthReturn {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const { read } = useFirebase();

  // Verificar autenticación al cargar
  useEffect(() => {
    const checkAuth = () => {
      try {
        const authStatus = localStorage.getItem(AUTH_KEY);
        const savedCredentials = localStorage.getItem(CREDENTIALS_KEY);

        if (authStatus === "true" && savedCredentials) {
          // Si hay credenciales guardadas y está marcado como autenticado
          setIsAuthenticated(true);
        } else {
          setIsAuthenticated(false);
        }
      } catch (err) {
        console.error("Error verificando autenticación:", err);
        setIsAuthenticated(false);
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const login = useCallback(
    async (username: string, password: string): Promise<boolean> => {
      setError(null);
      setIsLoading(true);

      try {
        // Leer las credenciales desde Firebase
        const credentials = await read<Credentials>("credentials");

        if (!credentials) {
          setError("Error al conectar con la base de datos");
          setIsLoading(false);
          return false;
        }

        // Verificar las credenciales
        if (credentials.user === username && credentials.pass === password) {
          // Guardar estado de autenticación y credenciales en localStorage
          localStorage.setItem(AUTH_KEY, "true");
          localStorage.setItem(
            CREDENTIALS_KEY,
            JSON.stringify({ user: username, pass: password })
          );
          setIsAuthenticated(true);
          setIsLoading(false);
          return true;
        } else {
          setError("El usuario o la contraseña son incorrectos");
          setIsLoading(false);
          return false;
        }
      } catch (err) {
        setError("Error al verificar las credenciales");
        console.error("Error en login:", err);
        setIsLoading(false);
        return false;
      }
    },
    [read]
  );

  const logout = useCallback(() => {
    localStorage.removeItem(AUTH_KEY);
    localStorage.removeItem(CREDENTIALS_KEY);
    setIsAuthenticated(false);
    router.push("/login");
  }, [router]);

  return {
    isAuthenticated,
    isLoading,
    login,
    logout,
    error,
    clearError,
  };
}

