import asyncio
import base64
import json
import os
import re
import sys
import unicodedata
import urllib.error
import urllib.request
from typing import Any, Optional

import websockets
from dotenv import load_dotenv
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from firebase_admin import credentials, db, initialize_app
from fastapi.middleware.cors import CORSMiddleware
from openai import AzureOpenAI

load_dotenv()

app = FastAPI(title="GPT Realtime Voice API")

cors_origins = os.getenv(
    "CORS_ORIGINS",
    "http://localhost:3000,http://localhost:8080,http://127.0.0.1:3000,http://127.0.0.1:8080"
).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

AZURE_OPENAI_ENDPOINT = os.getenv("AZURE_OPENAI_ENDPOINT", "")
AZURE_OPENAI_API_KEY = os.getenv("AZURE_OPENAI_API_KEY", "")
AZURE_OPENAI_API_VERSION = os.getenv("AZURE_OPENAI_API_VERSION", "2024-10-01-preview")
MODEL_NAME = os.getenv("MODEL_NAME", "gpt-realtime")
FIREBASE_DATABASE_URL = os.getenv("FIREBASE_DATABASE_URL", "")
FIREBASE_SERVICE_ACCOUNT_PATH = os.getenv("FIREBASE_SERVICE_ACCOUNT_PATH", "")
USER_DATA_API_URL = os.getenv("USER_DATA_API_URL", "").strip()
USER_DATA_API_TIMEOUT_SECONDS = int(os.getenv("USER_DATA_API_TIMEOUT_SECONDS", "5"))
USER_DATA_API_RETRIES = int(os.getenv("USER_DATA_API_RETRIES", "2"))

client: Optional[AzureOpenAI] = None
firebase_app: Optional[Any] = None

if AZURE_OPENAI_ENDPOINT and AZURE_OPENAI_API_KEY:
    client = AzureOpenAI(
        api_key=AZURE_OPENAI_API_KEY,
        api_version=AZURE_OPENAI_API_VERSION,
        azure_endpoint=AZURE_OPENAI_ENDPOINT,
    )


def initialize_firebase():
    """
    Inicializa Firebase Admin SDK (Python) para Realtime Database.
    Documentación base:
    https://firebase.google.com/docs/database/admin/save-data?hl=es-419&authuser=3#python
    """
    global firebase_app

    if not FIREBASE_DATABASE_URL:
        print("⚠️ FIREBASE_DATABASE_URL no configurado.")
        return

    if not FIREBASE_SERVICE_ACCOUNT_PATH:
        print("ℹ️ FIREBASE_SERVICE_ACCOUNT_PATH no configurado. Se usará fallback REST para lectura pública.")
        return

    try:
        cred = credentials.Certificate(FIREBASE_SERVICE_ACCOUNT_PATH)
        firebase_app = initialize_app(cred, {"databaseURL": FIREBASE_DATABASE_URL})
        print("✅ Firebase Admin inicializado correctamente.")
    except Exception as err:
        firebase_app = None
        print(f"⚠️ Error inicializando Firebase Admin: {err}")
        print("ℹ️ Se usará fallback REST para lectura pública.")


def get_user_from_realtime_db(order_number: str) -> Optional[dict[str, Any]]:
    """
    Lee users/{order_number} desde Realtime Database.
    Prioriza Admin SDK; si no hay credenciales, usa REST pública.
    """
    if not FIREBASE_DATABASE_URL:
        return None

    if firebase_app is not None:
        try:
            users_ref = db.reference("users", app=firebase_app)
            value = users_ref.child(order_number).get()
            return value if isinstance(value, dict) else None
        except Exception as err:
            print(f"⚠️ Error leyendo Firebase Admin para {order_number}: {err}")

    # Fallback REST (útil si las reglas permiten lectura pública)
    url = f"{FIREBASE_DATABASE_URL.rstrip('/')}/users/{order_number}.json"
    try:
        with urllib.request.urlopen(url, timeout=5) as response:
            payload = response.read().decode("utf-8")
            value = json.loads(payload) if payload else None
            return value if isinstance(value, dict) else None
    except urllib.error.HTTPError as http_err:
        if http_err.code != 404:
            print(f"⚠️ Error HTTP en Firebase REST para {order_number}: {http_err}")
    except Exception as err:
        print(f"⚠️ Error en Firebase REST para {order_number}: {err}")

    return None


def normalize_text(text: str) -> str:
    """Normaliza texto para detectar números con más robustez."""
    lowered = text.lower().strip()
    normalized = unicodedata.normalize("NFKD", lowered)
    return "".join(ch for ch in normalized if not unicodedata.combining(ch))


def extract_order_number(text: str) -> Optional[str]:
    """
    Extrae número de orden desde frases como:
    - "soy el número 42"
    - "soy el número 4, 2"
    - "mi codigo es cuatro dos"
    """
    if not text:
        return None

    normalized = normalize_text(text)

    # Buscar contexto mínimo para evitar falsos positivos.
    intent_keywords = ("numero", "codigo", "orden", "id", "identificador", "soy")
    if not any(keyword in normalized for keyword in intent_keywords):
        return None

    # 1) Número continuo.
    contiguous_matches = re.findall(r"\b\d{1,6}\b", normalized)
    if contiguous_matches:
        return contiguous_matches[0]

    # 2) Dígitos separados por espacios, comas o guiones.
    separated_matches = re.findall(r"(?:\d[\s,.\-]*){2,6}", normalized)
    for raw in separated_matches:
        digits_only = "".join(ch for ch in raw if ch.isdigit())
        if 1 <= len(digits_only) <= 6:
            return digits_only

    # 3) Número expresado en palabras.
    word_to_digit = {
        "cero": "0",
        "uno": "1",
        "una": "1",
        "dos": "2",
        "tres": "3",
        "cuatro": "4",
        "cinco": "5",
        "seis": "6",
        "siete": "7",
        "ocho": "8",
        "nueve": "9",
    }
    word_pattern = r"\b(?:cero|uno|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve)\b"
    sequence_pattern = rf"(?:{word_pattern})(?:[\s,.\-]+(?:{word_pattern}))*"
    for seq in re.findall(sequence_pattern, normalized):
        words = re.findall(word_pattern, seq)
        if not words:
            continue
        digits = "".join(word_to_digit[w] for w in words if w in word_to_digit)
        if 1 <= len(digits) <= 6:
            return digits

    return None


def build_personalization_instructions(order_number: str, user_data: dict[str, Any]) -> str:
    """Construye instrucciones internas para que la respuesta sea personalizada."""
    raw_name = (
        user_data.get("fullName")
        or user_data.get("name")
        or user_data.get("nombre")
        or "usuario"
    )
    user_name = str(raw_name).strip() or "usuario"
    return (
        "Contexto interno de sesión: usuario identificado por número de orden.\n"
        f"Número de orden verificado: {order_number}.\n"
        f"Nombre del usuario: {user_name}.\n"
        "Reglas obligatorias para esta respuesta:\n"
        f"- Debes dirigirte al usuario por su nombre exacto: {user_name}.\n"
        f"- Si saludas, utiliza explícitamente el nombre: 'Hola {user_name}, ...'.\n"
        "- No uses el número de orden para dirigirte al usuario.\n"
        "- Nunca digas 'Hola número X' ni variantes.\n"
        "Responde de forma personalizada y natural usando estos datos. "
        "No expliques que este contexto viene de un proceso interno."
    )


def send_user_data_to_external_api_sync(order_number: str, user_data: dict[str, Any]) -> bool:
    """
    Envía datos del usuario a una API externa (si está configurada).
    Reintenta en errores temporales.
    """
    if not USER_DATA_API_URL:
        return False

    payload = {
        "orderNumber": order_number,
        "user": user_data,
    }
    body = json.dumps(payload).encode("utf-8")

    last_error: Optional[Exception] = None
    attempts = max(1, USER_DATA_API_RETRIES + 1)

    for _ in range(attempts):
        try:
            request = urllib.request.Request(
                USER_DATA_API_URL,
                data=body,
                headers={"Content-Type": "application/json"},
                method="POST",
            )
            with urllib.request.urlopen(request, timeout=USER_DATA_API_TIMEOUT_SECONDS) as response:
                status = getattr(response, "status", 200)
                if 200 <= status < 300:
                    return True
                last_error = RuntimeError(f"status={status}")
        except Exception as err:
            last_error = err

    if last_error is not None:
        print(f"⚠️ No se pudo enviar datos a API externa: {last_error}")
    return False


initialize_firebase()


@app.get("/")
async def root():
    """Endpoint de salud"""
    return {
        "status": "ok",
        "message": "GPT Realtime Voice API está funcionando",
        "model": MODEL_NAME,
        "configured": client is not None,
    }


@app.get("/health")
async def health():
    """Endpoint de salud detallado"""
    return {
        "status": "healthy",
        "endpoint_configured": bool(AZURE_OPENAI_ENDPOINT),
        "api_key_configured": bool(AZURE_OPENAI_API_KEY),
    }


@app.get("/firebase/health")
async def firebase_health():
    """Estado de integración Firebase en backend."""
    return {
        "database_url_configured": bool(FIREBASE_DATABASE_URL),
        "service_account_path_configured": bool(FIREBASE_SERVICE_ACCOUNT_PATH),
        "admin_sdk_initialized": firebase_app is not None,
    }


@app.get("/firebase/users/{order_number}")
async def firebase_get_user(order_number: str):
    """Lee users/{order_number} en Realtime Database."""
    user = get_user_from_realtime_db(order_number)
    return {
        "order_number": order_number,
        "found": user is not None,
        "user": user,
    }


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """
    Endpoint WebSocket para manejar la conversación de voz en tiempo real.
    Recibe audio del frontend y lo reenvía al modelo GPT Realtime de Microsoft Foundry.
    """
    await websocket.accept()
    
    if not client:
        await websocket.send_json({
            "type": "error",
            "message": "Azure OpenAI no está configurado. Verifica las variables de entorno."
        })
        await websocket.close()
        return

    try:
        endpoint_base = AZURE_OPENAI_ENDPOINT.rstrip('/')
        if endpoint_base.startswith('https://'):
            endpoint_base = endpoint_base.replace('https://', 'wss://')
        elif endpoint_base.startswith('http://'):
            endpoint_base = endpoint_base.replace('http://', 'ws://')
        
        realtime_url = f"{endpoint_base}/openai/realtime?deployment={MODEL_NAME}&api-version={AZURE_OPENAI_API_VERSION}"
        
        print(f"Intentando conectar a: {realtime_url.replace(AZURE_OPENAI_API_KEY, '***')}")
        
        headers = {
            "api-key": AZURE_OPENAI_API_KEY,
        }

        try:
            async with websockets.connect(
                realtime_url,
                additional_headers=headers,
            ) as realtime_ws:
                await handle_realtime_connection(realtime_ws, websocket)
        except Exception as e:
            print(f"Error con 'deployment', intentando con 'model': {e}")
            # Si falla con deployment, intentar con model
            realtime_url = f"{endpoint_base}/openai/realtime?model={MODEL_NAME}&api-version={AZURE_OPENAI_API_VERSION}"
            print(f"Intentando conectar a: {realtime_url}")
            async with websockets.connect(
                realtime_url,
                additional_headers=headers,
            ) as realtime_ws:
                await handle_realtime_connection(realtime_ws, websocket)
    
    except Exception as e:
        print(f"Error general en WebSocket: {e}")
        try:
            if websocket.client_state.name != "DISCONNECTED":
                await websocket.send_json({
                    "type": "error",
                    "message": f"Error al conectar con GPT Realtime: {str(e)}"
                })
        except:
            pass
    finally:
        try:
            if websocket.client_state.name != "DISCONNECTED":
                await websocket.close()
        except:
            pass


async def handle_realtime_connection(realtime_ws, websocket):
    """Maneja la conexión con GPT Realtime una vez establecida"""
    session_ctx: dict[str, Any] = {
        "latest_user_text": "",
        "is_user_locked": False,
        "locked_order_number": None,
        "locked_user_data": None,
        "initial_response_sent": False,
    }

    session_init = {
        "type": "session.update",
        "session": {
            "modalities": ["text", "audio"],
            "instructions": "Eres un asistente de voz amigable y útil. Habla con acento español de España. Tan solo di la frase 'Hola, cual es tu número para saber quién eres, por favor'. No digas nada más",
            "voice": "alloy",
            "input_audio_format": "pcm16",
            "output_audio_format": "pcm16",
            "input_audio_transcription": {
                "model": "whisper-1"
            },
            "turn_detection": {
                "type": "server_vad",
                "threshold": 0.5,
                "prefix_padding_ms": 300,
                "silence_duration_ms": 500,
                # Control manual de respuestas desde backend para evitar carreras
                # (transcripción -> Firebase -> prompt -> response.create).
                "create_response": False,
            },
            "input_audio_transcription": {
                "model": "whisper-1"
            }
        }
    }
    await realtime_ws.send(json.dumps(session_init))

    async def resolve_user_context_if_needed() -> None:
        """
        Detecta número de orden en el último texto del usuario y, si encuentra
        datos en Firebase, bloquea el contexto para esta sesión.
        """
        if session_ctx["is_user_locked"]:
            return

        latest_text = session_ctx.get("latest_user_text", "")
        order_number = extract_order_number(latest_text)
        if not order_number:
            return

        user_data = await asyncio.to_thread(get_user_from_realtime_db, order_number)
        print(f"user_data: {user_data}")
        if not user_data:
            print(f"⚠️ Número detectado pero sin datos en Firebase: {order_number}")
            return

        session_ctx["is_user_locked"] = True
        session_ctx["locked_order_number"] = order_number
        session_ctx["locked_user_data"] = user_data
        print(f"se ha detectado que se ha pedido el número: {order_number}")
        resolved_name = (
            str(
                user_data.get("fullName")
                or user_data.get("name")
                or user_data.get("nombre")
                or ""
            ).strip()
        )
        print(f"Nombre resuelto desde Firebase: {resolved_name or '(vacío)'}")

        # Refuerzo fuerte: fijar contexto personalizado en la sesión realtime.
        # Esto aplica también cuando la respuesta no venga de un response.create explícito.
        session_update = {
            "type": "session.update",
            "session": {
                "instructions": (
                    "Eres un asistente de voz amigable y útil. Habla con acento español de España. "
                    "El usuario ya está identificado por su número de orden. "
                    f"Su nombre es: {resolved_name or 'usuario'}. "
                    "Debes dirigirte al usuario por su nombre exacto y no por su número. "
                    "Si saludas, usa el formato 'Hola <nombre>, ...'. "
                    "Nunca digas 'Hola número X' ni variantes."
                )
            },
        }
        try:
            await realtime_ws.send(json.dumps(session_update))
            print("✅ session.update personalizado enviado al modelo realtime.")
        except Exception as err:
            print(f"⚠️ No se pudo enviar session.update personalizado: {err}")

        if USER_DATA_API_URL:
            await asyncio.to_thread(send_user_data_to_external_api_sync, order_number, user_data)

    def inject_personalization_in_response(message: dict[str, Any]) -> dict[str, Any]:
        """
        Añade instrucciones personalizadas justo antes de pedir respuesta al modelo.
        """
        if not session_ctx["is_user_locked"]:
            return message

        order_number = str(session_ctx.get("locked_order_number") or "")
        user_data = session_ctx.get("locked_user_data") or {}
        if not order_number or not isinstance(user_data, dict):
            return message

        personalization = build_personalization_instructions(order_number, user_data)

        response_payload = message.get("response")
        if not isinstance(response_payload, dict):
            response_payload = {}

        existing_instructions = response_payload.get("instructions")
        if isinstance(existing_instructions, str) and existing_instructions.strip():
            response_payload["instructions"] = (
                f"{personalization}\n\n{existing_instructions.strip()}"
            )
        else:
            response_payload["instructions"] = personalization

        message["response"] = response_payload
        return message

    async def trigger_response_create() -> None:
        """Dispara una respuesta del modelo con el prompt ya personalizado."""
        response_msg = {"type": "response.create"}
        response_msg = inject_personalization_in_response(response_msg)
        await realtime_ws.send(json.dumps(response_msg))

    # Respuesta inicial de la sesión (sin esperar a frontend).
    await trigger_response_create()
    session_ctx["initial_response_sent"] = True

    async def forward_to_realtime():
        try:
            while True:
                try:
                    data = await websocket.receive()
                except RuntimeError as e:
                    if "disconnect" in str(e).lower():
                        print("Cliente desconectado (receive)")
                        break
                    raise
                
                if "bytes" in data:
                    audio_data = data["bytes"]
                    audio_size = len(audio_data)
                    if audio_size > 0:
                        audio_base64 = base64.b64encode(audio_data).decode("utf-8")
                        try:
                            audio_event = {
                                "type": "input_audio_buffer.append",
                                "audio": audio_base64
                            }
                            await realtime_ws.send(json.dumps(audio_event))
                            if audio_size % 100 == 0:
                                print(f"Audio recibido y enviado a GPT Realtime: {audio_size} bytes")
                        except websockets.exceptions.ConnectionClosed:
                            print("Conexión con GPT Realtime cerrada (enviando audio)")
                            break
                    else:
                        print("Advertencia: Audio recibido con 0 bytes")
                    
                elif "text" in data:
                    try:
                        message = json.loads(data["text"])
                        message_type = message.get("type", "unknown")
                        print(f"Recibido del frontend: {message_type}")

                        # Forzar control manual de respuestas en cualquier session.update de frontend.
                        if message_type == "session.update":
                            session_payload = message.get("session")
                            if isinstance(session_payload, dict):
                                td = session_payload.get("turn_detection")
                                if isinstance(td, dict):
                                    td["create_response"] = False

                        # Captura mensajes de texto de usuario si vienen por item.create.
                        should_trigger_manual_response = False
                        if message_type == "conversation.item.create":
                            item = message.get("item", {})
                            role = item.get("role")
                            content = item.get("content", [])
                            if role == "user" and isinstance(content, list):
                                text_chunks: list[str] = []
                                for chunk in content:
                                    if (
                                        isinstance(chunk, dict)
                                        and chunk.get("type") == "input_text"
                                        and isinstance(chunk.get("text"), str)
                                    ):
                                        text_chunks.append(chunk["text"])
                                if text_chunks:
                                    session_ctx["latest_user_text"] = " ".join(text_chunks).strip()
                                    should_trigger_manual_response = True

                        # Bloquear response.create del frontend: lo controla el backend
                        # para garantizar que Firebase se procese antes de responder.
                        if message_type == "response.create":
                            print("ℹ️ response.create recibido desde frontend, se ignora (modo control backend).")
                            continue

                        await realtime_ws.send(json.dumps(message))

                        # Flujo manual para mensajes de texto de usuario.
                        if should_trigger_manual_response:
                            await resolve_user_context_if_needed()
                            await trigger_response_create()
                    except json.JSONDecodeError:
                        pass
                    except websockets.exceptions.ConnectionClosed:
                        print("Conexión con GPT Realtime cerrada (enviando texto)")
                        break
                        
        except WebSocketDisconnect:
            print("Cliente desconectado")
        except Exception as e:
            print(f"Error en forward_to_realtime: {e}")
            try:
                if not websocket.client_state.name == "DISCONNECTED":
                    await websocket.send_json({
                        "type": "error",
                        "message": str(e)
                    })
            except:
                pass

    async def forward_to_client():
        try:
            while True:
                message = await realtime_ws.recv()
                if isinstance(message, str):
                    try:
                        data = json.loads(message)
                        print(f"Recibido de GPT Realtime: {data.get('type', 'unknown')}")

                        # Captura transcripción final de audio de usuario.
                        if data.get("type") == "conversation.item.input_audio_transcription.completed":
                            transcript = data.get("transcript")
                            if isinstance(transcript, str) and transcript.strip():
                                session_ctx["latest_user_text"] = transcript.strip()
                                await resolve_user_context_if_needed()
                                # Solo después de transcribir y resolver Firebase.
                                await trigger_response_create()

                        try:
                            if websocket.client_state.name != "DISCONNECTED":
                                await websocket.send_json(data)
                        except RuntimeError:
                            print("Cliente desconectado, no se puede enviar mensaje")
                            break
                    except json.JSONDecodeError:
                        try:
                            if websocket.client_state.name != "DISCONNECTED":
                                await websocket.send_text(message)
                        except RuntimeError:
                            break
                elif isinstance(message, bytes):
                    try:
                        if websocket.client_state.name != "DISCONNECTED":
                            await websocket.send_bytes(message)
                    except RuntimeError:
                        print("Cliente desconectado, no se puede enviar audio")
                        break
                    
        except websockets.exceptions.ConnectionClosed:
            print("Conexión con GPT Realtime cerrada")
            try:
                if websocket.client_state.name != "DISCONNECTED":
                    await websocket.send_json({
                        "type": "error",
                        "message": "Conexión con GPT Realtime cerrada"
                    })
            except:
                pass
        except Exception as e:
            print(f"Error en forward_to_client: {e}")
            try:
                if websocket.client_state.name != "DISCONNECTED":
                    await websocket.send_json({
                        "type": "error",
                        "message": str(e)
                    })
            except:
                pass

    try:
        initial_response = await realtime_ws.recv()
        if isinstance(initial_response, str):
            response_data = json.loads(initial_response)
            print(f"Respuesta inicial de GPT Realtime: {response_data.get('type', 'unknown')}")
            if websocket.client_state.name != "DISCONNECTED":
                await websocket.send_json(response_data)
    except Exception as e:
        print(f"Error esperando respuesta inicial: {e}")
    
    try:
        await asyncio.gather(
            forward_to_realtime(),
            forward_to_client(),
            return_exceptions=True
        )
    except Exception as e:
        print(f"Error en WebSocket: {e}")
        try:
            if websocket.client_state.name != "DISCONNECTED":
                await websocket.send_json({
                    "type": "error",
                    "message": str(e)
                })
        except:
            pass
        try:
            await websocket.close()
        except:
            pass
    finally:
        # Limpieza explícita de contexto al terminar la sesión.
        session_ctx["latest_user_text"] = ""
        session_ctx["is_user_locked"] = False
        session_ctx["locked_order_number"] = None
        session_ctx["locked_user_data"] = None


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

