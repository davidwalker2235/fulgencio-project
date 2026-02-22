# Secrets y variables para GitHub Actions

Configura estos secrets en el repositorio para que el despliegue a Azure funcione correctamente.

**Dónde añadirlos:** Repositorio → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**.

---

## Secrets obligatorios (ya existentes)

| Secret | Descripción | Usado en |
|--------|-------------|----------|
| `AZURE_CREDENTIALS` | JSON con credenciales del Service Principal de Azure (subscriptionId, clientId, clientSecret, tenantId) | Login en Azure |
| `AZURE_OPENAI_ENDPOINT` | URL del endpoint de Azure OpenAI (ej. `https://xxx.cognitiveservices.azure.com`) | Backend (Terraform) |
| `AZURE_OPENAI_API_KEY` | API Key de Azure OpenAI | Backend (Terraform) |
| `AZURE_OPENAI_API_VERSION` | Versión de la API (ej. `2024-10-01-preview`) | Backend (Terraform) |
| `MODEL_NAME` | Nombre del modelo (ej. `gpt-realtime`) | Backend (Terraform) |
| `FIREBASE_DATABASE_URL` | URL de Firebase Realtime Database (ej. `https://xxx-default-rtdb.europe-west1.firebasedatabase.app`) | Frontend (build) y **Backend (Terraform)** |
| `FIREBASE_API_KEY` | API Key de Firebase | Frontend (build) |
| `FIREBASE_AUTH_DOMAIN` | Auth domain de Firebase | Frontend (build) |
| `FIREBASE_PROJECT_ID` | Project ID de Firebase | Frontend (build) |
| `FIREBASE_STORAGE_BUCKET` | Storage bucket de Firebase | Frontend (build) |
| `FIREBASE_MESSAGING_SENDER_ID` | Messaging Sender ID | Frontend (build) |
| `FIREBASE_APP_ID` | App ID de Firebase | Frontend (build) |
| `FIREBASE_MEASUREMENT_ID` | Measurement ID (analytics) | Frontend (build) |

---

## Secret nuevo a añadir (backend: voz y caricaturas)

| Secret | Descripción | Obligatorio |
|--------|-------------|-------------|
| **`ERNI_AGENT_URL`** | URL completa del WebSocket de Erni Agent, incluyendo usuario y contraseña. Ejemplo: `wss://user:password@robot-agent.enricd.com/ws` | **Sí**, si usas `voice_agent_type=erni_agent`. Si solo usas Azure, puedes dejarlo vacío (no se inyectará en el backend). |

---

## Resumen: qué añadir ahora

1. **`ERNI_AGENT_URL`**  
   - Valor: la misma URL que tienes en `back/.env` como `ERNI_AGENT_URL` (con user y password en la URL).  
   - Si en producción solo usas `azure_agent`, puedes crear el secret con un valor vacío o no crearlo; Terraform no inyectará la variable en ese caso.

2. **`FIREBASE_DATABASE_URL`**  
   - Si ya lo tienes para el build del frontend, no hace falta duplicarlo: el mismo secret se usa ahora también para Terraform (backend).  
   - Si no lo tenías, añádelo para que el backend pueda guardar las caricaturas en Firebase.

---

## Variables con valor por defecto en Terraform (opcional)

Estas tienen default en Terraform; solo crea **variables** en GitHub (Settings → Variables) si quieres override en CI:

- `VOICE_AGENT_TYPE` → default `erni_agent`
- `MODEL_IMAGE_NAME` → default `gpt-image-1.5`
- `AZURE_OPENAI_IMAGE_API_VERSION` → default `2025-04-01-preview`
- `AZURE_OPENAI_IMAGE_PROMPT` → default (texto del prompt de caricatura)

No es necesario crear secrets/variables para estas si los valores por defecto te valen.
