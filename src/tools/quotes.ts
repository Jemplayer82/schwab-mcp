import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { getSchwab } from '../schwab-client.js'

export function registerQuoteTools(server: McpServer): void {
  server.tool(
    'getQuotes',
    'Get real-time quotes for one or more symbols',
    {
      symbols: z.string().describe("Comma-separated list of symbols, e.g. 'AAPL,MSFT,TSLA'"),
      indicative: z.boolean().optional().describe('Include indicative symbol quotes for all ETF constituents'),
    },
    async ({ symbols, indicative }) => {
      const symbolList = symbols.split(',').map(s => s.trim())
      const quotes = await getSchwab().marketData.quotes.getQuotes({
        queryParams: {
          symbols: symbolList,
          ...(indicative !== undefined && { indicative }),
        },
      })
      return { content: [{ type: 'text', text: JSON.stringify(quotes, null, 2) }] }
    }
  )
}
