import express from 'express'
import { WebSocketServer, WebSocket } from 'ws'
import http from 'http'
import path from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'
import dotenv from 'dotenv'

import GeminiService from './services/gemini/GeminiService.js'

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

// Initialize Gemini service
const geminiService = new GeminiService(GEMINI_API_KEY)

// Serve static files
app.use(express.static(path.join(__dirname, '../../public')))

// Basic route for testing
app.get('/api/status', (req, res) => {
  res.json({ status: 'Server is running' })
})

// WebSocket connection handling
wss.on('connection', (ws) => {
  console.log('Client connected to WebSocket')

  // Initialize Gemini connection
  const geminiWs = geminiService.createWebSocket(ws)

  // Send setup config once Gemini connection is established
  if (geminiWs.readyState !== WebSocket.OPEN) {
    geminiWs.pendingSetup = geminiService.getSetupConfig()
  } else {
    geminiWs.send(JSON.stringify(geminiService.getSetupConfig()))
  }

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
      geminiService.handleClientMessage(geminiWs, message)
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
      console.log('Closing Gemini connection')
      geminiWs.removeAllListeners()
      geminiWs.close()
    }
  })
})

// Start the server
server.listen(port, () => {
  console.log(`Backend server running at http://localhost:${port}`)
  console.log(`WebSocket server running at ws://localhost:${port}`)
})
