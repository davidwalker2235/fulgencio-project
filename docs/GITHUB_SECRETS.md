# Secrets y variables de GitHub Actions

Configúralos en `Settings → Secrets and variables → Actions`.

## Secrets obligatorios

| Secret | Valor |
|---|---|
| `AZURE_CREDENTIALS` | JSON del Service Principal con `clientId`, `clientSecret`, `subscriptionId` y `tenantId`. |
| `AZURE_OPENAI_ENDPOINT` | El valor de `back/.env` con ese nombre. Debe ser la URL base HTTPS del endpoint OpenAI-compatible. |
| `AZURE_OPENAI_API_KEY` | El valor de `back/.env`. |
| `AZURE_OPENAI_API_VERSION` | El valor de `back/.env`. |
| `AZURE_OPENAI_IMAGE_API_VERSION` | `2025-04-01-preview`, o el valor vigente de `back/.env`. |
| `AZURE_OPENAI_IMAGE_API_KEY` | Clave del endpoint de imagen. Si comparte credenciales con el endpoint general, usa el mismo valor que `AZURE_OPENAI_API_KEY`. No pongas aquí la versión de API. |
| `AZURE_OPENAI_IMAGE_EDITS_ENDPOINT` | El endpoint completo de edición; en el entorno actual termina en `/images/edits`. |
| `LITELLM_MASTER_KEY` | Clave interna nueva, distinta de las claves upstream. Debe comenzar por `sk-` y tener al menos 16 caracteres. |
| `FIREBASE_DATABASE_URL` | URL de Firebase Realtime Database. |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | JSON completo y en una sola línea del Service Account de Firebase Admin. |
| `AZURE_SQL_CONNECTION_STRING` | Cadena de conexión completa de Azure SQL. |
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
| `AZURE_OPENAI_IMAGE_ENDPOINT` | Endpoint de generación (`/images/generations`). La edición usa el secret obligatorio de edits. |
| `FIREBASE_MEASUREMENT_ID` | Firebase Analytics del frontend. |

## Variables de GitHub

| Variable | Valor |
|---|---|
| `VOICE_AGENT_TYPE` | `erni_agent`, `fulgencio_agent` o `azure_agent`. Si no existe, el workflow usa `erni_agent`. |

Los modelos se fijan en el workflow:

- Realtime: `gpt-realtime-1.5`
- Imagen: `gpt-image-2`

No son necesarios los secrets `MODEL_NAME` ni `MODEL_IMAGE_NAME`.

## Permisos de Azure

El Service Principal de `AZURE_CREDENTIALS` necesita:

- `Contributor` para crear y actualizar los recursos.
- `User Access Administrator` u `Owner` para crear la asignación `AcrPull`.

El workflow crea automáticamente un Resource Group y una cuenta de Storage separados para el estado remoto de Terraform. No requiere un secret adicional.
