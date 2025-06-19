class BaseWebSocketService {
  constructor(url, callbacks = {}, options = {}) {
    this.url = url
    this.callbacks = callbacks
    this.options = options
    this.ws = null
    this.onMessage = options.onMessage || (() => {})
  }

  connect() {
    this.ws = new WebSocket(this.url)
    this.setupEventHandlers()
  }

  setupEventHandlers() {
    this.ws.onopen = () => {
      console.log('WebSocket connection established', this.options)
      if (this.callback.onOpen) this.callbacks.onOpen()
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

  sendMessage(message) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message))
    } else {
      console.error('WebSocket not ready. State:', this.ws?.readyState)
    }
  }

  close() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.close()
    }
  }
}

export default BaseWebSocketService
