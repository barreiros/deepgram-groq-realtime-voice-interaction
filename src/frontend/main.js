import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { AudioRecorder } from './audio/AudioRecorder.js'

// WebSocket connection
let socket
let isConnected = false
let geminiInitialized = false

// Three.js variables
let scene, camera, renderer, controls
let cube

// DOM elements
const messageInput = document.getElementById('message-input')
const sendButton = document.getElementById('send-button')
const messageContainer = document.getElementById('message-container')
const recordButton = document.getElementById('record-button')
const audioStatus = document.getElementById('audio-status')

// Audio recorder
let audioRecorder = null
let isRecording = false

// Initialize the application
init()

// Initialize the application
function init() {
  initThreeJS()
  initWebSocket()
  initEventListeners()
  animate()
}

// Initialize Three.js scene
function initThreeJS() {
  // Create scene
  scene = new THREE.Scene()
  scene.background = new THREE.Color(0x000000)

  // Create camera
  camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  )
  camera.position.z = 5

  // Create renderer
  const container = document.getElementById('scene-container')
  renderer = new THREE.WebGLRenderer({ antialias: true })
  renderer.setSize(container.clientWidth, container.clientHeight)
  container.appendChild(renderer.domElement)

  // Add orbit controls
  controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true
  controls.dampingFactor = 0.05

  // Add ambient light
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.5)
  scene.add(ambientLight)

  // Add directional light
  const directionalLight = new THREE.DirectionalLight(0xffffff, 1)
  directionalLight.position.set(1, 1, 1)
  scene.add(directionalLight)

  // Create a cube
  const geometry = new THREE.BoxGeometry(1, 1, 1)
  const material = new THREE.MeshStandardMaterial({
    color: 0x3498db,
    metalness: 0.3,
    roughness: 0.4,
  })
  cube = new THREE.Mesh(geometry, material)
  scene.add(cube)

  // Handle window resize
  window.addEventListener('resize', onWindowResize)
}

// Initialize WebSocket connection
function initWebSocket() {
  socket = new WebSocket('ws://localhost:3001')

  socket.onopen = () => {
    isConnected = true
    console.log('Connected to WebSocket server')
    addMessage('System', 'Connected to WebSocket server', 'received')

    // Initialize Gemini connection after connecting to our server
    initGeminiConnection()
  }

  socket.onmessage = (event) => {
    try {
      // Check if the message is binary (from Gemini)
      if (event.data instanceof Blob) {
        // Handle binary message from Gemini
        event.data.text().then((text) => {
          try {
            const geminiData = JSON.parse(text)
            console.log('Gemini response:', geminiData)

            // Process Gemini response
            processGeminiResponse(geminiData)
          } catch (error) {
            console.error('Error parsing Gemini response:', error)
            addMessage('System', 'Error processing Gemini response', 'error')
          }
        })
        return
      }

      // Handle JSON messages from our server
      const data = JSON.parse(event.data)
      console.log('Message from server:', data)

      // Handle different message types
      switch (data.type) {
        case 'connection':
          addMessage('Server', data.message, 'received')
          break
        case 'error':
          addMessage('Server', `Error: ${data.message}`, 'error')
          break
        default:
          addMessage('Server', JSON.stringify(data), 'received')
      }
    } catch (error) {
      console.error('Error parsing message:', error)
      addMessage('System', 'Received invalid message format', 'error')
    }
  }

  socket.onclose = () => {
    isConnected = false
    console.log('Disconnected from WebSocket server')
    addMessage('System', 'Disconnected from WebSocket server', 'error')

    // Try to reconnect after 5 seconds
    setTimeout(() => {
      if (!isConnected) {
        addMessage('System', 'Attempting to reconnect...', 'received')
        initWebSocket()
      }
    }, 5000)
  }

  socket.onerror = (error) => {
    console.error('WebSocket error:', error)
    addMessage('System', 'WebSocket connection error', 'error')
  }
}

// Initialize event listeners
function initEventListeners() {
  // Send message on button click
  sendButton.addEventListener('click', sendMessage)

  // Send message on Enter key press
  messageInput.addEventListener('keypress', (event) => {
    if (event.key === 'Enter') {
      sendMessage()
    }
  })

  // Toggle audio recording on button click
  recordButton.addEventListener('click', toggleAudioRecording)
}

// Toggle audio recording
async function toggleAudioRecording() {
  if (!isConnected) {
    addMessage(
      'System',
      'Cannot record audio: Not connected to server',
      'error'
    )
    return
  }

  if (!geminiInitialized) {
    addMessage('System', 'Initializing Gemini connection first...', 'sent')
    initGeminiConnection()
  }

  if (isRecording) {
    stopRecording()
  } else {
    startRecording()
  }
}

// Start audio recording
async function startRecording() {
  try {
    // Create audio recorder if it doesn't exist
    if (!audioRecorder) {
      audioRecorder = new AudioRecorder(16000) // 16kHz sample rate for speech

      // Listen for audio data
      audioRecorder.on('data', (audioData) => {
        if (isConnected && isRecording) {
          sendAudioData(audioData)
        }
      })

      // Listen for volume updates
      audioRecorder.on('volume', (volume) => {
        updateVolumeIndicator(volume)
      })
    }

    // Start recording
    await audioRecorder.start()
    isRecording = true

    // Update UI
    recordButton.classList.add('recording')
    recordButton.innerHTML = '<span class="record-icon"></span>Stop Recording'
    audioStatus.textContent = 'Recording... Speak now'

    addMessage('System', 'Started audio recording', 'sent')
  } catch (error) {
    console.error('Failed to start recording:', error)
    addMessage('System', `Recording error: ${error.message}`, 'error')
  }
}

// Stop audio recording
function stopRecording() {
  if (audioRecorder && isRecording) {
    audioRecorder.stop()
    isRecording = false

    // Update UI
    recordButton.classList.remove('recording')
    recordButton.innerHTML = '<span class="record-icon"></span>Record Audio'
    audioStatus.textContent = 'Recording stopped'

    addMessage('System', 'Stopped audio recording', 'sent')
  }
}

// Send audio data to server
function sendAudioData(audioData) {
  if (!isConnected) return

  try {
    // Create audio message for Gemini
    const audioMessage = {
      audio: {
        data: audioData,
        sampleRate: 16000,
        encoding: 'LINEAR16',
      },
    }

    // Send to server
    socket.send(JSON.stringify(audioMessage))

    // Animate the cube to show audio is being sent
    animateCubeOnAudio()
  } catch (error) {
    console.error('Error sending audio data:', error)
  }
}

// Update volume indicator
function updateVolumeIndicator(volume) {
  // Scale volume (0-1) to a reasonable range
  const scaledVolume = Math.min(100, Math.floor(volume * 100))

  if (scaledVolume > 5) {
    // Only update for significant volume to reduce UI updates
    audioStatus.textContent = `Recording... Volume: ${scaledVolume}%`
  }
}

// Animate cube based on audio input
function animateCubeOnAudio() {
  if (!cube) return

  // Subtle animation to show audio processing
  const randomScale = 1 + Math.random() * 0.1
  cube.scale.x = randomScale
  cube.scale.z = randomScale

  // Rotate slightly
  cube.rotation.y += 0.02
}

// Initialize Gemini connection
function initGeminiConnection() {
  if (!isConnected) {
    addMessage(
      'System',
      'Cannot initialize Gemini: Not connected to server',
      'error'
    )
    return
  }

  // Create setup message for Gemini
  const setupMessage = {
    setup: {
      model: 'models/gemini-2.0-flash-exp',
      generationConfig: {
        responseModalities: 'audio',
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Aoede' } },
        },
      },
      systemInstruction: {
        parts: [
          {
            text: `First of all, you say Hello at the beginning of the conversation before receive any instruction. We have circles on a canvas that we can move and resize. Every time that I ask you something, I want you to use the "get_circles" function to understand where the circles are. Once you receive the response for "get_circles" I want you to use "change_circle" to modify one or multiple circle properties to accomplish our mutual goal. Every time I ask you ask you to do something you should call "get_circles" then "change_circle" after evaluating the response.

            The circles blend additively using screen mode, so if I ask you mix colors, you can make the color by moving circles to the same position to blend their colors.
            `,
          },
        ],
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
                type: 'OBJECT',
                properties: {
                  action: {
                    type: 'STRING',
                    description:
                      'The name of the action to perform (e.g., changePosition, changeRotation, changeScale, duplicateNode, deleteNode, changePrimaryColor, changeSecondaryColor)',
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
                    type: 'STRING',
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

  // Send setup message to server
  socket.send(JSON.stringify(setupMessage))
  addMessage('System', 'Initializing Gemini connection...', 'sent')
  geminiInitialized = true
}

// Process Gemini response
function processGeminiResponse(response) {
  if (!response) return

  // Check if response has candidates
  if (response.candidates && response.candidates.length > 0) {
    const candidate = response.candidates[0]

    // Process content parts if available
    if (candidate.content && candidate.content.parts) {
      candidate.content.parts.forEach((part) => {
        // Handle text responses
        if (part.text) {
          addMessage('Gemini', part.text, 'received')
          // Animate the cube based on received messages
          animateCubeOnMessage({ text: part.text })
        }

        // Handle audio responses
        if (part.audio) {
          addMessage('Gemini', '🔊 Audio response received', 'received')

          // Convert base64 audio data to audio element and play it
          if (part.audio.data) {
            playAudioResponse(part.audio.data)
          }

          // Animate the cube based on audio response
          animateCubeOnAudio()
        }
      })
    }

    // Process function calls if available
    if (
      candidate.content &&
      candidate.content.parts &&
      candidate.content.parts.length > 0
    ) {
      const part = candidate.content.parts[0]
      if (part.functionCall) {
        const functionCall = part.functionCall
        addMessage('Gemini', `Function call: ${functionCall.name}`, 'function')

        // Handle function calls
        handleFunctionCall(functionCall)
      }
    }
  }
}

// Handle function calls from Gemini
function handleFunctionCall(functionCall) {
  if (!functionCall || !functionCall.name) return

  switch (functionCall.name) {
    case 'get_circles':
      // Simulate get_circles response
      const circlesResponse = {
        functionResponse: {
          name: 'get_circles',
          response: {
            circles: [
              { id: 1, color: 'red', x: 100, y: 100, radius: 50 },
              { id: 2, color: 'blue', x: 200, y: 200, radius: 30 },
              { id: 3, color: 'green', x: 300, y: 150, radius: 40 },
            ],
          },
        },
      }

      // Send response back to Gemini
      socket.send(JSON.stringify(circlesResponse))
      addMessage('System', 'Sent circles data to Gemini', 'sent')
      break

    case 'change_circle':
      // Log the change circle request
      if (functionCall.args) {
        addMessage(
          'System',
          `Circle change request: ${JSON.stringify(functionCall.args)}`,
          'function'
        )
      }
      break

    default:
      console.log('Unknown function call:', functionCall.name)
  }
}

// Send message to WebSocket server
function sendMessage() {
  const message = messageInput.value.trim()

  if (message && isConnected) {
    if (!geminiInitialized) {
      addMessage('System', 'Initializing Gemini connection first...', 'sent')
      initGeminiConnection()
    }

    const messageObj = {
      contents: [
        {
          parts: [
            {
              text: message,
            },
          ],
        },
      ],
    }

    socket.send(JSON.stringify(messageObj))
    addMessage('You', message, 'sent')
    messageInput.value = ''
  } else if (!isConnected) {
    addMessage(
      'System',
      'Cannot send message: Not connected to server',
      'error'
    )
  }
}

// Add message to the message container
function addMessage(sender, text, type) {
  const messageElement = document.createElement('div')
  messageElement.classList.add('message', type)

  const now = new Date()
  const timeString = now.toLocaleTimeString()

  messageElement.innerHTML = `
    <strong>${sender}:</strong> ${text}
    <div class="timestamp">${timeString}</div>
  `

  messageContainer.appendChild(messageElement)
  messageContainer.scrollTop = messageContainer.scrollHeight
}

// Animate the cube based on received messages
function animateCubeOnMessage(message) {
  if (!cube) return

  // Change cube color randomly
  cube.material.color.setHSL(Math.random(), 0.7, 0.5)

  // Apply some animation based on the message
  if (typeof message === 'object' && message.text) {
    // Scale the cube based on message length
    const scale = 1 + (message.text.length % 10) / 10
    cube.scale.set(scale, scale, scale)

    // Rotate the cube
    cube.rotation.x += Math.PI / 4
    cube.rotation.y += Math.PI / 4
  }
}

// Handle window resize
function onWindowResize() {
  const container = document.getElementById('scene-container')
  camera.aspect = container.clientWidth / container.clientHeight
  camera.updateProjectionMatrix()
  renderer.setSize(container.clientWidth, container.clientHeight)
}

// Play audio response from Gemini
function playAudioResponse(audioData) {
  try {
    // Create audio element
    const audioElement = document.createElement('audio')
    audioElement.controls = false
    audioElement.autoplay = true

    // Convert base64 to blob
    const byteCharacters = atob(audioData)
    const byteNumbers = new Array(byteCharacters.length)
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i)
    }
    const byteArray = new Uint8Array(byteNumbers)
    const audioBlob = new Blob([byteArray], { type: 'audio/wav' })

    // Create object URL and set as source
    const audioUrl = URL.createObjectURL(audioBlob)
    audioElement.src = audioUrl

    // Add to document temporarily (needed for some browsers)
    audioElement.style.display = 'none'
    document.body.appendChild(audioElement)

    // Clean up after playing
    audioElement.onended = () => {
      URL.revokeObjectURL(audioUrl)
      document.body.removeChild(audioElement)
      audioStatus.textContent = 'Audio playback complete'
    }

    // Update status
    audioStatus.textContent = 'Playing audio response...'

    // Handle errors
    audioElement.onerror = (error) => {
      console.error('Audio playback error:', error)
      audioStatus.textContent = 'Error playing audio'
      URL.revokeObjectURL(audioUrl)
      document.body.removeChild(audioElement)
    }
  } catch (error) {
    console.error('Error processing audio data:', error)
    audioStatus.textContent = 'Error processing audio'
  }
}

// Animation loop
function animate() {
  requestAnimationFrame(animate)

  // Rotate the cube
  if (cube) {
    cube.rotation.x += 0.005
    cube.rotation.y += 0.01
  }

  // Update controls
  if (controls) {
    controls.update()
  }

  // Render the scene
  renderer.render(scene, camera)
}
