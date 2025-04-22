import express from 'express'
import { WebSocketServer, WebSocket } from 'ws'
import http from 'http'
import path from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'
import dotenv from 'dotenv'

import DeepgramService from './services/deepgram/DeepgramService.js'

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
const DEEPGRAM_API_KEY = process.env.DEEPGRAM_API_KEY

if (!DEEPGRAM_API_KEY) {
  console.error('DEEPGRAM_API_KEY environment variable is not set!')
  process.exit(1)
}

// Initialize Deepgram service
const deepgramService = new DeepgramService(DEEPGRAM_API_KEY)

// Serve static files
app.use(express.static(path.join(__dirname, '../../public')))

// Basic route for testing
app.get('/api/status', (req, res) => {
  res.json({ status: 'Server is running' })
})

wss.on('connection', (ws) => {
  console.log('Client connected to WebSocket')

  // Initialize Deepgram connection
  const deepgramWs = deepgramService.createWebSocket(ws)

  // Send a welcome message to the client
  ws.send(
    JSON.stringify({
      type: 'connection',
      message: 'Connected to WebSocket server',
    })
  )

  // Handle messages from client (audio binary)
  ws.on('message', (message) => {
    try {
      // console.log(
      //   'Received message from client, type:',
      //   typeof message,
      //   'length:',
      //   message?.length
      // )
      deepgramService.handleClientMessage(deepgramWs, message)
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
    if (deepgramWs) {
      console.log('Closing Deepgram connection')
      deepgramWs.removeAllListeners()
      deepgramWs.close()
    }
  })
})

// Start the server
server.listen(port, () => {
  console.log(`Backend server running at http://localhost:${port}`)
  console.log(`WebSocket server running at ws://localhost:${port}`)
})
