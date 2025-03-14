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

import AudioRecordingWorklet from './worklets/audio-processing'
import SafariAudioRecordingWorklet from './worklets/safari-audio-processing'
import VolMeterWorket from './worklets/vol-meter'
import { createWorketFromSrc } from './worklets/audioworklet-registry'
import { audioContext } from './utils.js'
import EventEmitter from './EventEmitter.js'

function arrayBufferToBase64(buffer) {
  var binary = ''
  var bytes = new Uint8Array(buffer)
  var len = bytes.byteLength
  for (var i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return window.btoa(binary)
}

// Add Safari-specific audio context creation
async function createSafariAudioContext(sampleRate) {
  // Safari requires webkit prefix
  const AudioContextClass = window.webkitAudioContext || window.AudioContext

  const ctx = new AudioContextClass({
    sampleRate,
    latencyHint: 'interactive',
  })

  // Safari requires user interaction to start audio context
  if (ctx.state === 'suspended') {
    try {
      await ctx.resume()
    } catch (err) {
      console.error('Failed to resume Safari audio context:', err)
      throw err
    }
  }

  return ctx
}

export class AudioRecorder extends EventEmitter {
  constructor(sampleRate = 16000) {
    super()
    this.sampleRate = sampleRate
    this.stream = undefined
    this.audioContext = undefined
    this.source = undefined
    this.recording = false
    this.recordingWorklet = undefined
    this.vuWorklet = undefined
    this.starting = null

    // Add browser detection
    this.isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent)
    this.isIOS =
      /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream
  }

  async start() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      console.error('MediaDevices API not available:', {
        mediaDevices: !!navigator.mediaDevices,
        getUserMedia: !!(
          navigator.mediaDevices && navigator.mediaDevices.getUserMedia
        ),
      })
      throw new Error('Could not request user media')
    }

    this.starting = new Promise(async (resolve, reject) => {
      try {
        if (this.isSafari) {
          const constraints = {
            audio: {
              echoCancellation: false,
              noiseSuppression: false,
              autoGainControl: false,
              sampleRate: this.sampleRate,
              channelCount: 1,
            },
          }

          try {
            this.stream = await navigator.mediaDevices.getUserMedia(constraints)
            const track = this.stream.getAudioTracks()[0]
          } catch (err) {
            console.error('Failed to get Safari audio permissions:', err)
            throw err
          }

          // 2. Create and initialize audio context
          try {
            this.audioContext = await createSafariAudioContext(this.sampleRate)
          } catch (err) {
            console.error('Failed to initialize Safari audio context:', err)
            throw err
          }

          // 3. Create and connect audio source
          try {
            this.source = this.audioContext.createMediaStreamSource(this.stream)
          } catch (err) {
            console.error('Failed to create Safari audio source:', err)
            throw err
          }

          // 4. Load and create worklet
          try {
            const workletName = 'audio-recorder-worklet'
            const src = createWorketFromSrc(
              workletName,
              SafariAudioRecordingWorklet
            )
            await this.audioContext.audioWorklet.addModule(src)

            this.recordingWorklet = new AudioWorkletNode(
              this.audioContext,
              workletName,
              {
                numberOfInputs: 1,
                numberOfOutputs: 1,
                channelCount: 1,
                processorOptions: {
                  sampleRate: this.sampleRate,
                },
              }
            )

            // Add detailed error handlers
            this.recordingWorklet.onprocessorerror = (event) => {
              console.error('Safari AudioWorklet processor error:', event)
            }

            this.recordingWorklet.port.onmessageerror = (event) => {
              console.error('Safari AudioWorklet message error:', event)
            }

            // Add data handler with detailed logging
            this.recordingWorklet.port.onmessage = (ev) => {
              const data = ev.data.data

              if (data && data.int16arrayBuffer) {
                const arrayBufferString = arrayBufferToBase64(
                  data.int16arrayBuffer
                )
                this.emit('data', arrayBufferString)
              } else {
                console.warn('Invalid Safari audio chunk received:', ev.data)
              }
            }
          } catch (err) {
            console.error('Failed to setup Safari audio worklet:', err)
            throw err
          }

          try {
            this.source.connect(this.recordingWorklet)
          } catch (err) {
            console.error('Failed to connect Safari audio nodes:', err)
            throw err
          }
        } else {
          // Chrome/other browsers implementation

          const constraints = {
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
              sampleRate: this.sampleRate,
            },
          }

          try {
            this.stream = await navigator.mediaDevices.getUserMedia(constraints)
            const track = this.stream.getAudioTracks()[0]
          } catch (err) {
            console.error('Failed to get Chrome audio permissions:', err)
            throw err
          }

          // Create audio context after getting stream for Chrome
          try {
            this.audioContext = await audioContext({
              sampleRate: this.sampleRate,
            })
          } catch (err) {
            console.error('Failed to create Chrome audio context:', err)
            throw err
          }

          // Create media stream source
          try {
            this.source = this.audioContext.createMediaStreamSource(this.stream)
            console.log('Chrome audio source created')
          } catch (err) {
            console.error('Failed to create Chrome audio source:', err)
            throw err
          }

          // Load and create standard worklet
          try {
            const workletName = 'audio-recorder-worklet'
            const src = createWorketFromSrc(workletName, AudioRecordingWorklet)
            await this.audioContext.audioWorklet.addModule(src)

            this.recordingWorklet = new AudioWorkletNode(
              this.audioContext,
              workletName,
              {
                numberOfInputs: 1,
                numberOfOutputs: 1,
                channelCount: 1,
                processorOptions: {
                  sampleRate: this.sampleRate,
                },
              }
            )

            // Add error handlers
            this.recordingWorklet.onprocessorerror = (event) => {
              console.error('Chrome AudioWorklet processor error:', event)
            }

            this.recordingWorklet.port.onmessageerror = (event) => {
              console.error('Chrome AudioWorklet message error:', event)
            }

            // Add data handler
            this.recordingWorklet.port.onmessage = async (ev) => {
              const arrayBuffer = ev.data.data && ev.data.data.int16arrayBuffer
              if (arrayBuffer) {
                const arrayBufferString = arrayBufferToBase64(arrayBuffer)
                this.emit('data', arrayBufferString)
              } else {
                console.warn('Invalid Chrome audio chunk received:', ev.data)
              }
            }
          } catch (err) {
            console.error('Failed to setup Chrome audio worklet:', err)
            throw err
          }

          // Connect nodes
          try {
            this.source.connect(this.recordingWorklet)

            // Set up VU meter
            const vuWorkletName = 'vu-meter'
            await this.audioContext.audioWorklet.addModule(
              createWorketFromSrc(vuWorkletName, VolMeterWorket)
            )
            this.vuWorklet = new AudioWorkletNode(
              this.audioContext,
              vuWorkletName
            )
            this.vuWorklet.port.onmessage = (ev) => {
              this.emit('volume', ev.data.volume)
            }
            this.source.connect(this.vuWorklet)
          } catch (err) {
            console.error('Failed to connect Chrome audio nodes:', err)
            throw err
          }
        }

        this.recording = true
        resolve()
        this.starting = null
      } catch (error) {
        console.error('Failed to start recording:', error)
        this.stop()
        reject(error)
        this.starting = null
      }
    })
    return this.starting
  }

  stop() {
    // it's plausible that stop would be called before start completes
    // such as if the websocket immediately hangs up
    const handleStop = () => {
      try {
        if (this.source) {
          this.source.disconnect()
        }
        if (this.stream) {
          this.stream.getTracks().forEach((track) => {
            track.stop()
          })
        }
        if (this.audioContext && this.isSafari) {
          this.audioContext.close()
        }
        this.stream = undefined
        this.recordingWorklet = undefined
        this.vuWorklet = undefined
      } catch (err) {
        console.error('Error while stopping audio recorder:', err)
      }
    }
    if (this.starting) {
      this.starting.then(handleStop)
      return
    }
    handleStop()
  }
}
