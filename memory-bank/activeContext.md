# Active Context

## Current Work Focus

- Audio folder refactored: now only AudioRecordingService.js and AudioPlaybackService.js, no worklets.
- App component is present in src/frontend/App.jsx and is the root entry; main entry is App.jsx, with Scene.jsx as the main Three.js component.
- Ensuring frontend sends Opus audio Blobs via MediaRecorder directly to backend.
- Backend proxies audio to Deepgram using the official SDK and streams transcripts to the client.
- Robust error handling, connection cleanup, and keepalive for Deepgram sessions.

## Recent Changes

- Audio worklet classes and related files removed.
- App.jsx is present in src/frontend and is the root entry; Scene.jsx is the main Three.js component.
- Audio services updated to use only Web Audio API and MediaRecorder.
- .clinerules and memory bank updated to reflect new architecture and lessons learned.

## Next Steps

- Further UI/UX improvements for transcription display.
- Add support for additional AI providers or features as needed.
- Expand testing and error handling for edge cases.
- Document deployment and scaling strategies.

## Active Decisions

- Use MediaRecorder for maximum browser compatibility and Deepgram support.
- Only send raw audio Blobs, never JSON, over WebSocket.
- Maintain a single Deepgram connection per client session.
