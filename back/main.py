import asyncio
import base64
import json
import os
import sys
from enum import Enum
from typing import Optional

import websockets
from dotenv import load_dotenv
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from openai import AzureOpenAI

load_dotenv()


class VoiceAgent(str, Enum):
    ERNI_AGENT = "erni_agent"
    AZURE_AGENT = "azure_agent"

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

ERNI_AGENT_URL = os.getenv("ERNI_AGENT_URL", "wss://erni_voice_agent_user:74jxGh-J2a41CxZ_pQ2@robot-agent.enricd.com/ws")
VOICE_AGENT_TYPE = VoiceAgent(os.getenv("VOICE_AGENT_TYPE", "erni_agent"))

client: Optional[AzureOpenAI] = None

if AZURE_OPENAI_ENDPOINT and AZURE_OPENAI_API_KEY:
    client = AzureOpenAI(
        api_key=AZURE_OPENAI_API_KEY,
        api_version=AZURE_OPENAI_API_VERSION,
        azure_endpoint=AZURE_OPENAI_ENDPOINT,
    )


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


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """
    Endpoint WebSocket para manejar la conversación de voz en tiempo real.
    Según VOICE_AGENT_TYPE, conecta con Erni Agent o Azure OpenAI Realtime.
    """
    await websocket.accept()
    
    print(f"Usando agente de voz: {VOICE_AGENT_TYPE.value}")
    
    if VOICE_AGENT_TYPE == VoiceAgent.ERNI_AGENT:
        await handle_erni_agent(websocket)
    else:
        await handle_azure_agent(websocket)


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

