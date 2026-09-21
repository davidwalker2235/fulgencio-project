# Backend - GPT Realtime Voice API

Backend in Python with FastAPI. Image edits call the Azure Foundry Images API directly. The legacy `azure_agent` voice mode still uses the LiteLLM Proxy; the normal `fulgencio_agent` mode connects to the external voice agent.

## Setup

1. Create a virtual environment:
```bash
python -m venv .venv
```

2. Activate the virtual environment:
- Windows: `.venv\Scripts\activate`
- Linux/Mac: `source .venv/bin/activate`

3. Install dependencies:
```bash
pip install -r requirements.txt
```

4. Configure environment variables in `back/.env`:
  - `MODEL_NAME=gpt-realtime-1.5`
  - `MODEL_IMAGE_NAME=gpt-image-2`
  - `AZURE_OPENAI_IMAGE_API_KEY`: key for the Foundry image deployment
  - `AZURE_OPENAI_IMAGE_ENDPOINT=https://<resource>.services.ai.azure.com/openai/v1/images/generations`
  - `AZURE_OPENAI_IMAGE_EDITS_ENDPOINT=https://<resource>.services.ai.azure.com/openai/v1/images/edits`
  - `AZURE_OPENAI_IMAGE_API_VERSION=preview`
  - `LITELLM_MASTER_KEY`: internal key used by the backend and Proxy

`docker-compose.yml` loads `back/.env` for local development and supplies a local internal key if `LITELLM_MASTER_KEY` is absent.

5. Run the server:
```bash
python main.py
```

Or with uvicorn directly:
```bash
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

The server will be available at `http://localhost:8000`

## Endpoints

- `GET /`: Health check endpoint
- `GET /health`: Detailed server status
- `WebSocket /ws`: Real-time voice conversation endpoint

## Features

- Real-time WebSocket communication
- Audio processing (PCM16 format at 24kHz)
- Integration with GPT Realtime model
- Transcription using Whisper-1
- Error handling and connection management

## Technical Details

- **Framework**: FastAPI
- **WebSocket**: Native WebSocket support for real-time communication
- **Audio Format**: PCM16 at 24kHz
- **Realtime model**: `gpt-realtime-1.5`
- **Image model**: `gpt-image-2`
- **Realtime gateway**: LiteLLM Proxy on the internal port `4000`
- **Image edits**: Direct multipart request to the Azure Foundry Images API
- **Transcription**: Whisper-1

## Troubleshooting

### Connection Issues
- Verify that the `.env` file contains correct credentials
- Check that the LiteLLM Proxy is running on port `4000`
- Ensure the Azure image deployment name matches `MODEL_IMAGE_NAME`
- Ensure the Foundry image key and `/openai/v1/images/edits` endpoint are configured

### Audio Processing Errors
- Verify audio format is PCM16 at 24kHz
- Check WebSocket connection stability
- Review server logs for detailed error messages
