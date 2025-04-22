import { createClient, LiveTranscriptionEvents } from '@deepgram/sdk'

let keepAlive = null

export class DeepgramService {
  constructor(apiKey) {
    this.apiKey = apiKey
    this.dgClient = createClient(this.apiKey)
    console.log('DeepgramService instantiated with API key:', !!this.apiKey)
  }

  createWebSocket(clientWs) {
    console.log('DeepgramService.createWebSocket called')
    let deepgram = this.setupDeepgram(clientWs)

    clientWs.on('close', () => {
      console.log('socket: client disconnected')
      if (deepgram) {
        deepgram.finish()
        deepgram.removeAllListeners()
        deepgram = null
      }
      if (keepAlive) {
        clearInterval(keepAlive)
        keepAlive = null
      }
    })

    return deepgram
  }

  setupDeepgram(ws) {
    const deepgram = this.dgClient.listen.live({
      language: 'en',
      punctuate: true,
      smart_format: true,
      model: 'nova',
    })

    if (keepAlive) clearInterval(keepAlive)
    keepAlive = setInterval(() => {
      console.log('deepgram: keepalive')
      deepgram.keepAlive()
    }, 10 * 1000)

    deepgram.addListener(LiveTranscriptionEvents.Open, async () => {
      console.log('deepgram: connected')

      deepgram.addListener(LiveTranscriptionEvents.Transcript, (data) => {
        console.log('deepgram: packet received', data)
        console.log('deepgram: transcript received')
        console.log('socket: transcript sent to client')
        ws.send(JSON.stringify(data))
      })

      deepgram.addListener(LiveTranscriptionEvents.Close, async () => {
        console.log('deepgram: disconnected')
        clearInterval(keepAlive)
        deepgram.finish()
      })

      deepgram.addListener(LiveTranscriptionEvents.Error, async (error) => {
        console.log('deepgram: error received')
        console.error(error)
      })

      deepgram.addListener(LiveTranscriptionEvents.Warning, async (warning) => {
        console.log('deepgram: warning received')
        console.warn(warning)
      })

      deepgram.addListener(LiveTranscriptionEvents.Metadata, (data) => {
        console.log('deepgram: packet received')
        console.log('deepgram: metadata received')
        console.log('ws: metadata sent to client')
        ws.send(JSON.stringify({ metadata: data }))
      })
    })

    return deepgram
  }

  handleClientMessage(deepgram, message, ws) {
    try {
      // console.log(
      //   'DeepgramService.handleClientMessage called. type:',
      //   typeof message,
      //   'isBuffer:',
      //   Buffer.isBuffer(message),
      //   'length:',
      //   message?.length
      // )
      if (deepgram.getReadyState() === 1) {
        console.log('socket: data sent to deepgram', message)
        deepgram.send(message)
      } else if (deepgram.getReadyState() >= 2) {
        console.log("socket: data couldn't be sent to deepgram")
        console.log('socket: retrying connection to deepgram')
        deepgram.finish()
        deepgram.removeAllListeners()
        deepgram = this.setupDeepgram(ws)
      } else {
        console.log("socket: data couldn't be sent to deepgram")
      }
    } catch (error) {
      console.error('Error sending audio to Deepgram:', error)
    }
  }
}

export default DeepgramService
