import { createSchwabAuth, createApiClient } from '@sudowealth/schwab-api'
import { loadTokens, saveTokens } from './token-store.js'
import type { TokenData } from './token-store.js'

// Minimum time remaining on an access token before we consider it "stale" and refresh
const REFRESH_SKEW_MS = 5 * 60_000

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

function isFresh(t: TokenData | null): boolean {
  return !!t?.expiresAt && t.expiresAt - Date.now() > REFRESH_SKEW_MS
}

/**
 * Ensure the Schwab access token is fresh before an API call.
 *
 * Schwab access tokens live only ~30 minutes. Without this, the first run after
 * ~30 min gets a 401 and the user has to re-authorize at /auth every half hour.
 *
 * ⚠️ We deliberately do NOT trust `auth.getTokenData()` for the freshness check.
 * The library's EnhancedTokenManager keeps the original `expires_in` (1800s) in
 * memory and recomputes expiry as `Date.now() + expires_in` on EVERY call — so an
 * in-memory token always *looks* like it has a full 30 min left, no matter how
 * long ago it was actually issued. That makes `refreshIfNeeded()` a no-op and the
 * token silently dies. (Bug in @sudowealth/schwab-api's mapToTokenData.)
 *
 * Instead we read the REAL absolute `expiresAt` straight from disk (token store),
 * and when it's stale we FORCE a refresh — `force: true` bypasses the library's
 * broken expiry check and always hits Schwab's token endpoint, persisting the new
 * token (with a correct expiresAt) via save().
 *
 * This does NOT extend Schwab's 7-day refresh-token lifetime — a full re-auth at
 * /auth is still required weekly. It only removes the every-~30-minutes re-auth.
 */
export async function ensureFreshToken(): Promise<void> {
  // Read the REAL expiry from disk, not the library's in-memory (lying) copy.
  let stored: TokenData | null = null
  try {
    stored = await loadTokens()
  } catch (err) {
    console.error('[schwab-mcp] could not load tokens:', err)
    return
  }

  // Not connected, or no refresh token (e.g. offline_access not granted): the
  // only remedy is a fresh login at /auth, so there is nothing to refresh here.
  if (!stored?.refreshToken) return
  if (isFresh(stored)) return

  // Disk token is expiring/expired. Force a real network refresh — force:true
  // sidesteps the library's broken in-memory freshness check and always calls
  // Schwab, then persists the new token to disk via saveTokens().
  try {
    await getAuth().refresh(stored.refreshToken, { force: true })
    console.log('[schwab-mcp] access token refreshed')
  } catch (err) {
    console.error('[schwab-mcp] forced token refresh failed (re-auth may be needed):', err)
  }
}
