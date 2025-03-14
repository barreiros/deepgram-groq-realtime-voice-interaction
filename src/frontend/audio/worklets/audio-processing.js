/**
 * Copyright 2024 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

const AudioRecordingWorklet = `
class AudioProcessingWorklet extends AudioWorkletProcessor {

  // send and clear buffer every 2048 samples,
  // which at 16khz is about 8 times a second
  buffer = new Int16Array(2048);

  // current write index
  bufferWriteIndex = 0;

  // Previous sample for smooth transitions
  prevSample = 0;

  // Silence detection
  silenceCounter = 0;
  isSilent = false;
  SILENCE_THRESHOLD = 500; // Threshold for silence detection
  MAX_SILENCE_COUNT = 10; // Number of consecutive silent samples to consider silence

  constructor() {
    super();
    this.hasAudio = false;
  }

  /**
   * @param inputs Float32Array[][] [input#][channel#][sample#] so to access first inputs 1st channel inputs[0][0]
   * @param outputs Float32Array[][]
   */
  process(inputs) {
    if (inputs[0].length) {
      const channel0 = inputs[0][0];
      this.processChunk(channel0);
    }
    return true;
  }

  sendAndClearBuffer(){
    // Apply a gentle fade out to the last few samples to avoid clicks
    const fadeLength = Math.min(20, this.bufferWriteIndex);
    for (let i = 0; i < fadeLength; i++) {
      const fadeIndex = this.bufferWriteIndex - fadeLength + i;
      if (fadeIndex >= 0) {
        const fadeRatio = 1 - (i / fadeLength);
        this.buffer[fadeIndex] = Math.floor(this.buffer[fadeIndex] * fadeRatio);
      }
    }

    this.port.postMessage({
      event: "chunk",
      data: {
        int16arrayBuffer: this.buffer.slice(0, this.bufferWriteIndex).buffer,
      },
    });
    this.bufferWriteIndex = 0;
  }

  processChunk(float32Array) {
    const l = float32Array.length;

    for (let i = 0; i < l; i++) {
      // Check for silence
      const absValue = Math.abs(float32Array[i]);
      if (absValue < 0.001) { // Very low values considered silence
        this.silenceCounter++;
        if (this.silenceCounter > this.MAX_SILENCE_COUNT && !this.isSilent) {
          this.isSilent = true;
        }
      } else {
        this.silenceCounter = 0;
        this.isSilent = false;
      }

      // Apply a slight smoothing between samples to reduce clicks
      const smoothedValue = 0.85 * float32Array[i] + 0.15 * this.prevSample;
      this.prevSample = float32Array[i];

      // convert float32 -1 to 1 to int16 -32768 to 32767
      const int16Value = smoothedValue * 32768;

      // If we're in a silent period, gradually reduce the volume
      if (this.isSilent && this.silenceCounter > this.SILENCE_THRESHOLD) {
        const fadeRatio = Math.max(0, 1 - ((this.silenceCounter - this.SILENCE_THRESHOLD) / 1000));
        this.buffer[this.bufferWriteIndex++] = int16Value * fadeRatio;
      } else {
        this.buffer[this.bufferWriteIndex++] = int16Value;
      }

      if(this.bufferWriteIndex >= this.buffer.length) {
        this.sendAndClearBuffer();
      }
    }

    if(this.bufferWriteIndex >= this.buffer.length) {
      this.sendAndClearBuffer();
    }
  }
}
`

export default AudioRecordingWorklet
