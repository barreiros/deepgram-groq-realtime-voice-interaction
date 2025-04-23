# Tech Context

## Technologies Used

- **Frontend**
  - React (UI framework)
  - Vite (build tool)
  - Tailwind CSS (styling)
  - MediaRecorder API (audio capture)
  - WebSocket API (real-time communication)
- **Backend**
  - Node.js (runtime)
  - Express.js (web server)
  - ws (WebSocket server)
  - @deepgram/sdk (Deepgram streaming API)

## Development Setup

- Node.js 18+ recommended
- Install dependencies: `npm install`
- Start backend: `npm run dev` (already running in dev environment)
- Start frontend: `npm run dev` (Vite, already running)
- .env file must include `DEEPGRAM_API_KEY`

## Technical Constraints

- Audio must be sent as Opus-encoded Blobs (from MediaRecorder) for Deepgram compatibility.
- WebSocket must transmit binary data, not JSON.
- Only one active Deepgram connection per client.
- KeepAlive required to maintain Deepgram streaming session.

## Dependencies

- @deepgram/sdk
- ws
- express
- react
- vite
- tailwindcss
