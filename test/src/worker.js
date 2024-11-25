/**
 * @param {Request} _
 * @return {Promise<Response|void>}
 */
export default async function (_) {
  return Response.json({ message: 'hello browser extension from socket runtime' })
}
