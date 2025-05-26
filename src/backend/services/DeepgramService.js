import { createClient, LiveTranscriptionEvents } from '@deepgram/sdk'

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
    this.inactivityTimer = null

    this.initializeListenConnection()
    this.initializeSpeakConnection()
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

  setupSpeakHandlers() {
    this.speakConnection
      .on('open', this.handleSpeakOpen.bind(this))
      .on('error', this.handleSpeakError.bind(this))
      .on('close', this.handleSpeakClose.bind(this))
      .on('data', this.handleSpeakData.bind(this))
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
      this.speakConnection?.finish()
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

  handleSpeakOpen() {
    console.log('Deepgram TTS connection opened')
    this.processSpeakText()
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
    if (!this.speakConnection || this.speakConnection.getReadyState() !== 'open') {
      await this.initializeSpeakConnection()
    }

    this.speakQueue.push(text)
    this.processSpeakText()
  }

  async initializeSpeakConnection() {
    this.speakConnection = this.dgClient.speak.live({
      model: 'aura-asteria-en',
      encoding: 'linear16',
      container: 'wav'
    })

    this.setupSpeakHandlers()
    this.resetInactivityTimer()
  }

  processSpeakText() {
    if (!this.speakConnection || this.speakConnection.getReadyState() !== 'open') return
    if (this.speakQueue.length === 0) return

    while (this.speakQueue.length > 0) {
      const text = this.speakQueue.shift()
      this.speakConnection.send(text)
    }
    this.speakConnection.finish()
  }

  resetSpeakConnection() {
    this.speakConnection = null
    this.speakQueue = []
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
    if (this.speakConnection) {
      this.speakConnection.finish()
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
