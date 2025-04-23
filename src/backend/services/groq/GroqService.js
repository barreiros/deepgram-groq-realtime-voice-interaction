import { ChatGroq } from '@langchain/groq'
import { ChatPromptTemplate } from '@langchain/core/prompts'
import { StringOutputParser } from '@langchain/core/output_parsers'
import { DeepgramService } from './../deepgram/DeepgramService.js' // Import DeepgramService

class GroqService {
  constructor() {
    this.model = new ChatGroq({
      apiKey: process.env.GROQ_API_KEY,
      model: 'llama3-8b-8192', // Specify the Groq model
    })
    this.prompt = ChatPromptTemplate.fromMessages([
      ['system', 'You are a helpful assistant'],
      ['human', '{input}'],
    ])
    this.outputParser = new StringOutputParser()
    this.chain = this.prompt.pipe(this.model).pipe(this.outputParser)
    this.deepgramService = new DeepgramService(process.env.DEEPGRAM_API_KEY) // Instantiate DeepgramService
  }

  async processTranscription(transcription, ws) {
    try {
      const response = await this.chain.stream({
        input: transcription,
      })
      let buffer = ''
      for await (const item of response) {
        buffer += item
        // Send each stream item back to the client (optional, can be removed if only full sentences are needed on client)

        // Check for sentence endings
        const sentenceEndings = /[.!?]/
        let sentenceEndIndex = buffer.search(sentenceEndings)

        while (sentenceEndIndex !== -1) {
          const completeSentence = buffer
            .substring(0, sentenceEndIndex + 1)
            .trim()
          console.log('Complete Sentence:', completeSentence)
          // TODO: Process or send the complete sentence to another service/client

          // Send complete sentence to client (optional, can be removed if only chunks are needed)
          ws.send(JSON.stringify({ groqSentence: completeSentence }))

          // Call DeepgramService to synthesize speech
          await this.deepgramService.synthesizeSpeech(completeSentence, ws)

          buffer = buffer.substring(sentenceEndIndex + 1).trimStart()
          sentenceEndIndex = buffer.search(sentenceEndings)
        }
      }

      // Process any remaining text in the buffer as a final sentence
      if (buffer.length > 0) {
        const finalSentence = buffer.trim()
        console.log('Final Sentence (stream ended):', finalSentence)
        // TODO: Process or send the final sentence to another service/client

        // Send final sentence to client (optional)
        ws.send(JSON.stringify({ groqSentence: finalSentence }))

        // Call DeepgramService to synthesize speech for the final sentence
        await this.deepgramService.synthesizeSpeech(finalSentence, ws)
      }

      // Return the full accumulated result (optional, depending on need)
      // Note: This 'result' is not used for streaming sentences, but holds the full text.
      // If you only need sentences, you might not need to accumulate the full result here.
      // let fullResult = ''; // If you need the full result, accumulate it here
      // return fullResult;
      return '' // Returning empty string as sentences are handled within the loop
    } catch (error) {
      console.error('Error processing transcription with Groq:', error)
      throw error
    }
  }
}

export default GroqService
