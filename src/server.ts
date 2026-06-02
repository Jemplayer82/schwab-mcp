import express from 'express'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { createServer } from './mcp.js'
import { exchangeCode, getAuthUrl } from './schwab-client.js'
import { hasTokens } from './token-store.js'

const app = express()
app.use(express.json())

// OAuth: initiate flow
app.get('/auth', (_req, res) => {
  const url = getAuthUrl()
  res.redirect(url)
})

// OAuth: callback from Schwab
app.get('/callback', async (req, res) => {
  const code = req.query['code']
  if (typeof code !== 'string') {
    res.status(400).send('Missing authorization code')
    return
  }
  try {
    await exchangeCode(code)
    res.send('<h1>Schwab connected!</h1><p>You can close this window. Claude can now access your Schwab account.</p>')
  } catch (err) {
    console.error('OAuth callback error:', err)
    res.status(500).send('Failed to exchange authorization code')
  }
})

// Health check
app.get('/health', async (_req, res) => {
  const authenticated = await hasTokens()
  res.json({ status: 'ok', authenticated })
})

// MCP streamable HTTP endpoint — new server per request (stateless)
app.post('/mcp', async (req, res) => {
  const server = createServer()
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined })

  res.on('close', async () => {
    await transport.close()
    await server.close()
  })

  await server.connect(transport)
  await transport.handleRequest(req, res, req.body)
})

// MCP GET (for SSE/ping clients that probe before posting — return 405 to signal stateless-only)
app.get('/mcp', (_req, res) => {
  res.status(405).json({ error: 'Use POST /mcp for streamable HTTP transport' })
})

const port = Number(process.env.PORT ?? 8000)
app.listen(port, () => {
  console.log(`schwab-mcp listening on port ${port}`)
  console.log(`  MCP endpoint:  POST http://localhost:${port}/mcp`)
  console.log(`  OAuth start:   GET  http://localhost:${port}/auth`)
  console.log(`  OAuth callback: GET  http://localhost:${port}/callback`)
  console.log(`  Health:         GET  http://localhost:${port}/health`)
})
