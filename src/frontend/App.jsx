import React, { useState, useEffect, useRef } from 'react'
import Scene from './components/Scene'
import DeepgramWebSocketService from './services/deepgram/DeepgramWebSocketService'
import { AudioRecordingService } from './audio/AudioRecordingService'
import AudioPlaybackService from './audio/AudioPlaybackService'

export default function App() {
  const [messages, setMessages] = useState([])
  const [isRecording, setIsRecording] = useState(false)
  const [isTimerActive, setIsTimerActive] = useState(false)
  const [audioStatus, setAudioStatus] = useState('')
  const ws = useRef(null)
  const audioService = useRef(null)
  const audioPlayback = useRef(null)
  const sceneAPIRef = useRef(null)
  const timerRef = useRef(null)
  const messagesContainerRef = useRef(null)
  const lastScrollTime = useRef(Date.now())
  const sampleRate = 24000

  const testMessages = [
    'Hello, how are you?',
    // 'I just want to chat with you.',
    'Tell the name of 20 cities in the world.',
    'Let’s talk about dogs.',
    // 'Could you stop talking, please?',
    // 'Tell me a joke',
    'Shut up',
  ]

  const scrollToBottom = () => {
    if (messagesContainerRef.current) {
      const container = messagesContainerRef.current
      const now = Date.now()
      const timeSinceLastScroll = now - lastScrollTime.current

      if (timeSinceLastScroll > 2000) {
        setTimeout(() => {
          container.scrollTop = container.scrollHeight
        }, 0)
      }
    }
  }

  const handleScroll = () => {
    lastScrollTime.current = Date.now()
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  useEffect(() => {
    if (!ws.current) {
      ws.current = new DeepgramWebSocketService(
        {
          onMessage: handleWebSocketMessage,
        },
        {
          language: 'en',
          model: 'nova-2-meeting',
        }
      )
    }
    if (!audioPlayback.current) {
      audioPlayback.current = new AudioPlaybackService(sampleRate)
    }
    return () => {
      if (audioService.current) {
        audioService.current.stopRecording()
      }
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }
    }
  }, [])

  const handleSceneReady = (api) => {
    sceneAPIRef.current = api
  }

  const handleAudioRecordingMessage = (message) => {
    if (message.type === 'audioData' && ws.current) {
      ws.current.sendAudioData(message.data)
    }
  }

  const handleWebSocketMessage = (message) => {
    try {
      if (message.type === 'speech') {
        if (
          message.data.type === 'Buffer' &&
          Array.isArray(message.data.data)
        ) {
          // console.log('Received audio blob from WebSocket', message.data)
          let uint8Array = new Uint8Array(message.data.data)
          if (uint8Array.length % 2 !== 0) {
            uint8Array = uint8Array.slice(0, uint8Array.length - 1)
          }
          const int16Array = new Int16Array(
            uint8Array.buffer,
            uint8Array.byteOffset,
            Math.floor(uint8Array.byteLength / 2)
          )
          audioPlayback.current.playPcmAudio(int16Array)
        }
      } else if (
        message.type === 'llm-text' ||
        message.type === 'transcription'
      ) {
        console.log('Received text from WebSocket:', message.data)
        setMessages((prev) => [
          ...prev,
          { type: 'received', text: message.data },
        ])
      } else if (message.type === 'shutup') {
        console.log('Shutup event received:', message.data)
        if (audioPlayback.current) {
          audioPlayback.current.stopPlayback()
        }
        if (message.data) {
          setMessages((prev) => [
            ...prev,
            { type: 'system', text: message.data },
          ])
        }
      }
    } catch (error) {
      console.error('Error handling WebSocket message:', error)
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
      audioService.current = new AudioRecordingService({
        onMessage: handleAudioRecordingMessage,
      })
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

  const toggleTimer = () => {
    if (!ws.current) {
      setMessages((prev) => [
        ...prev,
        { type: 'error', text: 'Cannot start timer: Not connected to server' },
      ])
      return
    }

    if (isTimerActive) {
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
      setIsTimerActive(false)
      setMessages((prev) => [
        ...prev,
        { type: 'system', text: 'Timer stopped' },
      ])
    } else {
      let messageIndex = 0
      const message = testMessages[messageIndex]
      ws.current.sendMessage({
        type: 'timer-message',
        data: message,
      })
      setMessages((prev) => [
        ...prev,
        { type: 'sent', text: `Timer: ${message}` },
      ])
      messageIndex++
      timerRef.current = setInterval(() => {
        if (messageIndex < testMessages.length) {
          const message = testMessages[messageIndex]
          ws.current.sendMessage({
            type: 'timer-message',
            data: message,
          })
          setMessages((prev) => [
            ...prev,
            { type: 'sent', text: `Timer: ${message}` },
          ])
          messageIndex++
        } else {
          if (timerRef.current) {
            clearInterval(timerRef.current)
            timerRef.current = null
          }
          setIsTimerActive(false)
          setMessages((prev) => [
            ...prev,
            { type: 'system', text: 'Timer completed all messages' },
          ])
        }
      }, 7000)

      setIsTimerActive(true)
      setMessages((prev) => [
        ...prev,
        {
          type: 'system',
          text: 'Timer started - sending messages every 5 seconds',
        },
      ])
    }
  }

  return (
    <div className="m-0 p-0 overflow-hidden h-full">
      <Scene onSceneReady={handleSceneReady} />
      <div className="fixed bottom-5 right-5 w-[300px] bg-black/80 rounded-lg p-4 text-white max-h-[400px] flex flex-col">
        <div
          ref={messagesContainerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto mb-2.5 flex flex-col gap-2 max-h-[300px] scrollbar-none"
        >
          {messages.map((msg, index) => (
            <div
              key={index}
              className={`px-3 py-2 rounded-2xl max-w-[80%] break-words whitespace-pre-wrap ${
                msg.type === 'sent'
                  ? 'bg-blue-500 self-end'
                  : msg.type === 'received'
                  ? 'bg-zinc-700 self-start'
                  : msg.type === 'system'
                  ? 'bg-yellow-600 self-center text-center'
                  : 'bg-red-600 self-start'
              }`}
            >
              {(() => {
                const text =
                  typeof msg.text === 'string'
                    ? msg.text
                    : JSON.stringify(msg.text)
                return text.length > 200 ? text.slice(0, 200) + '...' : text
              })()}
            </div>
          ))}
        </div>
        <div className="text-sm text-white/80 text-center my-1">
          {audioStatus}
        </div>
        <div className="flex flex-col gap-2">
          <button
            className={`w-full flex items-center justify-center gap-2 py-2.5 px-2.5 border-none rounded text-white cursor-pointer transition-colors ${
              isRecording
                ? 'bg-red-600 animate-[pulse_1.5s_infinite]'
                : 'bg-zinc-700 hover:bg-zinc-600'
            }`}
            onClick={toggleRecording}
          >
            <span
              className={`w-3 h-3 rounded-full bg-white ${
                isRecording ? 'animate-[blink_1s_infinite]' : ''
              }`}
            ></span>
            {isRecording ? 'Stop Recording' : 'Record Audio'}
          </button>
          <button
            className={`w-full flex items-center justify-center gap-2 py-2.5 px-2.5 border-none rounded text-white cursor-pointer transition-colors ${
              isTimerActive
                ? 'bg-orange-600 animate-[pulse_1.5s_infinite]'
                : 'bg-zinc-700 hover:bg-zinc-600'
            }`}
            onClick={toggleTimer}
          >
            <span
              className={`w-3 h-3 rounded-full bg-white ${
                isTimerActive ? 'animate-[blink_1s_infinite]' : ''
              }`}
            ></span>
            {isTimerActive ? 'Stop Timer' : 'Start Timer'}
          </button>
        </div>
      </div>
    </div>
  )
}
