import BaseWebSocketService from '../websocket/BaseWebSocketService'

class DeepgramWebSocketService extends BaseWebSocketService {
  constructor(options = {}) {
    super('ws://localhost:3001', options)
    this.connect()
  }

  sendAudioData(data) {
    // data should be raw audio (ArrayBuffer or Blob)
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(data)
    } else {
      console.error('WebSocket not ready. State:', this.ws?.readyState)
    }
  }
}

export default DeepgramWebSocketService
