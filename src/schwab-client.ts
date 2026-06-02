import { createSchwabAuth, createApiClient } from '@sudowealth/schwab-api'
import { loadTokens, saveTokens } from './token-store.js'

type SchwabClient = Awaited<ReturnType<typeof createApiClient>>

let _auth: ReturnType<typeof createSchwabAuth> | null = null
let _schwab: SchwabClient | null = null

function getConfig() {
  const clientId = process.env.SCHWAB_CLIENT_ID
  const clientSecret = process.env.SCHWAB_CLIENT_SECRET
  const redirectUri = process.env.SCHWAB_REDIRECT_URI
  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error(
      'Schwab credentials not configured. ' +
      'Set SCHWAB_CLIENT_ID, SCHWAB_CLIENT_SECRET, and SCHWAB_REDIRECT_URI, ' +
      'then visit /auth to connect your account.'
    )
  }
  return { clientId, clientSecret, redirectUri }
}

function getAuth() {
  if (!_auth) {
    const { clientId, clientSecret, redirectUri } = getConfig()
    _auth = createSchwabAuth({
      oauthConfig: {
        clientId,
        clientSecret,
        redirectUri,
        load: loadTokens,
        save: saveTokens,
      },
    })
  }
  return _auth
}

export function getSchwab(): SchwabClient {
  if (!_schwab) {
    _schwab = createApiClient({
      auth: getAuth(),
      middleware: {
        rateLimit: { maxRequests: 100, windowMs: 60_000 },
        retry: { maxAttempts: 3, baseDelayMs: 1000 },
      },
    }) as SchwabClient
  }
  return _schwab
}

export async function getAuthUrl(): Promise<string> {
  const { authUrl } = await getAuth().getAuthorizationUrl()
  return authUrl
}

export async function exchangeCode(code: string): Promise<void> {
  await getAuth().exchangeCode(code)
}
