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

  playPcmAudio(int16Array, sampleRate = 48000) {
    if (!(int16Array instanceof Int16Array)) {
      console.error('Invalid PCM data: Expected Int16Array')
      return
    }

    // Convert Int16Array to Float32Array
    const float32Array = new Float32Array(int16Array.length)
    for (let i = 0; i < int16Array.length; i++) {
      float32Array[i] = int16Array[i] / 32768 // Convert to [-1.0, 1.0]
    }

    // Create AudioBuffer: 1 channel (mono), frame count, and sample rate
    const audioBuffer = this.audioContext.createBuffer(
      1,
      float32Array.length,
      sampleRate
    )

    // Copy float data into buffer
    audioBuffer.getChannelData(0).set(float32Array)

    // Add to queue and play
    this.addToAudioQueue(audioBuffer)
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
