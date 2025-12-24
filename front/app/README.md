# Frontend App Structure

This project has been refactored following best practices for scalability and maintainability, including a complete authentication system.

## Folder Structure

```
app/
├── components/          # Reusable UI components
│   ├── ConversationButton.tsx
│   ├── ConnectionStatus.tsx
│   ├── Transcription.tsx
│   ├── ErrorDisplay.tsx
│   └── VoiceConversation.tsx
├── hooks/              # Custom hooks
│   ├── useWebSocket.ts
│   ├── useAudioRecording.ts
│   ├── useAudioPlayback.ts
│   ├── useVoiceConversation.ts
│   ├── useFirebase.ts
│   └── useAuth.ts        # Authentication hook
├── services/           # Services and utilities
│   ├── websocketService.ts
│   ├── audioUtils.ts
│   └── firebaseService.ts
├── types/              # TypeScript types
│   └── index.ts
├── constants/          # Configuration constants
│   └── index.ts
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
- Send messages
- Register message handlers
- Manage connection events

### `useAudioRecording`
Manages microphone audio recording. Provides:
- Start/stop recording
- Get audio level
- Detect when user is speaking

### `useAudioPlayback`
Manages audio playback. Provides:
- Play audio chunks
- Stop all playback
- Check if audio is active

### `useVoiceConversation`
Main hook that orchestrates the entire voice conversation logic. Combines other hooks and manages:
- Conversation state
- Transcripts
- Error handling
- Audio interruptions

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

## Services

### `websocketService`
Class that encapsulates WebSocket communication logic, including:
- Connection management
- Message handling
- Session initialization

### `audioUtils`
Utilities for audio processing:
- Format conversion (Float32, PCM16)
- Audio level calculation
- Base64 to audio conversion

### `firebaseService`
Service for advanced Firebase Realtime Database operations:
- CRUD operations
- Real-time subscriptions
- Path-specific references

## Components

All components are separated by responsibility:

- **ConversationButton**: Button to start/stop conversation
- **ConnectionStatus**: Connection status indicator
- **Transcription**: List of transcribed messages
- **ErrorDisplay**: Display errors to the user
- **VoiceConversation**: Main conversation component that combines all other components

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

## Authentication Flow

1. **Initial Load**: `useAuth` hook checks localStorage for authentication state
2. **Not Authenticated**: User is redirected to `/login`
3. **Login**: User enters credentials, validated against Firebase `credentials` node
4. **Success**: Authentication state and credentials saved to localStorage, redirect to main page
5. **Subsequent Visits**: Authentication automatically restored from localStorage
6. **Logout**: Clears localStorage and redirects to login page

## Scalability

This structure is prepared for:
- ✅ Adding new features without modifying existing code
- ✅ Reusing hooks and components in other parts of the application
- ✅ Easy integration with databases (ready for future improvements)
- ✅ Unit testing of each hook and service independently
- ✅ Easier maintenance and debugging
- ✅ Authentication system with session persistence
- ✅ Protected routes with automatic redirects

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
- **Real-time Data**: Can be extended for other features

## Next Steps

When adding new features:
1. Create new hooks in `hooks/` for specific functionality
2. Add services in `services/` for complex operations
3. Create components in `components/` for UI elements
4. Integrate with existing hooks without modifying current logic
5. Use `useAuth` for any protected features

## Best Practices

- **Hooks**: Keep hooks focused on a single responsibility
- **Components**: Make components reusable and composable
- **Services**: Encapsulate complex logic in services
- **Types**: Define TypeScript types for all data structures
- **Error Handling**: Use error states in hooks for consistent error handling
- **Authentication**: Always use `useAuth` hook for authentication checks
