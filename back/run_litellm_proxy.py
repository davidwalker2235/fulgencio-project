import os
import sys
from pathlib import Path

from dotenv import load_dotenv


BACK_DIR = Path(__file__).resolve().parent
load_dotenv(BACK_DIR / ".env")
# This URL belongs to the Fulgencio app. LiteLLM treats DATABASE_URL as its
# optional Prisma database setting, which is not configured in this project.
os.environ.pop("DATABASE_URL", None)
os.environ.setdefault("LITELLM_MASTER_KEY", "sk-litellm-local-dev")
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

proxy_host = os.getenv("LITELLM_HOST", "127.0.0.1")
proxy_port = os.getenv("LITELLM_PORT", "4000")

sys.argv = [
    "litellm",
    "--config",
    str(BACK_DIR / "litellm_config.yaml"),
    "--host",
    proxy_host,
    "--port",
    proxy_port,
]

from litellm import run_server

# LiteLLM may load dotenv files while importing. Remove the app's database URL
# again after the import and before proxy startup reads its optional DB config.
os.environ.pop("DATABASE_URL", None)
run_server()
