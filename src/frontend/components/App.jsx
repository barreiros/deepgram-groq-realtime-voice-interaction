import React, { useState } from 'react'
import Scene from './Scene'
import WebSocketConnection from './WebSocketConnection'

export default function App() {
  const [message, setMessage] = useState('')

  const handleWebSocketMessage = (data) => {
    setMessage(data)
  }

  return (
    <div>
      <Scene />
      <WebSocketConnection onMessage={handleWebSocketMessage} />
      {message && <div>{message}</div>}
    </div>
  )
}
