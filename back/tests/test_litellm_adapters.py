import base64
import asyncio
import sys
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import main


class _AsyncContext:
    def __init__(self, value):
        self.value = value

    async def __aenter__(self):
        return self.value

    async def __aexit__(self, exc_type, exc, tb):
        return False


class TestLiteLLMAdapters(unittest.TestCase):
    def test_parse_generated_base64_list_supports_sdk_objects(self):
        response = SimpleNamespace(
            data=[
                SimpleNamespace(b64_json="first"),
                SimpleNamespace(b64_json="first"),
                SimpleNamespace(b64_json="second"),
            ]
        )

        self.assertEqual(main.parse_generated_base64_list(response), ["first", "second"])

    @patch.object(main.litellm, "image_edit")
    def test_image_edit_uses_upstream_sdk_and_returns_base64(self, image_edit):
        source = base64.b64encode(b"image-bytes").decode("ascii")
        image_edit.return_value = SimpleNamespace(
            data=[SimpleNamespace(b64_json="generated-image")]
        )
        main.AZURE_OPENAI_ENDPOINT = "https://proxy.example"
        main.AZURE_OPENAI_IMAGE_EDITS_ENDPOINT = (
            "https://proxy.example/images/edits"
        )
        main.AZURE_OPENAI_API_KEY = "upstream-key"
        main.AZURE_OPENAI_IMAGE_API_VERSION = "2025-04-01-preview"
        main.MODEL_IMAGE_NAME = "gpt-image-2"

        result = main.call_image_generation_sync(source)

        self.assertEqual(result, ["generated-image"])
        kwargs = image_edit.call_args.kwargs
        self.assertEqual(kwargs["model"], "openai/gpt-image-2")
        self.assertEqual(kwargs["api_base"], "https://proxy.example")
        self.assertEqual(kwargs["api_key"], "upstream-key")
        self.assertIsInstance(kwargs["client"], main.ImageAPIQueryHTTPHandler)

    def test_image_edit_rejects_invalid_base64(self):
        main.AZURE_OPENAI_ENDPOINT = "https://proxy.example"
        main.AZURE_OPENAI_IMAGE_EDITS_ENDPOINT = (
            "https://proxy.example/images/edits"
        )
        main.AZURE_OPENAI_API_KEY = "upstream-key"
        with self.assertRaisesRegex(RuntimeError, "Base64"):
            main.call_image_generation_sync("not-base64")

    def test_image_http_handler_adds_api_version_query(self):
        handler = main.ImageAPIQueryHTTPHandler("2025-04-01-preview")
        try:
            with patch.object(main.HTTPHandler, "post", return_value=object()) as post:
                handler.post(url="https://proxy.example/images/edits")
            self.assertEqual(
                post.call_args.kwargs["params"],
                {"api-version": "2025-04-01-preview"},
            )
        finally:
            handler.close()

    def test_realtime_connects_to_litellm_proxy(self):
        websocket = SimpleNamespace(
            send_json=AsyncMock(),
            close=AsyncMock(),
            client_state=SimpleNamespace(name="CONNECTED"),
        )
        realtime_socket = object()
        main.LITELLM_PROXY_WS_URL = "ws://proxy:4000"
        main.LITELLM_PROXY_API_KEY = "proxy-key"
        main.MODEL_NAME = "gpt-realtime-1.5"

        async def run():
            with patch.object(main.websockets, "connect", return_value=_AsyncContext(realtime_socket)) as connect:
                with patch.object(main, "handle_realtime_connection", new=AsyncMock()):
                    await main.handle_azure_agent(websocket)
            return connect

        connect = asyncio.run(run())
        args, kwargs = connect.call_args
        self.assertEqual(args[0], "ws://proxy:4000/v1/realtime?model=gpt-realtime-1.5")
        self.assertEqual(
            kwargs["additional_headers"],
            {"Authorization": "Bearer proxy-key", "OpenAI-Beta": "realtime=v1"},
        )


if __name__ == "__main__":
    unittest.main()
