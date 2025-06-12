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
    this.language = params.llm_langugage || 'en'
    this.lastActivityTime = Date.now()
    this.silenceTimeout = null
    this.transcriptionBuffer = ''
    this.chatModel = new ChatGroq({
      apiKey: apiKey,
      model:
        this.params.llm_model ||
        'meta-llama/llama-4-maverick-17b-128e-instruct',
      temperature: this.params.llm_temp
        ? parseFloat(this.params.llm_temp)
        : 0.7,
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
        `You are an interruption detection assistant. Your job is to determine if the user wants to interrupt or stop the conversation.

Analyze the user's input and respond with exactly one of these:
- "INTERRUPT" if the user wants to stop, pause, wait, hold on, or interrupt
- "CONTINUE" if the user is continuing normal conversation

Look for words like: stop, pause, wait, hold on, interrupt, enough, quiet, silence

Be very strict - only respond "INTERRUPT" for clear interruption signals.`,
      ],
      ['human', '{input}'],
    ])

    const shutupChain = this.shutupPrompt
      .pipe(this.shutupModel)
      .pipe(new StringOutputParser())
    this.shutupChain = shutupChain
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
        
        if (shutupResponse && shutupResponse.trim() === 'INTERRUPT') {
          this.eventEmitter.emit('shutup', {
            message: 'Conversation stopped by user request',
          })
        }
      } catch (error) {
        console.error('Error in shutup detection:', error)
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
