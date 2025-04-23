export class AudioRecordingService {
  constructor(socket) {
    this.socket = socket
    this.mediaRecorder = null
    this.isRecording = false
    this.onVolumeChange = null // Callback for volume changes (optional)
    this.onStatusChange = null // Callback for status updates
    this.stream = null
    this.audioContext = null
    this.analyser = null
    this.source = null
    this.isAudible = false // Flag to track if sound is detected
    this.analysisInterval = null // Interval ID for analysis loop
    this.silenceThreshold = 5 // Threshold for detecting silence (adjust as needed)
    this.initialChunkSent = false // Flag to ensure the first chunk is always sent
  }

  async startRecording() {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('MediaDevices API not available')
      }

      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true })

      // --- Setup Audio Analysis ---
      this.audioContext = new (window.AudioContext ||
        window.webkitAudioContext)()
      this.analyser = this.audioContext.createAnalyser()
      this.analyser.fftSize = 256 // Smaller FFT size for faster analysis
      const bufferLength = this.analyser.frequencyBinCount
      const dataArray = new Uint8Array(bufferLength)

      this.source = this.audioContext.createMediaStreamSource(this.stream)
      this.source.connect(this.analyser)
      // Note: We don't connect analyser to destination, it just monitors

      // Start analysis loop
      this.analysisInterval = setInterval(() => {
        if (!this.isRecording || !this.analyser) return
        this.analyser.getByteFrequencyData(dataArray)
        let sum = 0
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i]
        }
        const average = sum / bufferLength
        this.isAudible = average > this.silenceThreshold

        // Optional: Call volume change callback
        if (this.onVolumeChange) {
          this.onVolumeChange(average)
        }
      }, 100) // Check volume every 100ms
      // --- End Audio Analysis Setup ---

      this.mediaRecorder = new window.MediaRecorder(this.stream) // Use the original stream
      this.initialChunkSent = false // Reset flag on new recording start

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0 && this.isRecording) {
          // Send the first chunk regardless of silence, then filter subsequent chunks
          if (!this.initialChunkSent || this.isAudible) {
            this.sendAudioData(event.data)
            this.initialChunkSent = true // Mark initial chunk as sent
          }
        }
      }

      this.mediaRecorder.onstart = () => {
        if (this.onStatusChange) {
          this.onStatusChange('Recording... Speak now')
        }
      }

      this.mediaRecorder.onstop = () => {
        if (this.onStatusChange) {
          this.onStatusChange('Recording stopped')
        }
      }

      this.mediaRecorder.start(250)
      this.isRecording = true

      return true
    } catch (error) {
      console.error('Failed to start recording:', error)
      if (this.onStatusChange) {
        this.onStatusChange(`Recording error: ${error.message}`)
      }
      return false
    }
  }

  stopRecording() {
    if (this.mediaRecorder && this.isRecording) {
      this.mediaRecorder.stop()
      this.isRecording = false
      this.initialChunkSent = false // Reset flag on stop
      // Stop analysis loop
      if (this.analysisInterval) {
        clearInterval(this.analysisInterval)
        this.analysisInterval = null
      }

      // Disconnect and close audio context
      if (this.source) {
        this.source.disconnect()
        this.source = null
      }
      if (this.audioContext && this.audioContext.state !== 'closed') {
        this.audioContext.close()
        this.audioContext = null
      }
      this.analyser = null

      if (this.stream) {
        this.stream.getTracks().forEach((track) => track.stop())
        this.stream = null
      }
      if (this.onStatusChange) {
        this.onStatusChange('Recording stopped')
      }
    }
  }

  sendAudioData(audioData) {
    if (!this.socket) return

    try {
      this.socket.sendAudioData(audioData)
    } catch (error) {
      console.error('Error sending audio data:', error)
    }
  }
}
