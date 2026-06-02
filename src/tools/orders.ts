import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { getSchwab } from '../schwab-client.js'

const OrderLegSchema = z.object({
  instruction: z.enum(['BUY', 'SELL', 'BUY_TO_COVER', 'SELL_SHORT', 'BUY_TO_OPEN', 'BUY_TO_CLOSE', 'SELL_TO_OPEN', 'SELL_TO_CLOSE']),
  quantity: z.number().positive(),
  instrument: z.object({
    symbol: z.string(),
    assetType: z.enum(['EQUITY', 'OPTION', 'MUTUAL_FUND', 'FIXED_INCOME', 'INDEX', 'CASH_EQUIVALENT', 'ETF', 'FOREX', 'FUTURE', 'FUTURE_OPTION', 'CURRENCY', 'COLLECTIVE_INVESTMENT']),
  }),
})

const OrderBodySchema = z.object({
  orderType: z.enum(['MARKET', 'LIMIT', 'STOP', 'STOP_LIMIT', 'TRAILING_STOP', 'CABINET', 'NON_MARKETABLE', 'MARKET_ON_CLOSE', 'EXERCISE', 'TRAILING_STOP_LIMIT', 'NET_DEBIT', 'NET_CREDIT', 'NET_ZERO', 'LIMIT_ON_CLOSE']),
  session: z.enum(['NORMAL', 'AM', 'PM', 'SEAMLESS']),
  duration: z.enum(['DAY', 'GOOD_TILL_CANCEL', 'FILL_OR_KILL', 'IMMEDIATE_OR_CANCEL', 'END_OF_WEEK', 'END_OF_MONTH', 'NEXT_END_OF_MONTH', 'UNKNOWN']),
  orderStrategyType: z.enum(['SINGLE', 'CANCEL', 'RECALL', 'PAIR', 'FLATTEN', 'TWO_DAY_SWAP', 'BLAST_ALL', 'OCO', 'TRIGGER']),
  price: z.number().optional().describe('Limit price (required for LIMIT orders)'),
  orderLegCollection: z.array(OrderLegSchema),
})

export function registerOrderTools(server: McpServer): void {
  server.tool(
    'getOrders',
    'Get orders for an account',
    {
      accountNumber: z.string().describe('Account number'),
      maxResults: z.number().int().optional().describe('Maximum number of orders to return'),
      fromEnteredTime: z.string().optional().describe('Start date in ISO 8601 format'),
      toEnteredTime: z.string().optional().describe('End date in ISO 8601 format'),
      status: z.string().optional().describe('Filter by order status (e.g. FILLED, PENDING_ACTIVATION)'),
    },
    async ({ accountNumber, maxResults, fromEnteredTime, toEnteredTime, status }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const orders = await (getSchwab().trader.orders.getOrdersByAccount as any)({
        pathParams: { accountNumber },
        queryParams: {
          ...(maxResults !== undefined && { maxResults }),
          ...(fromEnteredTime && { fromEnteredTime }),
          ...(toEnteredTime && { toEnteredTime }),
          ...(status && { status }),
        },
      })
      return { content: [{ type: 'text', text: JSON.stringify(orders, null, 2) }] }
    }
  )

  server.tool(
    'getOrder',
    'Get a specific order by ID',
    {
      accountNumber: z.string().describe('Account number'),
      orderId: z.number().int().describe('Order ID (numeric)'),
    },
    async ({ accountNumber, orderId }) => {
      const order = await getSchwab().trader.orders.getOrderByOrderId({
        pathParams: { accountNumber, orderId },
      })
      return { content: [{ type: 'text', text: JSON.stringify(order, null, 2) }] }
    }
  )

  server.tool(
    'placeOrder',
    'Place a new order for an account',
    {
      accountNumber: z.string().describe('Account number'),
      order: OrderBodySchema,
    },
    async ({ accountNumber, order }) => {
      // placeOrderForAccount returns void (201 + Location header); body typed as any for flexibility
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (getSchwab().trader.orders.placeOrderForAccount as unknown as (p: { pathParams: { accountNumber: string }, body: unknown }) => Promise<void>)({
        pathParams: { accountNumber },
        body: order,
      })
      return { content: [{ type: 'text', text: JSON.stringify({ status: 'order placed' }) }] }
    }
  )

  server.tool(
    'cancelOrder',
    'Cancel an existing order',
    {
      accountNumber: z.string().describe('Account number'),
      orderId: z.number().int().describe('Order ID (numeric)'),
    },
    async ({ accountNumber, orderId }) => {
      await getSchwab().trader.orders.cancelOrder({
        pathParams: { accountNumber, orderId },
      })
      return { content: [{ type: 'text', text: JSON.stringify({ status: 'cancelled', orderId }) }] }
    }
  )

  server.tool(
    'replaceOrder',
    'Replace (cancel and re-submit) an existing order with new parameters',
    {
      accountNumber: z.string().describe('Account number'),
      orderId: z.number().int().describe('Order ID (numeric)'),
      order: OrderBodySchema,
    },
    async ({ accountNumber, orderId, order }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (getSchwab().trader.orders.replaceOrder as unknown as (p: { pathParams: { accountNumber: string, orderId: number }, body: unknown }) => Promise<void>)({
        pathParams: { accountNumber, orderId },
        body: order,
      })
      return { content: [{ type: 'text', text: JSON.stringify({ status: 'order replaced', orderId }) }] }
    }
  )
}
