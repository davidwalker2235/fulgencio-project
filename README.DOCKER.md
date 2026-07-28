# Ejecución con Docker Compose

El stack contiene:

- `backend`: FastAPI en `http://localhost:8000`.
- `litellm`: Proxy interno con healthcheck en el puerto `4000`.
- `frontend`: Next.js en `http://localhost:8080`.

La configuración local se carga desde `back/.env`.

```bash
docker compose up --build
```

Compose utiliza `sk-litellm-local-dev` como clave interna local si no se define `LITELLM_MASTER_KEY`. Las claves del proveedor siguen leyéndose desde `back/.env`.

Comandos útiles:

```bash
docker compose ps
docker compose logs -f backend litellm
docker compose down
```
