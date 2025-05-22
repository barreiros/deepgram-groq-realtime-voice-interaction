import express from 'express'
import { WebSocketServer, WebSocket } from 'ws'
import http from 'http'
import path from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'
import dotenv from 'dotenv'
import DeepgramService from './services/DeepgramService.js'
import GroqService from './services/GroqService.js'

dotenv.config()

const DEEPGRAM_API_KEY = process.env.DEEPGRAM_API_KEY
const GROQ_API_KEY = process.env.GROQ_API_KEY // Get Groq API key

if (!DEEPGRAM_API_KEY) {
  console.error('DEEPGRAM_API_KEY environment variable is not set!')
  process.exit(1)
}

if (!GROQ_API_KEY) {
  console.error('GROQ_API_KEY environment variable is not set!')
  process.exit(1)
}

const groqService = new GroqService(GROQ_API_KEY) // Instantiate GroqService
const deepgramService = new DeepgramService(DEEPGRAM_API_KEY, groqService) // Instantiate DeepgramService and pass GroqService

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const app = express()
const port = 3001

const server = http.createServer(app)
const wss = new WebSocketServer({ server })

app.use(express.static(path.join(__dirname, '../../public')))
app.get('/api/status', (req, res) => {
  res.json({ status: 'Server is running' })
})

wss.on('connection', (ws) => {
  console.log('Client connected to WebSocket')

  const deepgramWs = deepgramService.createWebSocket(ws)

  ws.send(
    JSON.stringify({
      type: 'connection',
      message: 'Connected to WebSocket server',
    })
  )

  ws.on('message', (message) => {
    try {
      deepgramService.handleClientMessage(deepgramWs, message, ws)
    } catch (error) {
      console.error('Error processing message:', error)
      ws.send(
        JSON.stringify({ type: 'error', message: 'Invalid message format' })
      )
    }
  })

  ws.on('close', () => {
    console.log('Client disconnected from WebSocket')
    if (deepgramWs) {
      console.log('Closing Deepgram connection')
      deepgramWs.removeAllListeners()
      deepgramWs.finish()
    }
  })
})

server.listen(port, () => {
  console.log(`Backend server running at http://localhost:${port}`)
  console.log(`WebSocket server running at ws://localhost:${port}`)
})
