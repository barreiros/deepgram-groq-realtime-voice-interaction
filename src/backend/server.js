import express from 'express'
import { WebSocketServer, WebSocket } from 'ws'
import http from 'http'
import path from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'
import dotenv from 'dotenv'

// Load environment variables from .env file
dotenv.config()

// Get directory name in ESM
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Create Express application
const app = express()
const port = 3001

// Create HTTP server
const server = http.createServer(app)

// Create WebSocket server
const wss = new WebSocketServer({ server })

// Get API key from environment variables
const GEMINI_API_KEY = process.env.GEMINI_API_KEY

if (!GEMINI_API_KEY) {
  console.error('GEMINI_API_KEY environment variable is not set!')
  process.exit(1)
}

// Serve static files
app.use(express.static(path.join(__dirname, '../../public')))

// Basic route for testing
app.get('/api/status', (req, res) => {
  res.json({ status: 'Server is running' })
})

// Create a WebSocket connection to Gemini for each client
const createGeminiWebSocket = (clientWs) => {
  const geminiWs = new WebSocket(
    `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${GEMINI_API_KEY}`
  )

  // Set up event handlers before connecting
  geminiWs.on('open', () => {
    console.log('Connected to Gemini API')
    // If there's a pending setup message, send it now
    if (geminiWs.pendingSetup) {
      console.log('Sending pending setup:', geminiWs.pendingSetup)
      geminiWs.send(JSON.stringify(geminiWs.pendingSetup))
      geminiWs.pendingSetup = null
    }
  })

  geminiWs.on('message', (data) => {
    try {
      // Convert the message to a Blob before sending to client
      const message = data.toString()
      console.log('Received from Gemini:', message)

      // Create a Blob from the message
      const blob = Buffer.from(message)
      clientWs.send(blob, { binary: true })
    } catch (error) {
      console.error('Error handling Gemini message:', error)
    }
  })

  geminiWs.on('error', (error) => {
    console.error('Gemini WebSocket error:', error)
  })

  geminiWs.on('close', (code, reason) => {
    console.log('Gemini WebSocket closed:', code, reason.toString())
  })

  return geminiWs
}

// WebSocket connection handling
wss.on('connection', (ws) => {
  console.log('Client connected to WebSocket')
  let geminiWs = null

  // Send a welcome message to the client
  ws.send(
    JSON.stringify({
      type: 'connection',
      message: 'Connected to WebSocket server',
    })
  )

  // Handle messages from client
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message)
      console.log('Received from client:', data)

      // Initialize Gemini connection when receiving setup message
      if (data.setup) {
        console.log('Initializing Gemini connection with config:', data.setup)

        // Ensure setup has proper audio configuration
        if (data.setup.generationConfig) {
          // Make sure responseModalities is an array
          if (
            typeof data.setup.generationConfig.responseModalities === 'string'
          ) {
            data.setup.generationConfig.responseModalities = [
              data.setup.generationConfig.responseModalities,
            ]
          }

          // Ensure both text and audio are included
          if (!data.setup.generationConfig.responseModalities) {
            data.setup.generationConfig.responseModalities = ['text', 'audio']
          } else if (
            !data.setup.generationConfig.responseModalities.includes('text') ||
            !data.setup.generationConfig.responseModalities.includes('audio')
          ) {
            data.setup.generationConfig.responseModalities = ['text', 'audio']
          }
        }

        geminiWs = createGeminiWebSocket(ws)

        // Store setup message to send once connection is established
        if (geminiWs.readyState !== WebSocket.OPEN) {
          geminiWs.pendingSetup = data
        } else {
          console.log('Sending setup message to Gemini:', data.setup)
          geminiWs.send(JSON.stringify(data.setup))
        }
        return
      }

      // Handle audio data from client
      if (data.audio) {
        console.log('Received audio data from client')

        // Process audio data
        const audioMessage = {
          contents: [
            {
              parts: [
                {
                  audio: {
                    data: data.audio.data,
                    mime_type: 'audio/x-linear16',
                    sample_rate_hertz: data.audio.sampleRate || 16000,
                  },
                },
              ],
            },
          ],
        }

        // Forward to Gemini if connection exists
        if (geminiWs && geminiWs.readyState === WebSocket.OPEN) {
          console.log('Forwarding audio to Gemini')
          geminiWs.send(JSON.stringify(audioMessage))

          // Send acknowledgment to client
          ws.send(
            JSON.stringify({
              type: 'audio_status',
              message: 'Audio data sent to Gemini',
            })
          )
        } else {
          console.error('Cannot send audio: No Gemini connection')
          ws.send(
            JSON.stringify({
              type: 'error',
              message: 'Cannot send audio: No Gemini connection',
            })
          )
        }
        return
      }

      // Forward message to Gemini if connection exists
      if (geminiWs && geminiWs.readyState === WebSocket.OPEN) {
        console.log('Forwarding to Gemini:', JSON.stringify(data))
        geminiWs.send(JSON.stringify(data))
      } else if (geminiWs) {
        console.log('Waiting for Gemini connection to be ready...')
        // Store the message to send once connection is established
        if (!geminiWs.pendingMessages) {
          geminiWs.pendingMessages = []
        }
        geminiWs.pendingMessages.push(data)
      } else {
        console.error('No Gemini connection established')
        ws.send(
          JSON.stringify({
            type: 'error',
            message:
              'No Gemini connection established. Send setup message first.',
          })
        )
      }
    } catch (error) {
      console.error('Error processing message:', error)
      ws.send(
        JSON.stringify({ type: 'error', message: 'Invalid message format' })
      )
    }
  })

  // Handle client disconnection
  ws.on('close', () => {
    console.log('Client disconnected from WebSocket')
    if (geminiWs) {
      geminiWs.close()
    }
  })
})

// Start the server
server.listen(port, () => {
  console.log(`Backend server running at http://localhost:${port}`)
  console.log(`WebSocket server running at ws://localhost:${port}`)
})
