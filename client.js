const decoder = new TextDecoder()
const encoder = new TextEncoder()

/**
 * @typedef {InitEvent & { client?: Client }} ClientEventOptions
 * @typedef {ClientEventOptions & { error?: Error }} ClientErrorEventOptions
 */

/**
 * @template T
 * @typedef {ClientEventOptions & { data?: { options: {} & T, payload: Uint8Array }}} ClientMessageEventOptions
 */

export class ClientEvent extends Event {
  #client

  /**
   * @param {string} type
   * @param {ClientEventOptions=} [options]
   */
  constructor (type, options) {
    super(type, options)
    this.#client = options?.client ?? null
  }

  /**
   * @type {Client|null}
   */
  get client () {
    return this.#client ?? null
  }
}

export class ClientOpenEvent extends ClientEvent {}
export class ClientCloseEvent extends ClientEvent {}

export class ClientErrorEvent extends ClientEvent {
  #error

  /**
   * @param {string} type
   * @param {ClientErrorEventOptions=} [options]
   */
  constructor (type, options) {
    super(type, options)
    this.#error = options?.error ?? null
  }

  /**
   * @type {Error|null}
   */
  get error () {
    return this.#error ?? null
  }
}

/**
 * @template T
 */
export class ClientMessageEvent extends ClientEvent {
  #data

  /**
   * @param {string} type
   * @param {ClientMessageEventOptions<T>=} [options]
   */
  constructor (type, options) {
    super(type, options)
    this.#data = options?.data ?? null
  }

  /**
   * @type {T|null}
   */
  get data () {
    return this.#data ?? null
  }
}

/**
 * @typedef {{
 *   id?: number,
 *   key: string,
 *   origin: string,
 *   WebSocket?: new (string|URL): WebSocket
 * }} ClientConnectOptions
 */

export class Client extends EventTarget {
  /**
   * @return {number}
   */
  static id () {
    return globalThis.crypto.getRandomValues(new Uint32Array(1))[0]
  }

  /**
   * @param {ClientConnectOptions} options
   * @param {(function(Error|null, Client|undefined):any)=} [callback]
   * @return {Promise<Client>}
   */
  static async connect (options, callback = null) {
    const {
      WebSocket = globalThis.WebSocket,
      origin,
      key,
    } = options

    const id = options.id || Client.id()

    if (typeof WebSocket !== 'function') {
      throw new TypeError(
        'Unable to determine WebSocket implementation. Please provide one.'
      )
    }

    const client = new Client(null, { WebSocket, origin, key, id })

    await client.open()

    try {
      await new Promise((resolve, reject) => {
        client.addEventListener('error', reject, { once: true })
        client.addEventListener('open', resolve, { once: true })
      })
    } catch (err) {
      if (typeof callback === 'function') {
        callback(err)
        return
      }

      throw err
    }

    if (typeof callback === 'function') {
      callback(null, client)
    }

    return client
  }

  /**
   * @type {new (string|URL): WebSocket}
   */
  #WebSocket

  /**
   * @type {WebSocket}
   */
  #socket

  /**
   * @type {string}
   */
  #origin

  /**
   * @type {string}
   */
  #key

  /**
   * @type {number}
   */
  #id

  constructor (socket, options) {
    super()

    this.#WebSocket = options.WebSocket
    this.#socket = socket
    this.#origin = options.origin
    this.#key = options.key
    this.#id = options.id
  }

  get WebSocket () {
    return this.#WebSocket
  }

  get socket () {
    return this.#socket
  }

  get origin () {
    return this.#origin
  }

  get key () {
    return this.#key
  }

  get id () {
    return this.#id
  }

  /**
   * @overload
   * @param {'error'} type
   * @param {function(ClientErrorEvent):any} callback
   * @param {{ once?: boolean }=} [options]
   * @return {void}
   *
   * @overload
   * @param {'message'} type
   * @param {function(ClientMessageEvent):any} callback
   * @param {{ once?: boolean }=} [options]
   * @return {void}
   *
   * @overload
   * @param {'open'} type
   * @param {function(ClientOpenEvent):any} callback
   * @param {{ once?: boolean }=} [options]
   * @return {void}
   *
   * @overload
   * @param {'close'} type
   * @param {function(ClientCloseEvent):any} callback
   * @param {{ once?: boolean }=} [options]
   * @return {void}
   */
  addEventListener (type, callback, options = null) {
    super.addEventListener(type, callback, options)
  }

  /**
   * @param {Record<string, string|number|boolean>} options
   * @param {Uint8Array=} [payload]
   */
  send (options, payload = null) {
    if (!payload) {
      payload = new Uint8Array(0)
    }

    this.#socket.send(encodeMessage(options, payload))
  }

  /**
   * @template T
   * @param {string} command
   * @param {Record<string, string|number|boolean>=} [options]
   * @param {(Uint8Array|string)=} [payload]
   * @return {Promise<T|ArrayBuffer|Uint8Array>}
   */
  async call (command, options = null, payload = null) {
    const token = Math.random().toString(16).slice(2)
    const type = options?.type || null
    options = { ...options }

    if ('type' in options) {
      delete options.type
    }

    if (command === 'window.eval' && options.value) {
      options.value = encodeURIComponent(options.value)
    }

    this.send({ route: command, token, 'ipc-token': token, ...options }, payload)
    return await new Promise((resolve, reject) => {
      this.addEventListener('message', function onMessage (e) {
        if (e.data.options.token === token) {
          try {
            const result = JSON.parse(decoder.decode(e.data.payload))
            if (result.err) {
              return reject(new Error(result.err?.message ?? result.err))
            } else {
              if (type === 'arraybuffer') {
                return resolve(e.data.payload)
              }

              return resolve(result.data ?? result)
            }
          } catch {
            return resolve(e.data.payload)
          }
        }
      })
    })
  }

  async open () {
    if (this.#socket) {
      return
    }

    const url = new URL(`/${this.#id}/0?key=${this.#key}`, this.#origin)
    this.#socket = Object.assign(new this.#WebSocket(url.href), {
      id: this.#id
    })

    this.#socket.addEventListener('error', (e) => {
      this.dispatchEvent(new ClientErrorEvent('error', {
        client: this,
        error: e.error
      }))
    })

    this.#socket.addEventListener('open', () => {
      this.dispatchEvent(new ClientOpenEvent('open', {
        client: this
      }))
    })

    this.#socket.addEventListener('close', () => {
      this.dispatchEvent(new ClientCloseEvent('close', {
        client: this
      }))
    })

    this.#socket.addEventListener('message', async (event) => {
      let decoded
      try {
        // @ts-ignore
        const data = ArrayBuffer.isView(event.data)
          ? event.data
          : new Uint8Array(await event.data?.arrayBuffer?.() ?? 0)
        decoded = decodeMessage(data)
      } catch (err) {
        console.log(err)
        this.dispatchEvent(new ClientErrorEvent('error', {
          client: this,
          error: err
        }))
        return
      }

      this.dispatchEvent(new ClientMessageEvent('message', {
        data: decoded,
        client: this
      }))
    })
  }

  async close () {
    this.#socket.close()
    await new Promise((resolve) => this.addEventListener('close', resolve, { once: true }))
  }
}

/**
 * @see {@link https://github.com/socketsupply/socket/blob/master/api/internal/conduit.js}
 * @param {string} key
 * @param {string} value
 * @return {Uint8Array}
 */
export function encodeOption (key, value) {
  const keyLength = key.length
  const keyBuffer = encoder.encode(key)

  const valueBuffer = encoder.encode(value)
  const valueLength = valueBuffer.length

  const buffer = new ArrayBuffer(1 + keyLength + 2 + valueLength)
  const view = new DataView(buffer)

  view.setUint8(0, keyLength)
  new Uint8Array(buffer, 1, keyLength).set(keyBuffer)

  view.setUint16(1 + keyLength, valueLength, false)
  new Uint8Array(buffer, 3 + keyLength, valueLength).set(valueBuffer)

  return new Uint8Array(buffer)
}

/**
 * @param {Record<string, string|number|boolean>} options
 * @param {Uint8Array} payload
 * @return {Uint8Array}
 */
export function encodeMessage (options, payload) {
  const headerBuffers = Object.entries(options)
    .map(([key, value]) => encodeOption(key, String(value)))

  const totalOptionLength = headerBuffers.reduce((sum, buf) => sum + buf.length, 0)
  const bodyLength = payload.length
  const buffer = new ArrayBuffer(1 + totalOptionLength + 2 + bodyLength)
  const view = new DataView(buffer)

  view.setUint8(0, headerBuffers.length)

  let offset = 1

  headerBuffers.forEach(headerBuffer => {
    new Uint8Array(buffer, offset, headerBuffer.length).set(headerBuffer)
    offset += headerBuffer.length
  })

  view.setUint16(offset, bodyLength, false)
  offset += 2

  new Uint8Array(buffer, offset, bodyLength).set(payload)

  return new Uint8Array(buffer)
}

/**
 * @param {Uint8Array} data
 * @return {{ options: Record<string, string|number|boolean>, payload: Uint8Array }}
 */
export function decodeMessage (data) {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength)
  const length = view.getUint8(0)

  let offset = 1
  const options = /** @type {Record<string, string|number|boolean>} */ ({})

  for (let i = 0; i < length; i++) {
    const keyLength = view.getUint8(offset)
    offset += 1

    const key = decoder.decode(data.slice(offset, offset + keyLength))
    offset += keyLength

    const valueLength = view.getUint16(offset, false)
    offset += 2

    const valueBuffer = data.slice(offset, offset + valueLength)
    offset += valueLength

    const value = decoder.decode(valueBuffer)
    options[key] = value
  }

  const bodyLength = view.getUint16(offset, false)
  offset += 2

  const payload = data.subarray(offset, offset + bodyLength)
  return { options, payload }
}

/**
 * @param {ClientConnectOptions} options
 * @param {(function(Error|null, Client|undefined):any)=} [callback]
 * @return {Promise<Client>}
 */
export async function connect (options, callback = null) {
  return await Client.connect(options, callback)
}

export default Client