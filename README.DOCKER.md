# Guía de Docker para Fulgencio Project

Este documento explica cómo ejecutar el proyecto completo usando Docker.

## Requisitos Previos

- Docker instalado (versión 20.10 o superior)
- Docker Compose instalado (versión 2.0 o superior)

## Configuración

### 1. Variables de Entorno (REQUERIDO)

**⚠️ IMPORTANTE**: Debes crear un archivo `.env` en la raíz del proyecto. **Sin este archivo, el servidor arrancará pero NO podrá procesar conversaciones de voz** porque necesita las credenciales de Azure OpenAI.

Crea el archivo `.env` con las siguientes variables:

```env
# Azure OpenAI / Microsoft Foundry (REQUERIDAS)
AZURE_OPENAI_ENDPOINT=tu_endpoint_aqui
AZURE_OPENAI_API_KEY=tu_api_key_aqui

# Azure OpenAI / Microsoft Foundry (Opcionales - tienen valores por defecto)
AZURE_OPENAI_API_VERSION=2024-10-01-preview
MODEL_NAME=gpt-realtime

# CORS (opcional, tiene valores por defecto)
CORS_ORIGINS=http://localhost:3000,http://localhost:8080,http://127.0.0.1:3000,http://127.0.0.1:8080
```

**Nota**: Sin `AZURE_OPENAI_ENDPOINT` y `AZURE_OPENAI_API_KEY`, el backend arrancará pero no podrá procesar conversaciones de voz. El servidor mostrará un error cuando intentes conectarte al WebSocket.

### 2. Construir las Imágenes

```bash
docker-compose build
```

O para construir solo un servicio:

```bash
# Solo backend
docker-compose build backend

# Solo frontend
docker-compose build frontend
```

## Ejecutar el Proyecto

### Opción 1: Ejecutar todo el stack

```bash
docker-compose up
```

### Opción 2: Ejecutar en segundo plano

```bash
docker-compose up -d
```

### Opción 3: Ejecutar y reconstruir si hay cambios

```bash
docker-compose up --build
```

## Acceder a la Aplicación

- **Frontend**: http://localhost:8080
- **Backend API**: http://localhost:8000
- **Backend Health Check**: http://localhost:8000/health

## Comandos Útiles

### Ver logs

```bash
# Todos los servicios
docker-compose logs -f

# Solo backend
docker-compose logs -f backend

# Solo frontend
docker-compose logs -f frontend
```

### Detener los servicios

```bash
docker-compose down
```

### Detener y eliminar volúmenes

```bash
docker-compose down -v
```

### Reconstruir sin caché

```bash
docker-compose build --no-cache
```

### Ejecutar comandos en un contenedor

```bash
# Backend
docker-compose exec backend bash

# Frontend
docker-compose exec frontend sh
```

## Estructura de Redes

Los servicios están conectados en una red Docker llamada `fulgencio-network`, lo que permite que se comuniquen entre sí usando los nombres de los servicios como hostnames.

## Desarrollo

Para desarrollo con hot-reload, puedes usar volúmenes:

```yaml
# En docker-compose.yml ya están configurados los volúmenes para el backend
# Para el frontend, puedes agregar:
volumes:
  - ./front:/app
  - /app/node_modules
  - /app/.next
```

Luego ejecuta en modo desarrollo:

```bash
docker-compose up
```

## Solución de Problemas

### El frontend no se conecta al backend

1. Verifica que ambos servicios estén corriendo: `docker-compose ps`
2. Verifica los logs: `docker-compose logs frontend backend`
3. Asegúrate de que la variable `NEXT_PUBLIC_WS_URL` esté configurada correctamente

### Error de permisos

En Linux/Mac, puede ser necesario ajustar permisos:

```bash
sudo chown -R $USER:$USER .
```

### Limpiar todo y empezar de nuevo

```bash
docker-compose down -v
docker system prune -a
docker-compose build --no-cache
docker-compose up
```

## Producción

Para producción, considera:

1. Usar variables de entorno seguras
2. Configurar HTTPS
3. Usar un reverse proxy (nginx)
4. Configurar límites de recursos en docker-compose.yml
5. Usar imágenes específicas en lugar de `latest`

