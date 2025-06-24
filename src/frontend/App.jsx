import React, { useState, useEffect, useRef } from 'react'
import DeepgramWebSocketService from './services/deepgram/DeepgramWebSocketService'
import { AudioRecordingService } from './audio/AudioRecordingService'
import AudioPlaybackService from './audio/AudioPlaybackService'
import SecretPrompt from './components/SecretPrompt'

export default function App() {
  const [messages, setMessages] = useState([])
  const [inputText, setInputText] = useState('')
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
  const messagesContainerRef = useRef(null)
  const fileInputRef = useRef(null)
  const chatInputRef = useRef(null)
  const sampleRate = 24000

  const scrollToBottom = () => {
    if (messagesContainerRef.current) {
      setTimeout(() => {
        messagesContainerRef.current.scrollTop =
          messagesContainerRef.current.scrollHeight
      }, 100)
    }
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

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

  const handleImageSelect = (event) => {
    const files = event.target.files
    if (files && files.length > 0) {
      console.log('Selected files from input:', files.length)
      handleImageFiles(Array.from(files))
    }
  }

  const removeImage = (index) => {
    setSelectedImages((prev) => prev.filter((_, i) => i !== index))
    setImagePreviews((prev) => prev.filter((_, i) => i !== index))
  }

  const removeAllImages = () => {
    setSelectedImages([])
    setImagePreviews([])
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
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

  const sendTextMessage = async () => {
    if (
      (!inputText.trim() && selectedImages.length === 0) ||
      !ws.current ||
      !isAuthorized
    )
      return

    console.log('About to send message with images:', selectedImages.length)
    console.log('Selected images array:', selectedImages)

    const messageData = {
      type: 'chat-message',
      text: inputText.trim(),
      agentInstructions: currentAgentInstructions,
      timestamp: Date.now(),
    }

    if (selectedImages.length > 0) {
      console.log('Processing images for sending...')
      const imagePromises = selectedImages.map((file, index) => {
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
          text: inputText.trim(),
          images: imagePreviews,
          timestamp: Date.now(),
        },
      ])

      setInputText('')
      removeAllImages()
    } else {
      console.log('Sending text-only message')
      ws.current.sendMessage(messageData)

      setMessages((prev) => [
        ...prev,
        { type: 'user', text: inputText.trim(), timestamp: Date.now() },
      ])

      setInputText('')
    }
  }

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendTextMessage()
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
      className={`h-screen bg-gray-100 flex flex-col relative ${
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

      <div className="bg-white shadow-sm border-b p-4">
        <div className="max-w-4xl mx-auto flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-800">AI Voice Agent</h1>
          <button
            onClick={clearChat}
            className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
          >
            Clear Chat
          </button>
        </div>
      </div>

      <div className="bg-blue-50 border-b p-4">
        <div className="max-w-4xl mx-auto">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Agent Instructions
          </label>
          <div className="flex space-x-2">
            <textarea
              value={agentInstructions}
              onChange={(e) => setAgentInstructions(e.target.value)}
              placeholder="Enter instructions for the AI agent (e.g., 'You are a helpful coding assistant...')"
              className="flex-1 p-3 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              rows="2"
            />
            <button
              onClick={updateAgentInstructions}
              disabled={!isAuthorized}
              className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:bg-gray-300 disabled:cursor-not-allowe transition-colors whitespace-nowrap"
            >
              Update Agent
            </button>
          </div>
          {currentAgentInstructions && (
            <div className="mt-2 text-sm text-gray-600">
              <strong>Current:</strong> {currentAgentInstructions}
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        <div className="max-w-4xl mx-auto h-full flex flex-col">
          <div
            ref={messagesContainerRef}
            className="flex-1 overflow-y-auto p-4 space-y-4"
          >
            {messages.map((message, index) => (
              <div
                key={index}
                className={`flex ${
                  message.type === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                <div
                  className={`max-w-[70%] rounded-lg p-4 ${
                    message.type === 'user'
                      ? 'bg-blue-500 text-white'
                      : message.type === 'assistant'
                      ? 'bg-white text-gray-800 shadow-sm border'
                      : message.type === 'system'
                      ? 'bg-yellow-100 text-yellow-800 border border-yellow-200'
                      : 'bg-red-100 text-red-800 border border-red-200'
                  }`}
                >
                  {message.images && message.images.length > 0 && (
                    <div className="grid grid-cols-2 gap-2 mb-2">
                      {message.images.map((image, imgIndex) => (
                        <img
                          key={imgIndex}
                          src={image}
                          alt={`Uploaded ${imgIndex + 1}`}
                          className="max-w-full h-auto rounded-lg"
                        />
                      ))}
                    </div>
                  )}
                  <div className="whitespace-pre-wrap break-words">
                    {message.text}
                  </div>
                  <div className="text-xs opacity-70 mt-2">
                    {new Date(message.timestamp).toLocaleTimeString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white border-t p-4">
        <div className="max-w-4xl mx-auto">
          <div className="text-sm text-gray-600 text-center mb-4">
            {audioStatus || 'Click the microphone to start voice conversation'}
          </div>

          <div className="flex justify-center mb-4">
            <button
              className={`w-20 h-20 rounded-full flex items-center justify-center text-white text-2xl transition-all ${
                isRecording
                  ? 'bg-red-600 animate-pulse shadow-lg'
                  : isAuthorized
                  ? 'bg-blue-600 hover:bg-blue-700 shadow-md'
                  : 'bg-gray-400 cursor-not-allowed'
              }`}
              onClick={toggleRecording}
              disabled={!isAuthorized}
            >
              🎤
            </button>
          </div>

          {imagePreviews.length > 0 && (
            <div className="mb-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-gray-600">
                  {imagePreviews.length} image
                  {imagePreviews.length > 1 ? 's' : ''} selected
                </span>
                <button
                  onClick={removeAllImages}
                  className="text-sm text-red-500 hover:text-red-700"
                >
                  Remove all
                </button>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {imagePreviews.map((preview, index) => (
                  <div key={index} className="relative">
                    <img
                      src={preview}
                      alt={`Preview ${index + 1}`}
                      className="w-full h-20 object-cover rounded-lg border"
                    />
                    <button
                      onClick={() => removeImage(index)}
                      className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm hover:bg-red-600"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex space-x-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleImageSelect}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
              disabled={!isAuthorized}
            >
              📎
            </button>
            <textarea
              ref={chatInputRef}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type your message, paste/drag images, or use voice..."
              className="flex-1 p-3 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              rows="1"
              disabled={!isAuthorized}
            />
            <button
              onClick={sendTextMessage}
              disabled={
                (!inputText.trim() && selectedImages.length === 0) ||
                !isAuthorized
              }
              className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            >
              Send
            </button>
          </div>

          <div className="text-xs text-gray-500 text-center mt-2">
            💡 Tip: You can paste (Ctrl+V) or drag & drop multiple images
            directly into the chat
          </div>
        </div>
      </div>
    </div>
  )
}
