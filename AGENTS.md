# Fulgencio Project

## Propósito

Aplicación web para registrar personas, obtener una fotografía, generar una caricatura con IA y enviar al robot la orden de dibujarla. También incluye una conversación de voz con un agente de IA.

La aplicación está dividida en `front/` (Next.js, React y TypeScript), `back/` (FastAPI en Python) y `terraform/` (infraestructura). El despliegue usa Docker Compose y GitHub Actions.

## Flujo principal

1. `/login` lee `credentials` de Firebase Realtime Database y valida las credenciales.
2. La autenticación se conserva en `localStorage` mediante `useAuth.ts`.
3. Las páginas `/photo/form`, `/photo/capture` y `/photo/code` recopilan datos, foto y número de usuario.
4. `POST /photo/register` registra el usuario en la tabla `users` de Azure SQL y devuelve `orderNumber`.
5. `POST /photo/generate-caricature` envía la foto a `gpt-image-2` mediante LiteLLM y guarda la imagen base64 en Azure SQL.
6. `POST /robot/submit-number` comprueba que el robot esté libre, busca el usuario en Azure SQL y publica `robot_action` en Firebase.
7. El robot consume `robot_action` y actualiza `status`. El backend escucha ese nodo y reenvía cambios por WebSocket como `firebase.status.changed`.
8. La conversación de voz se ejecuta por `WS /ws` mientras el robot trabaja. `useVoiceConversation.ts` gestiona audio, transcripción, estado y suscripciones Firebase.

## Firebase Realtime Database

Firebase se usa para autenticación y coordinación, no como base principal de usuarios.

- `credentials`: credenciales simples usadas por el login.
- `status`: estado del robot; normalmente `idle` cuando está libre.
- `robot_action`: orden de dibujo publicada por el backend.
- `currentUser`: información temporal del usuario activo.

La ruta `users/{userId}` no debe usarse para guardar resúmenes, fotos ni datos de usuario. Los datos de usuario y caricaturas se almacenan en Azure SQL. Al detener una conversación se limpian `currentUser` y `robot_action`.

La configuración del frontend está en `front/firebaseConfig.ts`. El backend usa Firebase Admin SDK, `FIREBASE_DATABASE_URL` y `FIREBASE_SERVICE_ACCOUNT_JSON`.

## Backend (`back/main.py`)

Endpoints principales:

- `GET /` y `GET /health`: comprobaciones básicas.
- `POST /transcriptions/summarize`: genera un resumen mediante GPT Realtime; no lo almacena en Firebase.
- `POST /photo/register`: registra datos en Azure SQL.
- `POST /photo/generate-caricature`: genera y guarda la caricatura en Azure SQL.
- `POST /robot/submit-number`: valida estado, consulta SQL y publica `robot_action`.
- `WS /ws`: canal de conversación de voz.

La conexión SQL incorpora normalización, reintentos y detección de errores transitorios. La tabla `users` contiene, entre otros, `id`, `full_name`, `email`, `real_name`, `work_name`, `request_id`, `caricature` y `caricature_timestamp`.

El backend puede usar agentes Azure Realtime, Erni o `fulgencio_agent`, según `VOICE_AGENT_TYPE`. Para agentes externos funciona como proxy WebSocket, reenviando audio y eventos.

## Frontend (`front/`)

- `app/login`: autenticación.
- `app/photo/*`: formulario, captura/selección de foto y código.
- `app/screen`: pantalla pública con cámara, estado Firebase y vídeo promocional.
- `app/components/VoiceConversation.tsx`: interfaz de conversación, subtítulos, avatar/vídeo y estado.
- `app/hooks/useVoiceConversation.ts`: audio, WebSocket, transcripción y Firebase.
- `app/hooks/useFirebase.ts`: operaciones genéricas de Realtime Database.
- `app/hooks/useWebSocket.ts`: conexión y eventos WebSocket.
- `app/hooks/useAudioRecording.ts` y `useAudioPlayback.ts`: captura y reproducción PCM16.
- `app/services/audioUtils.ts`: conversiones de audio y nivel de señal.

El audio usa PCM16 a 24 kHz. Las transcripciones se muestran en memoria durante la sesión y no se deben persistir en `users` de Firebase.

Los errores WebSocket se almacenan en `error` y se renderizan mediante `ErrorDisplay.tsx`. Los errores genéricos siguen visibles; el aviso específico de que el robot no empezó a dibujar se oculta para no mostrar una franja roja.

## Agentes de voz y prompts

Cuando `VOICE_AGENT_TYPE=fulgencio_agent`, la conversación se puede personalizar en `back/prompts.py`:

```python
FULGENCIO_CONVERSATION_INSTRUCTIONS = """
Describe aquí la personalidad, el saludo inicial, los temas permitidos,
el recorrido de la conversación y el estilo de charla durante las esperas.
""".strip()
```

El prompt solo define personalidad, idioma, temas y estilo. No debe definir herramientas, argumentos, APIs, SQL, escrituras Firebase ni transiciones internas: esas capacidades pertenecen a `fulgencio-agent`. Si el archivo o la constante no existe o está vacía, el backend no envía configuración y el agente usa su comportamiento predeterminado.

El backend carga `prompts.py` al arrancar; después de modificarlo hay que reiniciarlo o reconstruir y redesplegar el contenedor.

## Configuración y ejecución

Desarrollo local:

```powershell
cd back
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

En otra terminal:

```powershell
cd front
npm install
npm run dev
```

Producción local: `docker compose up --build`. El backend escucha en 8000; el frontend se publica en 8080 y resuelve dinámicamente el hostname del backend para WebSocket.

Variables importantes: `MODEL_NAME`, `MODEL_IMAGE_NAME`, `VOICE_AGENT_TYPE`, URLs de LiteLLM y del agente externo, credenciales Firebase, `AZURE_SQL_CONNECTION_STRING` y claves Azure/LiteLLM. No guardar secretos en el repositorio.

## Reglas para cambios

- Distinguir siempre entre `users` de Azure SQL y el nodo `users` de Firebase; el segundo está fuera del diseño actual.
- Antes de cambiar un timeout, identificar si pertenece a SQL, generación de imágenes, GPT Realtime, proxy WebSocket o lógica del robot.
- Mantener los formatos de eventos Firebase y WebSocket salvo que se actualicen ambos extremos.
- Los mensajes dirigidos al usuario deben ser naturales y no exponer errores internos cuando exista un estado recuperable.
- Después de cambiar `back/`, reiniciar el backend. Después de cambiar `front/`, ejecutar `npm run lint` o una compilación si afecta tipos o rutas.

## Integración de `fulgencio_agent`

1. Configura `FULGENCIO_AGENT_URL` y `VOICE_AGENT_TYPE=fulgencio_agent`.
2. Crea `prompts.py` junto al entrypoint Python con `FULGENCIO_CONVERSATION_INSTRUCTIONS`.
3. Al abrir el WebSocket remoto, añade `conversation_config=1` y envía primero:

```json
{
  "type": "conversation.configure",
  "instructions": "..."
}
```

4. Reenvía audio únicamente después de ese frame.

Un prompt adapta la conversación; no crea capacidades que el agente no tenga implementadas.
