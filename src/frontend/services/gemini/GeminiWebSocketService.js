import BaseWebSocketService from '../websocket/BaseWebSocketService'

class GeminiWebSocketService extends BaseWebSocketService {
  constructor(options = {}) {
    super('ws://localhost:3001', options)
    this.connect()
  }

  sendAudioData(data) {
    if (data?.realtimeInput?.mediaChunks) {
      this.sendMessage(data)
    }
  }

  sendSetupConfig(config) {
    this.sendMessage(config)
  }
}

export default GeminiWebSocketService
