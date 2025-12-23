# Guía de Despliegue en Azure con Terraform y GitHub Actions

Esta guía te explica paso a paso cómo configurar el despliegue automático de tu proyecto en Azure usando Terraform y GitHub Actions.

## 📋 Requisitos Previos

- Cuenta de Azure con suscripción activa
- Cuenta de GitHub
- Terraform instalado localmente (opcional, para pruebas)
- Azure CLI instalado (opcional, para pruebas)

## 🚀 Paso 1: Crear Service Principal en Azure

El Service Principal es necesario para que GitHub Actions pueda autenticarse en Azure.

### 1.1. Instalar Azure CLI (si no lo tienes)

```bash
# Windows (PowerShell)
Invoke-WebRequest -Uri https://aka.ms/installazurecliwindows -OutFile .\AzureCLI.msi
Start-Process msiexec.exe -Wait -ArgumentList '/I AzureCLI.msi /quiet'

# Mac
brew install azure-cli

# Linux
curl -sL https://aka.ms/InstallAzureCLIDeb | sudo bash
```

### 1.2. Iniciar sesión en Azure

```bash
az login
```

### 1.3. Obtener tu Subscription ID

Primero necesitas tu Subscription ID:

```bash
az account show --query id --output tsv
```

**Guarda este valor** - lo necesitarás en el siguiente paso.

### 1.4. Crear Service Principal

```bash
# Reemplaza 'tu-subscription-id' con el valor obtenido en el paso anterior
az ad sp create-for-rbac --name "fulgencio-sp" \
  --role contributor \
  --scopes /subscriptions/tu-subscription-id \
  --sdk-auth
```

**⚠️ IMPORTANTE**: Después de crear el Service Principal, necesitas asignarle el rol **"User Access Administrator"** para que pueda crear asignaciones de roles (necesario para la autenticación con ACR):

```bash
# Obtener el Object ID del Service Principal
SP_OBJECT_ID=$(az ad sp list --display-name "fulgencio-sp" --query "[0].id" -o tsv)

# Asignar el rol "User Access Administrator" a nivel de suscripción
az role assignment create \
  --assignee $SP_OBJECT_ID \
  --role "User Access Administrator" \
  --scope /subscriptions/tu-subscription-id
```

**Alternativa**: Si prefieres usar el rol "Owner" (que incluye todos los permisos):

```bash
az role assignment create \
  --assignee $SP_OBJECT_ID \
  --role "Owner" \
  --scope /subscriptions/tu-subscription-id
```

**⚠️ IMPORTANTE**: 
- Este comando mostrará un JSON completo
- **Copia TODO el JSON**, incluyendo las llaves `{}`
- Este JSON completo es el valor del secreto `AZURE_CREDENTIALS` en GitHub
- **Guárdalo de forma segura** - el `clientSecret` solo se muestra una vez

## 🔐 Paso 2: Configurar Secretos en GitHub

### 2.1. Acceder a la configuración de secretos

1. Ve a tu repositorio en GitHub
2. Click en **Settings** (Configuración)
3. En el menú lateral, click en **Secrets and variables** → **Actions**
4. Click en **New repository secret**

### 2.2. Crear los siguientes secretos

Crea estos secretos uno por uno:

#### `AZURE_CREDENTIALS`
- **Nombre**: `AZURE_CREDENTIALS`
- **Valor**: La salida JSON completa del comando `az ad sp create-for-rbac` (Paso 1.3)
- **Ejemplo**:
```json
{
  "clientId": "xxxx-xxxx-xxxx-xxxx",
  "clientSecret": "xxxx-xxxx-xxxx-xxxx",
  "subscriptionId": "xxxx-xxxx-xxxx-xxxx",
  "tenantId": "xxxx-xxxx-xxxx-xxxx"
}
```

#### `AZURE_OPENAI_ENDPOINT` ⚠️ REQUERIDO
- **Nombre**: `AZURE_OPENAI_ENDPOINT`
- **Valor**: Tu endpoint de Azure OpenAI (del archivo `.env`)
- **Dónde encontrarlo**: Abre `back/.env` o `.env` y copia el valor de `AZURE_OPENAI_ENDPOINT`
- **Formato**: `https://tu-recurso.cognitiveservices.azure.com`

#### `AZURE_OPENAI_API_KEY` ⚠️ REQUERIDO
- **Nombre**: `AZURE_OPENAI_API_KEY`
- **Valor**: Tu API key de Azure OpenAI (del archivo `.env`)
- **Dónde encontrarlo**: Abre `back/.env` o `.env` y copia el valor de `AZURE_OPENAI_API_KEY`
- **⚠️ IMPORTANTE**: Mantén este secreto seguro, nunca lo compartas ni lo subas a GitHub

#### `AZURE_OPENAI_API_VERSION` ⚠️ REQUERIDO
- **Nombre**: `AZURE_OPENAI_API_VERSION`
- **Valor**: `2024-10-01-preview`
- **Dónde encontrarlo**: En tu archivo `.env` o `back/.env`

#### `MODEL_NAME` ⚠️ REQUERIDO
- **Nombre**: `MODEL_NAME`
- **Valor**: `gpt-realtime`
- **Dónde encontrarlo**: En tu archivo `.env` o `back/.env`

## 🏗️ Paso 3: Configurar Terraform

### 3.1. Crear Resource Group (primera vez)

Para la primera vez, crea el Resource Group manualmente:

```bash
# Crear Resource Group
az group create --name fulgencio-rg --location "West Europe"
```

**Nota**: El ACR y otros recursos se crearán automáticamente con Terraform. Ya no necesitas crear el ACR manualmente.

### 3.2. Configurar backend de Terraform (opcional pero recomendado)

Para almacenar el estado de Terraform en Azure:

```bash
# Crear Storage Account para el estado
az storage account create \
  --name tfstatefulgencio \
  --resource-group fulgencio-rg \
  --location "West Europe" \
  --sku Standard_LRS

# Crear contenedor
az storage container create \
  --name tfstate \
  --account-name tfstatefulgencio
```

Luego actualiza `terraform/main.tf` en la sección `backend`:

```hcl
backend "azurerm" {
  resource_group_name  = "fulgencio-rg"
  storage_account_name = "tfstatefulgencio"
  container_name       = "tfstate"
  key                  = "fulgencio.terraform.tfstate"
}
```

### 3.3. Crear archivo terraform.tfvars

```bash
cd terraform
cp terraform.tfvars.example terraform.tfvars
```

Edita `terraform/terraform.tfvars` y rellena los valores:

```hcl
resource_group_name = "fulgencio-rg"
location            = "West Europe"
project_name        = "fulgencio"
acr_name            = "fulgencioacr"  # Debe ser único, solo minúsculas y números

azure_openai_endpoint = "https://services-aida-apps-sweden.cognitiveservices.azure.com"
azure_openai_api_key  = "tu_api_key_aqui"
azure_openai_api_version = "2024-10-01-preview"
model_name           = "gpt-realtime"
```

**⚠️ IMPORTANTE**: `terraform.tfvars` está en `.gitignore` y NO se subirá al repositorio.

## 🧪 Paso 4: Probar Terraform localmente (opcional)

```bash
cd terraform

# Inicializar Terraform
terraform init

# Ver qué se va a crear
terraform plan

# Aplicar cambios (crear recursos)
terraform apply
```

## 🔄 Paso 5: Configurar GitHub Actions

El workflow ya está configurado en `.github/workflows/deploy.yml`. Solo necesitas:

1. **Asegurarte de que todos los secretos están configurados** (Paso 2)
2. **Hacer push a la rama main/master** para activar el despliegue

### 5.1. Verificar el workflow

1. Ve a tu repositorio en GitHub
2. Click en **Actions**
3. Deberías ver el workflow "Deploy to Azure"
4. Puedes ejecutarlo manualmente con **Run workflow**

## 📝 Paso 6: Primer Despliegue

### 6.1. Hacer commit y push

```bash
git add .
git commit -m "Configurar despliegue en Azure"
git push origin main
```

### 6.2. Monitorear el despliegue

1. Ve a **Actions** en GitHub
2. Click en el workflow en ejecución
3. Monitorea los pasos:
   - ✅ Checkout code
   - ✅ Build and push backend image
   - ✅ Build and push frontend image
   - ✅ Terraform Init
   - ✅ Terraform Plan
   - ✅ Terraform Apply

### 6.3. Obtener las URLs

Después del despliegue, obtén las URLs:

```bash
cd terraform
terraform output frontend_url
terraform output backend_url
```

O desde Azure Portal:
1. Ve a **Container Apps**
2. Selecciona tu Container App
3. Copia el **Application Url**

## 🔧 Paso 7: Actualizar CORS después del primer despliegue

Después del primer despliegue, necesitas actualizar el CORS con la URL real del frontend:

1. Obtén la URL del frontend (Paso 6.3)
2. Actualiza `terraform/terraform.tfvars`:

```hcl
cors_origins = "https://fulgencio-frontend-xxxxx.azurecontainerapps.io"
```

3. O actualiza directamente en Azure Portal o ejecuta:

```bash
cd terraform
terraform apply -var="cors_origins=https://tu-frontend-url.azurecontainerapps.io"
```

## 🔍 Verificación y Troubleshooting

### Ver logs de los contenedores

```bash
# Backend
az containerapp logs show \
  --name fulgencio-backend \
  --resource-group fulgencio-rg \
  --follow

# Frontend
az containerapp logs show \
  --name fulgencio-frontend \
  --resource-group fulgencio-rg \
  --follow
```

### Verificar estado de los recursos

```bash
az containerapp list --resource-group fulgencio-rg --output table
```

### Problemas comunes

#### Error: "ACR name already exists"
- El nombre del ACR debe ser único globalmente
- Cambia `acr_name` en `terraform.tfvars`

#### Error: "Service Principal not found"
- Verifica que el Service Principal existe: `az ad sp list --display-name "fulgencio-sp"`
- Verifica que `AZURE_CREDENTIALS` en GitHub tiene el formato JSON correcto

#### Error: "Image pull failed"
- Verifica que las credenciales del ACR están correctas en GitHub Secrets
- Verifica que las imágenes se subieron correctamente: `az acr repository list --name fulgencioacr`

#### Error: "Container App not accessible"
- Verifica que el ingress está habilitado: `az containerapp ingress show --name fulgencio-frontend --resource-group fulgencio-rg`
- Verifica los logs del contenedor para errores de aplicación

## 📚 Recursos Adicionales

- [Documentación de Azure Container Apps](https://docs.microsoft.com/azure/container-apps/)
- [Documentación de Terraform Azure Provider](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs)
- [GitHub Actions para Azure](https://github.com/azure/login)

## 🔄 Actualizaciones Automáticas

Una vez configurado, cada vez que hagas push a la rama `main` o `master`:

1. GitHub Actions construirá las imágenes Docker
2. Las subirá al Azure Container Registry
3. Terraform actualizará los Container Apps con las nuevas imágenes
4. Los contenedores se reiniciarán automáticamente con la nueva versión

¡Listo! Tu aplicación se desplegará automáticamente en Azure. 🎉

