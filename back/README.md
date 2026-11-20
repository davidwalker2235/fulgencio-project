# Backend - GPT Realtime Voice API

Backend in Python with FastAPI. Image edits use the LiteLLM OpenAI-compatible image edits endpoint with a virtual key. The `azure_agent` voice mode uses the local LiteLLM Proxy; the normal `fulgencio_agent` mode connects to the external voice agent.

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
  - `DATABASE_URL`: PostgreSQL connection URL with `sslmode=require`. The backend creates the `users` table at startup.
  - `LITELLM_IMAGE_API_BASE`: HTTPS base URL of the LiteLLM gateway that owns the image virtual key.
  - `LITELLM_IMAGE_API_KEY`: virtual key allowed to use the `gpt-image-2` model.
  - `LITELLM_IMAGE_MODEL=gpt-image-2`: model alias configured in LiteLLM.
  - `MODEL_NAME=gpt-realtime-1.5`
  - `LITELLM_MASTER_KEY`: internal key used by the backend and Proxy

`docker-compose.yml` loads `back/.env` for local development and supplies a local internal key if `LITELLM_MASTER_KEY` is absent.

The LiteLLM launcher removes the app's `DATABASE_URL` before starting the proxy,
so LiteLLM does not mistake the Fulgencio database for its own Prisma database.
Image requests use `POST {LITELLM_IMAGE_API_BASE}/v1/images/edits` and authenticate
with the separate `LITELLM_IMAGE_API_KEY`; this key is distinct from
`LITELLM_MASTER_KEY`, which is used by the local voice proxy.

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
- **Image model**: `gpt-image-2` through LiteLLM
- **Realtime gateway**: LiteLLM Proxy on the internal port `4000`
- **Image edits**: Multipart request to LiteLLM's OpenAI-compatible Images API
- **Transcription**: Whisper-1

## Troubleshooting

### Connection Issues
- Verify that the `.env` file contains correct credentials
- Check that the LiteLLM Proxy is running on port `4000`
- Ensure the LiteLLM virtual key is allowed to use the `gpt-image-2` model alias
- Ensure `LITELLM_IMAGE_API_BASE` points to the correct gateway

### Audio Processing Errors
- Verify audio format is PCM16 at 24kHz
- Check WebSocket connection stability
- Review server logs for detailed error messages
# PostgreSQL

Set `DATABASE_URL` in `back/.env` for local development. The backend creates
the `users` table and its request idempotency index at startup. For deployment,
set the GitHub Actions secret `DATABASE_URL`; Terraform passes it to the
backend container as a secret. Use the PostgreSQL connection URL from Azure
with `sslmode=require`.
