import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { schwab } from '../schwab-client.js'

export function registerTransactionTools(server: McpServer): void {
  server.tool(
    'getTransactions',
    'Get transaction history for an account',
    {
      accountNumber: z.string().describe('Account number'),
      types: z.string().optional().describe("Transaction type filter, e.g. 'TRADE'"),
      startDate: z.string().optional().describe('Start date in ISO 8601 format'),
      endDate: z.string().optional().describe('End date in ISO 8601 format'),
      symbol: z.string().optional().describe('Filter by symbol'),
    },
    async ({ accountNumber, types, startDate, endDate, symbol }) => {
      const queryParams: Record<string, unknown> = {}
      if (types) queryParams['types'] = types
      if (startDate) queryParams['startDate'] = startDate
      if (endDate) queryParams['endDate'] = endDate
      if (symbol) queryParams['symbol'] = symbol

      const txns = await schwab.trader.transactions.getTransactions({
        pathParams: { accountNumber },
        queryParams,
      })
      return { content: [{ type: 'text', text: JSON.stringify(txns, null, 2) }] }
    }
  )
}
