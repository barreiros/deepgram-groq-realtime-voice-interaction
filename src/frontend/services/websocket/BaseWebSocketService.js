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
        // Check if the data is a Blob (binary data)
        if (event.data instanceof Blob) {
          console.log('Received binary data (Blob) from WebSocket')
          this.onMessage(event.data) // Pass the raw Blob
        } else {
          // Otherwise, assume it's a JSON string
          const data = JSON.parse(event.data)
          this.onMessage(data)
        }
      } catch (error) {
        console.error('Error handling WebSocket message:', error)
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
