import React, { useState, useEffect, useRef } from 'react'
import Scene from './Scene'
import GeminiWebSocketService from '../services/gemini/GeminiWebSocketService'
import { AudioRecordingService } from '../services/audio/AudioRecordingService'

export default function App() {
  const [messages, setMessages] = useState([])
  const [inputMessage, setInputMessage] = useState('')
  const [isRecording, setIsRecording] = useState(false)
  const [audioStatus, setAudioStatus] = useState('')
  const ws = useRef(null)
  const audioService = useRef(null)

  useEffect(() => {
    if (!ws.current) {
      ws.current = new GeminiWebSocketService({
        onMessage: handleWebSocketMessage,
      })
    }
    return () => {
      if (audioService.current) {
        audioService.current.stopRecording()
      }
    }
  }, [])

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
      ws.current.sendMessage({
        realtimeInput: {
          mediaChunks: [inputMessage],
        },
      })
      setInputMessage('')
    }
  }

  const toggleRecording = async () => {
    if (!ws.current) {
      setMessages((prev) => [
        ...prev,
        { type: 'error', text: 'Cannot record audio: Not connected to server' },
      ])
      return
    }

    if (!audioService.current) {
      audioService.current = new AudioRecordingService(ws.current.socket)
      audioService.current.onVolumeChange = (volume) => {
        const scaledVolume = Math.min(100, Math.floor(volume * 100))
        if (scaledVolume > 5) {
          setAudioStatus(`Recording... Volume: ${scaledVolume}%`)
        }
      }
      audioService.current.onStatusChange = (status) => {
        setAudioStatus(status)
        if (status === 'Recording stopped') {
          setIsRecording(false)
          setMessages((prev) => [
            ...prev,
            { type: 'sent', text: 'Stopped audio recording' },
          ])
        } else if (status.includes('Recording...')) {
          setMessages((prev) => [
            ...prev,
            { type: 'sent', text: 'Started audio recording' },
          ])
        }
      }
    }

    if (isRecording) {
      audioService.current.stopRecording()
      setIsRecording(false)
    } else {
      const started = await audioService.current.startRecording()
      if (!started) {
        setMessages((prev) => [
          ...prev,
          { type: 'error', text: 'Failed to start recording' },
        ])
      } else {
        setIsRecording(true)
      }
    }
  }

  return (
    <div>
      <Scene />
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
        <div className="audio-status">{audioStatus}</div>
        <div className="controls">
          <form onSubmit={handleSendMessage}>
            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              placeholder="Type a message..."
            />
            <button type="submit">Send</button>
          </form>
          <button
            className={`record-button ${isRecording ? 'recording' : ''}`}
            onClick={toggleRecording}
          >
            <span className="record-icon"></span>
            {isRecording ? 'Stop Recording' : 'Record Audio'}
          </button>
        </div>
      </div>
    </div>
  )
}
