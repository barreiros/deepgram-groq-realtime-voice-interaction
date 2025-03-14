/**
 * A simple EventEmitter implementation for the browser
 */
export default class EventEmitter {
  constructor() {
    this._events = {}
  }

  /**
   * Add an event listener
   * @param {string} event - Event name
   * @param {Function} listener - Event callback
   * @returns {EventEmitter} - Returns this for chaining
   */
  on(event, listener) {
    if (!this._events[event]) {
      this._events[event] = []
    }
    this._events[event].push(listener)
    return this
  }

  /**
   * Add a one-time event listener
   * @param {string} event - Event name
   * @param {Function} listener - Event callback
   * @returns {EventEmitter} - Returns this for chaining
   */
  once(event, listener) {
    const onceWrapper = (...args) => {
      this.off(event, onceWrapper)
      listener.apply(this, args)
    }
    onceWrapper.listener = listener
    this.on(event, onceWrapper)
    return this
  }

  /**
   * Remove an event listener
   * @param {string} event - Event name
   * @param {Function} listener - Event callback
   * @returns {EventEmitter} - Returns this for chaining
   */
  off(event, listener) {
    if (!this._events[event]) return this

    const idx = this._events[event].findIndex(
      (l) => l === listener || (l.listener && l.listener === listener)
    )

    if (idx !== -1) {
      this._events[event].splice(idx, 1)
    }

    return this
  }

  /**
   * Remove all listeners for an event
   * @param {string} [event] - Event name (if omitted, removes all listeners)
   * @returns {EventEmitter} - Returns this for chaining
   */
  removeAllListeners(event) {
    if (event) {
      this._events[event] = []
    } else {
      this._events = {}
    }
    return this
  }

  /**
   * Emit an event
   * @param {string} event - Event name
   * @param {...any} args - Arguments to pass to listeners
   * @returns {boolean} - Returns true if event had listeners
   */
  emit(event, ...args) {
    if (!this._events[event]) return false

    const listeners = [...this._events[event]]
    listeners.forEach((listener) => {
      listener.apply(this, args)
    })

    return listeners.length > 0
  }

  /**
   * Get all listeners for an event
   * @param {string} event - Event name
   * @returns {Function[]} - Array of listeners
   */
  listeners(event) {
    return this._events[event] || []
  }
}
