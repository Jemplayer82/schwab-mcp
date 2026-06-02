import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { registerAccountTools } from './tools/accounts.js'
import { registerOrderTools } from './tools/orders.js'
import { registerQuoteTools } from './tools/quotes.js'
import { registerTransactionTools } from './tools/transactions.js'
import { registerMarketTools } from './tools/market.js'

export function createServer(): McpServer {
  const server = new McpServer({
    name: 'schwab-mcp',
    version: '1.0.0',
  })

  registerAccountTools(server)
  registerOrderTools(server)
  registerQuoteTools(server)
  registerTransactionTools(server)
  registerMarketTools(server)

  return server
}
