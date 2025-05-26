import { createClient, LiveTranscriptionEvents } from '@deepgram/sdk'

export class DeepgramService {
  constructor(apiKey, eventEmitter, params = {}) {
    this.apiKey = apiKey
    this.eventEmitter = eventEmitter
    this.params = params
    this.dgClient = createClient(this.apiKey)
    
    this.listenConnection = null
    this.ttsConnection = null
    
    this.ttsQueue = []
    this.keepAliveInterval = null
    this.inactivityTimer = null

    this.initializeListenConnection()
    console.log('DeepgramService instantiated with API key:', !!this.apiKey)
  }

  initializeListenConnection() {
    this.listenConnection = this.dgClient.listen.live({
      language: this.params.language || 'en',
      punctuate: true,
      smart_format: true,
      model: 'nova',
      sample_rate: this.params?.sample_rate ? parseInt(this.params.sample_rate) : 16000,
      channels: this.params?.channels ? parseInt(this.params.channels) : 1,
      ...this.params,
    })

    this.setupListenHandlers()
    this.startKeepAlive()
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

  setupTTSHandlers() {
    this.ttsConnection
      .on('open', this.handleTTSOpen.bind(this))
      .on('error', this.handleTTSError.bind(this))
      .on('close', this.handleTTSClose.bind(this))
      .on('data', this.handleTTSData.bind(this))
  }

  startKeepAlive() {
    this.keepAliveInterval = setInterval(() => {
      console.log('deepgram: keepalive')
      this.listenConnection?.keepAlive()
    }, 10 * 1000)
  }

  resetInactivityTimer() {
    clearTimeout(this.inactivityTimer)
    this.inactivityTimer = setTimeout(() => {
      this.ttsConnection?.finish()
    }, 30000)
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

  handleTTSOpen() {
    console.log('Deepgram TTS connection opened')
    this.processTTSText()
  }

  handleTTSError(error) {
    console.error('Deepgram TTS error:', error)
    this.eventEmitter.emit('error', { message: 'TTS connection error' })
    this.resetTTSConnection()
  }

  handleTTSClose() {
    console.log('Deepgram TTS connection closed')
    this.resetTTSConnection()
  }

  handleTTSData(audioChunk) {
    this.eventEmitter.emit('speech', { audio: audioChunk })
    this.resetInactivityTimer()
  }

  createWebSocket(clientWs) {
    console.log('DeepgramService.createWebSocket called')
    let deepgram = this.setupDeepgram(clientWs)

    clientWs.on('close', () => {
      console.log('socket: client disconnected')
    })

    return deepgram
  }

  async synthesizeSpeech(text) {
    if (!this.ttsConnection || this.ttsConnection.getReadyState() !== 'open') {
      await this.initializeTTSConnection()
    }

    this.ttsQueue.push(text)
    this.processTTSText()
  }

  async initializeTTSConnection() {
    this.ttsConnection = this.dgClient.speak.live({
      model: 'aura-asteria-en',
      encoding: 'linear16',
      container: 'wav'
    })

    this.setupTTSHandlers()
    this.resetInactivityTimer()
  }

  processTTSText() {
    if (!this.ttsConnection || this.ttsConnection.getReadyState() !== 'open') return
    if (this.ttsQueue.length === 0) return

    while (this.ttsQueue.length > 0) {
      const text = this.ttsQueue.shift()
      this.ttsConnection.send(text)
    }
    this.ttsConnection.finish()
  }

  resetTTSConnection() {
    this.ttsConnection = null
    this.ttsQueue = []
    clearTimeout(this.inactivityTimer)
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
      if (this.listenConnection.getReadyState() === 1) {
        // console.log('socket: data sent to deepgram', message)
        this.listenConnection.send(message)
      } else if (this.listenConnection.getReadyState() >= 2) {
        console.log("socket: data couldn't be sent to deepgram")
        console.log('socket: retrying connection to deepgram')
        this.listenConnection.finish()
        this.listenConnection.removeAllListeners()
        this.initializeListenConnection()
      } else {
        console.log("socket: data couldn't be sent to deepgram")
      }
    } catch (error) {
      console.error('Error sending audio to Deepgram:', error)
    }
  }

  close() {
    if (this.listenConnection) {
      this.listenConnection.finish()
      this.listenConnection.removeAllListeners()
      this.listenConnection = null
    }
    if (this.ttsConnection) {
      this.ttsConnection.finish()
      this.ttsConnection = null
    }
    this.resetTTSConnection()
    if (this.keepAliveInterval) {
      clearInterval(this.keepAliveInterval)
      this.keepAliveInterval = null
    }
  }
}

export default DeepgramService
