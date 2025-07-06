import { spawn } from 'child_process'
import path from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'
import { EventEmitter } from 'events'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

class SentenceDetectionService extends EventEmitter {
  constructor() {
    super()
    this.pythonProcess = null
    this.isReady = false
    this.pendingRequests = new Map()
    this.requestId = 0
    this.isInitializing = false
    this.connectionCount = 0
    this.initializePythonProcess()
  }

  addConnection() {
    this.connectionCount++
    console.log(
      `Sentence detector connection added. Total connections: ${this.connectionCount}`
    )
  }

  removeConnection() {
    this.connectionCount--
    console.log(
      `Sentence detector connection removed. Total connections: ${this.connectionCount}`
    )

    if (this.connectionCount <= 0) {
      this.connectionCount = 0
    }
  }

  initializePythonProcess() {
    if (this.isInitializing) {
      console.log('Python process already initializing, skipping...')
      return
    }

    this.isInitializing = true
    const pythonScriptPath = path.join(
      __dirname,
      '../python/sentence_detector.py'
    )

    console.log('Starting Python sentence detector process...')

    this.pythonProcess = spawn('python3', [pythonScriptPath], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env },
    })

    this.pythonProcess.stdout.on('data', (data) => {
      const lines = data
        .toString()
        .split('\n')
        .filter((line) => line.trim())

      for (const line of lines) {
        try {
          const response = JSON.parse(line)

          if (response.type === 'info') {
            console.log('Python sentence detector:', response.message)
          } else if (response.type === 'ready') {
            this.isReady = true
            this.isInitializing = false
            console.log('Sentence detection service ready')
            this.emit('ready')
          } else if (response.type === 'result') {
            const { requestId, result } = response
            const resolve = this.pendingRequests.get(requestId)
            if (resolve) {
              resolve(result)
              this.pendingRequests.delete(requestId)
            }
          } else if (response.type === 'error') {
            const { requestId, error } = response
            console.error('Python sentence detector error:', error)
            const resolve = this.pendingRequests.get(requestId)
            if (resolve) {
              resolve({ status: 'CONTINUE', confidence: 0, error })
              this.pendingRequests.delete(requestId)
            }
          } else if (response.type === 'shutdown') {
            console.log('Python process shutting down:', response.message)
          }
        } catch (error) {
          console.error(
            'Error parsing Python response:',
            error,
            'Raw data:',
            line
          )
        }
      }
    })

    this.pythonProcess.stderr.on('data', (data) => {
      console.error('Python process stderr:', data.toString())
    })

    this.pythonProcess.on('close', (code, signal) => {
      console.log(`Python process exited with code ${code}, signal ${signal}`)
      this.isReady = false
      this.isInitializing = false

      for (const [requestId, resolve] of this.pendingRequests) {
        resolve({
          status: 'CONTINUE',
          confidence: 0,
          error: 'Process terminated',
        })
      }
      this.pendingRequests.clear()

      this.emit('disconnected')

      if (
        code !== 0 &&
        signal !== 'SIGTERM' &&
        signal !== 'SIGKILL' &&
        this.connectionCount > 0
      ) {
        console.log('Restarting Python process in 3 seconds...')
        setTimeout(() => {
          if (!this.isInitializing && this.connectionCount > 0) {
            this.initializePythonProcess()
          }
        }, 3000)
      }
    })

    this.pythonProcess.on('error', (error) => {
      console.error('Failed to start Python process:', error)
      this.isReady = false
      this.isInitializing = false

      for (const [requestId, resolve] of this.pendingRequests) {
        resolve({
          status: 'CONTINUE',
          confidence: 0,
          error: 'Failed to start process',
        })
      }
      this.pendingRequests.clear()

      this.emit('error', error)
    })

    this.pythonProcess.on('spawn', () => {
      console.log('Python process spawned successfully')
    })
  }

  async detectSentenceCompletion(text) {
    if (!this.isReady) {
      console.log('Sentence detector not ready, returning CONTINUE')
      return { status: 'CONTINUE', confidence: 0 }
    }

    return new Promise((resolve) => {
      const requestId = ++this.requestId
      this.pendingRequests.set(requestId, resolve)

      const request = {
        type: 'detect',
        requestId,
        text,
      }

      try {
        if (
          this.pythonProcess &&
          this.pythonProcess.stdin &&
          !this.pythonProcess.stdin.destroyed
        ) {
          console.log(':::::::::::::::::::::::::::::::::::::::::::')
          this.pythonProcess.stdin.write(JSON.stringify(request) + '\n')
        } else {
          console.error('Python process stdin not available')
          this.pendingRequests.delete(requestId)
          resolve({ status: 'CONTINUE', confidence: 0 })
          return
        }
      } catch (error) {
        console.error('Error writing to Python process:', error)
        this.pendingRequests.delete(requestId)
        resolve({ status: 'CONTINUE', confidence: 0 })
        return
      }

      setTimeout(() => {
        if (this.pendingRequests.has(requestId)) {
          this.pendingRequests.delete(requestId)
          resolve({ status: 'CONTINUE', confidence: 0 })
        }
      }, 5000)
    })
  }

  close() {
    console.log('Closing sentence detection service...')

    if (this.pythonProcess) {
      try {
        this.pythonProcess.kill('SIGTERM')

        setTimeout(() => {
          if (this.pythonProcess && !this.pythonProcess.killed) {
            console.log('Force killing Python process...')
            this.pythonProcess.kill('SIGKILL')
          }
        }, 2000)

        this.pythonProcess = null
      } catch (error) {
        console.error('Error closing Python process:', error)
      }
    }

    this.isReady = false
    this.isInitializing = false
    this.connectionCount = 0
    this.pendingRequests.clear()

    SentenceDetectionService.instance = null
  }
}

export default SentenceDetectionService
