import BaseWebSocketService from '../websocket/BaseWebSocketService'

class DeepgramWebSocketService extends BaseWebSocketService {
  constructor(options = {}) {
    super('ws://localhost:3001', options)
    this.connect()
  }

  sendAudioData(data) {
    // data should be raw audio (ArrayBuffer or Blob)
    this.sendMessage(data)
  }
}

export default DeepgramWebSocketService
