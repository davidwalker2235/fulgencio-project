from __future__ import annotations

import importlib
import urllib.parse
from typing import Any


def normalize_instructions(value: Any) -> str | None:
    if value is None:
        return None
    if not isinstance(value, str):
        raise TypeError("FULGENCIO_CONVERSATION_INSTRUCTIONS debe ser texto o None")
    normalized = value.strip()
    return normalized or None


def load_instructions() -> str | None:
    """Carga el perfil opcional del proyecto consumidor."""
    try:
        prompts_module = importlib.import_module("prompts")
    except ModuleNotFoundError as exc:
        if exc.name == "prompts":
            return None
        raise
    return normalize_instructions(
        getattr(prompts_module, "FULGENCIO_CONVERSATION_INSTRUCTIONS", None)
    )


def add_config_query(url: str) -> str:
    parts = urllib.parse.urlsplit(url)
    query = [
        (key, value)
        for key, value in urllib.parse.parse_qsl(parts.query, keep_blank_values=True)
        if key != "conversation_config"
    ]
    query.append(("conversation_config", "1"))
    return urllib.parse.urlunsplit(
        (
            parts.scheme,
            parts.netloc,
            parts.path,
            urllib.parse.urlencode(query),
            parts.fragment,
        )
    )
