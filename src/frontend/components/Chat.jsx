import React, { useState, useRef, useEffect } from 'react'
import Button from './Button'

const PaperClipIcon = (props) => (
  <svg {...props} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="m18.375 12.739-7.693 7.693a4.5 4.5 0 0 1-6.364-6.364l10.94-10.94A3 3 0 1 1 19.5 7.372L8.552 18.32m.009-.01-.01.01m5.699-9.941-7.81 7.81a1.5 1.5 0 0 0 2.112 2.13" />
  </svg>
)

const PaperAirplaneIcon = (props) => (
  <svg {...props} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" />
  </svg>
)

const MicrophoneIcon = (props) => (
  <svg {...props} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 0 1-3-3V4.5a3 3 0 1 1 6 0v8.25a3 3 0 0 1-3 3Z" />
  </svg>
)

const StopIcon = (props) => (
  <svg {...props} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 7.5A2.25 2.25 0 0 1 7.5 5.25h9a2.25 2.25 0 0 1 2.25 2.25v9a2.25 2.25 0 0 1-2.25 2.25h-9a2.25 2.25 0 0 1-2.25-2.25v-9Z" />
  </svg>
)

const XMarkIcon = (props) => (
  <svg {...props} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
  </svg>
)

const Chat = ({
  messages,
  onSendMessage,
  onImageFilesSelected,
  onRemoveImage,
  onRemoveAllImages,
  selectedImages,
  imagePreviews,
  isAuthorized,
  isRecording,
  toggleRecording,
  agentInstructions,
  setAgentInstructions,
  currentAgentInstructions,
  updateAgentInstructions,
  clearChat,
}) => {
  const [inputText, setInputText] = useState('')
  const [showAgentOptions, setShowAgentOptions] = useState(false)
  const messagesContainerRef = useRef(null)
  const fileInputRef = useRef(null)
  const chatInputRef = useRef(null)

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

  const handleImageSelect = (event) => {
    const files = event.target.files
    if (files && files.length > 0) {
      console.log('Selected files from input:', files.length)
      onImageFilesSelected(Array.from(files))
    }
  }

  const sendTextMessage = async () => {
    if ((!inputText.trim() && selectedImages.length === 0) || !isAuthorized)
      return

    onSendMessage(inputText.trim(), selectedImages, imagePreviews)
    setInputText('')
  }

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendTextMessage()
    }
  }

  return (
    <>
      <div className="flex-1 overflow-hidden bg-gray-50">
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
                  className={`max-w-[70%] rounded-xl p-4 shadow-sm ${
                    message.type === 'user'
                      ? 'bg-blue-600 text-white'
                      : message.type === 'assistant'
                      ? 'bg-white text-gray-800 border border-gray-200'
                      : message.type === 'system'
                      ? 'bg-yellow-50 text-yellow-800 border border-yellow-200'
                      : 'bg-red-50 text-red-800 border border-red-200'
                  }`}
                >
                  {message.images && message.images.length > 0 && (
                    <div className="grid grid-cols-2 gap-2 mb-3">
                      {message.images.map((image, imgIndex) => (
                        <img
                          key={imgIndex}
                          src={image}
                          alt={`Uploaded ${imgIndex + 1}`}
                          className="max-w-full h-auto rounded-lg border border-gray-200"
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

      <div className="bg-white border-t shadow-sm">
        <div className="max-w-4xl mx-auto p-4">
          {imagePreviews.length > 0 && (
            <div className="mb-4 p-4 bg-gray-50 rounded-lg border">
              <div className="flex justify-between items-center mb-3">
                <span className="text-sm font-medium text-gray-700">
                  {imagePreviews.length} image
                  {imagePreviews.length > 1 ? 's' : ''} selected
                </span>
                <button
                  onClick={onRemoveAllImages}
                  className="text-gray-700 hover:text-gray-900 underline text-sm"
                >
                  Remove all
                </button>
              </div>
              <div className="grid grid-cols-4 gap-3">
                {imagePreviews.map((preview, index) => (
                  <div key={index} className="relative group">
                    <img
                      src={preview}
                      alt={`Preview ${index + 1}`}
                      className="w-full h-20 object-cover rounded-lg border border-gray-200"
                    />
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => onRemoveImage(index)}
                      icon={XMarkIcon}
                      className="absolute -top-2 -right-2 w-6 h-6 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex space-x-3">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleImageSelect}
              className="hidden"
            />
            <div className="flex space-x-2">
              <Button
                variant="secondary"
                onClick={() => fileInputRef.current?.click()}
                disabled={!isAuthorized}
                icon={PaperClipIcon}
                className="flex-shrink-0"
              />
              <Button
                variant="secondary"
                onClick={toggleRecording}
                disabled={!isAuthorized}
                icon={isRecording ? StopIcon : MicrophoneIcon}
                className={`flex-shrink-0 ${isRecording ? 'animate-pulse' : ''}`}
              />
            </div>
            <textarea
              ref={chatInputRef}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type your message, paste/drag images, or use voice..."
              className="flex-1 p-3 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
              rows="1"
              disabled={!isAuthorized}
            />
            <Button
              variant="primary"
              onClick={sendTextMessage}
              disabled={
                (!inputText.trim() && selectedImages.length === 0) ||
                !isAuthorized
              }
              icon={PaperAirplaneIcon}
              className="flex-shrink-0"
            >
              Send
            </Button>
          </div>

          <div className="flex items-center justify-between mt-3">
            <div className="text-xs text-gray-500">
              💡 Tip: You can paste (Ctrl+V) or drag & drop multiple images directly into the chat
            </div>
            <div className="flex items-center space-x-4 text-xs">
              <button
                onClick={() => setShowAgentOptions(!showAgentOptions)}
                className="text-gray-700 hover:text-gray-900 underline"
              >
                {showAgentOptions ? 'Hide Agent Options' : 'Agent Options'}
              </button>
              <button
                onClick={clearChat}
                className="text-gray-700 hover:text-gray-900 underline"
              >
                Clear Chat
              </button>
            </div>
          </div>

          {showAgentOptions && (
            <div className="mt-4 p-4 bg-gray-50 rounded-lg border">
              <div className="space-y-3">
                <label className="block text-sm font-medium text-gray-700">
                  Agent Instructions
                </label>
                <textarea
                  value={agentInstructions}
                  onChange={(e) => setAgentInstructions(e.target.value)}
                  placeholder="Enter instructions for the AI agent (e.g., 'You are a helpful coding assistant...')"
                  className="w-full p-3 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                  rows="3"
                />
                <div className="flex justify-end">
                  <button
                    onClick={updateAgentInstructions}
                    disabled={!isAuthorized}
                    className="px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                  >
                    Update Agent
                  </button>
                </div>
                {currentAgentInstructions && (
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="text-sm text-blue-800">
                      <strong>Current Instructions:</strong>
                    </div>
                    <div className="text-sm text-blue-700 mt-1">
                      {currentAgentInstructions}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

export default Chat
