import {
  createClient,
  LiveTranscriptionEvents,
  LiveTTSEvents,
} from '@deepgram/sdk'

export class DeepgramService {
  constructor(apiKey, eventEmitter, params = {}) {
    this.apiKey = apiKey
    this.eventEmitter = eventEmitter
    this.params = params
    this.dgClient = createClient(this.apiKey)

    this.listenConnection = null
    this.speakConnection = null

    this.speakQueue = []
    this.keepAliveInterval = null
    this.speakCounter = 0

    this.initializeListenConnection()
    this.initializeSpeakConnection()
    console.log('DeepgramService instantiated with API key:', !!this.apiKey)
  }

  initializeListenConnection() {
    this.listenConnection = this.dgClient.listen.live({
      language: this.params.language || 'en',
      punctuate: true,
      smart_format: true,
      model: 'nova-3',
      sample_rate: this.params?.sample_rate
        ? parseInt(this.params.sample_rate)
        : 16000,
      channels: this.params?.channels ? parseInt(this.params.channels) : 1,
      ...this.params,
    })

    this.setupListenHandlers()
    this.startKeepAlive()
  }

  initializeSpeakConnection() {
    this.speakConnection = this.dgClient.speak.live({
      model: 'aura-2-thalia-en',
      encoding: 'linear16',
    })

    this.setupSpeakHandlers()
  }

  setupListenHandlers() {
    this.listenConnection
      .on(LiveTranscriptionEvents.Open, this.handleListenOpen.bind(this))
      .on(LiveTranscriptionEvents.Transcript, this.handleTranscript.bind(this))
      .on(LiveTranscriptionEvents.Close, this.handleListenClose.bind(this))
      .on(LiveTranscriptionEvents.Error, this.handleListenError.bind(this))
      .on(LiveTranscriptionEvents.Warning, this.handleListenWarning.bind(this))
      .on(LiveTranscriptionEvents.Metadata, this.handleMetadata.bind(this))
  }

  setupSpeakHandlers() {
    this.speakConnection
      .on(LiveTTSEvents.Open, this.handleSpeakOpen.bind(this))
      .on(LiveTTSEvents.Error, this.handleSpeakError.bind(this))
      .on(LiveTTSEvents.Close, this.handleSpeakClose.bind(this))
      .on(LiveTTSEvents.Flushed, this.handleSpeakFlush.bind(this))
      .on(LiveTTSEvents.Audio, this.handleSpeakData.bind(this))
  }

  startKeepAlive() {
    this.keepAliveInterval = setInterval(() => {
      console.log('deepgram: keepalive')
      this.listenConnection?.keepAlive()
    }, 10 * 1000)
  }

  async synthesizeSpeech(text) {
    console.log('DeepgramService synthesizeSpeech', text)
    this.speakCounter++
    if (!this.speakConnection || this.speakConnection.getReadyState() >= 2) {
      await this.initializeSpeakConnection()
    }
    console.log('DeepgramService synthesizeSpeech B')
    this.speakConnection.sendText(text)
    this.speakConnection.flush()
  }

  resetSpeakConnection() {
    this.speakConnection = null
    this.speakQueue = []
  }

  sendMessage(message) {
    try {
      if (this.listenConnection.getReadyState() === 1) {
        // console.log('socket: data sent to deepgram', message)
        this.listenConnection.send(message)
      } else if (this.listenConnection.getReadyState() >= 2) {
        console.log("socket: data couldn't be sent to deepgram")
        console.log('socket: retrying connection to deepgram')
        this.listenConnection.removeAllListeners()
        this.initializeListenConnection()
      } else {
        console.log("socket: data couldn't be sent to deepgram")
      }
    } catch (error) {
      console.error('Error sending audio to Deepgram:', error)
    }
  }

  handleListenOpen() {
    console.log('deepgram: connected')
  }

  handleTranscript(data) {
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

  handleListenClose() {
    console.log('deepgram: disconnected')
    this.close()
  }

  handleListenError(error) {
    console.log('deepgram: error received')
    console.error(error)
  }

  handleListenWarning(warning) {
    console.log('deepgram: warning received')
    console.warn(warning)
  }

  handleMetadata(data) {
    console.log('deepgram: packet received')
    console.log('deepgram: metadata received')
    console.log('ws: metadata sent to client')
    this.eventEmitter.emit('metadata', { metadata: data })
  }

  handleSpeakOpen() {
    console.log('Deepgram TTS connection opened')
  }

  handleSpeakError(error) {
    console.error('Deepgram TTS error:', error)
    this.eventEmitter.emit('error', { message: 'TTS connection error' })
    this.resetSpeakConnection()
  }

  handleSpeakClose() {
    console.log('Deepgram TTS connection closed')
    this.resetSpeakConnection()
  }

  handleSpeakData(audioChunk) {
    console.log('Deepgram audio received:', audioChunk)
    this.eventEmitter.emit('speech', { audio: audioChunk })
  }

  handleSpeakFlush() {
    console.log('Deepgram TTS flush event received')
    this.speakCounter = Math.max(0, this.speakCounter - 1)

    if (this.speakCounter > 0) {
      console.log('Flushing remaining speech requests:', this.speakCounter)
      this.speakConnection.flush()
    } else {
      this.speakConnection.sendText('')
    }
  }

  close() {
    if (this.listenConnection) {
      this.listenConnection.removeAllListeners()
      this.listenConnection = null
    }
    if (this.speakConnection) {
      this.speakConnection = null
    }
    this.resetSpeakConnection()
    if (this.keepAliveInterval) {
      clearInterval(this.keepAliveInterval)
      this.keepAliveInterval = null
    }
  }
}

export default DeepgramService
