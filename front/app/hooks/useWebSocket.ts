import { useRef, useCallback, useEffect } from "react";
import { WebSocketService } from "../services/websocketService";
import { WebSocketMessage } from "../types";

interface UseWebSocketReturn {
  connect: (url: string) => Promise<void>;
  disconnect: () => void;
  send: (data: WebSocketMessage | ArrayBuffer) => void;
  onMessage: (type: string, handler: (data: any) => void) => void;
  onConnection: (handlers: {
    onOpen?: () => void;
    onClose?: () => void;
    onError?: (error: Error) => void;
  }) => void;
  isConnected: () => boolean;
  getService: () => WebSocketService | null;
}

/**
 * Hook para manejar la conexión WebSocket
 */
export function useWebSocket(): UseWebSocketReturn {
  const wsServiceRef = useRef<WebSocketService | null>(null);
  const pendingConnectionHandlersRef = useRef<{
    onOpen?: () => void;
    onClose?: () => void;
    onError?: (error: Error) => void;
  } | null>(null);
  const pendingMessageHandlersRef = useRef<Map<string, (data: any) => void>>(new Map());

  useEffect(() => {
    return () => {
      // Limpiar conexión al desmontar
      if (wsServiceRef.current) {
        wsServiceRef.current.close();
        wsServiceRef.current = null;
      }
    };
  }, []);

  const connect = useCallback(async (url: string) => {
    // Si ya existe un servicio, cerrarlo primero
    if (wsServiceRef.current) {
      wsServiceRef.current.close();
    }
    const service = new WebSocketService();
    wsServiceRef.current = service;
    
    // Aplicar handlers de conexión pendientes si existen
    if (pendingConnectionHandlersRef.current) {
      service.onConnection(pendingConnectionHandlersRef.current);
      pendingConnectionHandlersRef.current = null;
    }
    
    // Aplicar handlers de mensajes pendientes si existen
    console.log(`📝 Aplicando ${pendingMessageHandlersRef.current.size} handlers pendientes`);
    pendingMessageHandlersRef.current.forEach((handler, type) => {
      console.log(`📝 Aplicando handler pendiente para tipo: ${type}`);
      service.onMessage(type, handler);
    });
    pendingMessageHandlersRef.current.clear();
    
    await service.connect(url);
  }, []);

  const disconnect = useCallback(() => {
    if (wsServiceRef.current) {
      wsServiceRef.current.close();
      wsServiceRef.current = null;
    }
    pendingConnectionHandlersRef.current = null;
    pendingMessageHandlersRef.current.clear();
  }, []);

  const send = useCallback((data: WebSocketMessage | ArrayBuffer) => {
    if (wsServiceRef.current) {
      wsServiceRef.current.send(data);
    }
  }, []);

  const onMessage = useCallback(
    (type: string, handler: (data: any) => void) => {
      console.log(`📝 Registrando handler para tipo: ${type}, servicio existe: ${!!wsServiceRef.current}`);
      if (wsServiceRef.current) {
        // Si el servicio ya existe, aplicar directamente
        wsServiceRef.current.onMessage(type, handler);
        console.log(`✅ Handler aplicado directamente al servicio existente`);
      } else {
        // Si no existe, guardar para aplicar cuando se cree
        pendingMessageHandlersRef.current.set(type, handler);
        console.log(`💾 Handler guardado para aplicar cuando se cree el servicio`);
      }
    },
    []
  );

  const onConnection = useCallback(
    (handlers: {
      onOpen?: () => void;
      onClose?: () => void;
      onError?: (error: Error) => void;
    }) => {
      if (wsServiceRef.current) {
        // Si el servicio ya existe, aplicar directamente
        wsServiceRef.current.onConnection(handlers);
      } else {
        // Si no existe, guardar para aplicar cuando se cree
        pendingConnectionHandlersRef.current = handlers;
      }
    },
    []
  );

  const isConnected = useCallback(() => {
    return wsServiceRef.current?.isConnected() ?? false;
  }, []);

  const getService = useCallback(() => {
    return wsServiceRef.current;
  }, []);

  return {
    connect,
    disconnect,
    send,
    onMessage,
    onConnection,
    isConnected,
    getService,
  };
}

