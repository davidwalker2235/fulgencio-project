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
  scope                            = azurerm_container_registry.main.id
  role_definition_name             = "AcrPull"
  principal_id                     = azurerm_user_assigned_identity.main.principal_id
  principal_type                   = "ServicePrincipal"
  skip_service_principal_aad_check = true

  # Asegurar que el role assignment se cree antes de los Container Apps
  depends_on = [
    azurerm_user_assigned_identity.main,
    azurerm_container_registry.main
  ]
}

resource "time_sleep" "acr_role_propagation" {
  depends_on      = [azurerm_role_assignment.acr_pull]
  create_duration = "45s"
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
    time_sleep.acr_role_propagation
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
        name  = "LITELLM_PROXY_HTTP_URL"
        value = "http://localhost:4000"
      }

      env {
        name  = "LITELLM_PROXY_WS_URL"
        value = "ws://localhost:4000"
      }

      env {
        name        = "LITELLM_PROXY_API_KEY"
        secret_name = "litellm-master-key"
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
        for_each = var.voice_agent_type == "erni_agent" ? toset(["enabled"]) : toset([])
        content {
          name        = "ERNI_AGENT_URL"
          secret_name = "erni-agent-url"
        }
      }

      env {
        name        = "AZURE_OPENAI_IMAGE_API_KEY"
        secret_name = "azure-openai-image-api-key"
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
        value = var.azure_openai_image_endpoint != "" ? var.azure_openai_image_endpoint : "${trimspace(trim(var.azure_openai_endpoint, "/"))}/images/generations"
      }

      env {
        name  = "AZURE_OPENAI_IMAGE_EDITS_ENDPOINT"
        value = var.azure_openai_image_edits_endpoint
      }

      env {
        name  = "FIREBASE_DATABASE_URL"
        value = var.firebase_database_url
      }

      env {
        name        = "FIREBASE_SERVICE_ACCOUNT_JSON"
        secret_name = "firebase-service-account-json"
      }

      env {
        name        = "AZURE_SQL_CONNECTION_STRING"
        secret_name = "azure-sql-connection-string"
      }

      env {
        name  = "AZURE_SQL_CONNECT_TIMEOUT_SECONDS"
        value = tostring(var.azure_sql_connect_timeout_seconds)
      }

      env {
        name  = "AZURE_SQL_CONNECT_RETRY_ATTEMPTS"
        value = tostring(var.azure_sql_connect_retry_attempts)
      }

      env {
        name  = "AZURE_SQL_CONNECT_RETRY_BASE_SECONDS"
        value = var.azure_sql_connect_retry_base_seconds
      }

      env {
        name  = "AZURE_SQL_CONNECT_MAX_TOTAL_SECONDS"
        value = var.azure_sql_connect_max_total_seconds
      }

      startup_probe {
        transport               = "HTTP"
        port                    = 8000
        path                    = "/health"
        interval_seconds        = 5
        timeout                 = 2
        failure_count_threshold = 30
      }

      readiness_probe {
        transport               = "HTTP"
        port                    = 8000
        path                    = "/health"
        interval_seconds        = 10
        timeout                 = 3
        failure_count_threshold = 6
      }

      liveness_probe {
        transport               = "HTTP"
        port                    = 8000
        path                    = "/health"
        initial_delay           = 20
        interval_seconds        = 20
        timeout                 = 3
        failure_count_threshold = 3
      }
    }

    container {
      name    = "litellm"
      image   = "${azurerm_container_registry.main.login_server}/backend:${var.backend_image_tag}"
      command = ["python", "/app/run_litellm_proxy.py"]
      cpu     = 0.5
      memory  = "1.0Gi"

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
        name        = "LITELLM_MASTER_KEY"
        secret_name = "litellm-master-key"
      }

      env {
        name  = "LITELLM_HOST"
        value = "0.0.0.0"
      }

      env {
        name  = "LITELLM_PORT"
        value = "4000"
      }

      startup_probe {
        transport               = "HTTP"
        port                    = 4000
        path                    = "/health/liveliness"
        interval_seconds        = 5
        timeout                 = 3
        failure_count_threshold = 30
      }

      readiness_probe {
        transport               = "HTTP"
        port                    = 4000
        path                    = "/health/liveliness"
        interval_seconds        = 10
        timeout                 = 3
        failure_count_threshold = 6
      }

      liveness_probe {
        transport               = "HTTP"
        port                    = 4000
        path                    = "/health/liveliness"
        initial_delay           = 30
        interval_seconds        = 20
        timeout                 = 3
        failure_count_threshold = 3
      }
    }
  }

  registry {
    server   = azurerm_container_registry.main.login_server
    identity = azurerm_user_assigned_identity.main.id
  }

  ingress {
    external_enabled           = true
    target_port                = 8000
    transport                  = "auto"
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

  secret {
    name  = "azure-openai-image-api-key"
    value = var.azure_openai_image_api_key
  }

  secret {
    name  = "litellm-master-key"
    value = var.litellm_master_key
  }

  dynamic "secret" {
    for_each = var.voice_agent_type == "erni_agent" ? toset(["enabled"]) : toset([])
    content {
      name  = "erni-agent-url"
      value = var.erni_agent_url
    }
  }

  secret {
    name  = "firebase-service-account-json"
    value = var.firebase_service_account_json
  }

  secret {
    name  = "azure-sql-connection-string"
    value = var.azure_sql_connection_string
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
    time_sleep.acr_role_propagation
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

      startup_probe {
        transport               = "HTTP"
        port                    = 3000
        path                    = "/"
        interval_seconds        = 5
        timeout                 = 3
        failure_count_threshold = 30
      }

      readiness_probe {
        transport               = "HTTP"
        port                    = 3000
        path                    = "/"
        interval_seconds        = 10
        timeout                 = 3
        failure_count_threshold = 6
      }

      liveness_probe {
        transport               = "HTTP"
        port                    = 3000
        path                    = "/"
        initial_delay           = 15
        interval_seconds        = 20
        timeout                 = 3
        failure_count_threshold = 3
      }
    }
  }

  registry {
    server   = azurerm_container_registry.main.login_server
    identity = azurerm_user_assigned_identity.main.id
  }

  ingress {
    external_enabled           = true
    target_port                = 3000
    transport                  = "auto"
    allow_insecure_connections = false
    traffic_weight {
      latest_revision = true
      percentage      = 100
    }
  }

  tags = var.tags
}

