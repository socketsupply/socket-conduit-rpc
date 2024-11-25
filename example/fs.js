import { Stats } from 'node:fs'
import WebSocket from 'ws'

import { Client } from '../client.js'

const client = await Client.connect({
  WebSocket,
  origin: 'ws://localhost:8080',
  key: 'hello world'
})

const fs = {
  /**
   * @param {string} filename
   * @param {{ mode?: number, flags?: number }} [options]
   * @return {Promise<{ id: string, fd: number }>}
   */
  async open (filename, options = null) {
    return /** @type {{ id: string, fd: number }} */ (await client.call('fs.open', {
      path: filename,
      mode: 4,
      flags: 0,
      ...options
    }))
  },

  /**
   * @param {{ id: string, fd: number }} fd
   * @return {Promise}
   */
  async close (fd) {
    return await client.call('fs.close', { id: fd.id })
  },

  /**
   * @param {string} filename
   * @return {Promise<Stats>}
   */
  async stat (filename) {
    const result = /** @type {object} */ (await client.call('fs.stat', {
      path: filename
    }))
    // @ts-ignore
    return new Stats(
      parseInt(result.st_dev),
      parseInt(result.st_mode),
      parseInt(result.st_nlink),
      parseInt(result.st_uid),
      parseInt(result.st_gid),
      parseInt(result.st_rdev),
      parseInt(result.st_blksize),
      parseInt(result.st_ino),
      parseInt(result.st_size),
      parseInt(result.st_blocks),
      parseInt(result.st_atim.tv_sec) * 1000,
      parseInt(result.st_mtim.tv_sec) * 1000,
      parseInt(result.st_ctim.tv_sec) * 1000,
      parseInt(result.st_birthtim.tv_sec) * 1000
    )
  },

  async readFile (filename, options) {
    if (typeof options === 'string') {
      options = { encoding: options }
    }

    const fd = await this.open(filename, {
      flags: 0,
      mode: 4
    })

    const stats = await this.stat(filename)
    const buffer = Buffer.from(/** @type {ArrayBuffer|Buffer} */ (await client.call('fs.read', {
      id: fd.id,
      offset: 0,
      size: stats.size,
      type: 'arraybuffer'
    })))

    await this.close(fd)

    if (typeof options?.encoding === 'string') {
      return buffer.toString(options.encoding)
    }

    return buffer
  }
}

console.time('fs.readFile')
console.log(await fs.readFile('index.html', 'utf8'))
console.timeEnd('fs.readFile')
