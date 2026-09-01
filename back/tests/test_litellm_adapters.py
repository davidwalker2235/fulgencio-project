import base64
import asyncio
import json
import sys
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import main
import fulgencio_conversation


class _AsyncContext:
    def __init__(self, value):
        self.value = value

    async def __aenter__(self):
        return self.value

    async def __aexit__(self, exc_type, exc, tb):
        return False


class TestLiteLLMAdapters(unittest.TestCase):
    def test_fulgencio_session_events_keep_server_response_management(self):
        event = {"type": "session.created", "message": "Sesión iniciada"}

        with patch.object(
            main, "VOICE_AGENT_TYPE", main.VoiceAgent.FULGENCIO_AGENT
        ):
            normalized = main.normalize_external_agent_event(
                event, "Fulgencio Agent"
            )

        self.assertEqual(normalized["voice_agent"], "fulgencio_agent")
        self.assertIs(normalized["server_manages_responses"], True)

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

    def test_fulgencio_uses_generic_external_proxy(self):
        websocket = SimpleNamespace(
            send_json=AsyncMock(),
            close=AsyncMock(),
            client_state=SimpleNamespace(name="CONNECTED"),
        )
        external_socket = SimpleNamespace(send=AsyncMock())
        main.FULGENCIO_AGENT_URL = "wss://user:pass@agent.example/ws"
        main.FULGENCIO_CONVERSATION_INSTRUCTIONS = "Conversación personalizada"

        async def run():
            with patch.object(
                main.websockets,
                "connect",
                return_value=_AsyncContext(external_socket),
            ) as connect:
                with patch.object(
                    main, "handle_external_agent_connection", new=AsyncMock()
                ) as proxy:
                    await main.handle_fulgencio_agent(websocket)
            return connect, proxy

        connect, proxy = asyncio.run(run())
        connect.assert_called_once_with(
            "wss://user:pass@agent.example/ws?conversation_config=1"
        )
        external_socket.send.assert_awaited_once()
        self.assertEqual(
            json.loads(external_socket.send.await_args.args[0]),
            {
                "type": "conversation.configure",
                "instructions": "Conversación personalizada",
            },
        )
        proxy.assert_awaited_once_with(external_socket, websocket, "Fulgencio Agent")
        self.assertEqual(main.VoiceAgent("fulgencio_agent"), main.VoiceAgent.FULGENCIO_AGENT)

    def test_fulgencio_without_prompt_uses_original_url(self):
        websocket = SimpleNamespace(
            send_json=AsyncMock(),
            close=AsyncMock(),
            client_state=SimpleNamespace(name="CONNECTED"),
        )
        external_socket = SimpleNamespace(send=AsyncMock())
        main.FULGENCIO_AGENT_URL = "wss://user:pass@agent.example/ws"
        main.FULGENCIO_CONVERSATION_INSTRUCTIONS = None

        async def run():
            with patch.object(
                main.websockets,
                "connect",
                return_value=_AsyncContext(external_socket),
            ) as connect:
                with patch.object(
                    main, "handle_external_agent_connection", new=AsyncMock()
                ):
                    await main.handle_fulgencio_agent(websocket)
            return connect

        connect = asyncio.run(run())
        connect.assert_called_once_with(main.FULGENCIO_AGENT_URL)
        external_socket.send.assert_not_awaited()

    def test_conversation_config_query_preserves_existing_query(self):
        url = "wss://user:pass@agent.example/ws?region=eu&conversation_config=old"

        self.assertEqual(
            fulgencio_conversation.add_config_query(url),
            "wss://user:pass@agent.example/ws?region=eu&conversation_config=1",
        )

    def test_missing_prompts_module_uses_default_agent_conversation(self):
        missing = ModuleNotFoundError("No module named prompts", name="prompts")
        with patch.object(
            fulgencio_conversation.importlib, "import_module", side_effect=missing
        ):
            self.assertIsNone(fulgencio_conversation.load_instructions())

    def test_missing_or_empty_prompt_constant_uses_default(self):
        with patch.object(
            fulgencio_conversation.importlib,
            "import_module",
            return_value=SimpleNamespace(),
        ):
            self.assertIsNone(fulgencio_conversation.load_instructions())
        with patch.object(
            fulgencio_conversation.importlib,
            "import_module",
            return_value=SimpleNamespace(FULGENCIO_CONVERSATION_INSTRUCTIONS="   "),
        ):
            self.assertIsNone(fulgencio_conversation.load_instructions())

    def test_prompt_constant_must_be_text(self):
        with self.assertRaisesRegex(TypeError, "debe ser texto"):
            fulgencio_conversation.normalize_instructions(123)


if __name__ == "__main__":
    unittest.main()
