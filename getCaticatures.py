import argparse
import base64
import contextlib
import io
import os
import random
import subprocess
import sys
import time
from pathlib import Path
from typing import Optional


PROJECT_ROOT = Path(__file__).resolve().parent
BACK_ENV_PATH = PROJECT_ROOT / "back" / ".env"
OUTPUT_DIR = PROJECT_ROOT / "caricatures"
BACK_VENV_PYTHON = PROJECT_ROOT / "back" / "venv" / "Scripts" / "python.exe"


def ensure_backend_venv_python() -> None:
    if os.environ.get("GET_CATICATURES_BOOTSTRAPPED") == "1":
        return

    current_python = Path(sys.executable).resolve()
    if current_python == BACK_VENV_PYTHON.resolve():
        return

    if not BACK_VENV_PYTHON.exists():
        return

    env = os.environ.copy()
    env["GET_CATICATURES_BOOTSTRAPPED"] = "1"
    completed = subprocess.run([str(BACK_VENV_PYTHON), str(Path(__file__).resolve()), *sys.argv[1:]], env=env)
    raise SystemExit(completed.returncode)


ensure_backend_venv_python()

try:
    import psycopg
    from dotenv import load_dotenv
    from PIL import Image
except ModuleNotFoundError as exc:
    missing_module = exc.name or "dependencia desconocida"
    raise SystemExit(
        "Falta la dependencia '"
        f"{missing_module}"
        "'. Instalala en el entorno del backend con: back\\venv\\Scripts\\python.exe -m pip install -r back\\requirements.txt"
    )


def load_environment() -> None:
    if not BACK_ENV_PATH.exists():
        raise FileNotFoundError(f"No se encontro el archivo de entorno: {BACK_ENV_PATH}")
    load_dotenv(BACK_ENV_PATH)


def get_database_url() -> str:
    url = os.getenv("DATABASE_URL", "").strip().strip('"').strip("'")
    if not url:
        raise RuntimeError("DATABASE_URL no esta configurado en back/.env")
    return url


def is_transient_postgres_error(exc: Exception) -> bool:
    message = str(exc).lower()
    transient_markers = ("connection refused", "connection reset", "could not connect",
                         "server closed the connection", "timeout", "timed out",
                         "temporarily unavailable", "too many connections")
    return any(marker in message for marker in transient_markers)


@contextlib.contextmanager
def open_connection():
    database_url = get_database_url()
    last_error = None

    for attempt in range(1, 6):
        try:
            connection = psycopg.connect(database_url, connect_timeout=60)
            break
        except psycopg.OperationalError as exc:
            last_error = exc
            if not is_transient_postgres_error(exc) or attempt == 5:
                raise
            wait_seconds = min(8.0, (2 ** (attempt - 1)) + random.uniform(0.0, 0.5))
            print(f"[WARN] PostgreSQL no disponible en el intento {attempt}/5. Reintentando en {wait_seconds:.1f}s...")
            time.sleep(wait_seconds)
    else:
        raise last_error  # pragma: no cover

    try:
        yield connection
    finally:
        connection.close()


def decode_base64_payload(raw_value: str) -> bytes:
    payload = (raw_value or "").strip()
    if not payload:
        raise ValueError("Base64 vacio")
    if "," in payload and payload.lower().startswith("data:"):
        payload = payload.split(",", 1)[1]
    return base64.b64decode(payload, validate=False)


def save_as_jpeg(image_bytes: bytes, target_path: Path) -> None:
    with Image.open(io.BytesIO(image_bytes)) as image:
        converted = image.convert("RGB")
        converted.save(target_path, format="JPEG", quality=95)


def build_users_query(limit: Optional[int] = None) -> str:
    base_query = "SELECT id, caricature FROM users WHERE caricature IS NOT NULL AND BTRIM(caricature) <> ''"
    if limit is None:
        return base_query
    return f"SELECT id, caricature FROM users WHERE caricature IS NOT NULL AND BTRIM(caricature) <> '' ORDER BY id LIMIT {int(limit)}"


def count_users_with_caricature(connection, limit: Optional[int] = None) -> int:
    if limit is None:
        query = "SELECT COUNT(*) FROM users WHERE caricature IS NOT NULL AND BTRIM(caricature) <> ''"
    else:
        query = (
            "SELECT COUNT(*) FROM ("
            f"SELECT id FROM users WHERE caricature IS NOT NULL AND BTRIM(caricature) <> '' ORDER BY id LIMIT {int(limit)}"
            ") AS limited_users"
        )

    cursor = connection.cursor()
    cursor.execute(query)
    row = cursor.fetchone()
    return int(row[0]) if row else 0


def print_progress(processed: int, total: int, exported: int, skipped: int, user_id: str) -> None:
    if total > 0:
        percent = processed / total * 100
        print(
            f"\rProcesados: {processed}/{total} ({percent:5.1f}%) | Exportadas: {exported} | Omitidas: {skipped} | Ultimo id: {user_id}",
            end="",
            flush=True,
        )
        return

    print(
        f"\rProcesados: {processed} | Exportadas: {exported} | Omitidas: {skipped} | Ultimo id: {user_id}",
        end="",
        flush=True,
    )


def export_caricatures(limit: Optional[int] = None) -> tuple[int, int]:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    query = build_users_query(limit=limit)

    exported = 0
    skipped = 0
    processed = 0

    with open_connection() as connection:
        total = count_users_with_caricature(connection, limit=limit)
        print(f"Registros a procesar: {total}")

        cursor = connection.cursor()
        cursor.execute(query)

        for row in cursor:
            user_id = str(row[0]).strip()
            caricature_value = row[1]
            processed += 1

            if not user_id or not caricature_value:
                skipped += 1
                print_progress(processed, total, exported, skipped, user_id or "sin-id")
                continue

            try:
                image_bytes = decode_base64_payload(caricature_value)
                save_as_jpeg(image_bytes, OUTPUT_DIR / f"{user_id}.jpg")
                exported += 1
            except Exception as exc:
                skipped += 1
                print()
                print(f"[WARN] No se pudo exportar la caricatura del usuario {user_id}: {exc}")

            print_progress(processed, total, exported, skipped, user_id)

    if processed:
        print()

    return exported, skipped


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Descarga las caricaturas base64 de PostgreSQL y las guarda como JPG en la carpeta caricatures.",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        help="Limita el numero de registros procesados.",
    )
    return parser.parse_args()


def main() -> int:
    try:
        args = parse_args()
        load_environment()
        exported, skipped = export_caricatures(limit=args.limit)
        print(f"Caricaturas exportadas: {exported}")
        print(f"Registros omitidos: {skipped}")
        print(f"Carpeta destino: {OUTPUT_DIR}")
        return 0
    except Exception as exc:
        print(f"[ERROR] {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
