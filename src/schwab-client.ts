import { createSchwabAuth, createApiClient } from '@sudowealth/schwab-api'
import { loadTokens, saveTokens } from './token-store.js'

const clientId = process.env.SCHWAB_CLIENT_ID
const clientSecret = process.env.SCHWAB_CLIENT_SECRET
const redirectUri = process.env.SCHWAB_REDIRECT_URI

if (!clientId || !clientSecret || !redirectUri) {
  throw new Error('SCHWAB_CLIENT_ID, SCHWAB_CLIENT_SECRET, and SCHWAB_REDIRECT_URI must be set')
}

export const auth = createSchwabAuth({
  oauthConfig: {
    clientId,
    clientSecret,
    redirectUri,
    load: loadTokens,
    save: saveTokens,
  },
})

export const schwab = createApiClient({
  auth,
  middleware: {
    rateLimit: { maxRequests: 100, windowMs: 60_000 },
    retry: { maxAttempts: 3, baseDelayMs: 1000 },
  },
})

export async function getAuthUrl(): Promise<string> {
  const { authUrl } = await auth.getAuthorizationUrl()
  return authUrl
}

export async function exchangeCode(code: string): Promise<void> {
  await auth.exchangeCode(code)
}
