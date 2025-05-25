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
    const SENTENCE_END = /([.!?])\s*$/
    this.transcriptionBuffer = (this.transcriptionBuffer || '') + transcription

    if (this.bufferTimeout) clearTimeout(this.bufferTimeout)

    const match = this.transcriptionBuffer.match(SENTENCE_END)
    if (match) {
      const splitIndex = match.index + match[1].length
      const completeSentence = this.transcriptionBuffer.slice(0, splitIndex)
      const remainingText = this.transcriptionBuffer
        .slice(splitIndex)
        .trimStart()

      this.transcriptionBuffer = remainingText
      await this.processBuffer(completeSentence)
    } else {
      this.bufferTimeout = setTimeout(async () => {
        if (this.transcriptionBuffer) {
          await this.processBuffer(this.transcriptionBuffer)
          this.transcriptionBuffer = ''
        }
      }, 3000)
    }
    return ''
  }

  async processBuffer(textToSend) {
    console.log('Processing buffer`', textToSend)
    try {
      // Add user message to memory
      await this.memory.saveContext({ input: textToSend }, { output: '' })

      const response = await this.chain.stream({ input: textToSend })
      let fullResponse = ''

      for await (const item of response) {
        fullResponse += item
        this.eventEmitter.emit('llm-text', { text: item })
      }

      // Save the AI's full response to memory
      await this.memory.saveContext(
        { input: textToSend },
        { output: fullResponse }
      )
    } catch (error) {
      console.error('Error processing buffer:', error)
      this.eventEmitter.emit('error', { error: error.message })
    }
  }
}

export default GroqService
