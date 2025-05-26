import { createClient, LiveTranscriptionEvents } from '@deepgram/sdk'

let keepAlive = null

export class DeepgramService {
  constructor(apiKey, eventEmitter, params = {}) {
    this.params = params
    this.apiKey = apiKey
    this.eventEmitter = eventEmitter
    this.dgClient = createClient(this.apiKey)

    this.deepgramWs = this.dgClient.listen.live({
      language: params.language || 'en',
      punctuate: true,
      smart_format: true,
      model: 'nova',
      sample_rate: params?.sample_rate ? parseInt(params.sample_rate) : 16000,
      channels: params?.channels ? parseInt(params.channels) : 1,
      ...params,
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

          if (data.channel.alternatives[0]?.transcript) {
            const transcription = data.channel.alternatives[0].transcript
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
        this.close()
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
      console.log('Initializing Deepgram TTS live connection');
      const connection = this.dgClient.speak.live({
        model: 'aura-asteria-en',
        encoding: 'linear16',
        container: 'wav'
      });

      connection.on('open', async () => {
        console.log('Deepgram TTS connection opened');
        connection.send(text);
        connection.finish();
      });

      connection.on('error', (error) => {
        console.error('Deepgram TTS error:', error);
        this.eventEmitter.emit('error', { message: 'TTS connection error' });
      });

      connection.on('close', () => {
        console.log('Deepgram TTS connection closed');
      });

      const audioChunks = [];
      for await (const audioChunk of connection) {
        audioChunks.push(audioChunk);
      }
      
      const audioData = Buffer.concat(audioChunks);
      this.eventEmitter.emit('speech', { audio: audioData });

    } catch (error) {
      console.error('Error in Deepgram TTS:', error);
      this.eventEmitter.emit('error', { message: 'TTS synthesis failed' });
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
        // console.log('socket: data sent to deepgram', message)
        this.deepgramWs.send(message)
      } else if (this.deepgramWs.getReadyState() >= 2) {
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
