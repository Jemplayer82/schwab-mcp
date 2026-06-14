# schwab-mcp

> A Model Context Protocol (MCP) server that gives Claude and other MCP clients **direct access to your Charles Schwab brokerage account**. Query live quotes, account positions, orders, transaction history, option chains, and more — all through natural language.

**🔗 This is a fork of [sudowealth/schwab-mcp](https://github.com/sudowealth/schwab-mcp).** The core MCP server, tool definitions, and Schwab API integration are taken directly from that project. From that base I added Docker packaging, a multi-stage `Dockerfile`, a persistent on-disk token store, automatic background token refresh, and a stateless HTTP transport so it runs cleanly as a long-lived containerized service.

---

## 📚 Tools

### 💰 Accounts
| Tool | Description |
|------|-------------|
| `getAccounts` | Account balances and positions (`fields=positions` to include holdings) |
| `getAccountNumbers` | Account numbers and their encrypted hashes (needed for order placement) |

### 📊 Quotes & Market Data
| Tool | Description |
|------|-------------|
| `getQuotes` | Real-time quotes for one or more symbols (e.g. `AAPL,MSFT,TSLA`) |
| `getPriceHistory` | Historical OHLCV data — configurable period, frequency, extended hours |
| `getMarketHours` | Open/close status for equity, option, bond, future, and forex markets |
| `getMovers` | Top movers for a market index (`$SPX`, `$DJI`, `NYSE`, `NASDAQ`) |
| `searchInstruments` | Search for instruments by symbol or description |

### 📈 Options
| Tool | Description |
|------|-------------|
| `getOptionChain` | Full option chain with Greeks — filter by contract type, strike range, expiry, strategy |
| `getOptionExpirationChain` | Available expiration dates for a symbol |

### 📋 Orders
| Tool | Description |
|------|-------------|
| `getOrders` | Order history for an account — filter by date range and status |
| `getOrder` | Single order by ID |
| `placeOrder` | Submit a new equity or options order |
| `replaceOrder` | Cancel and re-submit an order with updated parameters |
| `cancelOrder` | Cancel an open order |

### 💸 Transactions
| Tool | Description |
|------|-------------|
| `getTransactions` | Transaction history — filter by type, date range, and symbol |

---

## 🚀 Prerequisites

1. **Schwab developer app** — Register at [developer.schwab.com](https://developer.schwab.com). You need a `Client ID`, `Client Secret`, and a registered callback URL.
2. **Docker** — For the containerized deployment.

> **⚠️ Note:** The callback URL must match `SCHWAB_REDIRECT_URI` exactly.  
> Local: `http://localhost:8000/callback`  
> Deployed: your public URL + `/callback`

---

## 🔧 Quick Start

### Docker (recommended)

```bash
docker run -d \
  --name schwab-mcp \
  -p 8000:8000 \
  -v schwab-tokens:/data \
  -e SCHWAB_CLIENT_ID=your_client_id \
  -e SCHWAB_CLIENT_SECRET=your_client_secret \
  -e SCHWAB_REDIRECT_URI=http://localhost:8000/callback \
  ghcr.io/jemplayer82/schwab-mcp:latest
```

### Docker Compose

```yaml
services:
  schwab-mcp:
    image: ghcr.io/jemplayer82/schwab-mcp:latest
    pull_policy: always
    ports:
      - "3105:8000"
    environment:
      SCHWAB_CLIENT_ID: ${SCHWAB_CLIENT_ID}
      SCHWAB_CLIENT_SECRET: ${SCHWAB_CLIENT_SECRET}
      SCHWAB_REDIRECT_URI: ${SCHWAB_REDIRECT_URI}
    volumes:
      - schwab-tokens:/data
    restart: unless-stopped

volumes:
  schwab-tokens:
```

### 🔐 Authorize Your Account

1. Open `http://localhost:8000/auth` (or your deployed URL) in a browser
2. Log in to Schwab and approve the connection
3. You'll land on a "Schwab connected!" confirmation page — close it and you're done

**Status check:** `GET /health` returns `{ status: "ok", authenticated: true/false }`

> **Weekly re-auth required** — Schwab refresh tokens expire after 7 days. Return to `/auth` once a week to re-authorize. The server handles the ~30-minute access token refresh automatically — you only need to re-auth for the weekly expiry.

---

## 🔌 MCP Client Configuration

#### Claude Code / Claude Desktop

```json
{
  "mcpServers": {
    "schwab": {
      "type": "http",
      "url": "http://localhost:8000/mcp"
    }
  }
}
```

Adjust the URL if running on a remote host or different port.

#### Claude Code CLI

```bash
claude mcp add schwab --transport http http://localhost:8000/mcp
```

---

## ⚙️ Environment Variables

| Variable | Required | Description |
|---|---|---|
| `SCHWAB_CLIENT_ID` | Yes | Client ID from developer.schwab.com |
| `SCHWAB_CLIENT_SECRET` | Yes | Client secret from developer.schwab.com |
| `SCHWAB_REDIRECT_URI` | Yes | OAuth callback URL (must match your app registration) |
| `PORT` | No | Port to listen on (default: `8000`) |
| `TOKEN_PATH` | No | Path to store OAuth tokens (default: `/data/tokens.json`) |

Token storage defaults to the `/data` volume so tokens survive container restarts.

---

## 💻 Development

```bash
npm install
npm run dev          # ts-node watch mode on port 8000
npm run build        # compile to dist/
npm start            # run compiled output
```

---

## 📝 Notes

- **Rate limiting** — 100 requests per 60-second window (Schwab API limit)
- **Retries** — Failed requests retry up to 3 times with exponential backoff
- **Stateless transport** — Each `POST /mcp` request creates and tears down its own MCP server instance. No session state is held in memory between requests
- **Token refresh** — Access tokens are refreshed every 10 minutes in the background so API calls never fail due to token expiry between the ~30-minute Schwab access token windows

---

## 🙏 Credits

- **[sudowealth/schwab-mcp](https://github.com/sudowealth/schwab-mcp)** — Original project this fork is based on. Core MCP server, tool definitions, and Schwab API integration come from there.
- [`@sudowealth/schwab-api`](https://www.npmjs.com/package/@sudowealth/schwab-api) — TypeScript Schwab API client and OAuth implementation
- [Anthropic MCP SDK](https://github.com/modelcontextprotocol/typescript-sdk) — MCP server transport layer

---

**Use at your own risk.** Not financial advice.
