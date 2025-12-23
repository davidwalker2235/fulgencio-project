output "resource_group_name" {
  description = "Nombre del grupo de recursos"
  value       = azurerm_resource_group.main.name
}

output "container_registry_name" {
  description = "Nombre del Azure Container Registry"
  value       = azurerm_container_registry.main.name
}

output "container_registry_login_server" {
  description = "URL del servidor de login del ACR"
  value       = azurerm_container_registry.main.login_server
}

output "backend_fqdn" {
  description = "FQDN del backend"
  value       = azurerm_container_app.backend.latest_revision_fqdn
}

output "frontend_fqdn" {
  description = "FQDN del frontend"
  value       = azurerm_container_app.frontend.latest_revision_fqdn
}

output "backend_url" {
  description = "URL completa del backend"
  value       = "https://${azurerm_container_app.backend.latest_revision_fqdn}"
}

output "frontend_url" {
  description = "URL completa del frontend"
  value       = "https://${azurerm_container_app.frontend.latest_revision_fqdn}"
}

