export class AudioRecordingService {
  constructor(socket) {
    this.socket = socket
    this.mediaRecorder = null
    this.isRecording = false
    this.onVolumeChange = null
    this.onStatusChange = null
    this.stream = null
  }

  async startRecording() {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('MediaDevices API not available')
      }

      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      this.mediaRecorder = new window.MediaRecorder(this.stream)

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0 && this.isRecording) {
          this.sendAudioData(event.data)
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
