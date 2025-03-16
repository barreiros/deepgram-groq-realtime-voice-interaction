import BaseWebSocketService from '../websocket/BaseWebSocketService'

class GeminiWebSocketService extends BaseWebSocketService {
  constructor(options = {}) {
    super('ws://localhost:3001', options)
    this.connect()
  }

  sendAudioData(data) {
    console.log('GeminiWebSocketService received audio data:', data)
    if (data?.realtimeInput?.mediaChunks) {
      console.log('Sending audio data to WebSocket')
      this.sendMessage(data)
    } else {
      console.error('Invalid audio data format:', data)
    }
  }

  sendSetupConfig(config) {
    this.sendMessage(config)
  }
}

export default GeminiWebSocketService
