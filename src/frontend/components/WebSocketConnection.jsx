import React, {
  useState,
  useEffect,
  useRef,
  forwardRef,
  useImperativeHandle,
} from 'react'

const WebSocketConnection = forwardRef(({ onMessage }, ref) => {
  const wsRef = useRef(null)

  const setupConfig = {
    setup: {
      model: 'models/gemini-2.0-flash-exp',
      generationConfig: {
        responseModalities: 'audio',
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Aoede' } },
        },
      },
      tools: [
        {
          functionDeclarations: [
            {
              name: 'confetti',
              description:
                'Execute a confetti action when user is asking for it',
            },
            {
              name: 'stream_tool',
              description:
                'Enable and stream tool when user is asking for it: transform, delete, translate, rotate, scale, duplicate, animation, message, primaryColor, secondaryColor',
            },
            {
              name: 'stream_action',
              description:
                'Execute an stream action when user is asking for it: changePosition, changeRotation, changeScale, duplicateNode, deleteNode, changePrimaryColor, changeSecondaryColor',
              parameters: {
                type: 'object',
                properties: {
                  action: {
                    type: 'string',
                    description: 'The name of the action to perform',
                    enum: [
                      'changePosition',
                      'changeRotation',
                      'changeScale',
                      'duplicateNode',
                      'deleteNode',
                      'changePrimaryColor',
                      'changeSecondaryColor',
                    ],
                  },
                  payload: {
                    type: 'string',
                    description:
                      'A JSON object structured according to the specific action being performed',
                  },
                },
                required: ['action', 'payload'],
              },
            },
          ],
        },
      ],
    },
  }

  useEffect(() => {
    const ws = new WebSocket('ws://localhost:3001')
    wsRef.current = ws

    ws.onopen = () => {
      console.log('WebSocket connection established')
      ws.send(JSON.stringify(setupConfig))
    }

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        onMessage(data)
      } catch (error) {
        console.error('Error parsing message:', error)
      }
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
        try {
          const data = JSON.parse(event.data)
          onMessage(data)
        } catch (error) {
          console.error('Error parsing message:', error)
        }
      }
    }
  }, [onMessage])

  const sendMessage = (message) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ message }))
    }
  }

  useImperativeHandle(ref, () => ({
    sendMessage,
  }))

  return null
})

export default WebSocketConnection
