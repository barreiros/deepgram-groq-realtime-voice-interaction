import { ChatGroq } from '@langchain/groq'
import {
  ChatPromptTemplate,
  MessagesPlaceholder,
} from '@langchain/core/prompts'
import { StringOutputParser } from '@langchain/core/output_parsers'
import { ConversationSummaryBufferMemory } from 'langchain/memory'
import { RunnableSequence } from '@langchain/core/runnables'

class GroqService {
  constructor(apiKey, eventEmitter) {
    this.model = new ChatGroq({
      apiKey: apiKey,
      model: 'meta-llama/llama-4-maverick-17b-128e-instruct',
    })

    this.memoryModel = new ChatGroq({
      apiKey: apiKey,
      model: 'llama3-8b-8192', // Specify the Groq model for memory
    })

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

    this.eventEmitter = eventEmitter
  }

  async processTranscription(transcription) {
    try {
      // Add user message to memory
      await this.memory.saveContext({ input: transcription }, { output: '' })

      const response = await this.chain.stream({
        input: transcription,
      })
      let buffer = ''
      let fullResponse = ''

      for await (const item of response) {
        buffer += item
        fullResponse += item

        const sentenceEndings = /[.!?]/
        let sentenceEndIndex = buffer.search(sentenceEndings)

        while (sentenceEndIndex !== -1) {
          const completeSentence = buffer
            .substring(0, sentenceEndIndex + 1)
            .trim()
          console.log('Complete Sentence:', completeSentence)

          this.eventEmitter.emit('llm-text', { text: completeSentence })

          buffer = buffer.substring(sentenceEndIndex + 1).trimStart()
          sentenceEndIndex = buffer.search(sentenceEndings)
        }
      }

      if (buffer.length > 0) {
        const finalSentence = buffer.trim()
        console.log('Final Sentence (stream ended):', finalSentence)

        this.eventEmitter.emit('llm-text', { text: finalSentence })
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
