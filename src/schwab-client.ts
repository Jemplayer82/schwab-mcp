import { createSchwabAuth, createApiClient } from '@sudowealth/schwab-api'
import { loadTokens, saveTokens } from './token-store.js'
import type { TokenData } from './token-store.js'

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

const REFRESH_SKEW_MS = 5 * 60_000

function isFresh(t: TokenData | null): boolean {
  return !!t?.expiresAt && t.expiresAt - Date.now() > REFRESH_SKEW_MS
}

/**
 * Ensure the Schwab access token is fresh before an API call.
 *
 * Schwab access tokens live only ~30 minutes. The auth middleware is supposed to
 * refresh expiring tokens, but in this stateless per-request server that path
 * doesn't fire — so without this, the first run after ~30 min gets a 401 and the
 * user has to re-authorize at /auth. Here we proactively refresh using the stored
 * refresh token and persist it via the token store's save().
 *
 * This does NOT extend Schwab's 7-day refresh-token lifetime — a full re-auth at
 * /auth is still required weekly. It only removes the every-~30-minutes re-auth.
 */
export async function ensureFreshToken(): Promise<void> {
  const auth = getAuth()

  let data: TokenData | null = null
  try {
    data = await auth.getTokenData()
  } catch (err) {
    console.error('[schwab-mcp] could not load tokens:', err)
    return
  }

  // Not connected, or no refresh token (e.g. offline_access not granted): the
  // only remedy is a fresh login at /auth, so there is nothing to refresh here.
  if (!data?.refreshToken) return
  if (isFresh(data)) return

  // Preferred path: concurrency-safe refresh (honors the 5-min threshold + lock,
  // and persists via save()).
  try {
    await auth.refreshIfNeeded()
  } catch (err) {
    console.error('[schwab-mcp] refreshIfNeeded failed:', err)
  }

  // Fallback: if the token is still stale (e.g. already expired well past the
  // threshold and refreshIfNeeded chose not to act), force an explicit refresh
  // with the stored refresh token.
  try {
    const after = await auth.getTokenData()
    if (!isFresh(after) && after?.refreshToken) {
      await auth.refresh(after.refreshToken, { force: true })
    }
  } catch (err) {
    console.error('[schwab-mcp] forced token refresh failed:', err)
  }
}
