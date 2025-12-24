# Frontend - Next.js Application

Frontend application built with Next.js 16, React 19, TypeScript, and Tailwind CSS, featuring real-time voice conversation with GPT Realtime and Firebase authentication.

## Features

- ✅ Real-time voice conversation with GPT Realtime
- ✅ User authentication with Firebase Realtime Database
- ✅ Session persistence with localStorage
- ✅ Protected routes
- ✅ Modern UI with Tailwind CSS
- ✅ Responsive design
- ✅ Error handling and connection status

## Prerequisites

- Node.js 18 or higher
- npm or yarn
- Firebase Realtime Database configured

## Installation

1. Install dependencies:
```bash
npm install
```

2. Configure Firebase:
- Firebase configuration is in `firebaseConfig.ts`
- Ensure your Firebase Realtime Database has a `credentials` node:
  ```json
  {
    "credentials": {
      "user": "your-username",
      "pass": "your-password"
    }
  }
  ```

## Development

Run the development server:
```bash
npm run dev
```

The application will be available at `http://localhost:3000`

## Build

Build for production:
```bash
npm run build
```

Start production server:
```bash
npm start
```

## Project Structure

```
front/
├── app/
│   ├── components/          # React components
│   │   ├── ConversationButton.tsx
│   │   ├── ConnectionStatus.tsx
│   │   ├── Transcription.tsx
│   │   ├── ErrorDisplay.tsx
│   │   └── VoiceConversation.tsx
│   ├── hooks/               # Custom React hooks
│   │   ├── useWebSocket.ts
│   │   ├── useAudioRecording.ts
│   │   ├── useAudioPlayback.ts
│   │   ├── useVoiceConversation.ts
│   │   ├── useFirebase.ts
│   │   └── useAuth.ts        # Authentication hook
│   ├── services/            # Services and utilities
│   │   ├── websocketService.ts
│   │   ├── audioUtils.ts
│   │   └── firebaseService.ts
│   ├── types/              # TypeScript types
│   ├── constants/          # Constants
│   ├── login/              # Login page
│   │   └── page.tsx
│   ├── page.tsx            # Main page (protected)
│   ├── layout.tsx          # Root layout
│   └── globals.css         # Global styles
├── firebaseConfig.ts       # Firebase configuration
├── package.json
├── tsconfig.json
└── next.config.ts
```

## Authentication

The application includes a complete authentication system:

### Login Page (`/login`)

- Validates credentials against Firebase Realtime Database
- Shows error messages for invalid credentials
- Automatically redirects to main page if already authenticated

### Protected Routes

- Main page (`/`) requires authentication
- Automatically redirects to `/login` if not authenticated
- Session is restored from localStorage on page load

### useAuth Hook

Custom hook that manages authentication state:

```typescript
const {
  isAuthenticated,  // Current authentication status
  isLoading,       // Loading state during auth check
  login,           // Login function
  logout,          // Logout function
  error,           // Error message
  clearError       // Clear error function
} = useAuth();
```

### Session Persistence

- Authentication state is saved in localStorage
- Credentials are stored securely in localStorage
- Session persists across browser sessions
- Automatic authentication restoration on page load

## Firebase Integration

The application uses Firebase Realtime Database for:

- **Authentication**: Credentials are stored in the `credentials` node
- **Real-time data**: Can be extended for other features

### Firebase Configuration

Configuration is in `firebaseConfig.ts`:
- API Key
- Database URL
- Project ID
- Other Firebase settings

## Custom Hooks

### useAuth
Manages authentication state and localStorage:
- Login/logout functionality
- Session persistence
- Automatic authentication check on load

### useFirebase
Manages Firebase Realtime Database operations:
- CRUD operations
- Real-time subscriptions
- Error handling

### useWebSocket
Manages WebSocket connection with backend:
- Connect/disconnect
- Send messages
- Register message handlers

### useAudioRecording
Manages microphone recording:
- Start/stop recording
- Audio level detection
- Voice activity detection

### useAudioPlayback
Manages audio playback:
- Play audio chunks
- Stop playback
- Check active audio

### useVoiceConversation
Main hook that orchestrates voice conversation:
- Combines all other hooks
- Manages conversation state
- Handles transcriptions and errors

## Components

- **VoiceConversation**: Main conversation component
- **ConversationButton**: Start/stop conversation button
- **ConnectionStatus**: Connection status indicator
- **Transcription**: Conversation transcription display
- **ErrorDisplay**: Error message display

## Styling

The application uses Tailwind CSS for styling:
- Responsive design
- Dark mode support
- Modern UI components

## Environment Variables

No environment variables are required for the frontend. Firebase configuration is hardcoded in `firebaseConfig.ts`.

## Troubleshooting

### Login not working
- Verify Firebase Realtime Database has the `credentials` node
- Check browser console for errors
- Verify Firebase configuration is correct

### Session not persisting
- Check browser localStorage permissions
- Verify cookies/localStorage are enabled
- Clear browser cache and try again

### WebSocket connection issues
- Ensure backend is running on port 8000
- Check network connectivity
- Review browser console for errors
