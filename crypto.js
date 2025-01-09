const encoder = new TextEncoder()
/**
 * @param {string|Uint8Array} input
 * @param {string|{ encoding: string }=} [options]
 * @return {Promise<Uint8Array|string>}
 */
export async function sha1 (input, options) {
  if (typeof input === 'string') {
    input = encoder.encode(input)
  }

  const encoding = /** @type {{ encoding?: string }} */ (options)?.encoding ?? options ?? ''
  const arrayBuffer = await globalThis.crypto.subtle.digest('SHA-1', input)
  const buffer = new Uint8Array(arrayBuffer)

  if (encoding === 'hex') {
    return Array
      .from(buffer)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase()
  }

  return buffer
}
