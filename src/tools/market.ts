import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { getSchwab } from '../schwab-client.js'
import { loadTokens } from '../token-store.js'

const SCHWAB_API_BASE = 'https://api.schwabapi.com'

/**
 * Authenticated GET against the Schwab market-data API, bypassing
 * @sudowealth/schwab-api's response validation.
 *
 * ⚠️ Needed because the library's zod response schemas are stricter than what
 * Schwab actually returns: /marketdata/v1/chains responds with
 * `underlying: null` and `optionDeliverablesList[].currencyType: null`, but the
 * schemas mark those `.optional()` (absent-only) rather than `.nullable()`, so
 * EVERY option-chain call throws "Invalid response data structure" after a
 * perfectly good fetch. Unfixed upstream as of 2.1.1 (build-only release). The
 * response is passed through verbatim — this server only JSON-stringifies tool
 * results anyway, so the validation bought nothing but the outage.
 *
 * The access token is fresh here: server.ts runs ensureFreshToken() before
 * every POST /mcp (and on a 10-minute interval).
 */
async function rawMarketDataGet(
  path: string,
  params: Record<string, string | number | boolean | undefined>
): Promise<unknown> {
  const tokens = await loadTokens()
  if (!tokens?.accessToken) {
    throw new Error('Schwab not connected — authorize at /auth first')
  }
  const qs = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) qs.set(key, String(value))
  }
  const res = await fetch(`${SCHWAB_API_BASE}${path}?${qs}`, {
    headers: { Authorization: `Bearer ${tokens.accessToken}`, Accept: 'application/json' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Schwab API ${res.status} for GET ${path}: ${body.slice(0, 300)}`)
  }
  return res.json()
}

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
      // Raw fetch, NOT the library's typed endpoint — see rawMarketDataGet's
      // header comment. The library's response schema is a discriminated
      // union keyed on assetType where only the (never-actually-returned)
      // literal assetType "FUNDAMENTAL" carries a `fundamental` field. Real
      // fundamental-projection results come back as assetType "EQUITY"/"ETF"
      // etc with a `fundamental` block attached, so the union matches the
      // EQUITY branch (no `fundamental` field) and Zod silently strips the
      // whole block — only bare identity fields ever came back.
      const results = await rawMarketDataGet('/marketdata/v1/instruments', { symbol, projection })
      return { content: [{ type: 'text', text: JSON.stringify(results, null, 2) }] }
    }
  )

  server.tool(
    'getPriceHistory',
    'Get historical OHLCV price data for a symbol',
    {
      symbol: z.string().describe('Symbol, e.g. AAPL'),
      periodType: z.enum(['day', 'month', 'year', 'ytd']).optional().default('month'),
      period: z.number().int().optional().describe('Number of periods'),
      frequencyType: z.enum(['minute', 'daily', 'weekly', 'monthly']).optional(),
      frequency: z.number().int().optional().describe('Frequency multiplier'),
      startDate: z.number().int().optional().describe('Start date as Unix epoch ms'),
      endDate: z.number().int().optional().describe('End date as Unix epoch ms'),
      needExtendedHoursData: z.boolean().optional().describe('Include pre/post market data'),
    },
    async ({ symbol, periodType, period, frequencyType, frequency, startDate, endDate, needExtendedHoursData }) => {
      const history = await getSchwab().marketData.priceHistory.getPriceHistory({
        queryParams: {
          symbol,
          frequency: frequency ?? 1,
          ...(periodType && { periodType }),
          ...(period !== undefined && { period }),
          ...(frequencyType && { frequencyType }),
          ...(startDate !== undefined && { startDate }),
          ...(endDate !== undefined && { endDate }),
          ...(needExtendedHoursData !== undefined && { needExtendedHoursData }),
        },
      })
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
      type Market = 'equity' | 'option' | 'bond' | 'future' | 'forex'
      const marketList = markets.split(',').map(m => m.trim() as Market)
      const hours = await getSchwab().marketData.marketHours.getMarketHours({
        queryParams: {
          markets: marketList,
          ...(date && { date: new Date(date) }),
        },
      })
      return { content: [{ type: 'text', text: JSON.stringify(hours, null, 2) }] }
    }
  )

  server.tool(
    'getMovers',
    'Get top movers for a market index',
    {
      symbolId: z.string().describe("Index symbol, e.g. '$SPX', '$COMPX', '$DJI', 'NYSE', 'NASDAQ'"),
      sort: z.enum(['up', 'down']).optional().default('up').describe('Sort direction'),
      frequency: z.number().int().optional().describe('Frequency in minutes (0 for all-day)'),
    },
    async ({ symbolId, sort, frequency }) => {
      const movers = await getSchwab().marketData.movers.getMovers({
        pathParams: { symbol_id: symbolId },
        queryParams: {
          sort: sort ?? 'up',
          ...(frequency !== undefined && { frequency }),
        },
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
      expMonth: z.enum(['ALL', 'JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']).optional().describe('Expiration month'),
    },
    async ({ symbol, contractType, strikeCount, includeUnderlyingQuote, strategy, range, fromDate, toDate, expMonth }) => {
      // Raw fetch, NOT the library's typed endpoint — see rawMarketDataGet's
      // header comment (the library's response schema rejects Schwab's live
      // nulls and made every chain call fail).
      const chain = await rawMarketDataGet('/marketdata/v1/chains', {
        symbol,
        contractType,
        strikeCount,
        includeUnderlyingQuote,
        strategy,
        range,
        fromDate,
        toDate,
        expMonth,
      })
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
      // Raw fetch for the same reason as getOptionChain: don't let the
      // library's over-strict response schema turn a good fetch into an error.
      const chain = await rawMarketDataGet('/marketdata/v1/expirationchain', { symbol })
      return { content: [{ type: 'text', text: JSON.stringify(chain, null, 2) }] }
    }
  )
}
