# Despliegue en Azure

El workflow `.github/workflows/deploy.yml` se ejecuta al hacer push a `main` o `master`, y también manualmente.

## Flujo

1. Comprueba que estén definidos los secrets requeridos.
2. Instala las dependencias y ejecuta los tests del backend.
3. Valida el formato y la configuración de Terraform.
4. Crea, si no existen, el Storage y el contenedor usados para el estado remoto.
5. Crea el Resource Group y ACR base.
6. Construye y publica las imágenes `backend` y `frontend` con el SHA del commit.
7. Despliega:
   - Backend público en el puerto `8000`.
   - LiteLLM como sidecar interno en el puerto `4000`.
   - Frontend público en el puerto `3000`.
8. Comprueba `/health` del backend y la raíz del frontend.

La lista exacta de secrets y variables está en [docs/GITHUB_SECRETS.md](docs/GITHUB_SECRETS.md).

## Permisos del Service Principal

El Service Principal de `AZURE_CREDENTIALS` debe tener:

- `Contributor`.
- `User Access Administrator` u `Owner`, necesario para asignar `AcrPull` a la identidad administrada.

## Ejecución

```bash
git push origin main
```

También se puede iniciar desde `Actions → Deploy to Azure → Run workflow`.

## Diagnóstico

```bash
az containerapp logs show \
  --name fulgencio-backend \
  --resource-group fulgencio-rg \
  --container backend \
  --follow
```

```bash
az containerapp logs show \
  --name fulgencio-backend \
  --resource-group fulgencio-rg \
  --container litellm \
  --follow
```
