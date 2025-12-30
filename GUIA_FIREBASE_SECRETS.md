# 🔐 Guía de Configuración de Firebase Secrets

Esta guía explica cómo configurar las credenciales de Firebase para desarrollo local y producción en Azure.

## 📋 Tabla de Contenidos

1. [Configuración Local](#configuración-local)
2. [Secrets de GitHub](#secrets-de-github)
3. [Cómo Funciona](#cómo-funciona)

---

## 🏠 Configuración Local

### Paso 1: Crear archivo `.env.local`

En el directorio `front/`, crea un archivo llamado `.env.local` (este archivo NO se sube al repositorio):

```bash
cd front
cp .env.local.example .env.local
```

### Paso 2: Completar los valores

Edita el archivo `.env.local` con tus credenciales de Firebase. Puedes usar los valores del archivo `.env.local.example` como referencia.

**⚠️ IMPORTANTE**: El archivo `.env.local` está en `.gitignore` y NO se subirá al repositorio.

---

## 🔑 Secrets de GitHub

Para que las credenciales de Firebase se usen durante el despliegue en Azure, debes crear los siguientes secrets en GitHub.

### Cómo crear secrets en GitHub

1. Ve a tu repositorio en GitHub
2. Click en **Settings** (Configuración)
3. En el menú lateral, click en **Secrets and variables** → **Actions**
4. Click en **New repository secret**
5. Crea cada uno de los secrets listados abajo

### Secrets a crear

Crea los siguientes secrets con estos **nombres exactos** y sus valores correspondientes:

#### 1. `FIREBASE_API_KEY`
- **Nombre**: `FIREBASE_API_KEY`
- **Valor**: `AIzaSyDr61gnqvK8C0QV76M7bA-q0DltMiqpHG0`
- **Descripción**: API Key de Firebase

#### 2. `FIREBASE_AUTH_DOMAIN`
- **Nombre**: `FIREBASE_AUTH_DOMAIN`
- **Valor**: `fulgencio-db.firebaseapp.com`
- **Descripción**: Dominio de autenticación de Firebase

#### 3. `FIREBASE_DATABASE_URL`
- **Nombre**: `FIREBASE_DATABASE_URL`
- **Valor**: `https://fulgencio-db-default-rtdb.europe-west1.firebasedatabase.app`
- **Descripción**: URL de la base de datos en tiempo real de Firebase

#### 4. `FIREBASE_PROJECT_ID`
- **Nombre**: `FIREBASE_PROJECT_ID`
- **Valor**: `fulgencio-db`
- **Descripción**: ID del proyecto de Firebase

#### 5. `FIREBASE_STORAGE_BUCKET`
- **Nombre**: `FIREBASE_STORAGE_BUCKET`
- **Valor**: `fulgencio-db.firebasestorage.app`
- **Descripción**: Bucket de almacenamiento de Firebase

#### 6. `FIREBASE_MESSAGING_SENDER_ID`
- **Nombre**: `FIREBASE_MESSAGING_SENDER_ID`
- **Valor**: `926935150095`
- **Descripción**: ID del remitente de mensajería de Firebase

#### 7. `FIREBASE_APP_ID`
- **Nombre**: `FIREBASE_APP_ID`
- **Valor**: `1:926935150095:web:ee66f4bae895126a1d3d7a`
- **Descripción**: ID de la aplicación web de Firebase

#### 8. `FIREBASE_MEASUREMENT_ID`
- **Nombre**: `FIREBASE_MEASUREMENT_ID`
- **Valor**: `G-JXD0HP9L1Y`
- **Descripción**: ID de medición de Google Analytics (si está habilitado)

---

## 🔄 Cómo Funciona

### Desarrollo Local

1. El archivo `firebaseConfig.ts` lee las variables de entorno con el prefijo `NEXT_PUBLIC_`
2. Next.js carga automáticamente el archivo `.env.local` si existe
3. Si no existe `.env.local`, las variables estarán vacías y la aplicación no funcionará
4. **Solución**: Crea `.env.local` copiando desde `.env.local.example`

### Producción (Azure)

1. Durante el workflow de GitHub Actions, los secrets se pasan como build args al Dockerfile
2. El Dockerfile los convierte en variables de entorno durante el build
3. Next.js las usa durante el proceso de build
4. Las credenciales quedan embebidas en el bundle de producción

### Seguridad

✅ **Las credenciales NO están en el código fuente**
- El archivo `.env.local` está en `.gitignore`
- Los valores hardcodeados fueron removidos de `firebaseConfig.ts`
- Los secrets de GitHub son privados y solo accesibles durante el workflow

⚠️ **Nota sobre credenciales de Firebase**
- Las credenciales de Firebase están diseñadas para ser públicas en el cliente
- Sin embargo, es una buena práctica no exponerlas en el repositorio
- Esto permite rotar credenciales sin cambiar código

---

## ✅ Verificación

### Verificar configuración local

1. Crea el archivo `.env.local` en `front/`
2. Ejecuta `npm run dev` en `front/`
3. La aplicación debería conectarse a Firebase sin errores

### Verificar secrets de GitHub

1. Ve a **Settings** → **Secrets and variables** → **Actions**
2. Verifica que los 8 secrets estén creados
3. En el próximo despliegue, los secrets se usarán automáticamente

---

## 🆘 Troubleshooting

### Error: "Firebase: Error (auth/invalid-api-key)"

- Verifica que el archivo `.env.local` existe en `front/`
- Verifica que todas las variables tienen el prefijo `NEXT_PUBLIC_`
- Reinicia el servidor de desarrollo después de crear/modificar `.env.local`

### Error durante el build en Azure

- Verifica que todos los secrets están creados en GitHub
- Verifica que los nombres de los secrets son exactamente los listados arriba
- Revisa los logs del workflow en GitHub Actions

### Las credenciales no se cargan en producción

- Verifica que el workflow de GitHub Actions está usando los secrets correctos
- Revisa el Dockerfile para asegurarte de que los build args están configurados
- Verifica que las variables de entorno se están pasando correctamente

---

## 📝 Resumen de Archivos

- `front/firebaseConfig.ts` - Lee variables de entorno (sin valores hardcodeados)
- `front/.env.local.example` - Plantilla para configuración local
- `front/.env.local` - Tu configuración local (NO se sube al repo)
- `front/Dockerfile` - Acepta build args de Firebase
- `.github/workflows/deploy.yml` - Pasa secrets como build args

---

**Última actualización**: Configuración para no exponer credenciales en el repositorio

