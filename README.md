# Proyecto de Conversación de Voz con GPT Realtime

Este proyecto permite mantener conversaciones de voz en tiempo real con el modelo GPT Realtime desplegado en Microsoft Foundry.

## Estructura del Proyecto

```
fulgencio-project/
├── back/          # Backend en Python con FastAPI
└── front/         # Frontend en Next.js
```

## Requisitos Previos

- Python 3.8 o superior
- Node.js 18 o superior
- Credenciales de Microsoft Foundry (endpoint y API key)

## Configuración del Backend

1. Navega a la carpeta `back`:
```bash
cd back
```

2. Crea un entorno virtual:
```bash
python -m venv venv
```

3. Activa el entorno virtual:
- Windows: `venv\Scripts\activate`
- Linux/Mac: `source venv/bin/activate`

4. Instala las dependencias:
```bash
pip install -r requirements.txt
```

5. Configura las variables de entorno:
- Crea un archivo `.env` en la carpeta `back` con el siguiente contenido:
```
AZURE_OPENAI_ENDPOINT=https://tu-endpoint.openai.azure.com
AZURE_OPENAI_API_KEY=tu-api-key-aqui
AZURE_OPENAI_API_VERSION=2024-10-01-preview
MODEL_NAME=gpt-realtime
```

6. Ejecuta el servidor:
```bash
python main.py
```

O con uvicorn directamente:
```bash
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

El servidor estará disponible en `http://localhost:8000`

## Configuración del Frontend

1. Navega a la carpeta `front`:
```bash
cd front
```

2. Instala las dependencias:
```bash
npm install
```

3. Ejecuta el servidor de desarrollo:
```bash
npm run dev
```

La aplicación estará disponible en `http://localhost:3000`

## Uso

1. Asegúrate de que ambos servidores estén ejecutándose (backend en puerto 8000 y frontend en puerto 3000).

2. Abre tu navegador y ve a `http://localhost:3000`.

3. Haz clic en el botón "Iniciar Conversación" para comenzar.

4. Permite el acceso al micrófono cuando el navegador lo solicite.

5. Habla con la IA. Verás la transcripción de la conversación en tiempo real.

6. Haz clic en "Detener Conversación" para finalizar.

## Características

- ✅ Conversación de voz en tiempo real
- ✅ Transcripción de la conversación
- ✅ Indicador de estado de conexión
- ✅ Manejo de errores
- ✅ Interfaz moderna y responsive

## Solución de Problemas

### Error: "Azure OpenAI no está configurado"
- Verifica que el archivo `.env` existe en la carpeta `back` y contiene las credenciales correctas.

### Error: "Error al acceder al micrófono"
- Asegúrate de haber dado permisos al navegador para acceder al micrófono.
- Verifica que no haya otras aplicaciones usando el micrófono.

### Error: "Error en la conexión WebSocket"
- Verifica que el backend esté ejecutándose en el puerto 8000.
- Verifica que las credenciales de Microsoft Foundry sean correctas.
- Revisa la consola del navegador para más detalles del error.

## Notas

- El proyecto está configurado para usar el modelo `gpt-realtime` desplegado en Microsoft Foundry.
- El audio se procesa en formato PCM16 a 24kHz.
- La transcripción se realiza usando Whisper-1.

