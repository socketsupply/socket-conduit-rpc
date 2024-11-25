Socket Runtime Conduit RPC
==========================

> A RPC client for connecting to a Socket Runtime application conduit.


## Installation

```sh
npm install @socketsupply/socket-conduit-rpc
```

## Usage

### API

```js
import { Client } from '@socketsupply/socket-conduit-rpc/client.js'

const client = await Client.connect({
  // The host origin where the websocket server is listening (see below)
  origin: 'ws://localhost:8080',
  // A known and shared key for authenticating with the server (see below)
  key: 'a shared key'
})

console.log(await client.call('fs.stat', { path: 'index.html' }))
```

### CLI

```sh
$ conduit                        \
  --origin 'ws://localhost:8080' \
  --key 'hello world'            \
  --format json                  \
  serviceWorker.fetch            \
  --scheme=custom-protocol       \
  --pathname='/hello.json'
{"message":"hello browser extension from socket runtime"}
```

### Configuring WebSocket Server Port

When building an application with the [Socket Runtime](https://github.com/socketsupply/socket),
an internal "conduit" WebSocket server that can allow connected and
authenticated clients to connect and make RPC requests to the runtime
such as managing & messaging windows, evaluating JavaScript, reading
from the file system (sandbox applies), and more.

In order to connect to the WebSocket server, a known port must be set.
The WebSocket server can read the `SOCKET_RUNTIME_CONDUIT_PORT`
environment variable at runtime and use it instead. This value can be
set at build time with `ssc build` or configured in the `[env]` section
of your `socket.ini`:

```ini
[env]
SOCKET_RUNTIME_CONDUIT_PORT = 8080
```

### Shared Key

When conencting to the WebSocket server, a shared key must be given in
the connection URL as a query string parameter `?key=...`. The key must
be known at build time and can be configured in the
`[application.conduit]` section of your `socket.ini`:

```ini
[application.conduit]
shared_key = "a shared key"
```


## License

MIT
