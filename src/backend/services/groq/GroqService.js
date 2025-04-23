import { ChatGroq } from '@langchain/groq'
import { ChatPromptTemplate } from '@langchain/core/prompts'
import { StringOutputParser } from '@langchain/core/output_parsers'

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
  }

  async processTranscription(transcription, ws) {
    try {
      const response = await this.chain.stream({
        input: transcription,
      })
      let result = ''
      for await (const item of response) {
        result += item
        // Send each stream item back to the client
        ws.send(JSON.stringify({ groqStreamChunk: item }))
      }
      // Optionally, send a final message when the stream is complete
      // ws.send(JSON.stringify({ groqStreamComplete: true, finalResult: result }));
      return result
    } catch (error) {
      console.error('Error processing transcription with Groq:', error)
      throw error
    }
  }
}

export default GroqService
