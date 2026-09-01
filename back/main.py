import asyncio
import base64
import contextlib
import datetime
import io
import json
import os
import random
import sys
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from enum import Enum
from typing import Any, Optional

import firebase_admin
import litellm
import pyodbc
import websockets
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from firebase_admin import credentials, db
from fulgencio_conversation import add_config_query, load_instructions
from litellm.llms.custom_httpx.http_handler import HTTPHandler
from pydantic import BaseModel

load_dotenv()


class VoiceAgent(str, Enum):
    ERNI_AGENT = "erni_agent"
    FULGENCIO_AGENT = "fulgencio_agent"
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
    r"(^https://[a-zA-Z0-9][a-zA-Z0-9.-]*\.azurecontainerapps\.io$)|(^https?://(localhost|127\.0\.0\.1|10(?:\.\d{1,3}){3}|192\.168(?:\.\d{1,3}){2}|172\.(1[6-9]|2\d|3[0-1])(?:\.\d{1,3}){2})(:\d+)?$)",
).strip()

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins_exact,
    allow_origin_regex=cors_origin_regex or None,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

MODEL_NAME = os.getenv("MODEL_NAME", "gpt-realtime-1.5")

LITELLM_PROXY_HTTP_URL = os.getenv(
    "LITELLM_PROXY_HTTP_URL",
    "http://localhost:4000",
).rstrip("/")
LITELLM_PROXY_WS_URL = os.getenv(
    "LITELLM_PROXY_WS_URL",
    "ws://localhost:4000",
).rstrip("/")
LITELLM_PROXY_API_KEY = os.getenv(
    "LITELLM_PROXY_API_KEY",
    os.getenv("LITELLM_MASTER_KEY", ""),
)

ERNI_AGENT_URL = os.getenv("ERNI_AGENT_URL", "wss://erni_voice_agent_user:74jxGh-J2a41CxZ_pQ2@robot-agent.enricd.com/ws")
FULGENCIO_AGENT_URL = os.getenv("FULGENCIO_AGENT_URL", "")
VOICE_AGENT_TYPE = VoiceAgent(os.getenv("VOICE_AGENT_TYPE", "erni_agent"))
FULGENCIO_CONVERSATION_INSTRUCTIONS = load_instructions()

# Configuración de Firebase
FIREBASE_DATABASE_URL = os.getenv("FIREBASE_DATABASE_URL", "")
FIREBASE_SERVICE_ACCOUNT_JSON = os.getenv("FIREBASE_SERVICE_ACCOUNT_JSON", "")
FIREBASE_SERVICE_ACCOUNT_FILE = os.getenv("FIREBASE_SERVICE_ACCOUNT_FILE", "")

# Azure SQL (datos de users y caricatura)
AZURE_SQL_CONNECTION_STRING = os.getenv("AZURE_SQL_CONNECTION_STRING", "")
AZURE_SQL_CONNECT_TIMEOUT_SECONDS = int(os.getenv("AZURE_SQL_CONNECT_TIMEOUT_SECONDS", "60"))
AZURE_SQL_CONNECT_RETRY_ATTEMPTS = int(os.getenv("AZURE_SQL_CONNECT_RETRY_ATTEMPTS", "5"))
AZURE_SQL_CONNECT_RETRY_BASE_SECONDS = float(os.getenv("AZURE_SQL_CONNECT_RETRY_BASE_SECONDS", "1.0"))
AZURE_SQL_CONNECT_MAX_TOTAL_SECONDS = float(os.getenv("AZURE_SQL_CONNECT_MAX_TOTAL_SECONDS", "45"))

# Configuración de generación de imágenes (caricaturas)
MODEL_IMAGE_NAME = os.getenv("MODEL_IMAGE_NAME", "gpt-image-2")
AZURE_OPENAI_ENDPOINT = os.getenv("AZURE_OPENAI_ENDPOINT", "").rstrip("/")
AZURE_OPENAI_API_KEY = os.getenv("AZURE_OPENAI_API_KEY", "")
AZURE_OPENAI_IMAGE_API_KEY = os.getenv("AZURE_OPENAI_IMAGE_API_KEY", "")
AZURE_OPENAI_IMAGE_EDITS_ENDPOINT = os.getenv(
    "AZURE_OPENAI_IMAGE_EDITS_ENDPOINT",
    f"{AZURE_OPENAI_ENDPOINT}/images/edits" if AZURE_OPENAI_ENDPOINT else "",
)
AZURE_OPENAI_IMAGE_API_VERSION = os.getenv(
    "AZURE_OPENAI_IMAGE_API_VERSION",
    "2025-04-01-preview",
)
AZURE_OPENAI_IMAGE_PROMPT = os.getenv(
    "AZURE_OPENAI_IMAGE_PROMPT",
    "Make an exaggerated caricature of the person appearing in this photo in a line drawing style. I want the details to be as minimalist as possible while preserving the exaggerated proportions. I want the teeth to appear as a single piece, meaning that the separation between the teeth should not be visible. Avoid grey colors, all lines must be black. The background should be white and empty, with no additional elements or distractions. The final image should be a clean and simple line drawing that captures the essence of the caricature in a minimalist way. This picture will be drawn by a robot arm so the lines should be connected together avoiding unnecessary gaps."
)
firebase_app: Optional[firebase_admin.App] = None
status_listener_started = False
current_status = "idle"

# Sesiones WebSocket activas para enviar eventos de estado en tiempo real.
active_websockets: set[WebSocket] = set()
active_websockets_lock = threading.Lock()
main_event_loop: Optional[asyncio.AbstractEventLoop] = None

def is_litellm_configured() -> bool:
    """Indica si el backend puede autenticarse contra el Proxy LiteLLM."""
    return bool(LITELLM_PROXY_HTTP_URL and LITELLM_PROXY_API_KEY)


def is_voice_agent_configured() -> bool:
    if VOICE_AGENT_TYPE == VoiceAgent.AZURE_AGENT:
        return is_litellm_configured()
    if VOICE_AGENT_TYPE == VoiceAgent.FULGENCIO_AGENT:
        return bool(FULGENCIO_AGENT_URL)
    return bool(ERNI_AGENT_URL)


def get_image_api_base() -> str:
    """Convierte el endpoint completo de edits en el api_base esperado por LiteLLM."""
    endpoint = AZURE_OPENAI_IMAGE_EDITS_ENDPOINT or AZURE_OPENAI_ENDPOINT
    if not endpoint:
        return ""

    parts = urllib.parse.urlsplit(endpoint)
    path = parts.path.rstrip("/")
    if path.endswith("/images/edits"):
        path = path[: -len("/images/edits")]
    return urllib.parse.urlunsplit(
        (parts.scheme, parts.netloc, path, "", "")
    ).rstrip("/")


def get_image_api_key() -> str:
    """Usa la clave del Proxy upstream cuando comparte host con el endpoint general."""
    image_host = urllib.parse.urlsplit(AZURE_OPENAI_IMAGE_EDITS_ENDPOINT).hostname
    main_host = urllib.parse.urlsplit(AZURE_OPENAI_ENDPOINT).hostname
    if image_host and image_host == main_host and AZURE_OPENAI_API_KEY:
        return AZURE_OPENAI_API_KEY
    return AZURE_OPENAI_IMAGE_API_KEY or AZURE_OPENAI_API_KEY


def is_image_litellm_configured() -> bool:
    return bool(get_image_api_base() and get_image_api_key() and MODEL_IMAGE_NAME)


class ImageAPIQueryHTTPHandler(HTTPHandler):
    """Añade api-version, que LiteLLM 1.86.0 no propaga en image_edit."""

    def __init__(self, api_version: str):
        super().__init__()
        self.api_version = api_version

    def post(self, url: str, **kwargs):
        params = dict(kwargs.pop("params", None) or {})
        if self.api_version:
            params.setdefault("api-version", self.api_version)
        return super().post(url=url, params=params, **kwargs)


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
    if not FIREBASE_SERVICE_ACCOUNT_JSON and not FIREBASE_SERVICE_ACCOUNT_FILE:
        print("⚠️ Credencial de Firebase Admin no configurada; no se inicializa Firebase Admin.")
        return

    try:
        if FIREBASE_SERVICE_ACCOUNT_FILE:
            with open(FIREBASE_SERVICE_ACCOUNT_FILE, "r", encoding="utf-8") as file:
                service_account_info = json.load(file)
        else:
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


def _get_sql_server_driver_name() -> Optional[str]:
    """Devuelve el nombre del primer controlador ODBC para SQL Server disponible (18, 17 o 13)."""
    candidates = [
        "ODBC Driver 18 for SQL Server",
        "ODBC Driver 17 for SQL Server",
        "ODBC Driver 13 for SQL Server",
    ]
    installed = pyodbc.drivers()
    for name in candidates:
        if name in installed:
            return name
    return None


def _normalize_odbc_connection_string(raw: str) -> str:
    """Normaliza atributos para ODBC Driver 17/18 y aliases comunes de ADO.NET."""
    s = raw
    s = s.replace("Encrypt=True", "Encrypt=yes").replace("Encrypt=False", "Encrypt=no")
    s = s.replace("TrustServerCertificate=True", "TrustServerCertificate=yes").replace("TrustServerCertificate=False", "TrustServerCertificate=no")
    # ADO.NET usa "Initial Catalog"; ODBC usa "Database"
    if "Initial Catalog=" in s and "DATABASE=" not in s.upper():
        s = s.replace("Initial Catalog=", "Database=")
    # ADO.NET usa MultipleActiveResultSets; en ODBC se usa MARS_Connection
    if "MultipleActiveResultSets=True" in s:
        s = s.replace("MultipleActiveResultSets=True", "MARS_Connection=yes")
    if "MultipleActiveResultSets=False" in s:
        s = s.replace("MultipleActiveResultSets=False", "MARS_Connection=no")
    # "Persist Security Info" no es relevante para pyodbc; eliminarlo evita warnings.
    s = s.replace("Persist Security Info=False;", "")
    s = s.replace("Persist Security Info=True;", "")
    # Driver 17 puede no reconocer "User ID" / "Password"; usar UID / PWD
    if "User ID=" in s and "UID=" not in s.upper():
        s = s.replace("User ID=", "UID=")
    if "Password=" in s and "PWD=" not in s.upper():
        s = s.replace("Password=", "PWD=")
    return s


def _get_azure_sql_connection_string() -> str:
    """Devuelve la connection string con Driver para pyodbc si no está presente.
    En .env puede ir entre comillas dobles (p. ej. por password con !); se eliminan aquí.
    """
    raw = (AZURE_SQL_CONNECTION_STRING or "").strip()
    if not raw:
        return ""
    if (raw.startswith('"') and raw.endswith('"')) or (raw.startswith("'") and raw.endswith("'")):
        raw = raw[1:-1]
    raw = _normalize_odbc_connection_string(raw)
    if "Driver=" in raw or "DRIVER=" in raw:
        return raw
    driver = _get_sql_server_driver_name()
    if not driver:
        return "Driver={ODBC Driver 18 for SQL Server};" + raw
    return f"Driver={{{driver}}};" + raw


def _is_transient_sql_connect_error(err: Exception) -> bool:
    """Detecta errores transitorios de conexión/login timeout en Azure SQL."""
    msg = str(err).lower()
    transient_markers = (
        "hyt00",  # login timeout expired
        "08001",  # unable to connect / transport errors
        "08s01",  # communication link failure
        "40613",  # Database is not currently available
        "40197",  # Service has encountered an error processing request
        "40501",  # Service busy
        "49918",  # Cannot process request
        "49919",
        "49920",
        "10928",  # Resource limit
        "10929",
        "not currently available",
        "service is currently busy",
        "timed out",
        "timeout",
        "tcp provider",
        "connection is busy",
    )
    return any(marker in msg for marker in transient_markers)


def _open_azure_sql_connection_with_retry(conn_str: str):
    """Abre conexión SQL con retries y backoff para fallos transitorios."""
    attempts = max(1, AZURE_SQL_CONNECT_RETRY_ATTEMPTS)
    started_at = time.monotonic()
    for attempt in range(1, attempts + 1):
        try:
            return pyodbc.connect(conn_str, timeout=AZURE_SQL_CONNECT_TIMEOUT_SECONDS)
        except pyodbc.Error as err:
            elapsed = time.monotonic() - started_at
            is_transient = _is_transient_sql_connect_error(err)
            if attempt >= attempts or not is_transient or elapsed >= AZURE_SQL_CONNECT_MAX_TOTAL_SECONDS:
                raise
            sleep_seconds = AZURE_SQL_CONNECT_RETRY_BASE_SECONDS * (2 ** (attempt - 1))
            # Jitter para evitar colisiones de reintentos simultáneos.
            sleep_seconds += random.uniform(0, AZURE_SQL_CONNECT_RETRY_BASE_SECONDS)
            if elapsed + sleep_seconds > AZURE_SQL_CONNECT_MAX_TOTAL_SECONDS:
                sleep_seconds = max(0.1, AZURE_SQL_CONNECT_MAX_TOTAL_SECONDS - elapsed)
            print(
                f"⚠️ Conexión Azure SQL falló (intento {attempt}/{attempts}): {err}. "
                f"Reintentando en {sleep_seconds:.1f}s..."
            )
            time.sleep(sleep_seconds)


@contextlib.contextmanager
def get_azure_sql_connection():
    """Context manager para obtener una conexión a Azure SQL."""
    conn_str = _get_azure_sql_connection_string()
    if not conn_str:
        raise RuntimeError("AZURE_SQL_CONNECTION_STRING no configurado")
    conn = _open_azure_sql_connection_with_retry(conn_str)
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def init_azure_sql_users_table() -> None:
    """Crea la tabla users si no existe."""
    if not _get_azure_sql_connection_string():
        return
    try:
        with get_azure_sql_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'users')
                CREATE TABLE users (
                    id INT IDENTITY(1,1) PRIMARY KEY,
                    full_name NVARCHAR(500) NOT NULL,
                    email NVARCHAR(500) NOT NULL,
                    [timestamp] NVARCHAR(100) NOT NULL,
                    real_name NVARCHAR(500) NULL,
                    work_name NVARCHAR(500) NULL,
                    request_id NVARCHAR(64) NULL,
                    caricature NVARCHAR(MAX) NULL,
                    caricature_timestamp NVARCHAR(100) NULL
                );
            """)
            cursor.execute("""
                IF COL_LENGTH('users', 'real_name') IS NULL
                ALTER TABLE users ADD real_name NVARCHAR(500) NULL;
            """)
            cursor.execute("""
                IF COL_LENGTH('users', 'work_name') IS NULL
                ALTER TABLE users ADD work_name NVARCHAR(500) NULL;
            """)
            cursor.execute("""
                IF COL_LENGTH('users', 'request_id') IS NULL
                ALTER TABLE users ADD request_id NVARCHAR(64) NULL;
            """)
            cursor.execute("""
                IF EXISTS (
                    SELECT 1
                    FROM sys.columns
                    WHERE object_id = OBJECT_ID('users')
                      AND name = 'photo'
                )
                ALTER TABLE users DROP COLUMN photo;
            """)
            cursor.execute("""
                IF NOT EXISTS (
                    SELECT 1
                    FROM sys.indexes
                    WHERE name = 'UX_users_request_id'
                      AND object_id = OBJECT_ID('users')
                )
                CREATE UNIQUE INDEX UX_users_request_id
                    ON users (request_id)
                    WHERE request_id IS NOT NULL;
            """)
            print("✅ Tabla users de Azure SQL verificada/creada")
    except Exception as err:
        print(f"⚠️ Error inicializando tabla users en Azure SQL: {err}")


def warm_up_azure_sql_connection() -> None:
    """
    Warm-up de conexión para reducir fallos en el primer request.
    """
    if not _get_azure_sql_connection_string():
        return
    try:
        with get_azure_sql_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT 1;")
            cursor.fetchone()
        print("✅ Warm-up Azure SQL completado")
    except Exception as err:
        # No bloquea el arranque; los endpoints volverán a reintentar al conectar.
        print(f"⚠️ Warm-up Azure SQL falló: {err}")


def insert_user_azure_sql(
    full_name: str,
    email: str,
    real_name: Optional[str] = None,
    work_name: Optional[str] = None,
    request_id: Optional[str] = None,
) -> int:
    """
    Inserta un usuario en Azure SQL y devuelve el id (order number).
    """
    with get_azure_sql_connection() as conn:
        cursor = conn.cursor()
        try:
            if request_id:
                cursor.execute(
                    "SELECT id FROM users WHERE request_id = ?;",
                    (request_id,),
                )
                existing = cursor.fetchone()
                if existing and existing[0] is not None:
                    return int(existing[0])
            cursor.execute(
                """
                INSERT INTO users (full_name, email, [timestamp], real_name, work_name, request_id)
                OUTPUT INSERTED.id
                VALUES (?, ?, ?, ?, ?, ?);
                """,
                (
                    full_name.strip(),
                    email.strip(),
                    datetime.datetime.now(datetime.timezone.utc).isoformat(),
                    real_name.strip() if real_name and real_name.strip() else None,
                    work_name.strip() if work_name and work_name.strip() else None,
                    request_id.strip() if request_id and request_id.strip() else None,
                ),
            )
            row = cursor.fetchone()
        except pyodbc.Error as e:
            print(f"❌ pyodbc.Error: {e}; args={getattr(e, 'args', None)}")
            raise
        if row is None or row[0] is None:
            raise RuntimeError("No se obtuvo id tras INSERT en users")
        return int(float(row[0]))


def update_user_caricature_azure_sql(order_number: str, caricature_base64: str) -> bool:
    """
    Actualiza la caricatura (una sola imagen base64) del usuario en Azure SQL.
    """
    try:
        with get_azure_sql_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                UPDATE users
                SET caricature = ?, caricature_timestamp = ?
                WHERE id = ?;
                """,
                (
                    caricature_base64,
                    datetime.datetime.now(datetime.timezone.utc).isoformat(),
                    order_number,
                ),
            )
            return cursor.rowcount > 0
    except Exception as err:
        print(f"❌ Error actualizando caricature en Azure SQL para {order_number}: {err}")
        return False


def submit_user_number_to_firebase(user_id: str) -> dict[str, Any]:
    """Busca un usuario en Azure SQL y publica su acción de dibujo en Firebase."""
    if firebase_app is None:
        raise RuntimeError("Firebase Admin no está inicializado")
    robot_status = db.reference("status").get()
    if robot_status != "idle":
        raise PermissionError("Robot busy, please wait")
    try:
        numeric_id = int(user_id.strip())
    except (AttributeError, ValueError):
        raise ValueError("user_id debe ser un número entero")
    with get_azure_sql_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""SELECT id, full_name, email, [timestamp], real_name, work_name,
                   request_id, caricature, caricature_timestamp FROM users WHERE id = ?;""", (numeric_id,))
        row = cursor.fetchone()
    if row is None:
        raise LookupError("Usuario no encontrado")
    fields = ("id", "full_name", "email", "timestamp", "real_name", "work_name", "request_id", "caricature", "caricature_timestamp")
    user = dict(zip(fields, row))
    def firebase_value(value: Any) -> Any:
        if value is None: return ""
        if isinstance(value, (datetime.datetime, datetime.date)): return value.isoformat()
        if isinstance(value, bytes): return value.decode("utf-8")
        return value
    action = {
        "caricatureImage": firebase_value(user["caricature"]),
        "fullName": firebase_value(user["full_name"]),
        "timestamp": int(time.time() * 1000),
        "type": "draw_caricature",
        "userId": numeric_id,
    }
    db.reference().update({"robot_action": action})
    return action


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


def parse_generated_base64_list(response: Any) -> list[str]:
    """Extrae y deduplica los ``b64_json`` de una respuesta LiteLLM."""
    data = getattr(response, "data", None)
    if data is None and isinstance(response, dict):
        data = response.get("data")

    results: list[str] = []
    if isinstance(data, list):
        for item in data:
            b64_json = getattr(item, "b64_json", None)
            if b64_json is None and isinstance(item, dict):
                b64_json = item.get("b64_json")
            if isinstance(b64_json, str) and b64_json.strip():
                results.append(b64_json.strip())

    return list(dict.fromkeys(results))


def call_image_generation_sync(photo_base64_or_data_url: str) -> list[str]:
    """
    Edita una imagen mediante LiteLLM SDK contra el endpoint OpenAI-compatible.
    """
    if not is_image_litellm_configured():
        raise RuntimeError("LiteLLM para imágenes no está configurado")

    raw_base64 = extract_base64_payload(photo_base64_or_data_url)
    if not raw_base64:
        raise RuntimeError("Foto base64 vacía")

    try:
        image_bytes = base64.b64decode(raw_base64, validate=True)
    except Exception as err:
        raise RuntimeError(f"Base64 de foto inválido: {err}") from err

    image_file = io.BytesIO(image_bytes)
    image_file.name = "image_to_edit.jpg"

    image_http_client = ImageAPIQueryHTTPHandler(AZURE_OPENAI_IMAGE_API_VERSION)
    try:
        response = litellm.image_edit(
            model=f"openai/{MODEL_IMAGE_NAME}",
            image=image_file,
            prompt=AZURE_OPENAI_IMAGE_PROMPT,
            n=1,
            api_base=get_image_api_base(),
            api_key=get_image_api_key(),
            client=image_http_client,
            timeout=90,
        )
    finally:
        image_http_client.close()

    generated_base64_list = parse_generated_base64_list(response)
    if generated_base64_list:
        print(f"Caricaturas generadas correctamente. Cantidad: {len(generated_base64_list)}")
        return generated_base64_list

    raise RuntimeError("LiteLLM devolvió una respuesta de imagen sin b64_json")


class RegisterUserRequest(BaseModel):
    fullName: str
    email: str
    realName: Optional[str] = None
    workName: Optional[str] = None
    requestId: Optional[str] = None


class CaricatureGenerationRequest(BaseModel):
    orderNumber: str
    photoBase64: str


class NumericUserRequest(BaseModel):
    user_id: str


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
    if not is_litellm_configured():
        raise RuntimeError("LiteLLM Proxy no configurado para resumen")

    headers = {
        "Authorization": f"Bearer {LITELLM_PROXY_API_KEY}",
        "OpenAI-Beta": "realtime=v1",
    }
    realtime_url = f"{LITELLM_PROXY_WS_URL}/v1/realtime?model={MODEL_NAME}"

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

    return await run_with_url(realtime_url)


@app.on_event("startup")
async def on_startup():
    """Inicializa Firebase, listener de status y tabla Azure SQL al arrancar."""
    global main_event_loop
    main_event_loop = asyncio.get_running_loop()
    initialize_firebase_admin()
    setup_firebase_status_listener()
    warm_up_azure_sql_connection()
    init_azure_sql_users_table()


@app.get("/")
async def root():
    """Endpoint de salud"""
    return {
        "status": "ok",
        "message": "GPT Realtime Voice API está funcionando",
        "model": MODEL_NAME,
        "voice_agent": VOICE_AGENT_TYPE.value,
        "configured": is_voice_agent_configured(),
    }


@app.get("/health")
async def health():
    """Endpoint de salud detallado"""
    return {
        "status": "healthy",
        "litellm_proxy_configured": is_litellm_configured(),
        "image_model_configured": is_image_litellm_configured(),
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


@app.post("/photo/register")
async def register_user(payload: RegisterUserRequest):
    """
    Registra un usuario en Azure SQL y devuelve el número de orden (id).
    """
    if not _get_azure_sql_connection_string():
        raise HTTPException(
            status_code=503,
            detail="AZURE_SQL_CONNECTION_STRING no configurado",
        )
    full_name = (payload.fullName or "").strip()
    email = (payload.email or "").strip()
    if not full_name or not email:
        raise HTTPException(
            status_code=400,
            detail="fullName y email son obligatorios",
        )
    real_name = (payload.realName or "").strip() or None
    work_name = (payload.workName or "").strip() or None
    request_id = (payload.requestId or "").strip() or None
    try:
        order_number = await asyncio.to_thread(
            insert_user_azure_sql,
            full_name,
            email,
            real_name,
            work_name,
            request_id,
        )
        return {"orderNumber": str(order_number)}
    except pyodbc.Error as err:
        print(f"❌ Error registrando usuario en Azure SQL: {err}")
        if _is_transient_sql_connect_error(err):
            raise HTTPException(
                status_code=503,
                detail="Azure SQL temporalmente no disponible. Reintentando puede resolverlo.",
            )
        raise HTTPException(status_code=500, detail=str(err))
    except Exception as err:
        print(f"❌ Error registrando usuario en Azure SQL: {err}")
        raise HTTPException(status_code=500, detail=str(err))


@app.post("/robot/submit-number")
async def submit_number(payload: NumericUserRequest):
    """Procesa números introducidos manualmente sin pasar por IA."""
    try:
        action = await asyncio.to_thread(submit_user_number_to_firebase, payload.user_id)
        return {"ok": True, "robot_action": action}
    except ValueError as err:
        raise HTTPException(status_code=400, detail=str(err))
    except LookupError as err:
        raise HTTPException(status_code=404, detail=str(err))
    except PermissionError as err:
        raise HTTPException(status_code=409, detail=str(err))
    except Exception as err:
        print(f"Error procesando número manual: {err}")
        raise HTTPException(status_code=500, detail="No se pudo procesar el número")


@app.post("/photo/generate-caricature")
async def generate_caricature(payload: CaricatureGenerationRequest):
    """
    Genera una caricatura desde la foto con gpt-image-2 y la guarda en Azure SQL
    (un solo valor base64, no array).
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
        print("1) Generando caricatura en Azure...")
        caricatures_base64 = await asyncio.to_thread(
            call_image_generation_sync,
            payload.photoBase64,
        )
        if not caricatures_base64:
            raise RuntimeError("No se generó ninguna imagen")
        # Una sola caricatura: tomar la primera
        single_caricature_base64 = caricatures_base64[0]
        print(f"2) Caricatura generada. longitud base64={len(single_caricature_base64)}")

        print("3) Guardando caricatura en Azure SQL...")
        updated_ok = await asyncio.to_thread(
            update_user_caricature_azure_sql,
            order_number,
            single_caricature_base64,
        )
        if not updated_ok:
            raise RuntimeError("No se pudo guardar la caricatura en Azure SQL")

        print(f"✅ Caricatura guardada en users id={order_number}")
        return {
            "ok": True,
            "orderNumber": order_number,
            "storedInSql": True,
            "generatedCount": 1,
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
    Según VOICE_AGENT_TYPE, conecta con Erni Agent o LiteLLM Realtime.
    """
    await websocket.accept()

    with active_websockets_lock:
        active_websockets.add(websocket)

    try:
        print(f"Usando agente de voz: {VOICE_AGENT_TYPE.value}")

        if VOICE_AGENT_TYPE == VoiceAgent.ERNI_AGENT:
            await handle_erni_agent(websocket)
        elif VOICE_AGENT_TYPE == VoiceAgent.FULGENCIO_AGENT:
            await handle_fulgencio_agent(websocket)
        else:
            await handle_azure_agent(websocket)
    finally:
        with active_websockets_lock:
            active_websockets.discard(websocket)


async def handle_erni_agent(websocket: WebSocket):
    """Conecta el frontend con el agente Erni externo."""
    await handle_external_agent(websocket, ERNI_AGENT_URL, "Erni Agent")


async def handle_fulgencio_agent(websocket: WebSocket):
    """Conecta el frontend con el agente Fulgencio externo."""
    await handle_external_agent(
        websocket,
        FULGENCIO_AGENT_URL,
        "Fulgencio Agent",
        conversation_instructions=FULGENCIO_CONVERSATION_INSTRUCTIONS,
    )


async def handle_external_agent(
    websocket: WebSocket,
    url: str,
    label: str,
    *,
    conversation_instructions: str | None = None,
):
    """Proxy genérico para agentes externos que implementan el protocolo Erni."""
    if not url:
        await websocket.send_json({
            "type": "error",
            "message": f"{label} no está configurado."
        })
        await websocket.close()
        return
    try:
        connection_url = (
            add_config_query(url) if conversation_instructions else url
        )
        parsed_url = urllib.parse.urlsplit(connection_url)
        print(f"Conectando a {label}: {parsed_url.hostname or 'host externo'}")
        async with websockets.connect(connection_url) as external_ws:
            if conversation_instructions:
                await external_ws.send(
                    json.dumps(
                        {
                            "type": "conversation.configure",
                            "instructions": conversation_instructions,
                        },
                        ensure_ascii=False,
                    )
                )
            await handle_external_agent_connection(external_ws, websocket, label)
    
    except Exception as e:
        print(f"Error en {label} WebSocket: {type(e).__name__}")
        try:
            if websocket.client_state.name != "DISCONNECTED":
                await websocket.send_json({
                    "type": "error",
                    "message": f"Error al conectar con {label}"
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
    """Maneja la conexión con GPT Realtime a través de LiteLLM."""
    if not is_litellm_configured():
        await websocket.send_json({
            "type": "error",
            "message": "Azure OpenAI no está configurado. Verifica las variables de entorno."
        })
        await websocket.close()
        return

    try:
        realtime_url = f"{LITELLM_PROXY_WS_URL}/v1/realtime?model={MODEL_NAME}"
        print(f"Conectando a LiteLLM Realtime: {realtime_url}")

        headers = {
            "Authorization": f"Bearer {LITELLM_PROXY_API_KEY}",
            "OpenAI-Beta": "realtime=v1",
        }

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


def normalize_external_agent_event(data: dict, label: str) -> dict:
    """Mantiene el contrato del proxy en eventos de sesión del agente remoto."""
    if data.get("type") != "session.created":
        return data
    return {
        **data,
        "voice_agent": VOICE_AGENT_TYPE.value,
        "server_manages_responses": label == "Fulgencio Agent",
    }


async def handle_external_agent_connection(external_ws, websocket: WebSocket, label: str):
    """
    Maneja la conexión con un agente externo compatible.
    - Envía audio PCM binario directamente (16-bit, 16kHz, mono)
    - Recibe eventos JSON: stt_chunk, stt_output, agent_chunk, agent_end, tool_call, tool_result, tts_chunk
    """
    
    async def forward_audio_to_external():
        """Recibe audio del frontend y lo envía como PCM binario."""
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
                            await external_ws.send(audio_data)
                            if len(audio_data) % 100 == 0:
                                print(f"Audio enviado a {label}: {len(audio_data)} bytes")
                        except websockets.exceptions.ConnectionClosed:
                            print(f"Conexión con {label} cerrada (enviando audio)")
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
            print(f"Error enviando audio a {label}: {type(e).__name__}")

    async def forward_events_to_client():
        """Recibe eventos JSON de Erni y los reenvía al frontend"""
        try:
            while True:
                message = await external_ws.recv()
                if isinstance(message, str):
                    try:
                        data = json.loads(message)
                        event_type = data.get("type", "unknown")
                        print(f"Evento de {label}: {event_type}")

                        data = normalize_external_agent_event(data, label)
                        
                        if websocket.client_state.name != "DISCONNECTED":
                            await websocket.send_json(data)
                            
                    except json.JSONDecodeError:
                        print(f"Mensaje no JSON recibido de {label}")
                elif isinstance(message, bytes):
                    print(f"Datos binarios inesperados de {label}: {len(message)} bytes")
                    
        except websockets.exceptions.ConnectionClosed:
            print(f"Conexión con {label} cerrada")
            try:
                if websocket.client_state.name != "DISCONNECTED":
                    await websocket.send_json({
                        "type": "error",
                        "message": f"Conexión con {label} cerrada"
                    })
            except:
                pass
        except Exception as e:
            print(f"Error recibiendo eventos de {label}: {type(e).__name__}")

    try:
        print(f"Conexión con {label} establecida")
        if websocket.client_state.name != "DISCONNECTED":
            await websocket.send_json({
                "type": "session.created",
                "message": f"Conectado a {label}",
                "voice_agent": VOICE_AGENT_TYPE.value,
                "server_manages_responses": label == "Fulgencio Agent",
            })
        
        audio_task = asyncio.create_task(forward_audio_to_external())
        events_task = asyncio.create_task(forward_events_to_client())
        done, pending = await asyncio.wait(
            {audio_task, events_task}, return_when=asyncio.FIRST_COMPLETED
        )
        for task in pending:
            task.cancel()
        await asyncio.gather(*done, *pending, return_exceptions=True)
    except Exception as e:
        print(f"Error en proxy de {label}: {type(e).__name__}")
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

