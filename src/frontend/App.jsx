import React, { useState, useEffect, useRef } from 'react'
import DeepgramWebSocketService from './services/deepgram/DeepgramWebSocketService'
import { AudioRecordingService } from './audio/AudioRecordingService'
import AudioPlaybackService from './audio/AudioPlaybackService'
import SecretPrompt from './components/SecretPrompt'
import Chat from './components/Chat'

export default function App() {
  const [messages, setMessages] = useState([])
  const [agentInstructions, setAgentInstructions] = useState('')
  const [currentAgentInstructions, setCurrentAgentInstructions] = useState('')
  const [showSecretPrompt, setShowSecretPrompt] = useState(true)
  const [isAuthorized, setIsAuthorized] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [audioStatus, setAudioStatus] = useState('')
  const [selectedImages, setSelectedImages] = useState([])
  const [imagePreviews, setImagePreviews] = useState([])
  const [isDragOver, setIsDragOver] = useState(false)
  const ws = useRef(null)
  const audioService = useRef(null)
  const audioPlayback = useRef(null)
  const sampleRate = 24000

  useEffect(() => {
    const handlePaste = (e) => {
      const items = e.clipboardData?.items
      if (!items) return

      const imageFiles = []
      for (let i = 0; i < items.length; i++) {
        const item = items[i]
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile()
          if (file) {
            imageFiles.push(file)
          }
        }
      }

      if (imageFiles.length > 0) {
        e.preventDefault()
        handleImageFiles(imageFiles)
      }
    }

    const handleDragOver = (e) => {
      e.preventDefault()
      setIsDragOver(true)
    }

    const handleDragLeave = (e) => {
      e.preventDefault()
      if (!e.currentTarget.contains(e.relatedTarget)) {
        setIsDragOver(false)
      }
    }

    const handleDrop = (e) => {
      e.preventDefault()
      setIsDragOver(false)

      const files = e.dataTransfer?.files
      if (files && files.length > 0) {
        const imageFiles = Array.from(files).filter((file) =>
          file.type.startsWith('image/')
        )
        if (imageFiles.length > 0) {
          handleImageFiles(imageFiles)
        }
      }
    }

    document.addEventListener('paste', handlePaste)
    document.addEventListener('dragover', handleDragOver)
    document.addEventListener('dragleave', handleDragLeave)
    document.addEventListener('drop', handleDrop)

    return () => {
      document.removeEventListener('paste', handlePaste)
      document.removeEventListener('dragover', handleDragOver)
      document.removeEventListener('dragleave', handleDragLeave)
      document.removeEventListener('drop', handleDrop)
    }
  }, [])

  const handleSecretSubmit = (secret) => {
    initializeWebSocket(secret)
  }

  const initializeWebSocket = (secret) => {
    if (ws.current) {
      ws.current.close()
      ws.current = null
    }

    ws.current = new DeepgramWebSocketService(
      {
        onMessage: handleWebSocketMessage,
        onOpen: () => {
          console.log('WebSocket connected successfully')
          setIsAuthorized(true)
          setShowSecretPrompt(false)
          setMessages([
            {
              type: 'system',
              text: 'Connected to AI Agent successfully',
              timestamp: Date.now(),
            },
          ])
        },
        onClose: () => {
          console.log('WebSocket disconnected')
          setIsAuthorized(false)
          setShowSecretPrompt(true)
          setMessages((prev) => [
            ...prev,
            {
              type: 'system',
              text: 'Disconnected from server',
              timestamp: Date.now(),
            },
          ])
        },
        onError: (error) => {
          console.error('WebSocket error:', error)
          setMessages((prev) => [
            ...prev,
            {
              type: 'error',
              text: 'Connection failed: Invalid secret or server error',
              timestamp: Date.now(),
            },
          ])
          setShowSecretPrompt(true)
          setIsAuthorized(false)
          if (ws.current) {
            ws.current.close()
            ws.current = null
          }
        },
      },
      {
        secret: secret,
        listen_language: 'en',
        listen_model: 'nova-3',
        llm_model: 'meta-llama/llama-4-maverick-17b-128e-instruct',
        llm_language: 'en',
        speech_model: 'aura-2-thalia-en',
      }
    )

    ws.current.connect()

    if (!audioPlayback.current) {
      audioPlayback.current = new AudioPlaybackService(sampleRate)
    }
  }

  useEffect(() => {
    return () => {
      if (audioService.current) {
        audioService.current.stopRecording()
      }
      if (ws.current) {
        ws.current.close()
      }
    }
  }, [])

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
      } else if (message.type === 'llm-text') {
        setMessages((prev) => [
          ...prev,
          { type: 'assistant', text: message.data, timestamp: Date.now() },
        ])
      } else if (message.type === 'transcription') {
        setMessages((prev) => [
          ...prev,
          { type: 'user', text: message.data, timestamp: Date.now() },
        ])
      } else if (message.type === 'shutup') {
        console.log('Shutup event received:', message.data)
        if (audioPlayback.current) {
          audioPlayback.current.stopPlayback()
        }
        if (message.data) {
          setMessages((prev) => [
            ...prev,
            { type: 'system', text: message.data, timestamp: Date.now() },
          ])
        }
      } else if (message.type === 'agent-instructions-updated') {
        setMessages((prev) => [
          ...prev,
          {
            type: 'system',
            text: 'Agent instructions updated successfully',
            timestamp: Date.now(),
          },
        ])
      } else if (message.type === 'error') {
        setMessages((prev) => [
          ...prev,
          {
            type: 'error',
            text: message.message || 'Unknown error',
            timestamp: Date.now(),
          },
        ])
        if (message.message && message.message.includes('Unauthorized')) {
          setShowSecretPrompt(true)
          setIsAuthorized(false)
          if (ws.current) {
            ws.current.close()
            ws.current = null
          }
        }
      } else if (message.type === 'connection') {
        console.log('Connection established:', message.message)
      }
    } catch (error) {
      console.error('Error handling WebSocket message:', error)
    }
  }

  const handleImageFiles = (files) => {
    const imageFiles = Array.from(files).filter((file) =>
      file.type.startsWith('image/')
    )
    if (imageFiles.length === 0) return

    console.log('Adding images:', imageFiles.length)
    console.log('Current selectedImages:', selectedImages.length)

    setSelectedImages(prev => {
      const newImages = [...prev, ...imageFiles]
      console.log('New selectedImages array:', newImages.length)
      return newImages
    })

    imageFiles.forEach((file) => {
      const reader = new FileReader()
      reader.onload = (e) => {
        setImagePreviews((prev) => {
          const newPreviews = [...prev, e.target.result]
          console.log('New imagePreviews array:', newPreviews.length)
          return newPreviews
        })
      }
      reader.readAsDataURL(file)
    })
  }

  const removeImage = (index) => {
    setSelectedImages((prev) => prev.filter((_, i) => i !== index))
    setImagePreviews((prev) => prev.filter((_, i) => i !== index))
  }

  const removeAllImages = () => {
    setSelectedImages([])
    setImagePreviews([])
  }

  const handleSendMessage = async (text, images, previews) => {
    console.log('About to send message with images:', images.length)
    console.log('Selected images array:', images)

    const messageData = {
      type: 'chat-message',
      text: text,
      agentInstructions: currentAgentInstructions,
      timestamp: Date.now(),
    }

    if (images.length > 0) {
      console.log('Processing images for sending...')
      const imagePromises = images.map((file, index) => {
        console.log(`Processing image ${index + 1}:`, file.name)
        return new Promise((resolve) => {
          const reader = new FileReader()
          reader.onload = () => {
            const base64Data = reader.result.split(',')[1]
            console.log(`Image ${index + 1} converted to base64, size:`, base64Data.length)
            resolve({
              data: base64Data,
              type: file.type,
              name: file.name,
            })
          }
          reader.readAsDataURL(file)
        })
      })

      const imageDataArray = await Promise.all(imagePromises)
      console.log('All images processed, final array length:', imageDataArray.length)
      messageData.images = imageDataArray

      console.log('Sending message with images:', messageData.images.length)
      ws.current.sendMessage(messageData)

      setMessages((prev) => [
        ...prev,
        {
          type: 'user',
          text: text,
          images: previews,
          timestamp: Date.now(),
        },
      ])

      removeAllImages()
    } else {
      console.log('Sending text-only message')
      ws.current.sendMessage(messageData)

      setMessages((prev) => [
        ...prev,
        { type: 'user', text: text, timestamp: Date.now() },
      ])
    }
  }

  const updateAgentInstructions = () => {
    if (!ws.current || !isAuthorized) return

    const messageData = {
      type: 'update-agent-instructions',
      agentInstructions: agentInstructions.trim(),
      timestamp: Date.now(),
    }

    ws.current.sendMessage(messageData)
    setCurrentAgentInstructions(agentInstructions.trim())

    setMessages((prev) => [
      ...prev,
      {
        type: 'system',
        text: `Agent instructions updated: "${
          agentInstructions.trim() || 'Default instructions'
        }"`,
        timestamp: Date.now(),
      },
    ])
  }

  const toggleRecording = async () => {
    if (!ws.current || !isAuthorized) {
      setMessages((prev) => [
        ...prev,
        {
          type: 'error',
          text: 'Cannot record audio: Not connected to server',
          timestamp: Date.now(),
        },
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
        } else if (status.includes('Recording...')) {
          // Audio recording started
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
          {
            type: 'error',
            text: 'Failed to start recording',
            timestamp: Date.now(),
          },
        ])
      } else {
        setIsRecording(true)
      }
    }
  }

  const clearChat = () => {
    setMessages([])
  }

  if (showSecretPrompt) {
    return <SecretPrompt onSecretSubmit={handleSecretSubmit} />
  }

  return (
    <div
      className={`h-screen bg-gray-50 flex flex-col relative ${
        isDragOver ? 'bg-blue-50' : ''
      }`}
    >
      {isDragOver && (
        <div className="absolute inset-0 bg-blue-500 bg-opacity-20 border-4 border-dashed border-blue-500 z-50 flex items-center justify-center">
          <div className="bg-white p-8 rounded-lg shadow-lg text-center">
            <div className="text-4xl mb-4">📷</div>
            <div className="text-xl font-semibold text-gray-700">
              Drop images here
            </div>
            <div className="text-sm text-gray-500 mt-2">
              Release to upload multiple images
            </div>
          </div>
        </div>
      )}

      <Chat
        messages={messages}
        onSendMessage={handleSendMessage}
        onClearChat={clearChat}
        onImageFilesSelected={handleImageFiles}
        onRemoveImage={removeImage}
        onRemoveAllImages={removeAllImages}
        selectedImages={selectedImages}
        imagePreviews={imagePreviews}
        isAuthorized={isAuthorized}
        isDragOver={isDragOver}
        isRecording={isRecording}
        toggleRecording={toggleRecording}
        agentInstructions={agentInstructions}
        setAgentInstructions={setAgentInstructions}
        currentAgentInstructions={currentAgentInstructions}
        updateAgentInstructions={updateAgentInstructions}
        clearChat={clearChat}
      />
    </div>
  )
}
