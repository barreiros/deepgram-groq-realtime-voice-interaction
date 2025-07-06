import { ChatGroq } from '@langchain/groq'
import {
  ChatPromptTemplate,
  MessagesPlaceholder,
} from '@langchain/core/prompts'
import { StringOutputParser } from '@langchain/core/output_parsers'
import { ConversationSummaryBufferMemory } from 'langchain/memory'
import { HumanMessage, AIMessage } from '@langchain/core/messages'
import SentenceCompletion from '../tools/SentenceCompletion.js'
import Groq from 'groq-sdk'

class GroqService {
  constructor(apiKey, eventEmitter, sentenceDetector, params = {}) {
    this.params = params
    this.language = params.llm_langugage || 'en'
    this.lastActivityTime = Date.now()
    this.silenceTimeout = null
    this.transcriptionBuffer = ''
    this.eventEmitter = eventEmitter
    this.currentAgentInstructions =
      'You are a helpful AI assistant. Respond naturally and be concise but informative.'
    this.defaultInstructions =
      'Be precise and concise in your answers and avoid long responses because you are interacting with the user using the voice and the conversation should be fluent. When users share images with you, you can see and analyze them directly. Answer questions about images based on what you can observe in them. Never mention that you cannot see images or that you only have descriptions - you can see the images directly.'

    this.chatModel = new ChatGroq({
      apiKey: apiKey,
      model: 'meta-llama/llama-4-maverick-17b-128e-instruct',
      temperature: this.params.llm_temp
        ? parseFloat(this.params.llm_temp)
        : 0.7,
    })

    this.nativeGroq = new Groq({
      apiKey: apiKey,
    })

    this.memoryModel = new ChatGroq({
      apiKey: apiKey,
      model: 'llama3-8b-8192',
    })

    this.imageModel = 'meta-llama/llama-4-scout-17b-16e-instruct'

    this.memory = new ConversationSummaryBufferMemory({
      llm: this.memoryModel,
      maxTokenLimit: 1000,
      returnMessages: true,
    })

    this.sentenceDetector = sentenceDetector
    this.sentenceDetector.addConnection()

    this.setupChat()
  }

  updateAgentInstructions(instructions) {
    this.currentAgentInstructions =
      instructions ||
      'You are a helpful AI assistant. Be precise and concise in your answers and avoid long responses because you are interacting with the user using the voice and the conversation should be fluent. Most of the cases is better to respond with yes or not than an unusseful long answer. When users share images with you, you can see and analyze them directly. Answer questions about images based on what you can observe in them.'
    console.log('Agent instructions updated to:', this.currentAgentInstructions)
  }

  getEffectiveSystemMessage(customInstructions = null) {
    const baseInstructions = customInstructions || this.currentAgentInstructions
    return `${baseInstructions}\n\n${this.defaultInstructions}`
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
      ['system', '{system_message}'],
      new MessagesPlaceholder('chat_history'),
      ['human', '{input}'],
    ])

    const chain = this.prompt
      .pipe(this.chatModel)
      .pipe(new StringOutputParser())
    this.conversationChain = chain
  }

  async processBufferIfInactive() {
    if (
      Date.now() - this.lastActivityTime >= 3000 &&
      this.transcriptionBuffer
    ) {
      const completeSentence = this.transcriptionBuffer
      this.transcriptionBuffer = ''
      this.eventEmitter.emit('shutup', {})

      try {
        const chatHistory = await this.memory.loadMemoryVariables({})
        const effectiveSystemMessage = this.getEffectiveSystemMessage()

        const response = await this.conversationChain.invoke({
          input: completeSentence,
          system_message: effectiveSystemMessage,
          chat_history: chatHistory.history || [],
        })

        if (response && response.trim().length > 0) {
          this.eventEmitter.emit('llm-text', {
            text: response.trim(),
            language: this.language,
          })

          await this.memory.saveContext(
            { input: completeSentence },
            { output: response }
          )
        }
      } catch (error) {
        console.error('Error processing inactive buffer:', error)
        this.eventEmitter.emit('error', { error: error.message })
      }
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

    try {
      const detectionPromise = this.sentenceDetector.detectSentenceCompletion(
        this.transcriptionBuffer
      )

      const chatPromise = this.prepareChatResponse()

      const detectionResult = await detectionPromise

      console.log(
        'Sentence detection result:',
        detectionResult,
        'for input:',
        this.transcriptionBuffer
      )

      if (detectionResult.status === 'INTERRUPT') {
        this.transcriptionBuffer = ''
        this.eventEmitter.emit('shutup', {
          message: 'Conversation stopped by user request',
        })
      } else if (detectionResult.status === 'COMPLETE') {
        console.log(
          'User utterance complete, processing:',
          this.transcriptionBuffer
        )
        const completeSentence = this.transcriptionBuffer
        this.transcriptionBuffer = ''
        this.eventEmitter.emit('shutup', {})

        try {
          const response = await chatPromise
          if (response && response.trim().length > 0) {
            this.eventEmitter.emit('llm-text', {
              text: response.trim(),
              language: this.language,
            })
            await this.memory.saveContext(
              { input: completeSentence },
              { output: response }
            )
          }
        } catch (error) {
          console.error('Error processing complete utterance:', error)
          this.eventEmitter.emit('error', { error: error.message })
        }
      }
    } catch (error) {
      console.error('Error in sentence detection:', error)
      this.eventEmitter.emit('shutup', {
        message: 'Sentence detection failed, stopping processing',
      })
    }
  }

  async prepareChatResponse() {
    const chatHistory = await this.memory.loadMemoryVariables({})
    const effectiveSystemMessage = this.getEffectiveSystemMessage()

    return this.conversationChain.invoke({
      input: this.transcriptionBuffer,
      system_message: effectiveSystemMessage,
      chat_history: chatHistory.history || [],
    })
  }

  async processChatMessage(messageData) {
    try {
      console.log('Processing chat message:', messageData)
      const { text, images, agentInstructions } = messageData

      const systemMessage = this.getEffectiveSystemMessage(agentInstructions)

      if (images && Array.isArray(images) && images.length > 0) {
        console.log(`Processing ${images.length} images`)
        await this.processImagesMessage(text, images, systemMessage)
      } else {
        console.log('Processing text message')
        await this.processTextMessage(text, systemMessage)
      }
    } catch (error) {
      console.error('Error processing chat message:', error)
      this.eventEmitter.emit('error', { error: error.message })
    }
  }

  async generateImageDescription(imageData) {
    try {
      const imageUrl = `data:${imageData.type};base64,${imageData.data}`

      const imageDescriptionMessages = [
        {
          role: 'system',
          content:
            'You are an image description assistant. Describe what you see in the image in detail, focusing on important visual elements, objects, people, text, and context.',
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Describe this image in detail.',
            },
            {
              type: 'image_url',
              image_url: {
                url: imageUrl,
              },
            },
          ],
        },
      ]

      const descriptionResponse = await this.nativeGroq.chat.completions.create(
        {
          model: this.imageModel,
          messages: imageDescriptionMessages,
          temperature: 0.3,
          max_tokens: 500,
        }
      )

      if (
        descriptionResponse &&
        descriptionResponse.choices &&
        descriptionResponse.choices[0] &&
        descriptionResponse.choices[0].message &&
        descriptionResponse.choices[0].message.content
      ) {
        return descriptionResponse.choices[0].message.content.trim()
      }

      return ''
    } catch (error) {
      console.error('Error generating image description:', error)
      return ''
    }
  }

  async processImagesMessage(text, imagesData, systemMessage) {
    try {
      console.log(`Starting to process ${imagesData.length} images`)

      const imageDescriptionPromises = imagesData.map((imageData, index) => {
        console.log(`Creating promise for image ${index + 1}`)
        return this.generateImageDescription(imageData).then((description) => ({
          index: index + 1,
          description,
          name: imageData.name || `image_${index + 1}`,
        }))
      })

      console.log('Waiting for all image descriptions...')
      const imageResults = await Promise.all(imageDescriptionPromises)
      console.log('All image descriptions completed:', imageResults.length)

      const imageDescriptions = imageResults
        .filter((result) => result.description)
        .map((result) => {
          console.log(
            `Image ${result.index} description generated:`,
            result.description.substring(0, 100) + '...'
          )
          return `Image ${result.index}: ${result.description}`
        })

      const userQuery =
        text ||
        (imagesData.length === 1
          ? 'What can you tell me about this image?'
          : 'What can you tell me about these images?')
      const combinedDescriptions = imageDescriptions.join('\n\n')

      console.log(`Saving context for ${imageDescriptions.length} images`)
      await this.memory.saveContext(
        {
          input: `${userQuery} [Images content: ${combinedDescriptions}]`,
        },
        {
          output: `I can see the ${imagesData.length} ${
            imagesData.length === 1 ? 'image' : 'images'
          } you shared. ${combinedDescriptions}`,
        }
      )
    } catch (error) {
      console.error('Error processing images message:', error)
      this.eventEmitter.emit('error', { error: error.message })
    }
  }

  async processTextMessage(text, systemMessage) {
    try {
      const chatHistory = await this.memory.loadMemoryVariables({})

      const response = await this.conversationChain.invoke({
        input: text,
        system_message: systemMessage,
        chat_history: chatHistory.history || [],
      })

      if (response && response.trim().length > 0) {
        this.eventEmitter.emit('llm-text', {
          text: response.trim(),
          language: this.language,
        })

        await this.memory.saveContext({ input: text }, { output: response })
      }
    } catch (error) {
      console.error('Error processing text message:', error)
      this.eventEmitter.emit('error', { error: error.message })
    }
  }

  close() {
    if (this.sentenceDetector) {
      this.sentenceDetector.removeConnection()
    }
  }
}

export default GroqService
