# GPT Realtime Voice Conversation Project

This project enables real-time voice conversations with the GPT Realtime model deployed on Microsoft Foundry, featuring user authentication via Firebase Realtime Database.

## Project Structure

```
fulgencio-project/
├── back/          # Backend in Python with FastAPI
├── front/         # Frontend in Next.js with authentication
└── terraform/     # Infrastructure as Code
```

## Prerequisites

- Python 3.8 or higher
- Node.js 18 or higher
- Microsoft Foundry credentials (endpoint and API key)
- Firebase Realtime Database (for authentication)

## Features

- ✅ Real-time voice conversation
- ✅ Conversation transcription
- ✅ Connection status indicator
- ✅ User authentication with Firebase
- ✅ Session persistence with localStorage
- ✅ Error handling
- ✅ Modern and responsive interface

## Backend Setup

1. Navigate to the `back` folder:
```bash
cd back
```

2. Create a virtual environment:
```bash
python -m venv venv
```

3. Activate the virtual environment:
- Windows: `venv\Scripts\activate`
- Linux/Mac: `source venv/bin/activate`

4. Install dependencies:
```bash
pip install -r requirements.txt
```

5. Configure environment variables:
- Create a `.env` file in the `back` folder with the following content:
```
AZURE_OPENAI_ENDPOINT=https://your-endpoint.openai.azure.com
AZURE_OPENAI_API_KEY=your-api-key-here
AZURE_OPENAI_API_VERSION=2024-10-01-preview
MODEL_NAME=gpt-realtime
```

6. Run the server:
```bash
python main.py
```

Or with uvicorn directly:
```bash
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

The server will be available at `http://localhost:8000`

## Frontend Setup

1. Navigate to the `front` folder:
```bash
cd front
```

2. Install dependencies:
```bash
npm install
```

3. Configure Firebase:
- The Firebase configuration is already set up in `firebaseConfig.ts`
- Ensure your Firebase Realtime Database has a `credentials` node with:
  ```json
  {
    "credentials": {
      "user": "your-username",
      "pass": "your-password"
    }
  }
  ```

4. Run the development server:
```bash
npm run dev
```

The application will be available at `http://localhost:3000`

## Usage

1. Make sure both servers are running (backend on port 8000 and frontend on port 3000).

2. Open your browser and go to `http://localhost:3000`.

3. You will be redirected to the login page (`/login`) if not authenticated.

4. Enter your credentials (stored in Firebase Realtime Database under the `credentials` node).

5. After successful login, you'll be redirected to the main page.

6. Click the "Start Conversation" button to begin.

7. Allow microphone access when the browser requests it.

8. Speak with the AI. You'll see the conversation transcription in real-time.

9. Click "Stop Conversation" to end the session.

## Authentication System

The application includes a complete authentication system:

- **Login Page**: Located at `/login`, validates credentials against Firebase Realtime Database
- **Session Persistence**: Credentials are saved in localStorage, so you don't need to log in every time you open the browser
- **Protected Routes**: The main page automatically redirects to login if not authenticated
- **Auto-redirect**: If already authenticated, the login page redirects to the main page

### Authentication Flow

1. User enters username and password on the login page
2. Credentials are verified against Firebase Realtime Database (`credentials` node)
3. On success, authentication state and credentials are saved to localStorage
4. User is redirected to the main application
5. On subsequent visits, authentication is automatically restored from localStorage

## Troubleshooting

### Error: "Azure OpenAI is not configured"
- Verify that the `.env` file exists in the `back` folder and contains the correct credentials.

### Error: "Error accessing microphone"
- Make sure you've granted the browser permission to access the microphone.
- Verify that no other applications are using the microphone.

### Error: "WebSocket connection error"
- Verify that the backend is running on port 8000.
- Verify that Microsoft Foundry credentials are correct.
- Check the browser console for more error details.

### Error: "User or password incorrect"
- Verify that the `credentials` node exists in Firebase Realtime Database.
- Check that the username and password match the values in Firebase.

### Authentication not persisting
- Check browser localStorage permissions
- Verify that cookies/localStorage are enabled in your browser

## Technical Details

- The project uses the `gpt-realtime` model deployed on Microsoft Foundry.
- Audio is processed in PCM16 format at 24kHz.
- Transcription is performed using Whisper-1.
- Authentication credentials are stored in Firebase Realtime Database.
- Session persistence is managed via localStorage using a custom `useAuth` hook.

## Project Architecture

- **Backend**: FastAPI with WebSocket support for real-time communication
- **Frontend**: Next.js 16 with React 19, TypeScript, and Tailwind CSS
- **Database**: Firebase Realtime Database for authentication
- **State Management**: Custom React hooks for authentication and Firebase operations
