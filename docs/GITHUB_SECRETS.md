# Secrets y variables de GitHub Actions

Configúralos en `Settings → Secrets and variables → Actions`.

## Secrets obligatorios

| Secret | Valor |
|---|---|
| `AZURE_CREDENTIALS` | JSON del Service Principal con `clientId`, `clientSecret`, `subscriptionId` y `tenantId`. |
| `AZURE_OPENAI_ENDPOINT` | El valor de `back/.env` con ese nombre. Debe ser la URL base HTTPS del endpoint OpenAI-compatible. |
| `AZURE_OPENAI_API_KEY` | El valor de `back/.env`. |
| `AZURE_OPENAI_API_VERSION` | El valor de `back/.env`. |
| `LITELLM_IMAGE_API_BASE` | URL HTTPS base del LiteLLM Gateway que expone la API de imágenes; no incluyas `/images/edits`. |
| `LITELLM_IMAGE_API_KEY` | Virtual key de LiteLLM autorizada para el alias `gpt-image-2`. |
| `LITELLM_MASTER_KEY` | Clave interna nueva, distinta de las claves upstream. Debe comenzar por `sk-` y tener al menos 16 caracteres. |
| `FIREBASE_DATABASE_URL` | URL de Firebase Realtime Database. |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | JSON completo y en una sola línea del Service Account de Firebase Admin. |
| `DATABASE_URL` | URL PostgreSQL completa (`postgresql://usuario:contraseña@host:5432/base?sslmode=require`). |
| `FIREBASE_API_KEY` | Configuración pública de Firebase para el frontend. |
| `FIREBASE_AUTH_DOMAIN` | Configuración pública de Firebase para el frontend. |
| `FIREBASE_PROJECT_ID` | Configuración pública de Firebase para el frontend. |
| `FIREBASE_STORAGE_BUCKET` | Configuración pública de Firebase para el frontend. |
| `FIREBASE_MESSAGING_SENDER_ID` | Configuración pública de Firebase para el frontend. |
| `FIREBASE_APP_ID` | Configuración pública de Firebase para el frontend. |

Si la variable `VOICE_AGENT_TYPE` vale `erni_agent`, también es obligatorio:

| Secret | Valor |
|---|---|
| `ERNI_AGENT_URL` | URL WebSocket completa del agente Erni, incluidas sus credenciales. |

Si la variable `VOICE_AGENT_TYPE` vale `fulgencio_agent`, también es obligatorio:

| Secret | Valor |
|---|---|
| `FULGENCIO_AGENT_URL` | URL WebSocket completa del agente Fulgencio, incluidas las credenciales Basic Auth. |

## Secrets opcionales

| Secret | Uso |
|---|---|
| `FIREBASE_MEASUREMENT_ID` | Firebase Analytics del frontend. |

## Variables de GitHub

| Variable | Valor |
|---|---|
| `VOICE_AGENT_TYPE` | `erni_agent`, `fulgencio_agent` o `azure_agent`. Si no existe, el workflow usa `erni_agent`. |

Los modelos se fijan en el workflow:

- Realtime: `gpt-realtime-1.5`
- Imagen: `gpt-image-2`

No son necesarios los secrets `MODEL_NAME` ni `LITELLM_IMAGE_MODEL`.

## Permisos de Azure

El Service Principal de `AZURE_CREDENTIALS` necesita:

- `Contributor` para crear y actualizar los recursos.
- `User Access Administrator` u `Owner` para crear la asignación `AcrPull`.

El workflow crea automáticamente un Resource Group y una cuenta de Storage separados para el estado remoto de Terraform. No requiere un secret adicional.
