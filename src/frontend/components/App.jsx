import React, { useState, useEffect, useRef } from 'react'
import Scene from './Scene'
import GeminiWebSocketService from '../services/gemini/GeminiWebSocketService'
import { AudioRecordingService } from '../services/audio/AudioRecordingService'
import AudioPlaybackService from '../services/audio/AudioPlaybackService'

export default function App() {
  const [messages, setMessages] = useState([])
  const [inputMessage, setInputMessage] = useState('')
  const [isRecording, setIsRecording] = useState(false)
  const [audioStatus, setAudioStatus] = useState('')
  const ws = useRef(null)
  const audioService = useRef(null)
  const audioPlayback = useRef(null)
  const sceneAPIRef = useRef(null)

  const handleSceneReady = (api) => {
    console.log('Scene API ready:', api)
    sceneAPIRef.current = api
  }

  useEffect(() => {
    if (!ws.current) {
      ws.current = new GeminiWebSocketService({
        onMessage: handleWebSocketMessage,
      })
    }
    if (!audioPlayback.current) {
      audioPlayback.current = new AudioPlaybackService()
    }
    return () => {
      if (audioService.current) {
        audioService.current.stopRecording()
      }
    }
  }, [])

  const handleWebSocketMessage = (data) => {
    try {
      console.log('Raw WebSocket message received:', data)
      const parsedData = typeof data === 'string' ? JSON.parse(data) : data
      console.log('Parsed WebSocket message:', parsedData)
      setMessages((prev) => [...prev, { type: 'received', text: parsedData }])

      if (parsedData?.toolCall?.functionCalls[0]) {
        const functionCall = parsedData?.toolCall?.functionCalls[0]
        if (functionCall.name === 'stream_action') {
          try {
            const { action, payload } = functionCall.args
            const parsedPayload = JSON.parse(payload)

            console.log(
              'Received stream action:',
              action,
              parsedPayload,
              sceneAPIRef.current
            )
            console.log('Action received:', action, 'Expected: addNode')

            // Try both addNode and add_node for compatibility
            if (action === 'addNode' || action === 'add_node') {
              console.log(
                'addNode action triggered, sceneAPI:',
                sceneAPIRef.current
              )
              if (sceneAPIRef.current?.addPrimitive) {
                console.log(
                  'Calling addPrimitive with:',
                  parsedPayload.type || 'cube'
                )
                sceneAPIRef.current.addPrimitive(parsedPayload.type || 'cube')
              } else {
                console.error('sceneAPI.addPrimitive is not available')
              }
            }
          } catch (error) {
            console.error('Error processing stream action:', error)
          }
        }
      }

      if (parsedData.serverContent?.modelTurn?.parts?.[0]?.inlineData) {
        const inlineData =
          parsedData.serverContent.modelTurn.parts[0].inlineData
        if (
          inlineData.mimeType &&
          inlineData.mimeType.startsWith('audio/pcm')
        ) {
          audioPlayback.current.playAudio(inlineData.data, inlineData.mimeType)
        }
      }
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
      audioService.current = new AudioRecordingService(ws.current)
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
      <Scene onSceneReady={handleSceneReady} />
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
          {/* <form onSubmit={handleSendMessage}>
            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              placeholder="Type a message..."
            />
            <button type="submit">Send</button>
          </form> */}
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
