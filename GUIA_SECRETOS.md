# 🔐 Guía Completa: Configurar Secretos en GitHub y Azure

Esta guía te explica paso a paso dónde encontrar y cómo configurar todos los secretos necesarios para el despliegue automático.

## 📍 Índice

1. [Secretos de Azure (Service Principal)](#1-secretos-de-azure-service-principal)
2. [Secretos de Azure OpenAI](#2-secretos-de-azure-openai)
3. [Configurar Secretos en GitHub](#3-configurar-secretos-en-github)

---

## 1. Secretos de Azure (Service Principal)

### ¿Qué es un Service Principal?
Es una identidad de aplicación que permite a GitHub Actions autenticarse en Azure sin usar tu cuenta personal.

### Paso 1.1: Obtener tu Subscription ID

```bash
# Inicia sesión en Azure
az login

# Obtén tu Subscription ID
az account show --query id --output tsv
```

**Guarda este valor** - lo necesitarás en el siguiente paso.

### Paso 1.2: Crear el Service Principal

```bash
# Reemplaza 'tu-subscription-id' con el valor obtenido en el paso anterior
az ad sp create-for-rbac --name "fulgencio-sp" \
  --role contributor \
  --scopes /subscriptions/tu-subscription-id \
  --sdk-auth
```

**⚠️ IMPORTANTE**: Este comando mostrará un JSON. **Copia TODO el JSON completo**, incluyendo las llaves `{}`.

**Ejemplo de salida**:
```json
{
  "clientId": "12345678-1234-1234-1234-123456789012",
  "clientSecret": "abcdefgh-1234-5678-90ab-cdef12345678",
  "subscriptionId": "87654321-4321-4321-4321-210987654321",
  "tenantId": "11111111-2222-3333-4444-555555555555",
  "activeDirectoryEndpointUrl": "https://login.microsoftonline.com",
  "resourceManagerEndpointUrl": "https://management.azure.com/",
  "activeDirectoryGraphResourceId": "https://graph.windows.net/",
  "sqlManagementEndpointUrl": "https://management.core.windows.net:8443/",
  "galleryEndpointUrl": "https://gallery.azure.com/",
  "managementEndpointUrl": "https://management.core.windows.net/"
}
```

**Este JSON completo es el valor del secreto `AZURE_CREDENTIALS`**

---

## 2. Secretos de Azure OpenAI

### Paso 2.1: Encontrar las credenciales

Las credenciales de Azure OpenAI están en tus archivos `.env`:

**Ubicaciones**:
- `back/.env`
- `.env` (raíz del proyecto)

### Paso 2.2: Valores a copiar

Abre el archivo `back/.env` o `.env` y copia estos valores:

#### `AZURE_OPENAI_ENDPOINT`
- **En el archivo**: Busca la línea que empieza con `AZURE_OPENAI_ENDPOINT=`
- **Valor a copiar**: Copia TODO el valor que aparece después del `=` (sin el `=`)
- **Formato esperado**: `https://tu-recurso.cognitiveservices.azure.com`
- **Ejemplo de cómo se ve en el archivo**: `AZURE_OPENAI_ENDPOINT=https://tu-recurso.cognitiveservices.azure.com`

#### `AZURE_OPENAI_API_KEY`
- **En el archivo**: Busca la línea que empieza con `AZURE_OPENAI_API_KEY=`
- **Valor a copiar**: Copia TODO el valor que aparece después del `=` (sin el `=`)
- **⚠️ IMPORTANTE**: Este es un secreto sensible. No lo compartas ni lo subas a GitHub.
- **Ejemplo de cómo se ve en el archivo**: `AZURE_OPENAI_API_KEY=una-cadena-larga-de-caracteres`

#### `AZURE_OPENAI_API_VERSION`
- **En el archivo**: Busca la línea que empieza con `AZURE_OPENAI_API_VERSION=`
- **Valor a copiar**: Copia TODO el valor que aparece después del `=` (sin el `=`)
- **Ejemplo**: `2024-10-01-preview`

#### `MODEL_NAME`
- **En el archivo**: Busca la línea que empieza con `MODEL_NAME=`
- **Valor a copiar**: Copia TODO el valor que aparece después del `=` (sin el `=`)
- **Ejemplo**: `gpt-realtime`

---

## 3. Configurar Secretos en GitHub

### Paso 3.1: Acceder a la configuración de secretos

1. Ve a tu repositorio en GitHub: `https://github.com/tu-usuario/tu-repositorio`
2. Click en **Settings** (Configuración) - está en la parte superior del repositorio
3. En el menú lateral izquierdo, busca **Secrets and variables**
4. Click en **Actions**
5. Click en **New repository secret** (botón verde)

### Paso 3.2: Crear cada secreto

Crea estos secretos **uno por uno**:

#### Secreto 1: `AZURE_CREDENTIALS`

1. **Name**: `AZURE_CREDENTIALS`
2. **Secret**: Pega el JSON completo del Paso 1.2 (todo el JSON con las llaves `{}`)
3. Click en **Add secret**

#### Secreto 2: `AZURE_OPENAI_ENDPOINT`

1. **Name**: `AZURE_OPENAI_ENDPOINT`
2. **Secret**: Copia el valor de `AZURE_OPENAI_ENDPOINT` de tu archivo `back/.env` o `.env`
3. Click en **Add secret**

#### Secreto 3: `AZURE_OPENAI_API_KEY`

1. **Name**: `AZURE_OPENAI_API_KEY`
2. **Secret**: Copia el valor de `AZURE_OPENAI_API_KEY` de tu archivo `back/.env` o `.env`
3. Click en **Add secret**

#### Secreto 4: `AZURE_OPENAI_API_VERSION`

1. **Name**: `AZURE_OPENAI_API_VERSION`
2. **Secret**: `2024-10-01-preview`
3. Click en **Add secret**

#### Secreto 5: `MODEL_NAME`

1. **Name**: `MODEL_NAME`
2. **Secret**: `gpt-realtime`
3. Click en **Add secret**

### Paso 3.3: Verificar que todos los secretos están creados

Deberías ver estos 5 secretos en la lista:
- ✅ `AZURE_CREDENTIALS`
- ✅ `AZURE_OPENAI_ENDPOINT`
- ✅ `AZURE_OPENAI_API_KEY`
- ✅ `AZURE_OPENAI_API_VERSION`
- ✅ `MODEL_NAME`

---

## ✅ Checklist Final

Antes de hacer el primer despliegue, verifica:

- [ ] Tienes Azure CLI instalado
- [ ] Has iniciado sesión en Azure (`az login`)
- [ ] Has creado el Service Principal y guardado el JSON
- [ ] Has copiado todas las credenciales de Azure OpenAI del archivo `.env`
- [ ] Has creado los 5 secretos en GitHub
- [ ] Has creado el Resource Group en Azure (`az group create --name fulgencio-rg --location "West Europe"`)

---

## 🚀 Siguiente Paso

Una vez configurados todos los secretos, puedes:

1. Hacer push a la rama `main` o `master`
2. O ejecutar el workflow manualmente desde **Actions** → **Deploy to Azure** → **Run workflow**

El despliegue se iniciará automáticamente.

---

## 🔍 Dónde Encontrar Cada Valor - Resumen Rápido

| Secreto | Dónde Encontrarlo |
|---------|-------------------|
| `AZURE_CREDENTIALS` | Comando: `az ad sp create-for-rbac --name "fulgencio-sp" --role contributor --scopes /subscriptions/TU-SUBSCRIPTION-ID --sdk-auth` |
| `AZURE_OPENAI_ENDPOINT` | Archivo: `back/.env` o `.env` - Busca la línea `AZURE_OPENAI_ENDPOINT=` |
| `AZURE_OPENAI_API_KEY` | Archivo: `back/.env` o `.env` - Busca la línea `AZURE_OPENAI_API_KEY=` |
| `AZURE_OPENAI_API_VERSION` | Archivo: `back/.env` o `.env` - Busca la línea `AZURE_OPENAI_API_VERSION=` |
| `MODEL_NAME` | Archivo: `back/.env` o `.env` - Busca la línea `MODEL_NAME=` |

---

## ❓ Preguntas Frecuentes

### ¿Cómo veo los secretos que ya creé?
1. Ve a **Settings** → **Secrets and variables** → **Actions**
2. Verás la lista de todos los secretos (pero no sus valores por seguridad)

### ¿Puedo editar un secreto?
Sí, click en el secreto y luego en **Update**. No puedes ver el valor actual por seguridad.

### ¿Qué pasa si olvido algún secreto?
GitHub Actions fallará con un error indicando qué secreto falta. Revisa los logs en **Actions**.

### ¿Necesito crear el ACR manualmente?
No, Terraform lo creará automáticamente. Solo necesitas crear el Resource Group.

---

¡Listo! Con estos secretos configurados, tu despliegue automático funcionará correctamente. 🎉
