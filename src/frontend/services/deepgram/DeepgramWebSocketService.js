import BaseWebSocketService from '../websocket/BaseWebSocketService'

class DeepgramWebSocketService extends BaseWebSocketService {
  constructor(callbacks = {}, options = {}) {
    const wsUrl = new URL(import.meta.env.VITE_WS_URL)

    Object.entries(options).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        wsUrl.searchParams.set(key, value.toString())
      }
    })

    super(wsUrl.toString(), {})
    this.callbacks = callbacks
    this.options = options
  }

  connect() {
    super.connect()
  }

  setupEventHandlers() {
    this.ws.onopen = () => {
      console.log('WebSocket connection established', this.options)
      if (this.callbacks.onOpen) this.callbacks.onOpen()
    }

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        this.onMessage(data)
      } catch (error) {
        console.error('Error handling WebSocket message:', error)
      }
    }

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error)
      if (this.callbacks.onError) this.callbacks.onError(error)
    }

    this.ws.onclose = () => {
      console.log('WebSocket connection closed')
      if (this.callbacks.onClose) this.callbacks.onClose()
    }
  }

  sendAudioData(data) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(data)
    } else {
      console.error('WebSocket not ready. State:', this.ws?.readyState)
    }
  }

  onMessage(data) {
    if (this.callbacks.onMessage) {
      this.callbacks.onMessage(data)
    }
  }
}

export default DeepgramWebSocketService
