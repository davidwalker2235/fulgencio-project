import { SESSION_CONFIG } from "../constants";
import { WebSocketMessage, SessionConfig } from "../types";

/**
 * Servicio para manejar la comunicación WebSocket
 */
export class WebSocketService {
  private ws: WebSocket | null = null;
  private messageHandlers: Map<string, (data: any) => void> = new Map();
  private connectionHandlers: {
    onOpen?: () => void;
    onClose?: () => void;
    onError?: (error: Error) => void;
  } = {};

  connect(url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(url);

        this.ws.onopen = () => {
          console.log("🔌 WebSocket abierto, inicializando sesión...");
          this.initializeSession();
          // Disparar handler de conexión
          // Los handlers ya deberían estar registrados antes de conectar
          console.log("📢 Disparando onOpen handler, handlers registrados:", !!this.connectionHandlers.onOpen);
          this.connectionHandlers.onOpen?.();
          resolve();
        };

        this.ws.onmessage = (event) => {
          this.handleMessage(event);
        };

        this.ws.onerror = (error) => {
          console.error("❌ Error en WebSocket:", error);
          const err = new Error("Error en la conexión WebSocket");
          this.connectionHandlers.onError?.(err);
          reject(err);
        };

        this.ws.onclose = () => {
          console.log("🔌 WebSocket cerrado");
          this.connectionHandlers.onClose?.();
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  private initializeSession() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    // Inicializar la sesión con GPT Realtime
    this.send({
      type: "session.update",
      session: {
        ...SESSION_CONFIG,
        modalities: [...SESSION_CONFIG.modalities],
        turn_detection: { ...SESSION_CONFIG.turn_detection },
        input_audio_transcription: { ...SESSION_CONFIG.input_audio_transcription },
      } as SessionConfig,
    });

    // Solicitar respuesta inicial
    this.send({
      type: "response.create",
    });
  }

  private async handleMessage(event: MessageEvent) {
    try {
      if (event.data instanceof Blob) {
        const handler = this.messageHandlers.get("audio");
        if (handler) {
          console.log("🔊 Audio recibido, reproduciendo...");
          handler(event.data);
        } else {
          console.warn("⚠️ Audio recibido pero no hay handler registrado");
        }
      } else {
        const data: WebSocketMessage = JSON.parse(event.data);
        const messageType = data.type;
        const handler = this.messageHandlers.get(messageType);
        
        if (handler) {
          console.log(`📨 Mensaje recibido: ${messageType}, handler encontrado`);
          handler(data);
        } else {
          // Loggear mensajes importantes para debug (filtrar algunos tipos comunes)
          if (
            !messageType.includes("session") && 
            !messageType.includes("response.audio_transcript") &&
            messageType !== "response.created" &&
            messageType !== "response.done"
          ) {
            console.log(`📨 Mensaje recibido: ${messageType}, sin handler registrado`, data);
          }
        }
        // También llamar al handler genérico si existe
        const genericHandler = this.messageHandlers.get("*");
        if (genericHandler) {
          genericHandler(data);
        }
      }
    } catch (error) {
      console.error("Error procesando mensaje:", error);
    }
  }

  send(data: WebSocketMessage | ArrayBuffer): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn("WebSocket no está abierto");
      return;
    }

    try {
      if (data instanceof ArrayBuffer) {
        this.ws.send(data);
      } else {
        this.ws.send(JSON.stringify(data));
      }
    } catch (error) {
      console.error("Error enviando mensaje:", error);
    }
  }

  onMessage(type: string, handler: (data: any) => void): void {
    console.log(`📝 Registrando handler para tipo: ${type}`);
    this.messageHandlers.set(type, handler);
  }

  onConnection(handlers: {
    onOpen?: () => void;
    onClose?: () => void;
    onError?: (error: Error) => void;
  }): void {
    this.connectionHandlers = handlers;
  }

  close(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.messageHandlers.clear();
    this.connectionHandlers = {};
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  getReadyState(): number {
    return this.ws?.readyState ?? WebSocket.CLOSED;
  }
}

