class AudioPlaybackService {
  constructor() {
    this.audioContext = new (window.AudioContext || window.webkitAudioContext)()
    this.audioQueue = []
    this.isPlaying = false
  }

  async playAudio(audioData, mimeType = 'audio/pcm;rate=24000') {
    try {
      if (!audioData || !audioData.length) {
        console.error('Invalid audio data')
        return
      }

      const sampleRate = parseInt(mimeType.match(/rate=(\d+)/)[1]) || 24000
      console.log('Processing audio data, sample rate:', sampleRate)

      // Convert base64 to array buffer
      const binaryString = atob(audioData)
      const bytes = new Uint8Array(binaryString.length)
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i)
      }

      // Convert to 16-bit PCM
      const audioData16bit = new Int16Array(bytes.buffer)

      // Convert to float32 (-1 to 1)
      const floatArray = new Float32Array(audioData16bit.length)
      for (let i = 0; i < audioData16bit.length; i++) {
        floatArray[i] = audioData16bit[i] / 32768.0
      }

      // Check if resampling is needed
      if (this.audioContext.sampleRate !== sampleRate) {
        console.log(
          'Resampling needed:',
          sampleRate,
          '->',
          this.audioContext.sampleRate
        )
        const resampledBuffer = await this.resampleAudio(floatArray, sampleRate)
        this.addToAudioQueue(resampledBuffer)
      } else {
        const audioBuffer = this.audioContext.createBuffer(
          1, // mono
          floatArray.length,
          sampleRate
        )
        audioBuffer.getChannelData(0).set(floatArray)
        this.addToAudioQueue(audioBuffer)
      }
    } catch (error) {
      console.error('Error processing audio:', error)
    }
  }

  async resampleAudio(floatArray, originalSampleRate) {
    const offlineCtx = new OfflineAudioContext(
      1, // mono
      Math.ceil(
        (floatArray.length * this.audioContext.sampleRate) / originalSampleRate
      ),
      this.audioContext.sampleRate
    )

    const originalBuffer = offlineCtx.createBuffer(
      1,
      floatArray.length,
      originalSampleRate
    )
    originalBuffer.getChannelData(0).set(floatArray)

    const source = offlineCtx.createBufferSource()
    source.buffer = originalBuffer
    source.connect(offlineCtx.destination)
    source.start()

    return await offlineCtx.startRendering()
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
