# System Patterns

## Architecture Overview

- **Frontend**: React + Vite + Tailwind CSS, modular component structure, MediaRecorder for audio capture, WebSocket for real-time communication.
- **Backend**: Node.js + Express, WebSocket server, Deepgram SDK for live transcription.
- **AI Integration**: Deepgram streaming API for speech-to-text, Groq integration for processing transcriptions and streaming sentences using the `meta-llama/llama-4-maverick-17b-128e-instruct` model for chat and `llama3-8b-8192` for memory summarization, with short-term memory implemented using Langchain's ConversationSummaryBufferMemory, designed for easy extension to other AI providers.

## Key Technical Decisions

- **MediaRecorder**: Chosen for browser compatibility and native Opus encoding, ensuring Deepgram compatibility.
- **Raw Audio Streaming**: Audio Blobs are sent directly over WebSocket, no JSON wrapping, matching Deepgram's requirements.
- **Event-Driven Backend**: All Deepgram events (transcript, metadata, error, warning) are handled and logged, with transcripts forwarded to the client.
- **KeepAlive**: Periodic keepAlive messages maintain the Deepgram connection.
- **Error Handling**: Robust cleanup on disconnect, reconnection logic if Deepgram closes.

## Design Patterns

- **Single Responsibility**: Each service/class has a focused role (audio, websocket, AI).
- **Event Emitter**: Used for audio and backend event handling.
- **Abstraction**: AI service layer allows for future provider expansion.
- **Separation of Concerns**: Clear split between UI, audio, network, and AI logic.

## Component Relationships

- Scene.jsx is the main Three.js scene component.
- AudioRecordingService and AudioPlaybackService in audio/ handle recording and playback using Web Audio API (no worklets).
- DeepgramWebSocketService handles direct binary WebSocket communication.
- Backend proxies audio to Deepgram and returns transcripts.
