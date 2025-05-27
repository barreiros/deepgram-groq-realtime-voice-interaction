import { ChatGroq } from '@langchain/groq'
import {
  ChatPromptTemplate,
  MessagesPlaceholder,
} from '@langchain/core/prompts'
import { StringOutputParser } from '@langchain/core/output_parsers'
import { ConversationSummaryBufferMemory } from 'langchain/memory'
import { RunnableSequence } from '@langchain/core/runnables'
import SentenceCompletion from '../tools/SentenceCompletion.js'

class GroqService {
  constructor(apiKey, eventEmitter, params = {}) {
    this.params = params
    this.language = params.langugage || 'en'
    this.lastActivityTime = Date.now()
    this.silenceTimeout = null
    this.model = new ChatGroq({
      apiKey: apiKey,
      model:
        this.params.model || 'meta-llama/llama-4-maverick-17b-128e-instruct',
      temperature: this.params.temp ? parseFloat(this.params.temp) : 0.7,
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

  startSilenceTimeout() {
    if (this.silenceTimeout) clearTimeout(this.silenceTimeout)

    this.silenceTimeout = setTimeout(() => {
      if (Date.now() - this.lastActivityTime >= 3000) {
        this.processBufferIfInactive()
      }
    }, 3000)
  }

  async processBufferIfInactive() {
    if (
      Date.now() - this.lastActivityTime >= 3000 &&
      this.transcriptionBuffer
    ) {
      const completeSentence = this.transcriptionBuffer
      this.transcriptionBuffer = ''
      await this.processBuffer(completeSentence)
    }
  }

  async sendToSilenceService(content) {
    console.log('Sending to silence service:', content)
    // Actual implementation would go here
  }

  async processTranscription(transcription) {
    this.lastActivityTime = Date.now()
    const spacedTranscription = this.transcriptionBuffer
      ? ' ' + transcription
      : transcription
    this.transcriptionBuffer =
      (this.transcriptionBuffer || '') + spacedTranscription

    if (this.bufferTimeout) clearTimeout(this.bufferTimeout)
    this.startSilenceTimeout()

    if (
      SentenceCompletion.isComplete(this.transcriptionBuffer, this.language)
    ) {
      console.log('Sentence is complete:', this.transcriptionBuffer)
      const completeSentence = this.transcriptionBuffer
      this.transcriptionBuffer = ''
      await this.processBuffer(completeSentence)
    }
  }

  async processBuffer(textToSend) {
    console.log('Processing buffer:', textToSend)
    console.log(
      'Sentence complete check:',
      SentenceCompletion.isComplete(textToSend)
    )
    try {
      // Add user message to memory
      await this.memory.saveContext({ input: textToSend }, { output: '' })
      await this.sendToSilenceService(textToSend)

      let llmResponseBuffer = ''
      const stream = await this.chain.stream({ input: textToSend })

      for await (const chunk of stream) {
        llmResponseBuffer += chunk
        this.lastActivityTime = Date.now()

        if (SentenceCompletion.isComplete(llmResponseBuffer, this.language)) {
          this.eventEmitter.emit('llm-text', {
            text: llmResponseBuffer.trim(),
            language: this.language,
          })
          llmResponseBuffer = ''
        }
      }

      if (llmResponseBuffer.length > 0) {
        this.eventEmitter.emit('llm-text', {
          text: llmResponseBuffer.trim(),
          language: this.language,
        })
      }

      // Save the AI's full response to memory
      await this.memory.saveContext(
        { input: textToSend },
        { output: llmResponseBuffer }
      )
      this.startSilenceTimeout()
    } catch (error) {
      console.error('Error processing buffer:', error)
      this.eventEmitter.emit('error', { error: error.message })
    }
  }
}

export default GroqService
