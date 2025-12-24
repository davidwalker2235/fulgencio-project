# Backend - GPT Realtime Voice API

Backend in Python with FastAPI for maintaining voice conversations with the GPT Realtime model deployed on Microsoft Foundry.

## Setup

1. Create a virtual environment:
```bash
python -m venv venv
```

2. Activate the virtual environment:
- Windows: `venv\Scripts\activate`
- Linux/Mac: `source venv/bin/activate`

3. Install dependencies:
```bash
pip install -r requirements.txt
```

4. Configure environment variables:
- Copy `.env.example` to `.env`
- Edit `.env` with your Microsoft Foundry credentials:
  - `AZURE_OPENAI_ENDPOINT`: URL of your Azure OpenAI endpoint
  - `AZURE_OPENAI_API_KEY`: Your API key
  - `AZURE_OPENAI_API_VERSION`: API version (default: 2024-10-01-preview)
  - `MODEL_NAME`: Model name (default: gpt-realtime)

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
- **Model**: GPT Realtime deployed on Microsoft Foundry
- **Transcription**: Whisper-1

## Troubleshooting

### Connection Issues
- Verify that the `.env` file contains correct credentials
- Check that Microsoft Foundry endpoint is accessible
- Ensure the model name matches your deployment

### Audio Processing Errors
- Verify audio format is PCM16 at 24kHz
- Check WebSocket connection stability
- Review server logs for detailed error messages
