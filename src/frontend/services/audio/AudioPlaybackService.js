class AudioPlaybackService {
  constructor() {
    this.audioContext = new (window.AudioContext || window.webkitAudioContext)()
    this.audioQueue = []
    this.isPlaying = false
    this.currentWordBuffer = []
    this.silenceThreshold = 0.01
    this.silenceFrames = 0
    this.minSilenceFrames = 100
  }

  async playAudio(audioData, mimeType = 'audio/pcm;rate=24000') {
    try {
      if (!audioData || !audioData.length) {
        console.error('Invalid audio data')
        return
      }

      const sampleRate = parseInt(mimeType.match(/rate=(\d+)/)[1]) || 24000

      const floatArray = await this.decodeAudioData(audioData)
      console.log('Decoded audio chunk length:', floatArray.length)

      const processedBuffer = await this.processAudioChunk(
        floatArray,
        sampleRate
      )

      if (processedBuffer) {
        console.log(
          'Complete word detected, buffer length:',
          processedBuffer.length
        )
        this.addToAudioQueue(processedBuffer)
      } else {
        console.log(
          'Buffering chunk, current word buffer size:',
          this.currentWordBuffer.length
        )
      }
    } catch (error) {
      console.error('Error processing audio:', error)
    }
  }

  async decodeAudioData(audioData) {
    const binaryString = atob(audioData)
    const bytes = new Uint8Array(binaryString.length)
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i)
    }

    const audioData16bit = new Int16Array(bytes.buffer)
    const floatArray = new Float32Array(audioData16bit.length)
    for (let i = 0; i < audioData16bit.length; i++) {
      floatArray[i] = audioData16bit[i] / 32768.0
    }
    return floatArray
  }

  async processAudioChunk(floatArray, sampleRate) {
    this.currentWordBuffer.push(floatArray)

    // Check for silence at the end of the chunk
    let silenceDetected = false
    for (
      let i = Math.max(0, floatArray.length - 100);
      i < floatArray.length;
      i++
    ) {
      if (Math.abs(floatArray[i]) < this.silenceThreshold) {
        this.silenceFrames++
        if (this.silenceFrames >= this.minSilenceFrames) {
          silenceDetected = true
          break
        }
      } else {
        this.silenceFrames = 0
      }
    }

    if (silenceDetected && this.currentWordBuffer.length > 0) {
      console.log(
        'Silence detected, combining chunks:',
        this.currentWordBuffer.length
      )
      // Combine all chunks in the word buffer
      const totalLength = this.currentWordBuffer.reduce(
        (sum, chunk) => sum + chunk.length,
        0
      )
      const combinedArray = new Float32Array(totalLength)
      let offset = 0

      for (const chunk of this.currentWordBuffer) {
        combinedArray.set(chunk, offset)
        offset += chunk.length
      }

      this.currentWordBuffer = []
      this.silenceFrames = 0

      // Resample if needed
      if (this.audioContext.sampleRate !== sampleRate) {
        return await this.resampleAudio(combinedArray, sampleRate)
      } else {
        const audioBuffer = this.audioContext.createBuffer(
          1,
          combinedArray.length,
          sampleRate
        )
        audioBuffer.getChannelData(0).set(combinedArray)
        return audioBuffer
      }
    }

    return null
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
