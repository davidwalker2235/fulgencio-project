# Frontend App Structure

This project has been refactored following best practices for scalability and maintainability, including a complete authentication system and GPT Realtime API integration.

## Folder Structure

```
app/
├── components/          # Reusable UI components
│   ├── ConversationButton.tsx
│   ├── ConnectionStatus.tsx
│   ├── ErrorDisplay.tsx
│   ├── Subtitles.tsx
│   ├── Transcription.tsx
│   ├── VoiceConversation.tsx
│   ├── TextInput.tsx
│   ├── EmailInput.tsx
│   ├── CameraCapture.tsx
│   ├── VideoLoop.tsx
│   ├── AnimatedFace.tsx
│   └── face/            # 3D face animation components
│       └── FaceMorphTargets.tsx
├── hooks/              # Custom hooks
│   ├── useAuth.ts
│   ├── useWebSocket.ts
│   ├── useAudioRecording.ts
│   ├── useAudioPlayback.ts
│   ├── useVoiceConversation.ts
│   ├── useFirebase.ts
│   ├── useBackgroundVideo.ts
│   ├── useVideoLoop.ts
│   └── useAnimationMode.ts
├── services/           # Services and utilities
│   ├── websocketService.ts
│   ├── audioUtils.ts
│   └── firebaseService.ts
├── types/              # TypeScript types
│   └── index.ts
├── constants/          # Configuration constants
│   ├── index.ts
│   └── aiPrompts.ts    # AI prompts centralized
├── login/              # Login page
│   └── page.tsx
├── page.tsx            # Main page (protected route)
├── layout.tsx          # Root layout
└── globals.css         # Global styles
```

## Custom Hooks

### `useAuth`
Manages authentication state and localStorage persistence. Provides:
- `isAuthenticated`: Current authentication status
- `isLoading`: Loading state during authentication check
- `login(username, password)`: Login function that validates credentials against Firebase
- `logout()`: Logout function that clears localStorage and redirects to login
- `error`: Error message state
- `clearError()`: Clear error function

**Features:**
- Automatic authentication check on component mount
- Session persistence via localStorage
- Credentials validation against Firebase Realtime Database
- Automatic redirects based on authentication state

**Usage:**
```typescript
const { isAuthenticated, isLoading, login, logout, error } = useAuth();

// Login
const success = await login(username, password);

// Logout
logout();
```

### `useWebSocket`
Manages WebSocket connection with the backend. Provides:
- Connect/disconnect functionality
- Send messages (JSON and binary)
- Register message handlers
- Manage connection events

### `useAudioRecording`
Manages microphone audio recording. Provides:
- Start/stop recording
- Get audio level
- Detect when user is speaking
- Voice activity detection

### `useAudioPlayback`
Manages audio playback. Provides:
- Play audio chunks (Float32 format)
- Stop all playback
- Check if audio is active
- Audio interruption handling

### `useVoiceConversation`
Main hook that orchestrates the entire voice conversation logic. Combines other hooks and manages:
- Conversation state and WebSocket connection
- Transcripts (user and assistant messages)
- Error handling
- Audio interruptions
- Text message sending to GPT Realtime API
- User ID generation and session management

**Returns:**
- `isConnected`: WebSocket connection status
- `isRecording`: Audio recording status
- `transcription`: Array of conversation messages
- `error`: Error message state
- `connectionStatus`: Connection status ("Disconnected" | "Connecting" | "Connected")
- `isSpeaking`: Whether the AI is currently speaking
- `activeUserId`: Current user session ID
- `startConversation()`: Start voice conversation
- `stopConversation()`: Stop conversation and save transcript
- `toggleConversation()`: Toggle conversation on/off
- `clearError()`: Clear error state
- `sendTextMessage(text)`: Send text message to GPT Realtime API

### `useFirebase`
Manages Firebase Realtime Database connections and operations. Provides:
- CRUD operations (Create, Read, Update, Delete)
- Push operations (automatic ID generation)
- Real-time subscriptions
- Loading and error state management

**Operations:**
- `read<T>(path)`: Read data from Firebase
- `write(path, data)`: Write data to Firebase
- `update(path, data)`: Update data in Firebase
- `remove(path)`: Delete data from Firebase
- `push(path, data)`: Add data with auto-generated ID
- `subscribe(path, callback)`: Subscribe to real-time updates

### `useBackgroundVideo`
Manages background video playback for different connection states.

### `useVideoLoop`
Manages video loop animations based on conversation state.

### `useAnimationMode`
Manages animation modes for different UI states.

## Services

### `websocketService`
Class that encapsulates WebSocket communication logic, including:
- Connection management
- Message handling (JSON and binary)
- Session initialization with GPT Realtime API
- Event handler registration

### `audioUtils`
Utilities for audio processing:
- Format conversion (Float32, PCM16, Base64)
- Audio level calculation
- Base64 to Float32 conversion
- ArrayBuffer to Float32 conversion

### `firebaseService`
Service for advanced Firebase Realtime Database operations:
- CRUD operations
- Real-time subscriptions
- Path-specific references

## Components

All components are separated by responsibility:

- **VoiceConversation**: Main conversation component that orchestrates all features
- **ConversationButton**: Button to start/stop conversation and handle photo capture
- **ConnectionStatus**: Connection status indicator
- **Subtitles**: Real-time subtitle display for conversation messages
- **Transcription**: List of transcribed messages (legacy component)
- **ErrorDisplay**: Display errors to the user
- **TextInput**: Input component for sending text messages to the AI
- **EmailInput**: Email input component for photo consent (GDPR compliance)
- **CameraCapture**: Camera component for taking photos
- **VideoLoop**: Background video loop component
- **AnimatedFace**: Animated face component (legacy)
- **FaceMorphTargets**: 3D face morphing component using Three.js

## Constants

### `constants/index.ts`
Configuration constants including:
- `WEBSOCKET_URL`: WebSocket endpoint configuration
- `AUDIO_CONFIG`: Audio recording configuration
- `AUDIO_PROCESSING`: Audio processing parameters
- `VOICE_DETECTION`: Voice activity detection settings
- `SESSION_CONFIG`: GPT Realtime API session configuration

### `constants/aiPrompts.ts`
Centralized AI prompts for easy maintenance:
- `PHOTO_AUTHORIZATION_PROMPT`: Prompt sent when requesting photo consent
- `PHOTO_DISAGREE_PROMPT`: Prompt sent when user disagrees to photo consent
- `AI_PROMPTS`: Object containing all prompts for reference

## Pages

### Login Page (`/login`)
- Authentication form with username and password inputs
- Validates credentials against Firebase Realtime Database
- Shows error messages for invalid credentials
- Automatically redirects to main page if already authenticated
- Session persistence via localStorage

### Main Page (`/`)
- Protected route that requires authentication
- Automatically redirects to `/login` if not authenticated
- Displays the voice conversation interface
- Uses `useAuth` hook to check authentication status

## Features

### Voice Conversation
- Real-time voice conversation with GPT Realtime API
- Audio input/output streaming
- Voice activity detection
- Automatic interruption handling
- Transcript management

### Text Input
- Send text messages to GPT Realtime API
- Receive audio responses
- Same behavior as voice input

### Photo Capture with Consent
- GDPR-compliant photo capture flow
- Email collection before photo capture
- Consent buttons (Agree/Disagree)
- Email validation
- Automatic AI prompts for consent requests

### Data Storage
- User transcripts saved to Firebase
- User photos saved to Firebase
- User emails saved to Firebase
- Structure: `users/{userId}/transcriptions/{timestamp}`, `users/{userId}/photo`, `users/{userId}/email`

## Authentication Flow

1. **Initial Load**: `useAuth` hook checks localStorage for authentication state
2. **Not Authenticated**: User is redirected to `/login`
3. **Login**: User enters credentials, validated against Firebase `credentials` node
4. **Success**: Authentication state and credentials saved to localStorage, redirect to main page
5. **Subsequent Visits**: Authentication automatically restored from localStorage
6. **Logout**: Clears localStorage and redirects to login page

## GPT Realtime API Integration

The application integrates with Microsoft Azure OpenAI GPT Realtime API via WebSocket:
- Supports both audio and text input
- Audio output (text-to-speech)
- Real-time conversation
- Session management
- Automatic prompt sending for specific events

## Firebase Integration

The application uses Firebase Realtime Database for:
- **Authentication**: Credentials stored in `credentials` node
  ```json
  {
    "credentials": {
      "user": "username",
      "pass": "password"
    }
  }
  ```
- **User Data**: User transcripts, photos, and emails
  ```json
  {
    "users": {
      "{userId}": {
        "transcriptions": {
          "{timestamp}": [...]
        },
        "photo": {...},
        "email": "user@example.com"
      }
    }
  }
  ```
- **Status Management**: Real-time status updates for photo capture flow
  ```json
  {
    "status": "idle" | "takingPhoto"
  }
  ```

## Scalability

This structure is prepared for:
- ✅ Adding new features without modifying existing code
- ✅ Reusing hooks and components in other parts of the application
- ✅ Easy integration with databases (ready for future improvements)
- ✅ Unit testing of each hook and service independently
- ✅ Easier maintenance and debugging
- ✅ Authentication system with session persistence
- ✅ Protected routes with automatic redirects
- ✅ Centralized AI prompts for easy modification
- ✅ GDPR-compliant data collection

## Next Steps

When adding new features:
1. Create new hooks in `hooks/` for specific functionality
2. Add services in `services/` for complex operations
3. Create components in `components/` for UI elements
4. Add prompts to `constants/aiPrompts.ts` for AI interactions
5. Integrate with existing hooks without modifying current logic
6. Use `useAuth` for any protected features

## Best Practices

- **Hooks**: Keep hooks focused on a single responsibility
- **Components**: Make components reusable and composable
- **Services**: Encapsulate complex logic in services
- **Types**: Define TypeScript types for all data structures
- **Error Handling**: Use error states in hooks for consistent error handling
- **Authentication**: Always use `useAuth` hook for authentication checks
- **AI Prompts**: Centralize all AI prompts in `constants/aiPrompts.ts` for easy maintenance
- **Data Privacy**: Always request consent before collecting user data (photos, emails)