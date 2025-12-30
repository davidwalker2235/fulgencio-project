# Dependencias necesarias para Next.js

## 📦 Instalación de paquetes NPM

Ejecuta el siguiente comando en tu proyecto Next.js:

```bash
npm install three
```

O con yarn:

```bash
yarn add three
```

## 📋 Resumen de dependencias

### Dependencias de NPM
- **three** (versión 0.182.0 o superior recomendada)
  - Incluye Three.js core
  - Incluye WebGPU renderer
  - Incluye todos los addons necesarios (OrbitControls, GLTFLoader, etc.)

### Archivos estáticos requeridos

Los siguientes archivos deben estar en la carpeta `public/` de tu proyecto Next.js:

1. **Modelo 3D:**
   - `public/models/gltf/facecap.glb`

2. **Librerías de decodificación KTX2:**
   - `public/jsm/libs/basis/basis_transcoder.js`
   - `public/jsm/libs/basis/basis_transcoder.wasm`
   - `public/jsm/libs/basis/README.md` (opcional)

## 🔍 Verificación

Después de instalar las dependencias, verifica que:

1. ✅ `node_modules/three` existe
2. ✅ `public/models/gltf/facecap.glb` existe
3. ✅ `public/jsm/libs/basis/` contiene los archivos necesarios

## ⚠️ Notas importantes

- **WebGPU**: Este componente requiere WebGPU, que solo está disponible en navegadores modernos (Chrome 113+, Edge 113+, Safari 18+)
- **Next.js**: Asegúrate de usar Next.js 13+ con App Router, o Next.js 12+ con Pages Router
- **TypeScript**: El componente está escrito en TypeScript, pero funcionará también en proyectos JavaScript

## 🚀 Configuración adicional (opcional)

Si quieres usar TypeScript con tipos de Three.js, puedes instalar:

```bash
npm install --save-dev @types/three
```

Pero esto no es necesario ya que Three.js incluye sus propios tipos.

