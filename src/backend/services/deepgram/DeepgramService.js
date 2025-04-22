import { createClient } from '@deepgram/sdk'

export class DeepgramService {
  constructor(apiKey) {
    this.apiKey = apiKey
    this.dg = createClient(this.apiKey)
    console.log('DeepgramService instantiated with API key:', !!this.apiKey)
  }

  createWebSocket(clientWs) {
    console.log('DeepgramService.createWebSocket called')
    const dgLive = this.dg.listen.live({
      language: 'en-US',
      smart_format: true,
      model: 'nova-2-general',
      interim_results: true,
      endpointing: 100,
      no_delay: true,
      utterance_end_ms: 1000,
    })
    console.log('Deepgram live connection created:', !!dgLive)

    dgLive.addListener('open', () => {
      console.log('Deepgram live transcription connection open')
    })

    dgLive.addListener('transcriptReceived', (dgOutput) => {
      try {
        console.log('DeepgramService.transcriptReceived event')
        const dgJSON = JSON.parse(dgOutput)
        let utterance = ''
        if (dgJSON.channel && dgJSON.channel.alternatives[0]) {
          utterance = dgJSON.channel.alternatives[0].transcript
        }
        if (utterance) {
          console.log(
            'Deepgram transcript:',
            utterance,
            'is_final:',
            dgJSON.is_final,
            'speech_final:',
            dgJSON.speech_final
          )
          clientWs.send(
            JSON.stringify({
              transcript: utterance,
              is_final: dgJSON.is_final,
              speech_final: dgJSON.speech_final,
            })
          )
        }
      } catch (error) {
        console.error('Error parsing Deepgram transcript:', error)
      }
    })

    dgLive.addListener('error', (msg) => {
      console.error('Deepgram error:', msg)
    })

    dgLive.addListener('close', () => {
      console.log('Deepgram live transcription connection closed')
    })

    return dgLive
  }

  handleClientMessage(dgLive, message) {
    try {
      // console.log(
      //   'DeepgramService.handleClientMessage called. type:',
      //   typeof message,
      //   'isBuffer:',
      //   Buffer.isBuffer(message),
      //   'length:',
      //   message?.length
      // )
      if (dgLive && dgLive.getReadyState() === 1) {
        console.log('Sending audio buffer to Deepgram...', message)
        dgLive.send(message)
      } else {
        console.log('Deepgram live connection not ready')
      }
    } catch (error) {
      console.error('Error sending audio to Deepgram:', error)
    }
  }
}

export default DeepgramService
