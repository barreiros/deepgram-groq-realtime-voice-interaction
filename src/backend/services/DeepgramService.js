import { createClient, LiveTranscriptionEvents } from '@deepgram/sdk'

let keepAlive = null

export class DeepgramService {
  constructor(apiKey, eventEmitter) {
    this.apiKey = apiKey
    this.eventEmitter = eventEmitter
    this.dgClient = createClient(this.apiKey)

    this.deepgramWs = this.dgClient.listen.live({
      language: 'en',
      punctuate: true,
      smart_format: true,
      model: 'nova',
    })

    if (keepAlive) clearInterval(keepAlive)
    keepAlive = setInterval(() => {
      console.log('deepgram: keepalive')
      this.deepgramWs.keepAlive()
    }, 10 * 1000)

    this.deepgramWs.addListener(LiveTranscriptionEvents.Open, async () => {
      console.log('deepgram: connected')

      this.deepgramWs.addListener(
        LiveTranscriptionEvents.Transcript,
        async (data) => {
          console.log('deepgram: packet received', data)
          console.log('deepgram: transcript received')
          console.log('socket: transcript sent to client')

          if (data.channel.alternatives[0]?.transcript) {
            const transcription = data.channel.alternatives[0].transcript
            console.log('Processing transcription with Groq:', transcription)
            try {
              this.eventEmitter.emit('transcription', { transcription })
            } catch (error) {
              console.error('Error processing transcription with Groq:', error)
            }
          }
        }
      )

      this.deepgramWs.addListener(LiveTranscriptionEvents.Close, async () => {
        console.log('deepgram: disconnected')
        clearInterval(keepAlive)
        deepgram.finish()
      })

      this.deepgramWs.addListener(
        LiveTranscriptionEvents.Error,
        async (error) => {
          console.log('deepgram: error received')
          console.error(error)
        }
      )

      this.deepgramWs.addListener(
        LiveTranscriptionEvents.Warning,
        async (warning) => {
          console.log('deepgram: warning received')
          console.warn(warning)
        }
      )

      this.deepgramWs.addListener(LiveTranscriptionEvents.Metadata, (data) => {
        console.log('deepgram: packet received')
        console.log('deepgram: metadata received')
        console.log('ws: metadata sent to client')
        this.eventEmitter.emit('metadata', { metadata: data })
      })
    })
    console.log('DeepgramService instantiated with API key:', !!this.apiKey)
  }

  createWebSocket(clientWs) {
    console.log('DeepgramService.createWebSocket called')
    let deepgram = this.setupDeepgram(clientWs)

    clientWs.on('close', () => {
      console.log('socket: client disconnected')
    })

    return deepgram
  }

  async synthesizeSpeech(text, ws) {
    try {
      console.log('DeepgramService.synthesizeSpeech called with text:', text)
      const response = await this.dgClient.speak.request(
        { text },
        {
          model: 'aura-angus-en', // Or another suitable voice
          encoding: 'linear16', // Or 'mp3', 'aac', etc.
          container: 'wav', // Or 'mp3', 'aac', etc.
        }
      )

      const stream = await response.getStream()
      const chunks = []
      for await (const chunk of stream) {
        chunks.push(chunk)
      }
      const data = Buffer.concat(chunks)

      console.log('DeepgramService.synthesizeSpeech received audio data')
      this.eventEmitter.emit('speech', { audio: data })
    } catch (error) {
      console.error('Error synthesizing speech with Deepgram:', error)
      console.error('Deepgram TTS Error Details:', error) // Log the full error object
      this.eventEmitter.emit('error', { message: 'Error synthesizing speech' })
    }
  }

  sendMessage(message) {
    try {
      // console.log(
      //   'DeepgramService.handleClientMessage called. type:',
      //   typeof message,
      //   'isBuffer:',
      //   Buffer.isBuffer(message),
      //   'length:',
      //   message?.length
      // )
      if (this.deepgramWs.getReadyState() === 1) {
        console.log('socket: data sent to deepgram', message)
        this.deepgramWs.send(message)
      } else if (deepgram.getReadyState() >= 2) {
        console.log("socket: data couldn't be sent to deepgram")
        console.log('socket: retrying connection to deepgram')
        this.deepgramWs.finish()
        this.deepgramWs.removeAllListeners()
        this.deepgramWs = this.setupDeepgram(ws)
      } else {
        console.log("socket: data couldn't be sent to deepgram")
      }
    } catch (error) {
      console.error('Error sending audio to Deepgram:', error)
    }
  }

  close() {
    if (this.deepgramWs) {
      this.deepgramWs.finish()
      this.deepgramWs.removeAllListeners()
      this.deepgramWs = null
    }
    if (keepAlive) {
      clearInterval(keepAlive)
      keepAlive = null
    }
  }
}

export default DeepgramService
