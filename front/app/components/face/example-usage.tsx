// Ejemplo de uso del componente FaceMorphTargets
// Este archivo es solo de referencia, no es necesario copiarlo

'use client';

import React from 'react';
import FaceMorphTargets from './FaceMorphTargets';

// Ejemplo 1: Uso básico
export function BasicExample() {
  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <FaceMorphTargets />
    </div>
  );
}

// Ejemplo 2: Con estilos personalizados
export function StyledExample() {
  return (
    <div style={{ padding: '20px' }}>
      <h1>Face Morph Targets Demo</h1>
      <div style={{ width: '800px', height: '600px', margin: '0 auto' }}>
        <FaceMorphTargets 
          className="custom-face-container"
          style={{ borderRadius: '10px', overflow: 'hidden' }}
        />
      </div>
    </div>
  );
}

// Ejemplo 3: Con verificación de WebGPU
export function WithWebGPUCheck() {
  const [webGPUSupported, setWebGPUSupported] = React.useState(false);

  React.useEffect(() => {
    if (typeof navigator !== 'undefined' && 'gpu' in navigator) {
      setWebGPUSupported(true);
    }
  }, []);

  if (!webGPUSupported) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <h2>WebGPU no está disponible</h2>
        <p>Por favor, usa un navegador compatible con WebGPU (Chrome 113+, Edge 113+, Safari 18+)</p>
      </div>
    );
  }

  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <FaceMorphTargets />
    </div>
  );
}

