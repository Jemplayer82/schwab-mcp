import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { schwab } from '../schwab-client.js'

export function registerMarketTools(server: McpServer): void {
  server.tool(
    'searchInstruments',
    'Search for instruments by symbol or description',
    {
      symbol: z.string().describe('Symbol or search string'),
      projection: z.enum(['symbol-search', 'symbol-regex', 'desc-search', 'desc-regex', 'search', 'fundamental'])
        .optional()
        .default('symbol-search')
        .describe('Search projection type'),
    },
    async ({ symbol, projection }) => {
      const results = await schwab.marketData.instruments.getInstruments({
        queryParams: { symbol, projection },
      })
      return { content: [{ type: 'text', text: JSON.stringify(results, null, 2) }] }
    }
  )

  server.tool(
    'getPriceHistory',
    'Get historical OHLCV price data for a symbol',
    {
      symbol: z.string().describe('Symbol, e.g. AAPL'),
      periodType: z.enum(['day', 'month', 'year', 'ytd']).optional().default('month'),
      period: z.number().int().optional().describe('Number of periods (default varies by periodType)'),
      frequencyType: z.enum(['minute', 'daily', 'weekly', 'monthly']).optional(),
      frequency: z.number().int().optional().describe('Frequency multiplier'),
      startDate: z.number().int().optional().describe('Start date as Unix epoch ms'),
      endDate: z.number().int().optional().describe('End date as Unix epoch ms'),
      needExtendedHoursData: z.boolean().optional().describe('Include pre/post market data'),
    },
    async ({ symbol, periodType, period, frequencyType, frequency, startDate, endDate, needExtendedHoursData }) => {
      const queryParams: Record<string, unknown> = { symbol }
      if (periodType) queryParams['periodType'] = periodType
      if (period !== undefined) queryParams['period'] = period
      if (frequencyType) queryParams['frequencyType'] = frequencyType
      if (frequency !== undefined) queryParams['frequency'] = frequency
      if (startDate !== undefined) queryParams['startDate'] = startDate
      if (endDate !== undefined) queryParams['endDate'] = endDate
      if (needExtendedHoursData !== undefined) queryParams['needExtendedHoursData'] = needExtendedHoursData

      const history = await schwab.marketData.priceHistory.getPriceHistory({ queryParams })
      return { content: [{ type: 'text', text: JSON.stringify(history, null, 2) }] }
    }
  )

  server.tool(
    'getMarketHours',
    'Get market hours for one or more markets',
    {
      markets: z.string().describe("Comma-separated markets, e.g. 'equity,option,bond,future,forex'"),
      date: z.string().optional().describe('Date in YYYY-MM-DD format (defaults to today)'),
    },
    async ({ markets, date }) => {
      const queryParams: Record<string, unknown> = { markets: markets.split(',').map(m => m.trim()) }
      if (date) queryParams['date'] = date

      const hours = await schwab.marketData.marketHours.getMarketHours({ queryParams })
      return { content: [{ type: 'text', text: JSON.stringify(hours, null, 2) }] }
    }
  )

  server.tool(
    'getMovers',
    'Get top movers for a market index',
    {
      symbolId: z.string().describe("Index symbol, e.g. '$SPX', '$COMPX', '$DJI', 'NYSE', 'NASDAQ', 'OTCBB'"),
      sort: z.enum(['VOLUME', 'TRADES', 'PERCENT_CHANGE_UP', 'PERCENT_CHANGE_DOWN']).optional().describe('Sort order'),
      frequency: z.number().int().optional().describe('Frequency in minutes (0 for all-day)'),
    },
    async ({ symbolId, sort, frequency }) => {
      const queryParams: Record<string, unknown> = {}
      if (sort) queryParams['sort'] = sort
      if (frequency !== undefined) queryParams['frequency'] = frequency

      const movers = await schwab.marketData.movers.getMovers({
        pathParams: { symbol_id: symbolId },
        queryParams,
      })
      return { content: [{ type: 'text', text: JSON.stringify(movers, null, 2) }] }
    }
  )

  server.tool(
    'getOptionChain',
    'Get option chain with Greeks for a symbol',
    {
      symbol: z.string().describe('Underlying symbol, e.g. AAPL'),
      contractType: z.enum(['CALL', 'PUT', 'ALL']).optional().default('ALL'),
      strikeCount: z.number().int().optional().describe('Number of strikes above/below ATM'),
      includeUnderlyingQuote: z.boolean().optional(),
      strategy: z.enum(['SINGLE', 'ANALYTICAL', 'COVERED', 'VERTICAL', 'CALENDAR', 'STRANGLE', 'STRADDLE', 'BUTTERFLY', 'CONDOR', 'DIAGONAL', 'COLLAR', 'ROLL']).optional(),
      range: z.enum(['ITM', 'NTM', 'OTM', 'SAK', 'SBK', 'SNK', 'ALL']).optional(),
      fromDate: z.string().optional().describe('Expiration from date YYYY-MM-DD'),
      toDate: z.string().optional().describe('Expiration to date YYYY-MM-DD'),
      expMonth: z.string().optional().describe('Expiration month e.g. JAN'),
    },
    async ({ symbol, contractType, strikeCount, includeUnderlyingQuote, strategy, range, fromDate, toDate, expMonth }) => {
      const queryParams: Record<string, unknown> = { symbol }
      if (contractType) queryParams['contractType'] = contractType
      if (strikeCount !== undefined) queryParams['strikeCount'] = strikeCount
      if (includeUnderlyingQuote !== undefined) queryParams['includeUnderlyingQuote'] = includeUnderlyingQuote
      if (strategy) queryParams['strategy'] = strategy
      if (range) queryParams['range'] = range
      if (fromDate) queryParams['fromDate'] = fromDate
      if (toDate) queryParams['toDate'] = toDate
      if (expMonth) queryParams['expMonth'] = expMonth

      const chain = await schwab.marketData.options.getOptionChain({ queryParams })
      return { content: [{ type: 'text', text: JSON.stringify(chain, null, 2) }] }
    }
  )

  server.tool(
    'getOptionExpirationChain',
    'Get available expiration dates for an option chain',
    {
      symbol: z.string().describe('Underlying symbol, e.g. AAPL'),
    },
    async ({ symbol }) => {
      const chain = await schwab.marketData.options.getOptionExpirationChain({
        queryParams: { symbol },
      })
      return { content: [{ type: 'text', text: JSON.stringify(chain, null, 2) }] }
    }
  )
}
