export class AudioRecordingService {
  constructor(options = {}) {
    this.onMessage = options.onMessage
    this.mediaRecorder = null
    this.isRecording = false
    this.onVolumeChange = null
    this.onStatusChange = null
    this.stream = null
    this.audioContext = null
    this.analyser = null
    this.source = null
    this.isAudible = false
    this.analysisInterval = null
    this.silenceThreshold = 8
    this.initialChunkSent = false
  }

  async startRecording() {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('MediaDevices API not available')
      }

      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true })

      this.audioContext = new (window.AudioContext ||
        window.webkitAudioContext)()
      this.analyser = this.audioContext.createAnalyser()
      this.analyser.fftSize = 256
      const bufferLength = this.analyser.frequencyBinCount
      const dataArray = new Uint8Array(bufferLength)

      this.source = this.audioContext.createMediaStreamSource(this.stream)
      this.source.connect(this.analyser)

      this.analysisInterval = setInterval(() => {
        if (!this.isRecording || !this.analyser) return
        this.analyser.getByteFrequencyData(dataArray)
        let sum = 0
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i]
        }
        const average = sum / bufferLength
        this.isAudible = average > this.silenceThreshold

        if (this.onVolumeChange) {
          this.onVolumeChange(average)
        }
      }, 100)

      this.mediaRecorder = new window.MediaRecorder(this.stream)
      this.initialChunkSent = false

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0 && this.isRecording) {
          if (!this.initialChunkSent || this.isAudible) {
            this.sendAudioData(event.data)
            this.initialChunkSent = true
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
      this.initialChunkSent = false

      if (this.analysisInterval) {
        clearInterval(this.analysisInterval)
        this.analysisInterval = null
      }

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
    if (!this.onMessage) return

    try {
      this.onMessage({
        type: 'audioData',
        data: audioData
      })
    } catch (error) {
      console.error('Error sending audio data:', error)
    }
  }
}
