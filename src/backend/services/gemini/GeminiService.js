import { WebSocket } from 'ws'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

export class GeminiService {
  constructor(apiKey) {
    this.apiKey = apiKey
    this.setupConfig = {
      setup: {
        model: 'models/gemini-2.0-flash-exp',
        generationConfig: {
          responseModalities: 'audio',
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Aoede' } },
          },
        },
        tools: [
          {
            functionDeclarations: [
              {
                name: 'confetti',
                description:
                  'Execute a confetti action when user is asking for it',
              },
              {
                name: 'stream_tool',
                description:
                  'Enable and stream tool when user is asking for it: transform, delete, translate, rotate, scale, duplicate, animation, message, primaryColor, secondaryColor',
              },
              {
                name: 'stream_action',
                description:
                  'Execute an stream action when user is asking for it: changePosition, changeRotation, changeScale, duplicateNode, deleteNode, changePrimaryColor, changeSecondaryColor',
                parameters: {
                  type: 'object',
                  properties: {
                    action: {
                      type: 'string',
                      description: 'The name of the action to perform',
                      enum: [
                        'changePosition',
                        'changeRotation',
                        'changeScale',
                        'duplicateNode',
                        'deleteNode',
                        'changePrimaryColor',
                        'changeSecondaryColor',
                      ],
                    },
                    payload: {
                      type: 'string',
                      description:
                        'A JSON object structured according to the specific action being performed',
                    },
                  },
                  required: ['action', 'payload'],
                },
              },
            ],
          },
        ],
        systemInstruction: {
          parts: [
            {
              text: fs.readFileSync(
                path.join(dirname(__dirname), '../assistants/assistant.md'),
                'utf8'
              ),
            },
          ],
        },
      },
    }
  }

  createWebSocket(clientWs) {
    const geminiWs = new WebSocket(
      `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${this.apiKey}`
    )

    geminiWs.on('open', () => {
      console.log('Connected to Gemini API')
      if (geminiWs.pendingSetup) {
        console.log('Sending pending setup:', geminiWs.pendingSetup)
        geminiWs.send(JSON.stringify(geminiWs.pendingSetup))
        geminiWs.pendingSetup = null
      }
    })

    geminiWs.on('message', (data) => {
      try {
        const message = data.toString()
        console.log('Received from Gemini:', message)
        clientWs.send(message)
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

  handleClientMessage(geminiWs, message) {
    try {
      const data = JSON.parse(message)
      console.log('Received from client:', data)

      if (geminiWs && geminiWs.readyState === WebSocket.OPEN) {
        console.log('Forwarding to Gemini:', JSON.stringify(data))
        geminiWs.send(JSON.stringify(data))
      } else if (geminiWs) {
        console.log('Waiting for Gemini connection to be ready...')
        if (!geminiWs.pendingMessages) {
          geminiWs.pendingMessages = []
        }
        geminiWs.pendingMessages.push(data)
      }
    } catch (error) {
      console.error('Error processing message:', error)
      throw error
    }
  }

  getSetupConfig() {
    return this.setupConfig
  }
}

export default GeminiService
