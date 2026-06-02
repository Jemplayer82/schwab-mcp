import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { schwab } from '../schwab-client.js'

export function registerQuoteTools(server: McpServer): void {
  server.tool(
    'getQuotes',
    'Get real-time quotes for one or more symbols',
    {
      symbols: z.string().describe("Comma-separated list of symbols, e.g. 'AAPL,MSFT,TSLA'"),
      fields: z.string().optional().describe("Fields to include, e.g. 'quote,fundamental'"),
      indicative: z.boolean().optional().describe('Include indicative symbol quotes for all ETF constituents'),
    },
    async ({ symbols, fields, indicative }) => {
      const queryParams: Record<string, unknown> = { symbols }
      if (fields) queryParams['fields'] = fields
      if (indicative !== undefined) queryParams['indicative'] = indicative

      const quotes = await schwab.marketData.quotes.getQuotes({ queryParams })
      return { content: [{ type: 'text', text: JSON.stringify(quotes, null, 2) }] }
    }
  )
}
