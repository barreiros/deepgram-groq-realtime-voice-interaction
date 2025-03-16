import { AudioRecorder } from '../../audio/AudioRecorder.js'

export class AudioRecordingService {
  constructor(socket) {
    this.socket = socket
    this.audioRecorder = null
    this.isRecording = false
    this.onVolumeChange = null
    this.onStatusChange = null
  }

  async startRecording() {
    try {
      if (!this.audioRecorder) {
        this.audioRecorder = new AudioRecorder(16000)

        this.audioRecorder.on('data', (audioData) => {
          if (this.isRecording) {
            this.sendAudioData(audioData)
          }
        })

        this.audioRecorder.on('volume', (volume) => {
          if (this.onVolumeChange) {
            this.onVolumeChange(volume)
          }
        })
      }

      await this.audioRecorder.start()
      this.isRecording = true

      if (this.onStatusChange) {
        this.onStatusChange('Recording... Speak now')
      }

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
    if (this.audioRecorder && this.isRecording) {
      this.audioRecorder.stop()
      this.isRecording = false

      if (this.onStatusChange) {
        this.onStatusChange('Recording stopped')
      }
    }
  }

  sendAudioData(audioData) {
    if (!this.socket) return

    try {
      const audioMessage = {
        realtimeInput: {
          mediaChunks: [
            {
              mimeType: 'audio/pcm;rate=16000',
              data: audioData,
            },
          ],
        },
      }

      this.socket.sendMessage(audioMessage)
    } catch (error) {
      console.error('Error sending audio data:', error)
    }
  }
}
