import express from 'express'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { createServer } from './mcp.js'
import { exchangeCode, getAuthUrl, ensureFreshToken } from './schwab-client.js'
import { hasTokens } from './token-store.js'

const app = express()
app.use(express.json())

// OAuth: initiate flow
app.get('/auth', async (_req, res) => {
  const url = await getAuthUrl()
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
  // Refresh the ~30-minute Schwab access token (using the stored refresh token)
  // before any tool runs, so a run after the token expired doesn't 401.
  await ensureFreshToken().catch((err) =>
    console.error('[schwab-mcp] pre-request token refresh failed:', err)
  )

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

// Keep the Schwab access token warm so a scheduled/portfolio run never hits an
// expired ~30-minute access token. Schwab still requires a full re-auth at /auth
// every 7 days — this only removes the every-~30-minutes re-authorization.
const REFRESH_INTERVAL_MS = 15 * 60_000
setInterval(() => {
  void ensureFreshToken().catch((err) =>
    console.error('[schwab-mcp] scheduled token refresh failed:', err)
  )
}, REFRESH_INTERVAL_MS)
void ensureFreshToken().catch(() => {})
