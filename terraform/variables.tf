variable "resource_group_name" {
  description = "Nombre del grupo de recursos de Azure"
  type        = string
  default     = "fulgencio-rg"
}

variable "location" {
  description = "Región de Azure donde se desplegarán los recursos"
  type        = string
  default     = "West Europe"
}

variable "project_name" {
  description = "Nombre del proyecto (usado para nombrar recursos)"
  type        = string
  default     = "fulgencio"
}

variable "acr_name" {
  description = "Nombre del Azure Container Registry (debe ser único globalmente, solo minúsculas y números)"
  type        = string
  default     = "fulgencioacr"
}

variable "tags" {
  description = "Tags para los recursos de Azure"
  type        = map(string)
  default = {
    Environment = "production"
    Project     = "fulgencio"
  }
}

# Backend variables
variable "backend_min_replicas" {
  description = "Número mínimo de réplicas del backend"
  type        = number
  default     = 1
}

variable "backend_max_replicas" {
  description = "Número máximo de réplicas del backend"
  type        = number
  default     = 3
}

variable "backend_cpu" {
  description = "CPU asignada al contenedor backend (0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0)"
  type        = number
  default     = 0.5
}

variable "backend_memory" {
  description = "Memoria asignada al contenedor backend (0.5Gi, 1.0Gi, 1.5Gi, 2.0Gi, 2.5Gi, 3.0Gi, 3.5Gi, 4.0Gi)"
  type        = string
  default     = "1.0Gi"
}

# Frontend variables
variable "frontend_min_replicas" {
  description = "Número mínimo de réplicas del frontend"
  type        = number
  default     = 1
}

variable "frontend_max_replicas" {
  description = "Número máximo de réplicas del frontend"
  type        = number
  default     = 3
}

variable "frontend_cpu" {
  description = "CPU asignada al contenedor frontend"
  type        = number
  default     = 0.5
}

variable "frontend_memory" {
  description = "Memoria asignada al contenedor frontend"
  type        = string
  default     = "1.0Gi"
}

# Azure OpenAI variables
variable "azure_openai_endpoint" {
  description = "Endpoint de Azure OpenAI"
  type        = string
  sensitive   = true
}

variable "azure_openai_api_key" {
  description = "API Key de Azure OpenAI"
  type        = string
  sensitive   = true
}

variable "azure_openai_api_version" {
  description = "Versión de la API de Azure OpenAI"
  type        = string
  default     = "2024-10-01-preview"
}

variable "model_name" {
  description = "Nombre del modelo de Azure OpenAI"
  type        = string
  default     = "gpt-realtime"
}

variable "cors_origins" {
  description = "Orígenes permitidos para CORS"
  type        = string
  default     = "https://fulgencio-frontend.*.azurecontainerapps.io"
}

# Voice agent (erni_agent | azure_agent)
variable "voice_agent_type" {
  description = "Tipo de agente de voz: erni_agent o azure_agent"
  type        = string
  default     = "erni_agent"
}

variable "erni_agent_url" {
  description = "URL del WebSocket de Erni Agent (incluye credenciales)"
  type        = string
  default     = ""
  sensitive   = true
}

# Imagen / caricaturas (Azure OpenAI gpt-image-1.5)
variable "model_image_name" {
  description = "Nombre del modelo de imagen Azure OpenAI"
  type        = string
  default     = "gpt-image-1.5"
}

variable "azure_openai_image_api_version" {
  description = "Versión de la API de generación de imágenes"
  type        = string
  default     = "2025-04-01-preview"
}

variable "azure_openai_image_prompt" {
  description = "Prompt para generación de caricaturas"
  type        = string
  default     = "Make an exaggerated caricature of the person appearing in this photo in a line drawing style. I want the lines to be thin and the details to be as minimalist as possible while preserving the exaggerated proportions."
}

variable "azure_openai_image_endpoint" {
  description = "Endpoint de generación de imágenes (vacío = se construye desde azure_openai_endpoint)"
  type        = string
  default     = ""
}

variable "azure_openai_image_edits_endpoint" {
  description = "Endpoint de edición de imágenes para caricaturas (vacío = se construye desde azure_openai_endpoint)"
  type        = string
  default     = ""
}

# Firebase (backend: guardar caricaturas en Realtime Database)
variable "firebase_database_url" {
  description = "URL de Firebase Realtime Database para el backend"
  type        = string
  default     = ""
}

# Tags de imagen para forzar nueva revisión en cada deploy (evita reinicio manual)
variable "backend_image_tag" {
  description = "Tag de la imagen backend (usar github.sha en CI para que Container Apps detecte cambios)"
  type        = string
  default     = "latest"
}

variable "frontend_image_tag" {
  description = "Tag de la imagen frontend (usar github.sha en CI para que Container Apps detecte cambios)"
  type        = string
  default     = "latest"
}

