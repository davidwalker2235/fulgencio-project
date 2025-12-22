# Estructura del Proyecto Frontend

Este proyecto ha sido refactorizado siguiendo buenas prácticas de desarrollo para ser escalable y mantenible.

## Estructura de Carpetas

```
app/
├── components/          # Componentes UI reutilizables
│   ├── ConversationButton.tsx
│   ├── ConnectionStatus.tsx
│   ├── Transcription.tsx
│   ├── ErrorDisplay.tsx
│   └── VoiceConversation.tsx
├── hooks/              # Hooks personalizados
│   ├── useWebSocket.ts
│   ├── useAudioRecording.ts
│   ├── useAudioPlayback.ts
│   └── useVoiceConversation.ts
├── services/           # Servicios y utilidades
│   ├── websocketService.ts
│   └── audioUtils.ts
├── types/              # Tipos TypeScript
│   └── index.ts
├── constants/          # Constantes de configuración
│   └── index.ts
└── page.tsx
```

## Hooks Personalizados

### `useWebSocket`
Maneja la conexión WebSocket con el backend. Proporciona métodos para:
- Conectar/desconectar
- Enviar mensajes
- Registrar handlers de mensajes
- Gestionar eventos de conexión

### `useAudioRecording`
Gestiona la grabación de audio del micrófono. Proporciona:
- Iniciar/detener grabación
- Obtener nivel de audio
- Detectar cuando el usuario está hablando

### `useAudioPlayback`
Maneja la reproducción de audio. Proporciona:
- Reproducir chunks de audio
- Detener toda la reproducción
- Verificar si hay audio activo

### `useVoiceConversation`
Hook principal que orquesta toda la lógica de conversación de voz. Combina los otros hooks y gestiona:
- Estado de la conversación
- Transcripciones
- Manejo de errores
- Interrupciones de audio

## Servicios

### `websocketService`
Clase que encapsula la lógica de comunicación WebSocket, incluyendo:
- Gestión de conexión
- Manejo de mensajes
- Inicialización de sesión

### `audioUtils`
Utilidades para procesamiento de audio:
- Conversión entre formatos (Float32, PCM16)
- Cálculo de niveles de audio
- Conversión de base64 a audio

## Componentes

Todos los componentes están separados por responsabilidad:
- **ConversationButton**: Botón para iniciar/detener conversación
- **ConnectionStatus**: Indicador de estado de conexión
- **Transcription**: Lista de mensajes transcritos
- **ErrorDisplay**: Mostrar errores al usuario

## Escalabilidad

Esta estructura está preparada para:
- ✅ Agregar nuevas funcionalidades sin modificar código existente
- ✅ Reutilizar hooks y componentes en otras partes de la aplicación
- ✅ Fácil integración con bases de datos (preparado para futuras mejoras)
- ✅ Testing unitario de cada hook y servicio de forma independiente
- ✅ Mantenimiento y debugging más sencillo

## Próximos Pasos

Cuando se agregue la base de datos, se puede:
1. Crear un hook `useDatabase` para operaciones de BD
2. Agregar servicios en `services/database.ts`
3. Integrar con los hooks existentes sin modificar la lógica actual

