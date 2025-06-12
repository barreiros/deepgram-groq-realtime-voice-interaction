import { ChatGroq } from '@langchain/groq'
import {
  ChatPromptTemplate,
  MessagesPlaceholder,
} from '@langchain/core/prompts'
import { StringOutputParser } from '@langchain/core/output_parsers'
import { ConversationSummaryBufferMemory } from 'langchain/memory'
import SentenceCompletion from '../tools/SentenceCompletion.js'

class GroqService {
  constructor(apiKey, eventEmitter, params = {}) {
    this.params = params
    this.language = params.langugage || 'en'
    this.lastActivityTime = Date.now()
    this.silenceTimeout = null
    this.transcriptionBuffer = ''
    this.chatModel = new ChatGroq({
      apiKey: apiKey,
      model:
        this.params.groq_model ||
        'meta-llama/llama-4-maverick-17b-128e-instruct',
      temperature: this.params.temp ? parseFloat(this.params.temp) : 0.7,
    })

    this.memoryModel = new ChatGroq({
      apiKey: apiKey,
      model: 'llama3-8b-8192',
    })

    this.shutupModel = new ChatGroq({
      apiKey: apiKey,
      model: 'llama3-8b-8192',
      temperature: 0.1,
    })

    this.memory = new ConversationSummaryBufferMemory({
      llm: this.memoryModel,
      maxTokenLimit: 1000,
      returnMessages: true,
    })

    this.eventEmitter = eventEmitter
    this.setupChat()
    this.setupShutup()
  }

  setupShutup() {
    this.shutupPrompt = ChatPromptTemplate.fromMessages([
      [
        'system',
        `You are a tool decision assistant. Analyze the user's input and determine if they want to interrupt or stop the conversation.

Look for interruption signals like:
- "Stop"
- "Pause" 
- "Wait"
- "Hold on"
- "Interrupt"

If you detect an interruption request, respond with exactly: "INTERRUPT"
If no interruption is detected, respond with exactly: "CONTINUE"

Only respond with one of these two words.`,
      ],
      ['human', '{input}'],
    ])

    const chain = this.shutupPrompt
      .pipe(this.shutupModel)
      .pipe(new StringOutputParser())
    this.shutupChain = chain
  }

  clearBuffers() {
    this.transcriptionBuffer = ''
    if (this.silenceTimeout) {
      clearTimeout(this.silenceTimeout)
      this.silenceTimeout = null
    }
  }

  setupChat() {
    this.prompt = ChatPromptTemplate.fromMessages([
      [
        'system',
        `You are a helpful english tutor. Please, make short responses.

Respond naturally to the user's input. Focus on being helpful and educational.`,
      ],
      new MessagesPlaceholder('chat_history'),
      ['human', '{input}'],
    ])

    const chain = this.prompt
      .pipe(this.chatModel)
      .pipe(new StringOutputParser())
    this.conversationChain = chain
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
      this.eventEmitter.emit('shutup', {})
      await this.processBuffer(completeSentence)
    } else {
      try {
        const shutupResponse = await this.shutupChain.invoke({
          input: this.transcriptionBuffer,
        })
        
        if (shutupResponse.trim() === 'INTERRUPT') {
          this.eventEmitter.emit('shutup', {
            message: 'Conversation interrupted by user request',
          })
        }
      } catch (error) {
        console.error('Error checking for interruption:', error)
      }
    }
  }

  async processBuffer(textToSend) {
    console.log('Processing buffer:', textToSend)
    console.log(
      'Sentence complete check:',
      SentenceCompletion.isComplete(textToSend)
    )
    try {
      const chatHistory = await this.memory.loadMemoryVariables({})

      const response = await this.conversationChain.invoke({
        input: textToSend,
        chat_history: chatHistory.history || [],
      })

      if (response && response.trim().length > 0) {
        let llmResponseBuffer = response

        if (SentenceCompletion.isComplete(llmResponseBuffer, this.language)) {
          this.eventEmitter.emit('llm-text', {
            text: llmResponseBuffer.trim(),
            language: this.language,
          })
        } else {
          this.eventEmitter.emit('llm-text', {
            text: llmResponseBuffer.trim(),
            language: this.language,
          })
        }

        await this.memory.saveContext(
          { input: textToSend },
          { output: response }
        )
      }

      this.startSilenceTimeout()
    } catch (error) {
      console.error('Error processing buffer:', error)
      this.eventEmitter.emit('error', { error: error.message })
    }
  }
}

export default GroqService
