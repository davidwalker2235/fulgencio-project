# Backend configurado opcionalmente - descomenta y configura después de crear el Storage Account
# terraform {
#   backend "azurerm" {
#     resource_group_name  = "fulgencio-rg"
#     storage_account_name = "tfstatefulgencio"
#     container_name       = "tfstate"
#     key                  = "fulgencio.terraform.tfstate"
#   }
# }

provider "azurerm" {
  features {
    resource_group {
      prevent_deletion_if_contains_resources = false
    }
  }
}

# Resource Group
resource "azurerm_resource_group" "main" {
  name     = var.resource_group_name
  location = var.location

  tags = var.tags
}

# Container Registry (ACR) para almacenar las imágenes Docker
resource "azurerm_container_registry" "main" {
  name                = var.acr_name
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location
  sku                 = "Basic"
  admin_enabled       = true

  tags = var.tags
}

# Container App Environment
resource "azurerm_container_app_environment" "main" {
  name                       = "${var.project_name}-env"
  resource_group_name        = azurerm_resource_group.main.name
  location                   = azurerm_resource_group.main.location
  log_analytics_workspace_id = azurerm_log_analytics_workspace.main.id

  tags = var.tags
}

# Log Analytics Workspace
resource "azurerm_log_analytics_workspace" "main" {
  name                = "${var.project_name}-logs"
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location
  sku                 = "PerGB2018"
  retention_in_days   = 30

  tags = var.tags
}

# User Assigned Identity para acceder al ACR
resource "azurerm_user_assigned_identity" "main" {
  name                = "${var.project_name}-identity"
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location

  tags = var.tags
}

# Asignar permisos de ACR a la identidad
# Nota: Si el Service Principal no tiene permisos "User Access Administrator" o "Owner",
# este recurso fallará. En ese caso, asigna el rol manualmente usando:
# az role assignment create --assignee <identity-principal-id> --role AcrPull --scope <acr-id>
# IMPORTANTE: Este role assignment debe crearse ANTES de que los Container Apps intenten usar las imágenes
resource "azurerm_role_assignment" "acr_pull" {
  scope                = azurerm_container_registry.main.id
  role_definition_name = "AcrPull"
  principal_id         = azurerm_user_assigned_identity.main.principal_id
  
  # Asegurar que el role assignment se cree antes de los Container Apps
  depends_on = [
    azurerm_user_assigned_identity.main,
    azurerm_container_registry.main
  ]
}

# Container App - Backend
# IMPORTANTE: Depende del role assignment para poder autenticarse con el ACR
resource "azurerm_container_app" "backend" {
  name                         = "${var.project_name}-backend"
  container_app_environment_id = azurerm_container_app_environment.main.id
  resource_group_name          = azurerm_resource_group.main.name
  revision_mode                = "Single"
  identity {
    type         = "UserAssigned"
    identity_ids = [azurerm_user_assigned_identity.main.id]
  }
  
  # Asegurar que el role assignment existe antes de crear el Container App
  depends_on = [
    azurerm_role_assignment.acr_pull
  ]

  template {
    min_replicas = var.backend_min_replicas
    max_replicas = var.backend_max_replicas

    container {
      name   = "backend"
      image  = "${azurerm_container_registry.main.login_server}/backend:${var.backend_image_tag}"
      cpu    = var.backend_cpu
      memory = var.backend_memory

      env {
        name  = "AZURE_OPENAI_ENDPOINT"
        value = var.azure_openai_endpoint
      }

      env {
        name        = "AZURE_OPENAI_API_KEY"
        secret_name = "azure-openai-api-key"
      }

      env {
        name  = "AZURE_OPENAI_API_VERSION"
        value = var.azure_openai_api_version
      }

      env {
        name  = "MODEL_NAME"
        value = var.model_name
      }

      env {
        name  = "CORS_ORIGINS"
        value = var.cors_origins
      }

      env {
        name  = "VOICE_AGENT_TYPE"
        value = var.voice_agent_type
      }

      dynamic "env" {
        for_each = var.erni_agent_url != "" ? { "erni_agent_url" = true } : {}
        content {
          name        = "ERNI_AGENT_URL"
          secret_name = "erni-agent-url"
        }
      }

      env {
        name  = "MODEL_IMAGE_NAME"
        value = var.model_image_name
      }

      env {
        name  = "AZURE_OPENAI_IMAGE_API_VERSION"
        value = var.azure_openai_image_api_version
      }

      env {
        name  = "AZURE_OPENAI_IMAGE_PROMPT"
        value = var.azure_openai_image_prompt
      }

      env {
        name  = "AZURE_OPENAI_IMAGE_ENDPOINT"
        value = var.azure_openai_image_endpoint != "" ? var.azure_openai_image_endpoint : "${trimspace(trim(var.azure_openai_endpoint, "/"))}/openai/deployments/${var.model_image_name}/images/generations"
      }

      env {
        name  = "AZURE_OPENAI_IMAGE_EDITS_ENDPOINT"
        value = var.azure_openai_image_edits_endpoint != "" ? var.azure_openai_image_edits_endpoint : "${trimspace(trim(var.azure_openai_endpoint, "/"))}/openai/deployments/${var.model_image_name}/images/edits"
      }

      env {
        name  = "FIREBASE_DATABASE_URL"
        value = var.firebase_database_url
      }
    }
  }

  registry {
    server   = azurerm_container_registry.main.login_server
    identity = azurerm_user_assigned_identity.main.id
  }

  ingress {
    external_enabled = true
    target_port      = 8000
    transport        = "auto"
    allow_insecure_connections = false
    traffic_weight {
      latest_revision = true
      percentage      = 100
    }
  }

  secret {
    name  = "azure-openai-api-key"
    value = var.azure_openai_api_key
  }

  dynamic "secret" {
    for_each = var.erni_agent_url != "" ? { "erni_agent_url" = true } : {}
    content {
      name  = "erni-agent-url"
      value = var.erni_agent_url
    }
  }

  tags = var.tags
}

# Container App - Frontend
# IMPORTANTE: Depende del role assignment para poder autenticarse con el ACR
resource "azurerm_container_app" "frontend" {
  name                         = "${var.project_name}-frontend"
  container_app_environment_id = azurerm_container_app_environment.main.id
  resource_group_name          = azurerm_resource_group.main.name
  revision_mode                = "Single"
  identity {
    type         = "UserAssigned"
    identity_ids = [azurerm_user_assigned_identity.main.id]
  }
  
  # Asegurar que el role assignment existe antes de crear el Container App
  depends_on = [
    azurerm_role_assignment.acr_pull
  ]

  template {
    min_replicas = var.frontend_min_replicas
    max_replicas = var.frontend_max_replicas

    container {
      name   = "frontend"
      image  = "${azurerm_container_registry.main.login_server}/frontend:${var.frontend_image_tag}"
      cpu    = var.frontend_cpu
      memory = var.frontend_memory

      env {
        name  = "NODE_ENV"
        value = "production"
      }

      env {
        name  = "PORT"
        value = "3000"
      }

      env {
        name  = "HOSTNAME"
        value = "0.0.0.0"
      }

      env {
        name  = "NEXT_PUBLIC_WS_URL"
        value = "wss://${azurerm_container_app.backend.ingress[0].fqdn}/ws"
      }
    }
  }

  registry {
    server   = azurerm_container_registry.main.login_server
    identity = azurerm_user_assigned_identity.main.id
  }

  ingress {
    external_enabled = true
    target_port      = 3000
    transport        = "auto"
    allow_insecure_connections = false
    traffic_weight {
      latest_revision = true
      percentage      = 100
    }
  }

  tags = var.tags
}

