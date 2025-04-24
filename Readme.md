# Deepgram Groq Realtime Voice Interaction

Deepgram Groq Realtime Voice Interaction is a full-stack web application that integrates Three.js for 3D rendering with real-time WebSocket communication and AI services. It features audio-to-text communication through Deepgram's speech-to-text API, with an architecture designed to support multiple AI service providers.

## Features

- **React Components**: Modular component architecture
- **3D Visualization**: Interactive Three.js scene (not working yet)
- **Real-time Audio**: Browser-based audio recording and playback using Web Audio API and MediaRecorder (no worklets)
- **AI Integration**: Deepgram speech-to-text API with streaming audio and real-time transcription. Groq integration for processing transcriptions and streaming complete sentences using LangChain, with short-term memory.

## Technology Stack

### Frontend

- React ![React](https://img.shields.io/badge/react-%2320232a.svg?style=for-the-badge&logo=react&logoColor=%2361DAFB)
- Tailwind CSS ![TailwindCSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)
- ViteJS ![Vite](https://img.shields.io/badge/vite-%23646CFF.svg?style=for-the-badge&logo=vite&logoColor=white)
- Three.js ![Three.js](https://img.shields.io/badge/three.js-black?style=for-the-badge&logo=three.js&logoColor=white)
- WebSocket Client (Native API)
- Web Audio API

### Backend

- Node.js ![Node.js](https://img.shields.io/badge/node.js-%23339933.svg?style=for-the-badge&logo=node.js&logoColor=white)
- Express.js ![Express.js](https://img.shields.io/badge/express.js-%23404D59.svg?style=for-the-badge&logo=express&logoColor=%2361DAFB)
- WebSocket Server (ws library)
- Deepgram API (@deepgram/sdk) ![Deepgram](https://img.shields.io/badge/Deepgram-20232A?style=for-the-badge&logo=deepgram&logoColor=white)
- Groq API (groq-sdk) ![Groq](https://img.shields.io/badge/Groq-F5F5F5?style=for-the-badge&logo=groq&logoColor=black)
- LangChain (langchain, @langchain/groq) ![LangChain](https://img.shields.io/badge/LangChain-000000?style=for-the-badge&logo=langchain&logoColor=white)

## Project Structure

```
/
├── package.json
├── vite.config.js
├── .clinerules
├── src/
│   ├── frontend/
│   │   ├── index.html
│   │   ├── style.css
│   │   ├── main.jsx
│   │   ├── audio/
│   │   │   ├── AudioPlaybackService.js
│   │   │   └── AudioRecordingService.js
│   │   ├── App.jsx
│   │   ├── components/
│   │   │   ├── Scene.jsx
│   │   └── services/
│   │       ├── deepgram/
│   │       │   └── DeepgramWebSocketService.js
│   │       ├── three/
│   │       │   ├── PhysicsEngine.js
│   │       │   ├── PrimitiveFactory.js
│   │       │   ├── ProximityScene.js
│   │       │   └── ThreeScene.js
│   │       └── websocket/
│   │           └── BaseWebSocketService.js
│   └── backend/
│       ├── server.js
│       └── services/
│           ├── deepgram/
│           │   └── DeepgramService.js
│           └── groq/
│               └── GroqService.js
```

## Installation

1. **Clone the repository:**

   ```bash
   git clone <repository_url> .
   ```

2. **Install dependencies:**

   ```bash
   npm install
   ```

3. **Set up environment variables:**

   Create a `.env` file in the root directory of the project. Add your Deepgram API key:

   ```env
   DEEPGRAM_API_KEY=YOUR_DEEPGRAM_API_KEY
   GROQ_API_KEY=YOUR_GROQ_API_KEY
   ```

   Replace `YOUR_DEEPGRAM_API_KEY` and `YOUR_GROQ_API_KEY` with your actual API keys.

4. **Run the application:**

   The project consists of a backend and a frontend. Both are initialized with the same command.

   ```bash
   npm run dev
   ```

## Usage

Once the application is running, navigate to the provided local development server address (usually `http://localhost:5173/` for the frontend). Currently, only the real-time audio recording and transcription functionality is fully integrated and working. Interaction with the 3D scene is not yet fully implemented. You can use the audio input feature to communicate via speech, and transcriptions will appear in real-time.
