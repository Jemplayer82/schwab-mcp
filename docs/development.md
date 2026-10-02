# `$ schwab-mcp development`

## `[ build and run from source ]`

Use this if you want to change the code instead of running the ready-made Docker image.

```bash
$ npm install
$ npm run dev    # ts-node watch mode on port 8000
$ npm run build  # compile to dist/
$ npm start      # run compiled output
```

## `[ how it behaves ]`

- **Rate limiting** — 100 requests per 60-second window (Schwab API limit)
- **Retries** — Failed requests retry up to 3 times with exponential backoff
- **Stateless transport** — Each `POST /mcp` request creates and tears down its own MCP server instance. No session state is held in memory between requests
- **Token refresh** — Access tokens are refreshed every 10 minutes in the background so API calls never fail due to token expiry between the ~30-minute Schwab access token windows

## `[ credits ]`

- **[sudowealth/schwab-mcp](https://github.com/sudowealth/schwab-mcp)** — Original project this fork is based on. Core MCP server, tool definitions, and Schwab API integration come from there.
- [`@sudowealth/schwab-api`](https://www.npmjs.com/package/@sudowealth/schwab-api) — TypeScript Schwab API client and OAuth implementation
- [Anthropic MCP SDK](https://github.com/modelcontextprotocol/typescript-sdk) — MCP server transport layer
