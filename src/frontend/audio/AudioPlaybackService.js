class AudioPlaybackService {
  constructor() {
    this.audioContext = new (window.AudioContext || window.webkitAudioContext)()
    this.audioQueue = []
    this.isPlaying = false
  }

  async playAudio(audioBlob) {
    try {
      if (!audioBlob || !(audioBlob instanceof Blob)) {
        console.error('Invalid audio data: Expected a Blob')
        return
      }

      // Decode the audio data from the Blob
      const arrayBuffer = await audioBlob.arrayBuffer()
      const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer)

      this.addToAudioQueue(audioBuffer)
    } catch (error) {
      console.error('Error processing audio blob:', error)
    }
  }

  addToAudioQueue(audioBuffer) {
    this.audioQueue.push(audioBuffer)
    if (!this.isPlaying) {
      this.playNextInQueue()
    }
  }

  playNextInQueue() {
    try {
      if (this.audioQueue.length === 0) {
        this.isPlaying = false
        return
      }

      this.isPlaying = true
      const audioBuffer = this.audioQueue.shift()
      const source = this.audioContext.createBufferSource()
      source.buffer = audioBuffer
      source.connect(this.audioContext.destination)
      source.onended = () => this.playNextInQueue()
      source.start(0)
    } catch (error) {
      console.error('Error playing audio:', error)
    }
  }
}

export default AudioPlaybackService
