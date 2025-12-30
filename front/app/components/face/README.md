# Componente Face Morph Targets para Next.js

Este componente encapsula la animación de morph targets de una cara 3D usando Three.js WebGPU.

## 📦 Dependencias necesarias

Para que este componente funcione en tu proyecto Next.js, necesitas instalar las siguientes dependencias:

```bash
npm install three
```

O si usas yarn:

```bash
yarn add three
```

## 📁 Estructura de archivos

```
face/
├── FaceMorphTargets.tsx    # Componente principal
├── styles.css              # Estilos del componente
├── README.md              # Este archivo
└── public/                # Recursos estáticos
    ├── models/
    │   └── gltf/
    │       └── facecap.glb  # Modelo 3D de la cara
    └── jsm/
        └── libs/
            └── basis/      # Librerías para decodificación KTX2
                ├── basis_transcoder.js
                └── basis_transcoder.wasm
```

## 🚀 Instalación

1. **Copia la carpeta `face`** a tu proyecto Next.js (puedes colocarla en `components/`, `app/`, o donde prefieras).

2. **Copia los archivos públicos**:
   - Copia el contenido de `face/public/` a la carpeta `public/` de tu proyecto Next.js.
   - Asegúrate de mantener la estructura de carpetas: `public/models/gltf/` y `public/jsm/libs/basis/`

3. **Instala las dependencias**:
   ```bash
   npm install three
   ```

## 💻 Uso

### En App Router (Next.js 13+)

```tsx
// app/page.tsx o cualquier página
import FaceMorphTargets from '@/components/face/FaceMorphTargets';

export default function Home() {
  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <FaceMorphTargets />
    </div>
  );
}
```

### En Pages Router (Next.js 12 o anterior)

```tsx
// pages/index.tsx o cualquier página
import FaceMorphTargets from '../components/face/FaceMorphTargets';

export default function Home() {
  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <FaceMorphTargets />
    </div>
  );
}
```

### Con estilos personalizados

```tsx
<FaceMorphTargets 
  className="mi-clase-personalizada"
  style={{ width: '800px', height: '600px' }}
/>
```

## ⚙️ Características

- ✅ Renderizado con WebGPU (requiere navegador compatible)
- ✅ Controles de órbita para rotar, hacer zoom y pan
- ✅ Animación automática de morph targets
- ✅ Inspector integrado con controles GUI para ajustar morph targets
- ✅ Responsive y se adapta al tamaño del contenedor
- ✅ Limpieza automática de recursos al desmontar

## 🌐 Requisitos del navegador

Este componente requiere un navegador que soporte WebGPU:
- Chrome/Edge 113+
- Firefox Nightly (con flags habilitados)
- Safari 18+ (macOS/iOS)

Si el navegador no soporta WebGPU, el componente no funcionará. Considera agregar una verificación o fallback.

## 📝 Notas

- El componente usa `'use client'` porque Three.js requiere ejecutarse en el cliente
- Los recursos estáticos (modelo GLB y librerías WASM) deben estar en la carpeta `public/`
- El componente maneja automáticamente el resize y la limpieza de recursos
- El inspector de Three.js está habilitado y permite ajustar los morph targets en tiempo real

## 🔧 Solución de problemas

### El modelo no carga
- Verifica que `facecap.glb` esté en `public/models/gltf/`
- Verifica la consola del navegador para errores de carga

### WebGPU no funciona
- Verifica que tu navegador soporte WebGPU
- En Chrome, ve a `chrome://gpu` y verifica que WebGPU esté habilitado

### Los archivos WASM no se cargan
- Verifica que los archivos de `basis/` estén en `public/jsm/libs/basis/`
- Verifica que la ruta en el código (`/jsm/libs/basis/`) coincida con tu estructura de carpetas

## 📄 Licencia

Este componente utiliza Three.js (licencia MIT) y el modelo Face Cap de Bannaflak.

