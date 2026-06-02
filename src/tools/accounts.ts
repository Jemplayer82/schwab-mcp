import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { schwab } from '../schwab-client.js'

export function registerAccountTools(server: McpServer): void {
  server.tool(
    'getAccounts',
    'Get all Schwab accounts with balances and positions',
    {
      fields: z.string().optional().describe("Comma-separated fields to include, e.g. 'positions'"),
    },
    async ({ fields }) => {
      const accounts = await schwab.trader.accounts.getAccounts(
        fields ? { queryParams: { fields } } : undefined
      )
      return { content: [{ type: 'text', text: JSON.stringify(accounts, null, 2) }] }
    }
  )

  server.tool(
    'getAccountNumbers',
    'Get the list of account numbers and their encrypted hashes (needed for order placement)',
    {},
    async () => {
      const accounts = await schwab.trader.accounts.getAccounts()
      const numbers = Array.isArray(accounts)
        ? accounts.map((a: Record<string, unknown>) => ({
            accountNumber: (a['securitiesAccount'] as Record<string, unknown>)?.['accountNumber'],
            hashValue: (a['securitiesAccount'] as Record<string, unknown>)?.['accountNumber'],
          }))
        : accounts
      return { content: [{ type: 'text', text: JSON.stringify(numbers, null, 2) }] }
    }
  )
}
