import { ChatGroq } from '@langchain/groq'
import {
  ChatPromptTemplate,
  MessagesPlaceholder,
} from '@langchain/core/prompts' // Import MessagesPlaceholder
import { StringOutputParser } from '@langchain/core/output_parsers'
import { DeepgramService } from './DeepgramService.js' // Import DeepgramService
import { ConversationSummaryBufferMemory } from 'langchain/memory' // Import ConversationSummaryBufferMemory
import { RunnableSequence } from '@langchain/core/runnables' // Import RunnableSequence

class GroqService {
  constructor() {
    this.model = new ChatGroq({
      apiKey: process.env.GROQ_API_KEY,
      model: 'meta-llama/llama-4-maverick-17b-128e-instruct',
    })

    // Initialize Groq model for memory summarization
    this.memoryModel = new ChatGroq({
      apiKey: process.env.GROQ_API_KEY,
      model: 'llama3-8b-8192', // Specify the Groq model for memory
    })

    // Initialize ConversationSummaryBufferMemory
    this.memory = new ConversationSummaryBufferMemory({
      llm: this.memoryModel,
      maxTokenLimit: 1000,
      returnMessages: true,
    })

    this.prompt = ChatPromptTemplate.fromMessages([
      [
        'system',
        'You are a helpful english tutor. Please, make sort responses.',
      ],
      new MessagesPlaceholder('chat_history'), // Use MessagesPlaceholder
      ['human', '{input}'],
    ])
    this.outputParser = new StringOutputParser()

    // Create a chain that includes memory
    this.chain = RunnableSequence.from([
      {
        input: (input) => input.input,
        chat_history: async () => {
          const { history } = await this.memory.loadMemoryVariables({})
          return history
        },
      },
      this.prompt,
      this.model,
      this.outputParser,
    ])

    this.deepgramService = new DeepgramService(process.env.DEEPGRAM_API_KEY) // Instantiate DeepgramService
  }

  async processTranscription(transcription, ws) {
    try {
      // Add user message to memory
      await this.memory.saveContext({ input: transcription }, { output: '' })

      const response = await this.chain.stream({
        input: transcription,
      })
      let buffer = ''
      let fullResponse = '' // To store the full response for saving to memory

      for await (const item of response) {
        buffer += item
        fullResponse += item // Accumulate the full response

        // Check for sentence endings
        const sentenceEndings = /[.!?]/
        let sentenceEndIndex = buffer.search(sentenceEndings)

        while (sentenceEndIndex !== -1) {
          const completeSentence = buffer
            .substring(0, sentenceEndIndex + 1)
            .trim()
          console.log('Complete Sentence:', completeSentence)

          // Send complete sentence to client
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

        // Send final sentence to client
        ws.send(JSON.stringify({ groqSentence: finalSentence }))

        // Call DeepgramService to synthesize speech for the final sentence
        await this.deepgramService.synthesizeSpeech(finalSentence, ws)
      }

      // Save the AI's full response to memory
      await this.memory.saveContext(
        { input: transcription },
        { output: fullResponse }
      )

      return '' // Returning empty string as sentences are handled within the loop
    } catch (error) {
      console.error('Error processing transcription with Groq:', error)
      throw error
    }
  }
}

export default GroqService
