# Backend - GPT Realtime Voice API

Backend en Python con FastAPI para mantener conversaciones de voz con el modelo GPT Realtime desplegado en Microsoft Foundry.

## Configuración

1. Crea un entorno virtual:
```bash
python -m venv venv
```

2. Activa el entorno virtual:
- Windows: `venv\Scripts\activate`
- Linux/Mac: `source venv/bin/activate`

3. Instala las dependencias:
```bash
pip install -r requirements.txt
```

4. Configura las variables de entorno:
- Copia `.env.example` a `.env`
- Edita `.env` con tus credenciales de Microsoft Foundry:
  - `AZURE_OPENAI_ENDPOINT`: URL de tu endpoint de Azure OpenAI
  - `AZURE_OPENAI_API_KEY`: Tu clave API
  - `AZURE_OPENAI_API_VERSION`: Versión de la API (por defecto: 2024-10-01-preview)
  - `MODEL_NAME`: Nombre del modelo (por defecto: gpt-realtime)

5. Ejecuta el servidor:
```bash
python main.py
```

O con uvicorn directamente:
```bash
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

El servidor estará disponible en `http://localhost:8000`

## Endpoints

- `GET /`: Endpoint de salud
- `GET /health`: Estado detallado del servidor
- `WebSocket /ws`: Endpoint para conversación de voz en tiempo real

