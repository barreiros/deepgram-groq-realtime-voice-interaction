import fs from 'fs'

/**
 * Writes a WAV file from raw PCM data.
 * @param {Buffer} pcmBuffer - Raw PCM buffer
 * @param {string} filePath - Output path for .wav file
 * @param {object} options - WAV metadata
 */
export function writeWavFile(pcmBuffer, filePath, options = {}) {
  const numChannels = options.numChannels || 1
  const sampleRate = options.sampleRate || 16000
  const bitDepth = options.bitDepth || 16

  const byteRate = (sampleRate * numChannels * bitDepth) / 8
  const blockAlign = (numChannels * bitDepth) / 8
  const subchunk2Size = pcmBuffer.length
  const chunkSize = 36 + subchunk2Size

  const buffer = Buffer.alloc(44 + subchunk2Size)

  // RIFF chunk descriptor
  buffer.write('RIFF', 0)
  buffer.writeUInt32LE(chunkSize, 4)
  buffer.write('WAVE', 8)

  // fmt subchunk
  buffer.write('fmt ', 12)
  buffer.writeUInt32LE(16, 16) // Subchunk1Size (16 for PCM)
  buffer.writeUInt16LE(1, 20) // AudioFormat (1 for PCM)
  buffer.writeUInt16LE(numChannels, 22)
  buffer.writeUInt32LE(sampleRate, 24)
  buffer.writeUInt32LE(byteRate, 28)
  buffer.writeUInt16LE(blockAlign, 32)
  buffer.writeUInt16LE(bitDepth, 34)

  // data subchunk
  buffer.write('data', 36)
  buffer.writeUInt32LE(subchunk2Size, 40)

  // PCM data
  pcmBuffer.copy(buffer, 44)

  // Write file
  fs.writeFileSync(filePath, buffer)
}
