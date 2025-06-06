import { ChatGroq } from '@langchain/groq'
import {
  ChatPromptTemplate,
  MessagesPlaceholder,
} from '@langchain/core/prompts'
import { StringOutputParser } from '@langchain/core/output_parsers'
import { ConversationSummaryBufferMemory } from 'langchain/memory'
import { RunnableSequence } from '@langchain/core/runnables'
import { DynamicTool } from '@langchain/core/tools'
import { AgentExecutor, createToolCallingAgent } from 'langchain/agents'
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
      model: 'llama3-8b-8192',
    })

    this.memory = new ConversationSummaryBufferMemory({
      llm: this.memoryModel,
      maxTokenLimit: 1000,
      returnMessages: true,
    })

    this.eventEmitter = eventEmitter
    this.tools = this.createTools()
    this.setupAgent()
  }

  createTools() {
    const stopConversationTool = new DynamicTool({
      name: 'stop_conversation',
      description: 'Stop the current conversation buffer and interrupt the model speech when the user wants to interrupt',
      func: async () => {
        this.eventEmitter.emit('shutup', {
          message: 'Conversation stopped by user request'
        })
        return 'Conversation buffer stopped successfully'
      }
    })

    const changeTopicTool = new DynamicTool({
      name: 'change_topic',
      description: 'Use this when the user wants to change the conversation topic or interrupt to discuss something else. This tool helps identify the new topic and respond appropriately.',
      func: async (input) => {
        const topicAnalysis = await this.analyzeTopicChange(input)
        return `Topic change detected: ${topicAnalysis}`
      }
    })

    return [stopConversationTool, changeTopicTool]
  }

  async analyzeTopicChange(userInput) {
    try {
      const analysisPrompt = ChatPromptTemplate.fromTemplate(`
        Analyze this user input to determine if they want to change topics or interrupt the conversation:
        
        User input: "{input}"
        
        If the user is clearly changing topics, identify the new topic they want to discuss.
        If the topic change is unclear or vague, return "unclear_topic".
        
        Respond with just the topic name or "unclear_topic".
      `)

      const analysisChain = analysisPrompt.pipe(this.memoryModel).pipe(new StringOutputParser())
      
      const result = await analysisChain.invoke({ input: userInput })
      return result.trim()
    } catch (error) {
      console.error('Error analyzing topic change:', error)
      return 'unclear_topic'
    }
  }

  setupAgent() {
    this.prompt = ChatPromptTemplate.fromMessages([
      [
        'system',
        `You are a helpful english tutor. Please, make short responses. 

You have access to tools that can help you manage the conversation:
- Use the stop_conversation tool when the user explicitly asks to stop, interrupt, or pause the conversation.
- Use the change_topic tool when the user seems to be changing the subject or interrupting to discuss something else.

When responding to topic changes:
- If the new topic is clear, acknowledge it and engage with the new subject
- If the topic change is unclear or vague, respond with something like "Yes, tell me more" or "What would you like to discuss?" to encourage them to clarify

Pay attention to interruption signals like:
- "Actually, let me ask about..."
- "Wait, I want to talk about..."
- "By the way..."
- "Speaking of..."
- Sudden subject changes
- Questions that don't relate to the current topic`,
      ],
      new MessagesPlaceholder('chat_history'),
      ['human', '{input}'],
      new MessagesPlaceholder('agent_scratchpad'),
    ])

    this.agent = createToolCallingAgent({
      llm: this.model,
      tools: this.tools,
      prompt: this.prompt,
    })

    this.agentExecutor = new AgentExecutor({
      agent: this.agent,
      tools: this.tools,
      verbose: false,
    })
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
      const chatHistory = await this.memory.loadMemoryVariables({})
      
      await this.sendToSilenceService(textToSend)

      const result = await this.agentExecutor.invoke({
        input: textToSend,
        chat_history: chatHistory.history || [],
      })

      const response = result.output
      
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
