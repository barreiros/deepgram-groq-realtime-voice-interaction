class BaseWebSocketService {
  constructor(url, options = {}) {
    this.url = url
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
      console.log('WebSocket connection established')
      if (this.options.onOpen) this.options.onOpen()
    }

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        this.onMessage(data)
      } catch (error) {
        console.error('Error parsing message:', error)
      }
    }

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error)
      if (this.options.onError) this.options.onError(error)
    }

    this.ws.onclose = () => {
      console.log('WebSocket connection closed')
      if (this.options.onClose) this.options.onClose()
    }
  }

  sendMessage(message) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message))
    }
  }

  close() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.close()
    }
  }
}

export default BaseWebSocketService
