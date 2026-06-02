import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { schwab } from '../schwab-client.js'

const TransactionType = z.enum([
  'TRADE', 'RECEIVE_AND_DELIVER', 'DIVIDEND_OR_INTEREST',
  'ACH_RECEIPT', 'ACH_DISBURSEMENT', 'CASH_RECEIPT', 'CASH_DISBURSEMENT',
  'ELECTRONIC_FUND', 'WIRE_OUT', 'WIRE_IN', 'JOURNAL', 'MEMORANDUM',
  'MARGIN_CALL', 'MONEY_MARKET',
])

export function registerTransactionTools(server: McpServer): void {
  server.tool(
    'getTransactions',
    'Get transaction history for an account',
    {
      accountNumber: z.string().describe('Account number'),
      types: TransactionType.describe("Transaction type, e.g. 'TRADE'"),
      startDate: z.string().optional().describe('Start date in ISO 8601 format'),
      endDate: z.string().optional().describe('End date in ISO 8601 format'),
      symbol: z.string().optional().describe('Filter by symbol'),
    },
    async ({ accountNumber, types, startDate, endDate, symbol }) => {
      const txns = await schwab.trader.transactions.getTransactions({
        pathParams: { accountNumber },
        queryParams: {
          types,
          ...(startDate && { startDate }),
          ...(endDate && { endDate }),
          ...(symbol && { symbol }),
        },
      })
      return { content: [{ type: 'text', text: JSON.stringify(txns, null, 2) }] }
    }
  )
}
