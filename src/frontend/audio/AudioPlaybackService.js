class AudioPlaybackService {
  constructor(sampleRate = 24000) {
    this.audioContext = new (window.AudioContext || window.webkitAudioContext)()
    this.queue = []
    this.isPlaying = false
    this.currentWordBuffer = []
    this.silenceThreshold = 0.01
    this.silenceFrames = 0
    this.minSilenceFrames = 1600
    this.sampleRate = sampleRate
    this.currentSource = null
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

  playPcmAudio(int16Array) {
    const float32Array = new Float32Array(int16Array.length)
    for (let i = 0; i < int16Array.length; i++) {
      float32Array[i] = int16Array[i] / 32768
    }

    this.processAudioChunk(float32Array, this.sampleRate).then(
      (audioBuffer) => {
        if (audioBuffer) {
          this.addToAudioQueue(audioBuffer)
        }
      }
    )
  }

  addToAudioQueue(audioBuffer) {
    this.queue.push(audioBuffer)
    if (!this.isPlaying) {
      this.playNextInQueue()
    }
  }

  playNextInQueue() {
    if (this.queue.length === 0) {
      this.isPlaying = false

      if (this.currentWordBuffer.length > 0) {
        this.flushWordBuffer(this.sampleRate).then((audioBuffer) => {
          if (audioBuffer) {
            this.addToAudioQueue(audioBuffer)
          }
        })
      }

      return
    }

    this.isPlaying = true
    const audioBuffer = this.queue.shift()
    const source = this.audioContext.createBufferSource()
    source.buffer = audioBuffer
    source.connect(this.audioContext.destination)

    this.currentSource = source

    source.onended = () => {
      this.currentSource = null
      this.playNextInQueue()
    }

    source.start(0)
  }

  stopPlayback() {
    console.log('Stopping audio playback')
    if (this.currentSource) {
      console.log('Stopping current audio source')
      try {
        this.currentSource.stop()
        this.currentSource = null
      } catch (error) {
        console.log('Audio source already stopped')
      }
    }

    this.queue = []
    this.currentWordBuffer = []
    this.isPlaying = false
  }

  async processAudioChunk(floatArray, sampleRate) {
    this.currentWordBuffer.push(floatArray)

    let silentSamples = 0
    const checkLength = Math.min(floatArray.length, sampleRate / 10)
    for (let i = floatArray.length - checkLength; i < floatArray.length; i++) {
      if (Math.abs(floatArray[i]) < this.silenceThreshold) {
        silentSamples++
      }
    }

    if (silentSamples >= checkLength * 0.9) {
      return this.flushWordBuffer(sampleRate)
    }
    return null
  }

  async flushWordBuffer(sampleRate) {
    if (this.currentWordBuffer.length === 0) return null

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

    const audioBuffer = this.audioContext.createBuffer(
      1,
      combinedArray.length,
      sampleRate
    )

    audioBuffer.getChannelData(0).set(combinedArray)
    return audioBuffer
  }

  playBufferImmediately(audioBuffer) {
    const source = this.audioContext.createBufferSource()
    source.buffer = audioBuffer
    source.connect(this.audioContext.destination)
    source.start(0)
  }
}

export default AudioPlaybackService
