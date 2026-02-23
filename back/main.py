import asyncio
import base64
import datetime
import json
import os
import sys
import threading
import urllib.error
import urllib.request
from enum import Enum
from typing import Any, Optional

import firebase_admin
import requests
import websockets
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from firebase_admin import credentials, db
from openai import AzureOpenAI
from pydantic import BaseModel

load_dotenv()


class VoiceAgent(str, Enum):
    ERNI_AGENT = "erni_agent"
    AZURE_AGENT = "azure_agent"

app = FastAPI(title="GPT Realtime Voice API")

_raw_cors = os.getenv(
    "CORS_ORIGINS",
    "http://localhost:3000,http://localhost:8080,http://127.0.0.1:3000,http://127.0.0.1:8080",
)
cors_origins = [o.strip() for o in _raw_cors.split(",") if o.strip()]

# Quitar orígenes que son patrones con * (no son coincidencia exacta)
cors_origins_exact = [o for o in cors_origins if "*" not in o]

# Regex para Azure Container Apps: cualquier subdominio .azurecontainerapps.io
cors_origin_regex = os.getenv(
    "CORS_ORIGIN_REGEX",
    r"^https://[a-zA-Z0-9][a-zA-Z0-9.-]*\.azurecontainerapps\.io$",
).strip()

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins_exact,
    allow_origin_regex=cors_origin_regex or None,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

AZURE_OPENAI_ENDPOINT = os.getenv("AZURE_OPENAI_ENDPOINT", "")
AZURE_OPENAI_API_KEY = os.getenv("AZURE_OPENAI_API_KEY", "")
AZURE_OPENAI_API_VERSION = os.getenv("AZURE_OPENAI_API_VERSION", "2024-10-01-preview")
MODEL_NAME = os.getenv("MODEL_NAME", "gpt-realtime")

ERNI_AGENT_URL = os.getenv("ERNI_AGENT_URL", "wss://erni_voice_agent_user:74jxGh-J2a41CxZ_pQ2@robot-agent.enricd.com/ws")
VOICE_AGENT_TYPE = VoiceAgent(os.getenv("VOICE_AGENT_TYPE", "erni_agent"))

# Configuración de Firebase
FIREBASE_DATABASE_URL = os.getenv("FIREBASE_DATABASE_URL", "")
FIREBASE_SERVICE_ACCOUNT_JSON = os.getenv("FIREBASE_SERVICE_ACCOUNT_JSON", "")

# Configuración de generación de imágenes (caricaturas)
MODEL_IMAGE_NAME = os.getenv("MODEL_IMAGE_NAME", "gpt-image-1.5")
AZURE_OPENAI_IMAGE_API_VERSION = os.getenv(
    "AZURE_OPENAI_IMAGE_API_VERSION",
    os.getenv("AZURE_OPENAI_IMAGE_API_KEY", "2024-02-01"),
)
AZURE_OPENAI_IMAGE_PROMPT = os.getenv(
    "AZURE_OPENAI_IMAGE_PROMPT",
    "Make an exaggerated caricature of the person appearing in this photo in a line drawing style. I want the lines to be thin and the details to be as minimalist as possible while preserving the exaggerated proportions."
)
AZURE_OPENAI_IMAGE_ENDPOINT = os.getenv(
    "AZURE_OPENAI_IMAGE_ENDPOINT",
    (
        f"{AZURE_OPENAI_ENDPOINT.rstrip('/')}/openai/deployments/{MODEL_IMAGE_NAME}/images/generations"
        if AZURE_OPENAI_ENDPOINT
        else ""
    ),
)
AZURE_OPENAI_IMAGE_EDITS_ENDPOINT = os.getenv(
    "AZURE_OPENAI_IMAGE_EDITS_ENDPOINT",
    (
        f"{AZURE_OPENAI_ENDPOINT.rstrip('/')}/openai/deployments/{MODEL_IMAGE_NAME}/images/edits"
        if AZURE_OPENAI_ENDPOINT
        else ""
    ),
)

client: Optional[AzureOpenAI] = None
firebase_app: Optional[firebase_admin.App] = None
status_listener_started = False
current_status = "idle"

# Sesiones WebSocket activas para enviar eventos de estado en tiempo real.
active_websockets: set[WebSocket] = set()
active_websockets_lock = threading.Lock()
main_event_loop: Optional[asyncio.AbstractEventLoop] = None

if AZURE_OPENAI_ENDPOINT and AZURE_OPENAI_API_KEY:
    client = AzureOpenAI(
        api_key=AZURE_OPENAI_API_KEY,
        api_version=AZURE_OPENAI_API_VERSION,
        azure_endpoint=AZURE_OPENAI_ENDPOINT,
    )


def _sanitize_service_account_json(raw_json: str) -> str:
    raw = (raw_json or "").strip()
    if len(raw) >= 2 and raw[0] == raw[-1] and raw[0] in {"'", '"'}:
        raw = raw[1:-1]
    return raw


def initialize_firebase_admin() -> None:
    """
    Inicializa Firebase Admin SDK usando FIREBASE_SERVICE_ACCOUNT_JSON.
    """
    global firebase_app

    if firebase_app is not None:
        return

    if not FIREBASE_DATABASE_URL:
        print("⚠️ FIREBASE_DATABASE_URL no configurado; no se inicializa Firebase Admin.")
        return
    if not FIREBASE_SERVICE_ACCOUNT_JSON:
        print("⚠️ FIREBASE_SERVICE_ACCOUNT_JSON no configurado; no se inicializa Firebase Admin.")
        return

    try:
        service_account_json = _sanitize_service_account_json(FIREBASE_SERVICE_ACCOUNT_JSON)
        service_account_info = json.loads(service_account_json)
        private_key = service_account_info.get("private_key")
        if isinstance(private_key, str):
            service_account_info["private_key"] = private_key.replace("\\n", "\n")

        cred = credentials.Certificate(service_account_info)
        firebase_app = firebase_admin.initialize_app(
            cred,
            {"databaseURL": FIREBASE_DATABASE_URL},
        )
        print("✅ Firebase Admin inicializado correctamente")
    except Exception as err:
        print(f"❌ Error inicializando Firebase Admin: {err}")


async def broadcast_status_change(new_status: str) -> None:
    """
    Envía el nuevo status de Firebase a todas las sesiones activas.
    """
    with active_websockets_lock:
        sockets = list(active_websockets)

    if not sockets:
        return

    payload = {
        "type": "firebase.status.changed",
        "status": new_status,
    }
    for ws in sockets:
        try:
            if ws.client_state.name != "DISCONNECTED":
                await ws.send_json(payload)
        except Exception as err:
            print(f"⚠️ Error enviando status a una sesión: {err}")


def setup_firebase_status_listener() -> None:
    """
    Configura listener para cambios en el nodo 'status' de Firebase.
    Cuando cambia a 'painting', notifica a las sesiones activas.
    """
    global status_listener_started, current_status

    if status_listener_started:
        return

    if firebase_app is None:
        print("⚠️ Firebase no inicializado, no se puede configurar listener de status")
        return

    def on_status_change(event) -> None:
        global current_status
        new_status = event.data
        if new_status == current_status:
            return

        old_status = current_status
        current_status = new_status if new_status else "idle"
        print(f"📡 Status Firebase cambió: {old_status} -> {current_status}")

        if current_status == "painting":
            print("🎨 Estado 'painting' detectado - se aplicarán instrucciones de conversación")

        if main_event_loop and main_event_loop.is_running():
            asyncio.run_coroutine_threadsafe(
                broadcast_status_change(current_status),
                main_event_loop,
            )

    try:
        ref = db.reference("status")
        ref.listen(on_status_change)
        status_listener_started = True
        print("✅ Listener de status de Firebase configurado correctamente")
    except Exception as e:
        print(f"⚠️ Error configurando listener de status: {e}")


def update_user_fields_in_realtime_db(order_number: str, fields: dict[str, Any]) -> bool:
    """
    Actualiza campos parciales en users/{order_number} usando REST PATCH.
    """
    if not FIREBASE_DATABASE_URL:
        print("❌ FIREBASE_DATABASE_URL no configurado para actualizar Firebase.")
        return False

    try:
        url = f"{FIREBASE_DATABASE_URL.rstrip('/')}/users/{order_number}.json"
        payload = json.dumps(fields).encode("utf-8")
        request = urllib.request.Request(
            url,
            data=payload,
            headers={"Content-Type": "application/json"},
            method="PATCH",
        )
        with urllib.request.urlopen(request, timeout=10) as response:
            status = getattr(response, "status", 200)
            return 200 <= status < 300
    except Exception as err:
        print(f"❌ Error actualizando Firebase REST para {order_number}: {err}")
        return False


def extract_base64_payload(image_data: str) -> str:
    """
    Admite data URL o base64 directo y devuelve solo el payload base64.
    """
    if not image_data:
        return ""
    marker = "base64,"
    if marker in image_data:
        return image_data.split(marker, 1)[1].strip()
    return image_data.strip()


def parse_generated_base64_list(response_data: dict[str, Any]) -> list[str]:
    """
    Extrae una lista de base64 desde posibles formatos de respuesta del endpoint images.
    """
    results: list[str] = []

    data = response_data.get("data")
    if isinstance(data, list) and data:
        for item in data:
            if not isinstance(item, dict):
                continue
            b64_json = item.get("b64_json")
            if isinstance(b64_json, str) and b64_json.strip():
                results.append(b64_json.strip())

    output = response_data.get("output")
    if isinstance(output, list) and output:
        for item in output:
            if not isinstance(item, dict):
                continue
            b64_json = item.get("b64_json")
            if isinstance(b64_json, str) and b64_json.strip():
                results.append(b64_json.strip())
            content = item.get("content")
            if isinstance(content, list):
                for piece in content:
                    if isinstance(piece, dict):
                        b64_piece = piece.get("b64_json")
                        if isinstance(b64_piece, str) and b64_piece.strip():
                            results.append(b64_piece.strip())

    deduped: list[str] = []
    seen: set[str] = set()
    for entry in results:
        if entry in seen:
            continue
        seen.add(entry)
        deduped.append(entry)

    return deduped


def call_image_generation_sync(photo_base64_or_data_url: str) -> list[str]:
    """
    Edita imagen usando gpt-image-1.5 en endpoint /images/edits
    enviando multipart/form-data (image + prompt).
    """
    if not AZURE_OPENAI_IMAGE_EDITS_ENDPOINT:
        raise RuntimeError("AZURE_OPENAI_IMAGE_EDITS_ENDPOINT no configurado")
    if not AZURE_OPENAI_API_KEY:
        raise RuntimeError("AZURE_OPENAI_API_KEY no configurado")

    raw_base64 = extract_base64_payload(photo_base64_or_data_url)
    if not raw_base64:
        raise RuntimeError("Foto base64 vacía")

    try:
        image_bytes = base64.b64decode(raw_base64, validate=True)
    except Exception as err:
        raise RuntimeError(f"Base64 de foto inválido: {err}") from err

    files = {
        "image": ("image_to_edit.jpg", image_bytes, "image/jpeg"),
    }
    data = {
        "prompt": AZURE_OPENAI_IMAGE_PROMPT,
        "n": "1",
    }
    headers = {
        "Authorization": f"Bearer {AZURE_OPENAI_API_KEY}",
    }

    version = AZURE_OPENAI_IMAGE_API_VERSION
    request_url = f"{AZURE_OPENAI_IMAGE_EDITS_ENDPOINT}?api-version={version}"
    print(f"🖼️ Edit endpoint: {request_url}")
    response = requests.post(
        request_url,
        headers=headers,
        files=files,
        data=data,
        timeout=90,
    )
    print(f"🖼️ Status Foundry edits: {response.status_code}")

    if response.status_code != 200:
        raise RuntimeError(
            f"HTTP {response.status_code} {response.reason} "
            f"(api-version={version}). Body: {response.text}"
        )

    response_data = response.json()
    generated_base64_list = parse_generated_base64_list(response_data)
    if generated_base64_list:
        print(
            f"✅ Caricaturas generadas correctamente (api-version={version}). "
            f"Cantidad: {len(generated_base64_list)}"
        )
        return generated_base64_list

    raise RuntimeError(
        f"200 sin b64_json (api-version={version}). Body: {response.text}"
    )


class CaricatureGenerationRequest(BaseModel):
    orderNumber: str
    photoBase64: str


class SummaryMessage(BaseModel):
    role: str
    content: str


class TranscriptionSummaryRequest(BaseModel):
    messages: list[SummaryMessage]


def extract_user_messages_for_summary(messages: list[SummaryMessage]) -> list[str]:
    """
    Extrae únicamente los mensajes del usuario con contenido válido.
    """
    result: list[str] = []
    for item in messages:
        role = str(getattr(item, "role", "") or "").strip().lower()
        content = str(getattr(item, "content", "") or "").strip()
        if role == "user" and content:
            result.append(content)
    return result


async def summarize_user_messages_with_gpt_realtime(user_messages: list[str]) -> str:
    """
    Usa GPT Realtime en modo texto para resumir solo los mensajes de usuario.
    """
    if not AZURE_OPENAI_ENDPOINT or not AZURE_OPENAI_API_KEY:
        raise RuntimeError("Azure OpenAI no configurado para resumen")

    endpoint_base = AZURE_OPENAI_ENDPOINT.rstrip("/")
    if endpoint_base.startswith("https://"):
        endpoint_base = endpoint_base.replace("https://", "wss://")
    elif endpoint_base.startswith("http://"):
        endpoint_base = endpoint_base.replace("http://", "ws://")

    headers = {"api-key": AZURE_OPENAI_API_KEY}
    realtime_url = (
        f"{endpoint_base}/openai/realtime?deployment={MODEL_NAME}"
        f"&api-version={AZURE_OPENAI_API_VERSION}"
    )

    summary_prompt = (
        "Eres un asistente que resume conversaciones.\n"
        "Debes usar EXCLUSIVAMENTE los mensajes del usuario.\n"
        "No incluyas respuestas del asistente ni inventes información.\n"
        "Devuelve un resumen breve y claro en español (2-4 frases).\n\n"
        "Mensajes del usuario:\n"
        + "\n".join(f"- {msg}" for msg in user_messages)
    )

    async def run_with_url(url: str) -> str:
        async with websockets.connect(url, additional_headers=headers) as realtime_ws:
            session_init = {
                "type": "session.update",
                "session": {
                    "modalities": ["text"],
                    "instructions": (
                        "Resume únicamente lo que dijo el usuario. "
                        "No uses información del asistente."
                    ),
                },
            }
            await realtime_ws.send(json.dumps(session_init))

            await realtime_ws.send(
                json.dumps(
                    {
                        "type": "conversation.item.create",
                        "item": {
                            "type": "message",
                            "role": "user",
                            "content": [{"type": "input_text", "text": summary_prompt}],
                        },
                    }
                )
            )

            await realtime_ws.send(
                json.dumps(
                    {
                        "type": "response.create",
                        "response": {"modalities": ["text"]},
                    }
                )
            )

            chunks: list[str] = []
            for _ in range(200):
                raw = await asyncio.wait_for(realtime_ws.recv(), timeout=25)
                if not isinstance(raw, str):
                    continue

                data = json.loads(raw)
                event_type = str(data.get("type") or "")

                if event_type in {
                    "conversation.item.output_text.delta",
                    "response.output_text.delta",
                    "response.text.delta",
                }:
                    delta = data.get("delta")
                    if isinstance(delta, str) and delta:
                        chunks.append(delta)
                    continue

                if event_type in {
                    "conversation.item.output_text.done",
                    "response.output_text.done",
                    "response.text.done",
                }:
                    text = data.get("text")
                    if isinstance(text, str) and text.strip():
                        return text.strip()
                    continue

                if event_type == "response.done":
                    break

            joined = "".join(chunks).strip()
            if joined:
                return joined
            raise RuntimeError("No se recibió texto de resumen desde GPT Realtime")

    try:
        return await run_with_url(realtime_url)
    except Exception as first_err:
        print(f"⚠️ Fallo resumen con deployment, reintentando con model: {first_err}")
        realtime_url_model = (
            f"{endpoint_base}/openai/realtime?model={MODEL_NAME}"
            f"&api-version={AZURE_OPENAI_API_VERSION}"
        )
        return await run_with_url(realtime_url_model)


@app.on_event("startup")
async def on_startup():
    """Inicializa Firebase y listener de status al arrancar."""
    global main_event_loop
    main_event_loop = asyncio.get_running_loop()
    initialize_firebase_admin()
    setup_firebase_status_listener()


@app.get("/")
async def root():
    """Endpoint de salud"""
    return {
        "status": "ok",
        "message": "GPT Realtime Voice API está funcionando",
        "model": MODEL_NAME,
        "voice_agent": VOICE_AGENT_TYPE.value,
        "configured": client is not None if VOICE_AGENT_TYPE == VoiceAgent.AZURE_AGENT else True,
    }


@app.get("/health")
async def health():
    """Endpoint de salud detallado"""
    return {
        "status": "healthy",
        "endpoint_configured": bool(AZURE_OPENAI_ENDPOINT),
        "api_key_configured": bool(AZURE_OPENAI_API_KEY),
    }


@app.post("/transcriptions/summarize")
async def summarize_transcriptions(payload: TranscriptionSummaryRequest):
    """
    Resume la conversación usando GPT Realtime en texto, tomando solo mensajes user.
    """
    user_messages = extract_user_messages_for_summary(payload.messages)
    if not user_messages:
        return {
            "summary": "",
            "userMessageCount": 0,
        }

    try:
        summary = await summarize_user_messages_with_gpt_realtime(user_messages)
        return {
            "summary": summary,
            "userMessageCount": len(user_messages),
        }
    except Exception as err:
        print(f"❌ Error generando resumen de transcripción: {err}")
        raise HTTPException(status_code=500, detail=str(err))


@app.post("/photo/generate-caricature")
async def generate_caricature(payload: CaricatureGenerationRequest):
    """
    Genera caricaturas desde foto usando gpt-image-1.5 y las guarda en
    users/{order}/caricatures (array).
    """
    order_number = payload.orderNumber.strip()
    print("========================================")
    print("🟦 Inicio generación de caricatura")
    print(f"🧾 orderNumber: {order_number}")
    print("========================================")

    if not order_number:
        raise HTTPException(status_code=400, detail="orderNumber es obligatorio")
    if not payload.photoBase64.strip():
        raise HTTPException(status_code=400, detail="photoBase64 es obligatorio")

    try:
        print("1) Generando caricatura en Azure Foundry...")
        caricatures_base64 = await asyncio.to_thread(
            call_image_generation_sync,
            payload.photoBase64,
        )
        print(f"2) Caricaturas generadas. Total: {len(caricatures_base64)}")
        for i, b64_img in enumerate(caricatures_base64, start=1):
            print(f"   - Caricatura #{i}: longitud base64={len(b64_img)}")

        caricatures_data_urls = [
            f"data:image/png;base64,{img_b64}" for img_b64 in caricatures_base64
        ]

        print("3) Guardando caricaturas en Firebase...")
        updated_ok = await asyncio.to_thread(
            update_user_fields_in_realtime_db,
            order_number,
            {
                "caricatures": caricatures_data_urls,
                "caricaturesTimestamp": datetime.datetime.utcnow().isoformat() + "Z",
            },
        )
        if not updated_ok:
            raise RuntimeError("No se pudo guardar caricatures en Firebase")

        print(f"✅ Caricaturas guardadas en users/{order_number}/caricatures")
        return {
            "ok": True,
            "orderNumber": order_number,
            "storedInFirebase": True,
            "generatedCount": len(caricatures_data_urls),
        }
    except HTTPException:
        raise
    except Exception as err:
        print(f"❌ Error en generación/guardado de caricatura: {err}")
        raise HTTPException(status_code=500, detail=str(err))


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """
    Endpoint WebSocket para manejar la conversación de voz en tiempo real.
    Según VOICE_AGENT_TYPE, conecta con Erni Agent o Azure OpenAI Realtime.
    """
    await websocket.accept()

    with active_websockets_lock:
        active_websockets.add(websocket)

    try:
        print(f"Usando agente de voz: {VOICE_AGENT_TYPE.value}")

        if VOICE_AGENT_TYPE == VoiceAgent.ERNI_AGENT:
            await handle_erni_agent(websocket)
        else:
            await handle_azure_agent(websocket)
    finally:
        with active_websockets_lock:
            active_websockets.discard(websocket)


async def handle_erni_agent(websocket: WebSocket):
    """Maneja la conexión con Erni Agent"""
    try:
        print(f"Conectando a Erni Agent: {ERNI_AGENT_URL.split('@')[1] if '@' in ERNI_AGENT_URL else ERNI_AGENT_URL}")
        
        async with websockets.connect(ERNI_AGENT_URL) as erni_ws:
            await handle_erni_connection(erni_ws, websocket)
    
    except Exception as e:
        print(f"Error en Erni Agent WebSocket: {e}")
        try:
            if websocket.client_state.name != "DISCONNECTED":
                await websocket.send_json({
                    "type": "error",
                    "message": f"Error al conectar con Erni Agent: {str(e)}"
                })
        except:
            pass
    finally:
        try:
            if websocket.client_state.name != "DISCONNECTED":
                await websocket.close()
        except:
            pass


async def handle_azure_agent(websocket: WebSocket):
    """Maneja la conexión con Azure OpenAI Realtime"""
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


async def handle_erni_connection(erni_ws, websocket: WebSocket):
    """
    Maneja la conexión con Erni Agent.
    - Envía audio PCM binario directamente (16-bit, 16kHz, mono)
    - Recibe eventos JSON: stt_chunk, stt_output, agent_chunk, agent_end, tool_call, tool_result, tts_chunk
    """
    
    async def forward_audio_to_erni():
        """Recibe audio del frontend y lo envía a Erni como binario PCM"""
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
                    if len(audio_data) > 0:
                        try:
                            await erni_ws.send(audio_data)
                            if len(audio_data) % 100 == 0:
                                print(f"Audio enviado a Erni Agent: {len(audio_data)} bytes")
                        except websockets.exceptions.ConnectionClosed:
                            print("Conexión con Erni Agent cerrada (enviando audio)")
                            break
                
                elif "text" in data:
                    try:
                        message = json.loads(data["text"])
                        print(f"Mensaje de control del frontend: {message.get('type', 'unknown')}")
                    except json.JSONDecodeError:
                        pass
                        
        except WebSocketDisconnect:
            print("Cliente desconectado")
        except Exception as e:
            print(f"Error en forward_audio_to_erni: {e}")

    async def forward_events_to_client():
        """Recibe eventos JSON de Erni y los reenvía al frontend"""
        try:
            while True:
                message = await erni_ws.recv()
                if isinstance(message, str):
                    try:
                        data = json.loads(message)
                        event_type = data.get("type", "unknown")
                        print(f"Evento de Erni Agent: {event_type}")
                        
                        if websocket.client_state.name != "DISCONNECTED":
                            await websocket.send_json(data)
                            
                    except json.JSONDecodeError:
                        print(f"Mensaje no JSON de Erni: {message[:100]}")
                elif isinstance(message, bytes):
                    print(f"Datos binarios inesperados de Erni: {len(message)} bytes")
                    
        except websockets.exceptions.ConnectionClosed:
            print("Conexión con Erni Agent cerrada")
            try:
                if websocket.client_state.name != "DISCONNECTED":
                    await websocket.send_json({
                        "type": "error",
                        "message": "Conexión con Erni Agent cerrada"
                    })
            except:
                pass
        except Exception as e:
            print(f"Error en forward_events_to_client: {e}")

    try:
        print("Conexión con Erni Agent establecida")
        if websocket.client_state.name != "DISCONNECTED":
            await websocket.send_json({
                "type": "session.created",
                "message": "Conectado a Erni Agent"
            })
        
        await asyncio.gather(
            forward_audio_to_erni(),
            forward_events_to_client(),
            return_exceptions=True
        )
    except Exception as e:
        print(f"Error en handle_erni_connection: {e}")
        try:
            if websocket.client_state.name != "DISCONNECTED":
                await websocket.send_json({
                    "type": "error",
                    "message": str(e)
                })
        except:
            pass


async def handle_realtime_connection(realtime_ws, websocket):
    """Maneja la conexión con GPT Realtime una vez establecida (Azure)"""
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
                "silence_duration_ms": 500
            },
            "input_audio_transcription": {
                "model": "whisper-1"
            }
        }
    }
    await realtime_ws.send(json.dumps(session_init))

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
                        await realtime_ws.send(json.dumps(message))
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


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

