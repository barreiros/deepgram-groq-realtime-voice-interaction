import express from 'express'
import { WebSocketServer, WebSocket } from 'ws'
import http from 'http'
import path from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'
import dotenv from 'dotenv'
import DeepgramService from './services/DeepgramService.js'
import GroqService from './services/GroqService.js'
import { EventEmitter } from 'events'

dotenv.config()

const DEEPGRAM_API_KEY = process.env.DEEPGRAM_API_KEY
const GROQ_API_KEY = process.env.GROQ_API_KEY

if (!DEEPGRAM_API_KEY) {
  console.error('DEEPGRAM_API_KEY environment variable is not set!')
  process.exit(1)
}

if (!GROQ_API_KEY) {
  console.error('GROQ_API_KEY environment variable is not set!')
  process.exit(1)
}

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

  const eventEmitter = new EventEmitter()
  const groqService = new GroqService(GROQ_API_KEY, eventEmitter, 'en') // Default to English
  const sttService = new DeepgramService(DEEPGRAM_API_KEY, eventEmitter)
  const ttsService = sttService

  eventEmitter.on('transcription', async ({ transcription }) => {
    console.log('Received transcription from STT:', transcription)
    const groqResponse = await groqService.processTranscription(transcription)
    ws.send(JSON.stringify({ groqResponse }))
  })

  eventEmitter.on('llm-text', async ({ text }) => {
    // ws.send(JSON.stringify({ groqSentence: text }))
    // await ttsService.synthesizeSpeech(text)
    console.log('LLM Text:', text)
  })

  eventEmitter.on('error', ({ error }) => {
    console.error('error:', error)
    ws.send(JSON.stringify({ type: 'error', message: error }))
  })

  eventEmitter.on('metadata', ({ data }) => {
    ws.send(JSON.stringify({ metadata: data }))
  })

  eventEmitter.on('speech', ({ audio }) => {
    ws.send(audio)
  })

  ws.send(
    JSON.stringify({
      type: 'connection',
      message: 'Connected to WebSocket server',
    })
  )

  ws.on('message', (message) => {
    try {
      console.log('Received message from client:', message)
      sttService.sendMessage(message)
    } catch (error) {
      console.error('Error processing message:', error)
      ws.send(
        JSON.stringify({ type: 'error', message: 'Invalid message format' })
      )
    }
  })

  ws.on('close', () => {
    console.log('Client disconnected from WebSocket')
    if (sttService) {
      console.log('Closing stt connection')
      sttService.close()
    }
    if (ttsService !== sttService) {
      console.log('Closing tts connection')
      ttsService.close()
    }
  })
})

server.listen(port, () => {
  console.log(`Backend server running at http://localhost:${port}`)
  console.log(`WebSocket server running at ws://localhost:${port}`)
})
