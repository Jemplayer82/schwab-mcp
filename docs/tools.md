# `$ schwab-mcp tools`

These are the actions your AI assistant can ask the server to perform. Reading data (quotes, balances, history) is separate from changing things (`placeOrder`, `replaceOrder`, `cancelOrder`).

### ACCOUNTS

| Tool | Description |
|------|-------------|
| `getAccounts` | Account balances and positions (`fields=positions` to include holdings) |
| `getAccountNumbers` | Account numbers and their encrypted hashes (needed for order placement) |

### QUOTES & MARKET DATA

| Tool | Description |
|------|-------------|
| `getQuotes` | Real-time quotes for one or more symbols (e.g. `AAPL,MSFT,TSLA`) |
| `getPriceHistory` | Historical OHLCV data — configurable period, frequency, extended hours |
| `getMarketHours` | Open/close status for equity, option, bond, future, and forex markets |
| `getMovers` | Top movers for a market index (`$SPX`, `$DJI`, `NYSE`, `NASDAQ`) |
| `searchInstruments` | Search for instruments by symbol or description |

### OPTIONS

| Tool | Description |
|------|-------------|
| `getOptionChain` | Full option chain with Greeks — filter by contract type, strike range, expiry, strategy |
| `getOptionExpirationChain` | Available expiration dates for a symbol |

### ORDERS

| Tool | Description |
|------|-------------|
| `getOrders` | Order history for an account — filter by date range and status |
| `getOrder` | Single order by ID |
| `placeOrder` | Submit a new equity or options order |
| `replaceOrder` | Cancel and re-submit an order with updated parameters |
| `cancelOrder` | Cancel an open order |

### TRANSACTIONS

| Tool | Description |
|------|-------------|
| `getTransactions` | Transaction history — filter by type, date range, and symbol |
