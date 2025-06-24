import React, { useState, useRef, useEffect } from 'react'

const Chat = ({
  messages,
  onSendMessage,
  onImageFilesSelected,
  onRemoveImage,
  onRemoveAllImages,
  selectedImages,
  imagePreviews,
  isAuthorized,
}) => {
  const [inputText, setInputText] = useState('')
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
          {imagePreviews.length > 0 && (
            <div className="mb-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-gray-600">
                  {imagePreviews.length} image
                  {imagePreviews.length > 1 ? 's' : ''} selected
                </span>
                <button
                  onClick={onRemoveAllImages}
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
                      onClick={() => onRemoveImage(index)}
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
    </>
  )
}

export default Chat
