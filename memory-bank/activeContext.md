# Active Context

## Current Work Focus

- Migration from Gemini to Deepgram for all speech-to-text functionality.
- Ensuring frontend sends Opus audio Blobs via MediaRecorder directly to backend.
- Backend proxies audio to Deepgram using the official SDK and streams transcripts to the client.
- Robust error handling, connection cleanup, and keepalive for Deepgram sessions.

## Recent Changes

- All Gemini code and references removed from frontend and backend.
- DeepgramService refactored to match official streaming example, with event-driven architecture.
- AudioRecordingService now uses MediaRecorder, sending Blobs directly over WebSocket.
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
