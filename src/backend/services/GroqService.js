import { ChatGroq } from '@langchain/groq'
import {
  ChatPromptTemplate,
  MessagesPlaceholder,
} from '@langchain/core/prompts'
import { StringOutputParser } from '@langchain/core/output_parsers'
import { ConversationSummaryBufferMemory } from 'langchain/memory'
import { DynamicTool } from '@langchain/core/tools'
import { AgentExecutor, createToolCallingAgent } from 'langchain/agents'
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
    this.tools = this.createTools()
    this.setupChat()
    this.setupShutup()
  }

  createTools() {
    const stopConversationTool = new DynamicTool({
      name: 'stop_conversation',
      description:
        'Stop the current conversation buffer and interrupt the model speech when the user wants to interrupt',
      func: async () => {
        this.eventEmitter.emit('shutup', {
          message: 'Conversation stopped by user request',
        })
        return 'Conversation buffer stopped successfully'
      },
    })

    return [stopConversationTool]
  }

  setupShutup() {
    this.shutupPrompt = ChatPromptTemplate.fromMessages([
      [
        'system',
        `You are a tool decision assistant. Your only job is to determine if the user's input requires calling specific tools.

Analyze the user's input and decide if you should call the stop_conversation tool.

Call stop_conversation when the user explicitly asks to:
- "Stop"
- "Pause"
- "Wait"
- "Hold on"
- "Interrupt"
- Direct requests to stop or pause

If the user input does NOT contain clear interruption signals, respond with exactly: "no_tools_needed"

Be very strict - only call the tool for explicit interruption requests.`,
      ],
      ['human', '{input}'],
      new MessagesPlaceholder('agent_scratchpad'),
    ])

    this.shutupAgent = createToolCallingAgent({
      llm: this.shutupModel,
      tools: this.tools,
      prompt: this.shutupPrompt,
    })

    this.shutupAgentExecutor = new AgentExecutor({
      agent: this.shutupAgent,
      tools: this.tools,
      verbose: false,
      maxIterations: 1,
    })
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
      await this.processBuffer(completeSentence)
    } else {
      console.log(
        '*******************Sentence is not complete yet:',
        this.transcriptionBuffer
      )
      await this.shutupAgentExecutor.invoke({
        input: this.transcriptionBuffer,
      })
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
