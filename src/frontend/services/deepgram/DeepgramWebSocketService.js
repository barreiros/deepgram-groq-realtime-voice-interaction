import BaseWebSocketService from '../websocket/BaseWebSocketService'

class DeepgramWebSocketService extends BaseWebSocketService {
  constructor(callbacks = {}, options = {}) {
    const wsUrl = new URL('ws://localhost:3001')
    
    // Add all options as query parameters
    Object.entries(options).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        wsUrl.searchParams.set(key, value.toString())
      }
    })
    
    super(wsUrl.toString(), callbacks)
    this.options = options
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
