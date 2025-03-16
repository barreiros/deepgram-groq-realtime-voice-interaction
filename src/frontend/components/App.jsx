import React, { useState, useRef } from 'react'
import Scene from './Scene'
import WebSocketConnection from './WebSocketConnection'

export default function App() {
  const [messages, setMessages] = useState([])
  const [inputMessage, setInputMessage] = useState('')
  const wsRef = useRef(null)

  const handleWebSocketMessage = (data) => {
    try {
      const parsedData = typeof data === 'string' ? JSON.parse(data) : data
      setMessages((prev) => [...prev, { type: 'received', text: parsedData }])
    } catch (error) {
      console.error('Error handling WebSocket message:', error)
    }
  }

  const handleSendMessage = (e) => {
    e.preventDefault()
    if (inputMessage.trim()) {
      setMessages((prev) => [...prev, { type: 'sent', text: inputMessage }])
      wsRef.current.sendMessage({
        realtimeInput: {
          mediaChunks: [inputMessage],
        },
      })
      setInputMessage('')
    }
  }

  return (
    <div>
      <Scene />
      <WebSocketConnection
        onMessage={handleWebSocketMessage}
        ref={(ref) => (wsRef.current = ref)}
      />
      <div className="chat-container">
        <div className="messages">
          {messages.map((msg, index) => (
            <div key={index} className={`message ${msg.type}`}>
              {typeof msg.text === 'string'
                ? msg.text
                : JSON.stringify(msg.text)}
            </div>
          ))}
        </div>
        <form onSubmit={handleSendMessage}>
          <input
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            placeholder="Type a message..."
          />
          <button type="submit">Send</button>
        </form>
      </div>
    </div>
  )
}
