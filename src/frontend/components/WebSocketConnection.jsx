import React, { useState } from 'react'
import { useEffect, useRef } from 'react'

export default function WebSocketConnection({ onMessage }) {
  const wsRef = useRef(null)

  useEffect(() => {
    const ws = new WebSocket('ws://localhost:3001')
    wsRef.current = ws

    ws.onopen = () => {
      console.log('WebSocket connection established')
    }

    ws.onmessage = (event) => {
      onMessage(event.data)
    }

    ws.onerror = (error) => {
      console.error('WebSocket error:', error)
    }

    ws.onclose = () => {
      console.log('WebSocket connection closed')
    }

    return () => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.close()
      }
    }
  }, [])

  useEffect(() => {
    if (wsRef.current) {
      wsRef.current.onmessage = (event) => {
        onMessage(event.data)
      }
    }
  }, [onMessage])

  const sendMessage = (message) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(message)
    }
  }

  return null
}
