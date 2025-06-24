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
import url from 'url'

dotenv.config()

const DEEPGRAM_API_KEY = process.env.DEEPGRAM_API_KEY
const GROQ_API_KEY = process.env.GROQ_API_KEY
const SECRET = process.env.SECRET

if (!DEEPGRAM_API_KEY) {
  console.error('DEEPGRAM_API_KEY environment variable is not set!')
  process.exit(1)
} else {
  console.log(
    'DEEPGRAM_API_KEY is set',
    DEEPGRAM_API_KEY.length > 10 ? '***' : DEEPGRAM_API_KEY
  )
}

if (!GROQ_API_KEY) {
  console.error('GROQ_API_KEY environment variable is not set!')
  process.exit(1)
} else {
  console.log(
    'GROQ_API_KEY is set',
    GROQ_API_KEY.length > 10 ? '***' : GROQ_API_KEY
  )
}

if (!SECRET) {
  console.error('SECRET environment variable is not set!')
  process.exit(1)
} else {
  console.log('SECRET is set')
}

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const app = express()
const port = process.env.PORT || 7860

app.use(express.json({ limit: '50mb' }))
app.use(express.urlencoded({ limit: '50mb', extended: true }))

const server = http.createServer(app)
const wss = new WebSocketServer({ 
  server,
  maxPayload: 50 * 1024 * 1024
})

app.use(express.static(path.join(__dirname, '../../dist')))

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../../dist/index.html'))
})

app.get('/api/status', (req, res) => {
  res.json({ status: 'Server is running' })
})

wss.on('connection', (ws, req) => {
  console.log('Client connected to WebSocket')

  const queryParams = url.parse(req.url, true).query
  const providedSecret = queryParams.secret

  if (!providedSecret || providedSecret !== SECRET) {
    console.log('Unauthorized WebSocket connection attempt')
    ws.send(JSON.stringify({ type: 'error', message: 'Unauthorized: Invalid secret' }))
    ws.close(1008, 'Unauthorized')
    return
  }

  console.log('WebSocket connection authorized')

  const eventEmitter = new EventEmitter()

  console.log('Query parameters:', queryParams)
  const groqService = new GroqService(GROQ_API_KEY, eventEmitter, queryParams)

  const sttService = new DeepgramService(
    DEEPGRAM_API_KEY,
    eventEmitter,
    queryParams
  )
  const ttsService = sttService

  eventEmitter.on('transcription', async ({ transcription }) => {
    console.log('Received transcription from STT:', transcription)
    await groqService.processTranscription(transcription)
    ws.send(JSON.stringify({ type: 'transcription', data: transcription }))
  })

  eventEmitter.on('llm-text', async ({ text }) => {
    console.log('Received LLM text:', text)
    ws.send(JSON.stringify({ type: 'llm-text', data: text }))
    await ttsService.synthesizeSpeech(text)
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
    ws.send(JSON.stringify({ type: 'speech', data: audio }))
  })

  eventEmitter.on('shutup', ({ message }) => {
    console.log('Shutup requested:', message)
    if (sttService && sttService.clearBuffers) {
      sttService.clearBuffers()
    }
    if (ttsService && ttsService.clearBuffers && ttsService !== sttService) {
      ttsService.clearBuffers()
    }
    if (groqService && groqService.clearBuffers) {
      groqService.clearBuffers()
    }
    ws.send(JSON.stringify({ type: 'shutup', data: message }))
  })

  ws.send(
    JSON.stringify({
      type: 'connection',
      message: 'Connected to WebSocket server',
    })
  )

  ws.on('message', (message) => {
    try {
      let parsedMessage
      try {
        parsedMessage = JSON.parse(message.toString())
      } catch (jsonError) {
        sttService.sendMessage(message)
        return
      }

      if (parsedMessage.type === 'chat-message') {
        console.log('Received chat message:', parsedMessage)
        groqService.processChatMessage(parsedMessage)
      } else if (parsedMessage.type === 'update-agent-instructions') {
        console.log('Received agent instructions update:', parsedMessage.agentInstructions)
        groqService.updateAgentInstructions(parsedMessage.agentInstructions)
        ws.send(JSON.stringify({ type: 'agent-instructions-updated' }))
      } else {
        sttService.sendMessage(message)
      }
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

server.listen(port, '0.0.0.0', () => {
  console.log(`Backend server running at http://localhost:${port}`)
  console.log(`WebSocket server running at ws://localhost:${port}`)
})
